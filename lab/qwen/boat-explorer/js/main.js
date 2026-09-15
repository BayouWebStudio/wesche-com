// js/main.js — Golden Wake: orchestrates ocean, boat physics, islands, camera, HUD
import * as THREE from 'three';
import { waveSample } from './waves.js';
import { makeOcean, makeSky, makeSunSprite, SUN_DIR } from './ocean.js';
import { makeIsland, islandHeight, pickName } from './islands.js';
import { makeBoat } from './boat.js';

// ---------- boot ----------
const canvas = document.getElementById('cv');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance',
  preserveDrawingBuffer: true, // enables offline/headless capture; negligible cost
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(0, 6, -14);

scene.add(makeSky());
scene.add(makeSunSprite());
const ocean = makeOcean();
scene.add(ocean);

// lighting: warm low sun + cool sky fill + warm hemisphere bounce
const sun = new THREE.DirectionalLight(0xffc27a, 2.6);
sun.position.copy(SUN_DIR).multiplyScalar(100);
scene.add(sun);
scene.add(new THREE.AmbientLight(0x35204a, 0.9));
scene.add(new THREE.HemisphereLight(0xff9a55, 0x14202e, 0.85));
// cool fill from the opposite side so islands aren't flat silhouettes
const fill = new THREE.DirectionalLight(0x7fa8d8, 0.75);
fill.position.set(60, 40, 80);
scene.add(fill);

// ---------- islands ----------
const islands = [];           // active islands
const ISL_SPACING = 210;    // world is chunked into a grid of this size
const CHUNK = ISL_SPACING;
const loaded = new Map();     // "cx,cz" -> island

function chunkIsland(cx, cz) {
  // deterministic per-chunk RNG
  let s = (cx * 73856093) ^ (cz * 19349663);
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const r = rnd();
  if (r < 0.24) return null;              // empty ocean chunk
  const x = cx * CHUNK + (rnd() - 0.5) * CHUNK * 0.7;
  const z = cz * CHUNK + (rnd() - 0.5) * CHUNK * 0.7;
  if (Math.abs(x) < 60 && Math.abs(z) < 60) return null; // spawn area clear
  const seed = ((cx * 9176 + cz * 6817279) ^ 0x9e3779b9) >>> 0;
  const isl = makeIsland(x, z, seed);
  isl.name = pickName(seed % 15);
  return isl;
}

function streamIslands(px, pz) {
  const pcx = Math.round(px / CHUNK), pcz = Math.round(pz / CHUNK);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const key = `${pcx + dx},${pcz + dz}`;
    if (loaded.has(key)) continue;
    const isl = chunkIsland(pcx + dx, pcz + dz);
    loaded.set(key, isl);
    if (isl) { scene.add(isl.mesh); islands.push(isl); }
  }
  // unload far chunks
  for (const [key, isl] of loaded) {
    const [cx, cz] = key.split(',').map(Number);
    if (Math.abs(cx - pcx) > 2 || Math.abs(cz - pcz) > 2) {
      if (isl) { scene.remove(isl.mesh); const i = islands.indexOf(isl); if (i >= 0) islands.splice(i, 1); }
      loaded.delete(key);
    }
  }
  refreshIslandUniforms();
}

function refreshIslandUniforms() {
  const u = ocean.userData.mat.uniforms;
  // sort by distance to camera-ish (use boat pos)
  const sorted = islands.slice().sort((a, b) =>
    (a.x - boat.pos.x) ** 2 + (a.z - boat.pos.z) ** 2 - ((b.x - boat.pos.x) ** 2 + (b.z - boat.pos.z) ** 2));
  const n = Math.min(sorted.length, 6);
  for (let i = 0; i < 6; i++) {
    if (i < n) u.uIslands.value[i].set(sorted[i].x, sorted[i].z, sorted[i].R1, sorted[i].R2);
    else u.uIslands.value[i].set(0, 0, 1e9, 1e9 + 1);
  }
  u.uIslCount.value = n;
}

// ---------- boat physics ----------
const boatObj = makeBoat();
scene.add(boatObj.root);
const boat = {
  pos: new THREE.Vector3(0, 0, 0),
  yaw: Math.PI * 0.15,
  speed: 0,               // knots-ish forward
  helm: 0,              // -1..1 rudder
  throttle: 0,          // 0..1
  vy: 0,
  pitch: 0, roll: 0,
  grounded: false,
  discovered: 0,
};

// ---------- wake particles ----------
const WAKE_N = 22;
const wakeArr = ocean.userData.mat.uniforms.uWake.value;
let wakeHead = 0, wakeTimer = 0;
function emitWake(x, z, strength) {
  wakeArr[wakeHead].set(x, z, 2.2 + strength * 4.4, Math.min(1, 0.45 + strength));
  wakeHead = (wakeHead + 1) % WAKE_N;
  ocean.userData.mat.uniforms.uWakeCount.value = WAKE_N;
}

// bow spray: world-space points
const SPRAY_N = 90;
const sprayPos = new Float32Array(SPRAY_N * 3);
const sprayVel = new Float32Array(SPRAY_N * 3);
const sprayLife = new Float32Array(SPRAY_N).fill(0);
const sprayGeo = new THREE.BufferGeometry();
sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
const spray = new THREE.Points(sprayGeo, new THREE.PointsMaterial({
  color: 0xffe8c8, size: 0.22, transparent: true, opacity: 0.85,
  depthWrite: false, sizeAttenuation: true,
}));
spray.frustumCulled = false;
scene.add(spray);
let sprayHead = 0;
function sprayBurst(n, x, y, z, spread, up) {
  for (let i = 0; i < n; i++) {
    sprayHead = (sprayHead + 1) % SPRAY_N;
    const h = sprayHead * 3;
    sprayPos[h] = x; sprayPos[h + 1] = y; sprayPos[h + 2] = z;
    sprayVel[h] = (Math.random() - 0.5) * spread;
    sprayVel[h + 1] = Math.random() * up + 1.2;
    sprayVel[h + 2] = (Math.random() - 0.5) * spread;
    sprayLife[sprayHead] = 0.7 + Math.random() * 0.5;
  }
}

// ---------- birds (ambient life) ----------
const birds = [];
const birdGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-0.5, 0, 0), new THREE.Vector3(0, 0.18, 0), new THREE.Vector3(0.5, 0, 0)]);
const birdMat = new THREE.LineBasicMaterial({ color: 0x2a1a20, transparent: true, opacity: 0.85 });
for (let i = 0; i < 7; i++) {
  const b = new THREE.Line(birdGeo, birdMat);
  b.frustumCulled = false;
  b.userData = { cx: (Math.random() - 0.5) * 400, cz: (Math.random() - 0.5) * 400,
    r: 22 + Math.random() * 40, a: Math.random() * 6.28, s: 0.25 + Math.random() * 0.3,
    y: 14 + Math.random() * 18 };
  scene.add(b); birds.push(b);
}

// ---------- input ----------
const IN = { fwd: 0, turn: 0, boost: false, brake: false };
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyC') cycleCamera();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => keys[e.code] = false);

function readInput() {
  let fwd = 0, turn = 0;
  if (keys['KeyW'] || keys['ArrowUp']) fwd += 1;
  if (keys['KeyS'] || keys['ArrowDown']) fwd -= 1;
  if (keys['KeyA'] || keys['ArrowLeft']) turn -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) turn += 1;
  // touch joystick overrides/adds
  fwd = THREE.MathUtils.clamp(fwd + IN.fwd, -1, 1);
  turn = THREE.MathUtils.clamp(turn + IN.turn, -1, 1);
  const boost = IN.boost || keys['ShiftLeft'] || keys['ShiftRight'];
  const brake = IN.brake || keys['Space'];
  return { fwd, turn, boost, brake };
}

// touch joystick
const stickZone = document.getElementById('stickZone');
const stick = document.getElementById('stick');
const knob = document.getElementById('knob');
let stickPid = null, stickOrigin = { x: 0, y: 0 };
const STICK_R = 46;
stickZone.addEventListener('pointerdown', e => {
  if (stickPid !== null) return;
  stickPid = e.pointerId;
  stickOrigin = { x: e.clientX, y: e.clientY };
  stick.style.left = (e.clientX - 59) + 'px';
  stick.style.top = (e.clientY - 59) + 'px';
  stick.classList.add('show');
  knob.style.transform = 'translate(-50%,-50%)';
  stickZone.setPointerCapture(e.pointerId);
});
stickZone.addEventListener('pointermove', e => {
  if (e.pointerId !== stickPid) return;
  let dx = e.clientX - stickOrigin.x, dy = e.clientY - stickOrigin.y;
  const len = Math.hypot(dx, dy);
  const cl = Math.min(len, STICK_R);
  const nx = len > 0 ? dx / len : 0, ny = len > 0 ? dy / len : 0;
  knob.style.transform = `translate(calc(-50% + ${nx * cl}px), calc(-50% + ${ny * cl}px))`;
  IN.turn = (nx * cl) / STICK_R;
  IN.fwd = -(ny * cl) / STICK_R;
});
function stickEnd(e) {
  if (e.pointerId !== stickPid) return;
  stickPid = null; IN.turn = 0; IN.fwd = 0;
  stick.classList.remove('show');
}
stickZone.addEventListener('pointerup', stickEnd);
stickZone.addEventListener('pointercancel', stickEnd);

function bindHold(el, prop) {
  el.addEventListener('pointerdown', e => { IN[prop] = true; el.classList.add('held'); el.setPointerCapture(e.pointerId); });
  const off = e => { IN[prop] = false; el.classList.remove('held'); };
  el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off);
}
bindHold(document.getElementById('boostBtn'), 'boost');
bindHold(document.getElementById('brakeBtn'), 'brake');
document.getElementById('camBtn').addEventListener('pointerdown', cycleCamera);
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

// ---------- camera ----------
let camMode = 0; // 0 chase, 1 close, 2 orbit-cinematic, 3 bow-cam
const CAM_MODES = [
  { dist: 11.5, height: 4.6, lag: 3.2, lookUp: 1.6 },
  { dist: 7.0, height: 2.6, lag: 4.5, lookUp: 1.2 },
  { dist: 16.0, height: 7.0, lag: 1.2, lookUp: 1.0 },
  { dist: -1.2, height: 2.3, lag: 6.0, lookUp: 0.4 },
];
function cycleCamera() { camMode = (camMode + 1) % CAM_MODES.length; }
const camSmooth = new THREE.Vector3(0, 6, -14);
const lookSmooth = new THREE.Vector3();

// ---------- HUD ----------
const $ = id => document.getElementById(id);
const spdVal = $('spdVal'), spdBar = $('spdBar'), cdir = $('cdir'), chdg = $('chdg');
const foundN = $('foundN'), toast = $('toast'), toastName = $('toastName'), toastBc = $('toastBc');
const mmCtx = $('mm').getContext('2d');
function compass(yaw) {
  // yaw=0 faces +Z; map to compass degrees (N=+Z)
  let deg = ((yaw * 180 / Math.PI) % 360 + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return { deg, dir: dirs[Math.round(deg / 45) % 8] };
}
let toastTimer = null;
function showToast(name, bc) {
  toastName.textContent = name; toastBc.textContent = bc;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3400);
}
function drawMinimap() {
  const c = mmCtx, S = 256, R = 128, scale = R / 320; // 320 world units -> edge
  c.clearRect(0, 0, S, S);
  c.fillStyle = 'rgba(10,20,34,0.72)'; c.beginPath(); c.arc(R, R, R, 0, 6.29); c.fill();
  c.save(); c.translate(R, R); c.rotate(-boat.yaw);
  for (const isl of islands) {
    const dx = (isl.x - boat.pos.x) * scale, dz = -(isl.z - boat.pos.z) * scale;
    if (Math.hypot(dx, dz) > R - 4) continue;
    c.beginPath();
    c.fillStyle = isl.discovered ? 'rgba(90,190,110,0.9)' : 'rgba(120,110,140,0.55)';
    c.arc(dx, dz, Math.max(3.5, isl.R1 * scale), 0, 6.29); c.fill();
  }
  c.restore();
  // boat arrow
  c.save(); c.translate(R, R);
  c.fillStyle = '#ffcf7a';
  c.beginPath(); c.moveTo(0, -8); c.lineTo(5.5, 6); c.lineTo(0, 3); c.lineTo(-5.5, 6); c.closePath(); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(255,200,140,0.35)'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(R, R, R - 1, 0, 6.29); c.stroke();
}

// ---------- audio: gentle ocean wash + sail snap (WebAudio, gesture-gated) ----------
let AC = null;
function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    // filtered noise = surf
    const len = AC.sampleRate * 2;
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = AC.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 420; filt.Q.value = 0.8;
    const gain = AC.createGain(); gain.gain.value = 0.05;
    const lfo = AC.createOscillator(); lfo.frequency.value = 0.13;
    const lfoGain = AC.createGain(); lfoGain.gain.value = 180;
    lfo.connect(lfoGain); lfoGain.connect(filt.frequency);
    // shore proximity raises surf volume
    AC.destination && src.connect(filt); filt.connect(gain); gain.connect(AC.destination);
    src.start(); lfo.start();
    AC.surfGain = gain;
  } catch (e) { /* audio optional */ }
}

// ---------- game state / loop ----------
const G = { running: false, time: 0, fps: 60 };
let last = performance.now();
let stepOverride = null; // for headless deterministic stepping

function update(dt) {
  G.time += dt;
  const t = G.time;
  const inp = readInput();

  // throttle & turn rate scale with speed for satisfying heeling feel
  if (inp.fwd > 0) boat.throttle = Math.min(1, boat.throttle + dt * 0.55);
  else if (inp.fwd < 0) boat.throttle = Math.max(-0.4, boat.throttle - dt * 0.8);
  else boat.throttle *= (1 - dt * 0.25);

  const boost = inp.boost ? 1.55 : 1.0;
  const target = boat.throttle * 7.8 * boost;
  if (inp.brake) {
    boat.speed *= (1 - dt * 1.8);
  } else {
    boat.speed += (target - boat.speed) * Math.min(1, dt * (boat.speed < target ? 0.7 : 1.1));
  }
  boat.speed = THREE.MathUtils.clamp(boat.speed, -3, 12);

  // rudder: authority grows with speed, drifts back to center
  boat.helm += (inp.turn - boat.helm) * Math.min(1, dt * 6);
  const steerRate = 0.9 * boat.helm * THREE.MathUtils.clamp(Math.abs(boat.speed) / 4, 0.25, 1) * Math.sign(boat.speed || 1);
  boat.yaw += steerRate * dt;

  // move
  const fx = Math.sin(boat.yaw), fz = Math.cos(boat.yaw);
  const nx = boat.pos.x + fx * boat.speed * dt * 0.5144 * 2.0; // knots -> m/s, arcade scale
  const nz = boat.pos.z + fz * boat.speed * dt * 0.5144 * 2.0;

  // island collision: heightfield — solid ground beaches the hull
  let blocked = false;
  for (const isl of islands) {
    const d = Math.hypot(nx - isl.x, nz - isl.z);
    if (d < isl.R1 * 1.12) {
      const h = islandHeight(isl, nx, nz);
      if (h > 0.35) { blocked = true; }
    }
  }
  // reversing off the beach always works
  if (blocked && boat.speed < -0.4) blocked = false;
  boat.grounded = blocked;
  if (blocked) {
    // beach: halt forward motion, settle on the sand; spray kicks at the hull
    boat.speed *= 0.22;
    if (boat.throttle > 0.25 && Math.random() < 0.35) sprayBurst(2, nx, 0.5, nz, 1.4, 1.6);
  } else {
    boat.pos.x = nx; boat.pos.z = nz;
  }

  // wave sample with island shelter
  let shelter = 1.0;
  for (const isl of islands) {
    const d = Math.hypot(boat.pos.x - isl.x, boat.pos.z - isl.z);
    const sh = THREE.MathUtils.smoothstep(d, isl.R1, isl.R2);
    shelter = Math.min(shelter, sh);
  }
  const ws = waveSample(boat.pos.x, boat.pos.z, t, shelter);
  // resting height: on sand the hull settles onto the terrain under it; else float on the water
  let groundY = -1;
  if (boat.grounded) {
    for (const isl of islands) groundY = Math.max(groundY, islandHeight(isl, boat.pos.x, boat.pos.z));
    if (groundY < 0) groundY = 0.15;
  }
  const targetY = boat.grounded ? Math.max(ws.y, groundY + 0.1) : ws.y;
  boat.pos.y += (targetY - boat.pos.y) * Math.min(1, dt * 7);

  // pitch/roll from wave slopes + turn banking
  const tPitch = THREE.MathUtils.clamp(-ws.slopeX * fx - ws.slopeZ * fz, -0.4, 0.4) * 1.4;
  const crossSlope = (-ws.slopeX * fz + ws.slopeZ * fx);
  const tRoll = THREE.MathUtils.clamp(crossSlope * 1.6, -0.45, 0.45) + (-steerRate * Math.abs(boat.speed) * 0.035);
  boat.pitch += (tPitch - boat.pitch) * Math.min(1, dt * 4.2);
  boat.roll += (tRoll - boat.roll) * Math.min(1, dt * 3.6);

  // place boat
  boatObj.root.position.copy(boat.pos);
  boatObj.root.rotation.y = boat.yaw;
  boatObj.bob.rotation.set(boat.pitch, 0, boat.roll);
  boatObj.animate(t, Math.abs(boat.speed) / 8, boat.speed, boat.helm);

  // wake emission: twin trails from the stern quarters => V-wake
  wakeTimer -= dt;
  if (Math.abs(boat.speed) > 0.6 && !boat.grounded && wakeTimer <= 0) {
    const sx = boat.pos.x - fx * 1.7, sz = boat.pos.z - fz * 1.7;
    // port & starboard quarter points, spreading with speed
    const spread = 0.6 + Math.abs(boat.speed) * 0.05;
    emitWake(sx - fz * spread, sz + fx * spread, Math.abs(boat.speed) / 9);
    emitWake(sx + fz * spread, sz - fx * spread, Math.abs(boat.speed) / 9);
    wakeTimer = 0.16;
  }
  // bow spray at speed
  if (boat.speed > 4.5 && !boat.grounded && Math.random() < boat.speed / 30) {
    sprayBurst(2, boat.pos.x + fx * 1.9, boat.pos.y + 0.5, boat.pos.z + fz * 1.9, 1.8, boat.speed * 0.28);
  }
  // update spray
  for (let i = 0; i < SPRAY_N; i++) {
    if (sprayLife[i] <= 0) continue;
    sprayLife[i] -= dt;
    const h = i * 3;
    sprayVel[h + 1] -= 9.8 * dt;
    sprayPos[h] += sprayVel[h] * dt;
    sprayPos[h + 1] += sprayVel[h + 1] * dt;
    sprayPos[h + 2] += sprayVel[h + 2] * dt;
    if (sprayLife[i] <= 0) sprayPos[h + 1] = -999;
  }
  sprayGeo.attributes.position.needsUpdate = true;

  // birds wheel around the boat
  for (const b of birds) {
    const u = b.userData;
    u.a += u.s * dt;
    b.position.set(boat.pos.x + u.cx * 0.3 + Math.cos(u.a) * u.r,
      u.y + Math.sin(u.a * 2.3) * 1.2,
      boat.pos.z + u.cz * 0.3 + Math.sin(u.a) * u.r);
    b.rotation.y = -u.a + Math.PI / 2;
    const flap = 0.35 + Math.abs(Math.sin(G.time * 6 + u.r)) * 0.5;
    b.scale.y = flap;
  }

  // islands streaming + discovery
  streamIslands(boat.pos.x, boat.pos.z);
  for (const isl of islands) {
    if (!isl.discovered) {
      const d = Math.hypot(boat.pos.x - isl.x, boat.pos.z - isl.z);
      if (d < isl.R2 + 24) {
        isl.discovered = true;
        boat.discovered++;
        foundN.textContent = boat.discovered;
        showToast(isl.name, `${Math.round(d)} m off the bow — charted`);
        if (AC && AC.surfGain) { AC.surfGain.gain.setTargetAtTime(0.085, AC.currentTime, 0.4); AC.surfGain.gain.setTargetAtTime(0.05, AC.currentTime + 1.6, 0.8); }
      }
    }
  }

  // ocean follows camera
  ocean.userData.follow(camera);
  ocean.userData.mat.uniforms.uTime.value = t;

  // camera follow (smooth chase with slight lead-in)
  const m = CAM_MODES[camMode];
  const camYaw = camMode === 2 ? boat.yaw + t * 0.18 : boat.yaw;
  const cd = m.dist, ch = m.height;
  const camTarget = new THREE.Vector3(
    boat.pos.x - Math.sin(camYaw) * cd,
    boat.pos.y + ch + Math.sin(t * 0.7) * 0.12,
    boat.pos.z - Math.cos(camYaw) * cd
  );
  camSmooth.lerp(camTarget, 1 - Math.exp(-dt * m.lag));
  // never let the camera dive under the water
  camSmooth.y = Math.max(camSmooth.y, waveSample(camSmooth.x, camSmooth.z, t, 0).y + 1.2);
  camera.position.copy(camSmooth);
  const lookAt = new THREE.Vector3(
    boat.pos.x + Math.sin(boat.yaw) * 3.0,
    boat.pos.y + m.lookUp,
    boat.pos.z + Math.cos(boat.yaw) * 3.0);
  lookSmooth.lerp(lookAt, 1 - Math.exp(-dt * 6));
  camera.lookAt(lookSmooth);

  // HUD
  const spd = Math.max(0, boat.speed);
  spdVal.textContent = spd.toFixed(1);
  spdBar.style.width = Math.min(100, (spd / 12) * 100) + '%';
  const cmp = compass(boat.yaw);
  cdir.textContent = cmp.dir;
  chdg.textContent = String(Math.round(cmp.deg)).padStart(3, '0') + '°';

  // shore surf audio
  if (AC && AC.surfGain) {
    let nearest = 1e9;
    for (const isl of islands) nearest = Math.min(nearest, Math.hypot(boat.pos.x - isl.x, boat.pos.z - isl.z) - isl.R1);
    const prox = THREE.MathUtils.clamp(1 - nearest / 120, 0, 1);
    AC.surfGain.gain.setTargetAtTime(0.05 + prox * 0.075, AC.currentTime, 0.5);
  }
}

function render() { renderer.render(scene, camera); }

const loopErr = [];
function frame(now) {
  requestAnimationFrame(frame);
  try {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.running) { update(dt); render(); G.fps = G.fps * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05; }
    else { ocean.userData.mat.uniforms.uTime.value += dt; ocean.userData.follow(camera); renderer.render(scene, camera); }
  } catch (e) {
    if (loopErr.length < 5) loopErr.push(e.stack || String(e));
    const el = document.getElementById('err');
    el.style.display = 'block'; el.textContent = String(e.message || e);
  }
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- start ----------
function start() {
  if (G.running) return;
  G.running = true;
  document.getElementById('title').classList.add('hidden');
  document.getElementById('hud').classList.add('show');
  initAudio();
  streamIslands(boat.pos.x, boat.pos.z);
}
document.getElementById('goBtn').addEventListener('click', start);
document.getElementById('title').addEventListener('pointerdown', e => { if (e.target.id !== 'goBtn') start(); });

// ---------- debug API for headless verification ----------
window.__err = [];
addEventListener('error', e => window.__err.push(String(e.message)));
window.__game = {
  G, boat, scene, camera, renderer, islands, IN, THREE,
  start,
  step(n = 30, fixedDt = 1 / 60) { for (let i = 0; i < n; i++) { update(fixedDt); } render(); },
  key(code, down) { keys[code] = down; },
  goto(x, z) { boat.pos.set(x, 0, z); camSmooth.set(x, 6, z - 12); },
  state() {
    return {
      running: G.running, time: +G.time.toFixed(2), fps: Math.round(G.fps),
      x: +boat.pos.x.toFixed(2), y: +boat.pos.y.toFixed(2), z: +boat.pos.z.toFixed(2),
      yaw: +boat.yaw.toFixed(3), speed: +boat.speed.toFixed(2),
      throttle: +boat.throttle.toFixed(2), helm: +boat.helm.toFixed(2),
      grounded: boat.grounded, discovered: boat.discovered,
      camMode, islands: islands.length,
      drawCalls: renderer.info.render.calls,
      loopErr: loopErr.length ? loopErr[0].split('\n').slice(0, 3).join(' | ') : null,
      jsErr: window.__err.length ? window.__err[0] : null,
    };
  },
};
