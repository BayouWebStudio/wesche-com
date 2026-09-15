import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ad4f5);
scene.fog = new THREE.Fog(0x9ad4f5, 70, 170);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 400);
camera.position.set(32, 26, 36);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 14;
controls.maxDistance = 95;
controls.maxPolarAngle = 1.42;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- lights
scene.add(new THREE.HemisphereLight(0xcfeaff, 0x87a35a, 0.9));
scene.add(new THREE.AmbientLight(0xffe3c0, 0.35));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
sun.position.set(28, 42, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -38;
sun.shadow.camera.right = 38;
sun.shadow.camera.top = 38;
sun.shadow.camera.bottom = -38;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0004;
scene.add(sun);

// ---------------------------------------------------------------- helpers
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInCubic = (t) => t * t * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
function easeOutBounce(t) {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const mats = {};
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial({ color, roughness: 1, ...opts });
  return mats[key];
}
function box(w, h, d, color, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.castShadow = true;
  return m;
}

// ---------------------------------------------------------------- island
const grassTop = new THREE.Mesh(new THREE.CylinderGeometry(26, 27, 3, 48), mat(0x7ecb5a));
grassTop.position.y = -1.5;
grassTop.receiveShadow = true;
scene.add(grassTop);

const dirt = new THREE.Mesh(new THREE.CylinderGeometry(27, 21, 7, 48), mat(0x8a5a3b, { flatShading: true }));
dirt.position.y = -6.5;
scene.add(dirt);

const bedrock = new THREE.Mesh(new THREE.ConeGeometry(21, 9, 48), mat(0x6e4429, { flatShading: true }));
bedrock.rotation.x = Math.PI;
bedrock.position.y = -14.5;
scene.add(bedrock);

// pond
const pond = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.2, 24), mat(0x5ec8e8, { roughness: 0.25 }));
pond.position.set(3, 0.02, 17);
scene.add(pond);
const pondRim = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.28, 8, 24), mat(0xc9b083));
pondRim.rotation.x = Math.PI / 2;
pondRim.position.set(3, 0.12, 17);
scene.add(pondRim);

// ---------------------------------------------------------------- fences / pens
const woodMat = mat(0xb07a4a);
function fenceLine(group, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.3) return;
  const ang = Math.atan2(dx, dz);
  const n = Math.max(2, Math.round(len / 1.9) + 1);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = box(0.18, 1.15, 0.18, 0xb07a4a);
    p.position.set(x1 + dx * t, 0.55, z1 + dz * t);
    group.add(p);
  }
  for (const h of [0.5, 0.92]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, len), woodMat);
    rail.castShadow = true;
    rail.position.set(x1 + dx / 2, h, z1 + dz / 2);
    rail.rotation.y = ang;
    group.add(rail);
  }
}
function buildPen(pen) {
  const g = new THREE.Group();
  const { x, z, w, d } = pen;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  fenceLine(g, x0, z0, x1, z0);
  fenceLine(g, x0, z0, x0, z1);
  fenceLine(g, x1, z0, x1, z1);
  const gap = 1.6; // gate opening at the front
  fenceLine(g, x0, z1, x - gap / 2, z1);
  fenceLine(g, x + gap / 2, z1, x1, z1);
  scene.add(g);
}

const PENS = {
  sheep:   { x: 9,   z: 7,  w: 10, d: 8 },
  pig:     { x: -5,  z: 11, w: 8,  d: 6.5 },
  cow:     { x: 13,  z: -6, w: 11, d: 9 },
  chicken: { x: -13, z: 5,  w: 7,  d: 6 },
};
Object.values(PENS).forEach(buildPen);
function penPoint(pen, margin = 1.2) {
  return new THREE.Vector3(
    rand(pen.x - pen.w / 2 + margin, pen.x + pen.w / 2 - margin),
    0,
    rand(pen.z - pen.d / 2 + margin, pen.z + pen.d / 2 - margin)
  );
}

const mud = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 0.16, 20), mat(0x6b4a2e));
mud.position.set(PENS.pig.x + 1, 0.02, PENS.pig.z - 1);
scene.add(mud);

// ---------------------------------------------------------------- farmhouse
const chimneyTip = new THREE.Vector3();
{
  const g = new THREE.Group();
  const base = box(6.4, 3.6, 5.2, 0xfff2d8);
  base.position.y = 1.8;
  base.receiveShadow = true;
  g.add(base);

  const roofShape = new THREE.Shape();
  roofShape.moveTo(-3.8, 0); roofShape.lineTo(3.8, 0); roofShape.lineTo(0, 2.6); roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 6.2, bevelEnabled: false });
  roofGeo.translate(0, 0, -3.1);
  const roof = new THREE.Mesh(roofGeo, mat(0xd8543f, { flatShading: true }));
  roof.castShadow = true;
  roof.position.y = 3.6;
  g.add(roof);

  const chimney = box(0.8, 1.9, 0.8, 0xa5644a);
  chimney.position.set(1.9, 5.1, -1.2);
  g.add(chimney);

  const door = box(1.2, 2, 0.12, 0x7a4a28);
  door.position.set(0, 1, 2.66);
  g.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat(0xf2c14e));
  knob.position.set(0.4, 1, 2.74);
  g.add(knob);
  for (const wx of [-2, 2]) {
    const frame = box(1.2, 1.2, 0.08, 0x8a5a3b);
    frame.position.set(wx, 2.1, 2.6);
    g.add(frame);
    const win = box(1, 1, 0.12, 0xaee3f5);
    win.position.set(wx, 2.1, 2.66);
    g.add(win);
  }
  g.position.set(-9, 0, -9);
  g.rotation.y = 0.5;
  scene.add(g);
  g.updateMatrixWorld(true);
  chimney.getWorldPosition(chimneyTip);
  chimneyTip.y += 1.1;
}

// stepping stones
for (let i = 0; i < 5; i++) {
  const s = new THREE.Mesh(new THREE.CylinderGeometry(rand(0.4, 0.55), rand(0.45, 0.6), 0.12, 7), mat(0xcfc3a8, { flatShading: true }));
  s.position.set(-6.5 + i * 1.6 + rand(-0.2, 0.2), 0.04, -5.6 + i * 1.1 + rand(-0.3, 0.3));
  s.receiveShadow = true;
  scene.add(s);
}

// hay bales
for (const [hx, hz, ry] of [[-3.6, -13.2, 0.4], [-2.1, -13.9, 1.2], [-2.9, -12.6, 2.1]]) {
  const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 12), mat(0xe8c86a, { flatShading: true }));
  bale.rotation.z = Math.PI / 2;
  bale.rotation.y = ry;
  bale.position.set(hx, 0.7, hz);
  bale.castShadow = true;
  scene.add(bale);
}

// crop patch
{
  const patch = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.2, 4.2), mat(0x7a5236));
  patch.position.set(-16, 0.06, -5);
  patch.receiveShadow = true;
  scene.add(patch);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 6; c++) {
      const sprout = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.22, 0.34), 0), mat(0x4f9e3e, { flatShading: true }));
      sprout.position.set(-16 - 2.2 + c * 0.85, 0.35, -5 - 1.3 + r * 1.3);
      sprout.castShadow = true;
      scene.add(sprout);
    }
}

// chicken coop
{
  const g = new THREE.Group();
  const body = box(2, 1.5, 1.6, 0xc8543c);
  body.position.y = 1.05;
  g.add(body);
  const roof = box(2.4, 0.18, 2, 0x8a3a2a);
  roof.position.y = 1.9;
  roof.rotation.z = 0.12;
  g.add(roof);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), mat(0x38220f));
  hole.position.set(0, 0.95, 0.81);
  g.add(hole);
  const ramp = box(0.7, 0.08, 1.4, 0xb07a4a);
  ramp.position.set(0, 0.35, 1.35);
  ramp.rotation.x = 0.45;
  g.add(ramp);
  g.position.set(PENS.chicken.x - 1.8, 0, PENS.chicken.z - 1.4);
  g.rotation.y = 0.5;
  scene.add(g);
}

// windmill
const windBlades = new THREE.Group();
{
  const g = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 6.5, 6), mat(0xe7dcc2, { flatShading: true }));
  tower.position.y = 3.25;
  tower.castShadow = true;
  g.add(tower);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1, 6), mat(0xd8543f, { flatShading: true }));
  cap.position.y = 7;
  g.add(cap);
  for (let i = 0; i < 4; i++) {
    const blade = box(0.5, 2.8, 0.06, 0xfaf3e3);
    blade.position.y = 1.5;
    const arm = new THREE.Group();
    arm.add(blade);
    arm.rotation.z = (i * Math.PI) / 2;
    windBlades.add(arm);
  }
  windBlades.position.set(0, 6.4, 0.95);
  g.add(windBlades);
  g.position.set(3, 0, -16);
  scene.add(g);
}

// trees, rocks, flowers
function tree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.4 * s, 1.6 * s, 7), mat(0x7a4a28, { flatShading: true }));
  trunk.position.y = 0.8 * s;
  trunk.castShadow = true;
  g.add(trunk);
  const greens = [0x4f9e3e, 0x5cb84a, 0x479240];
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.8, 1.25) * s, 0), mat(pick(greens), { flatShading: true }));
    puff.position.set(rand(-0.5, 0.5) * s, (1.9 + i * 0.75) * s, rand(-0.5, 0.5) * s);
    puff.castShadow = true;
    g.add(puff);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rand(0, Math.PI * 2);
  scene.add(g);
}
[[-20, -3, 1.2], [-16, -15, 1], [0, -20, 1.35], [20, 12, 1], [22, 2, 0.85], [17, 15, 1.1], [-19, 12, 0.9], [-9, 17, 1]].forEach(([x, z, s]) => tree(x, z, s));

for (let i = 0; i < 7; i++) {
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.3, 0.7), 0), mat(0xa8a496, { flatShading: true }));
  const a = rand(0, Math.PI * 2), r = rand(19, 24);
  rock.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
  rock.castShadow = true;
  scene.add(rock);
}
const flowerCols = [0xf2c14e, 0xef7ea8, 0xffffff, 0xf25c3d];
for (let i = 0; i < 26; i++) {
  const a = rand(0, Math.PI * 2), r = rand(4, 24);
  const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  const inPen = Object.values(PENS).some(pen =>
    Math.abs(p.x - pen.x) < pen.w / 2 + 0.5 && Math.abs(p.z - pen.z) < pen.d / 2 + 0.5);
  if (inPen || p.distanceTo(new THREE.Vector3(-9, 0, -9)) < 5) continue;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5), mat(0x4f9e3e));
  stem.position.set(p.x, 0.2, p.z);
  scene.add(stem);
  const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), mat(pick(flowerCols)));
  bloom.position.set(p.x, 0.45, p.z);
  scene.add(bloom);
}

// clouds
const clouds = [];
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group();
  for (let j = 0; j < 4; j++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(rand(0.9, 1.7), 10, 10),
      mat(0xffffff, { transparent: true, opacity: 0.92 }));
    puff.position.set(j * rand(1, 1.6) - 2, rand(-0.25, 0.4), rand(-0.6, 0.6));
    g.add(puff);
  }
  g.userData = { ang: rand(0, Math.PI * 2), r: rand(18, 34), y: rand(26, 33), speed: rand(0.01, 0.03) };
  clouds.push(g);
  scene.add(g);
}

// butterflies
const butterflies = [];
for (let i = 0; i < 3; i++) {
  const g = new THREE.Group();
  const wingGeo = new THREE.PlaneGeometry(0.34, 0.26);
  const wmat = mat(pick([0xf2c14e, 0xef7ea8, 0x9ad4f5]), { side: THREE.DoubleSide });
  const wl = new THREE.Mesh(wingGeo, wmat); wl.position.x = 0.17;
  const wr = new THREE.Mesh(wingGeo, wmat); wr.position.x = -0.17;
  const l = new THREE.Group(); l.add(wl);
  const r = new THREE.Group(); r.add(wr);
  g.add(l, r);
  g.userData = { l, r, seed: rand(0, 100), cx: rand(-12, 12), cz: rand(-6, 14) };
  butterflies.push(g);
  scene.add(g);
}

// ---------------------------------------------------------------- animals
function makeLeg(w, h, color) {
  const geo = new THREE.BoxGeometry(w, h, w);
  geo.translate(0, -h / 2, 0);
  const leg = new THREE.Mesh(geo, mat(color));
  leg.castShadow = true;
  return leg;
}

function buildSheep() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), mat(0xf6f2e7, { flatShading: true }));
  body.position.y = 1.05;
  body.scale.set(1.15, 1, 1.35);
  body.castShadow = true;
  g.add(body);
  const head = box(0.5, 0.48, 0.5, 0x40342a);
  head.position.set(0, 1.25, 1.25);
  g.add(head);
  const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), mat(0xf6f2e7, { flatShading: true }));
  tuft.position.set(0, 1.6, 1.15);
  g.add(tuft);
  for (const ex of [-0.32, 0.32]) {
    const ear = box(0.16, 0.1, 0.3, 0x40342a);
    ear.position.set(ex, 1.33, 1.2);
    ear.rotation.z = ex > 0 ? -0.4 : 0.4;
    g.add(ear);
  }
  const legs = [];
  for (const [lx, lz] of [[-0.4, 0.55], [0.4, 0.55], [-0.4, -0.55], [0.4, -0.55]]) {
    const leg = makeLeg(0.16, 0.55, 0x40342a);
    leg.position.set(lx, 0.55, lz);
    g.add(leg); legs.push(leg);
  }
  g.userData.legs = legs;
  return g;
}

function buildPig() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.7, 6, 12), mat(0xf2a2b0));
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.72;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), mat(0xf2a2b0));
  head.position.set(0, 0.85, 0.95);
  head.castShadow = true;
  g.add(head);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.18, 10), mat(0xe07f92));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.8, 1.35);
  g.add(snout);
  for (const ex of [-0.22, 0.22]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 6), mat(0xe07f92));
    ear.position.set(ex, 1.22, 0.92);
    ear.rotation.x = -0.3;
    g.add(ear);
  }
  const legs = [];
  for (const [lx, lz] of [[-0.3, 0.42], [0.3, 0.42], [-0.3, -0.42], [0.3, -0.42]]) {
    const leg = makeLeg(0.17, 0.42, 0xe58fa0);
    leg.position.set(lx, 0.42, lz);
    g.add(leg); legs.push(leg);
  }
  g.userData.legs = legs;
  return g;
}

function buildCow() {
  const g = new THREE.Group();
  const body = box(1.15, 1, 1.8, 0xfdfaf2);
  body.position.y = 1.15;
  g.add(body);
  for (const [sx, py, pz] of [[0.5, 1.35, 0.3], [-0.5, 1, -0.5], [0.5, 1.3, -0.7]]) {
    const patch = box(0.2, 0.55, 0.6, 0x3a3230);
    patch.position.set(sx, py, pz);
    g.add(patch);
  }
  const head = box(0.7, 0.65, 0.6, 0xfdfaf2);
  head.position.set(0, 1.55, 1.15);
  g.add(head);
  const muzzle = box(0.55, 0.3, 0.25, 0xf2b8ad);
  muzzle.position.set(0, 1.38, 1.45);
  g.add(muzzle);
  for (const ex of [-0.42, 0.42]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 6), mat(0xe8d9b8));
    horn.position.set(ex, 1.95, 1.05);
    g.add(horn);
    const ear = box(0.25, 0.12, 0.18, 0xfdfaf2);
    ear.position.set(ex * 1.15, 1.72, 1.1);
    g.add(ear);
  }
  const legs = [];
  for (const [lx, lz] of [[-0.4, 0.7], [0.4, 0.7], [-0.4, -0.7], [0.4, -0.7]]) {
    const leg = makeLeg(0.22, 0.65, 0x4a423e);
    leg.position.set(lx, 0.65, lz);
    g.add(leg); legs.push(leg);
  }
  g.userData.legs = legs;
  return g;
}

function buildChicken() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 12), mat(0xfdfaf2));
  body.position.y = 0.48;
  body.scale.set(0.9, 1, 1.15);
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), mat(0xfdfaf2));
  head.position.set(0, 0.88, 0.26);
  g.add(head);
  const comb = box(0.07, 0.16, 0.2, 0xe23d28);
  comb.position.set(0, 1.08, 0.26);
  g.add(comb);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 6), mat(0xf2953d));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.86, 0.5);
  g.add(beak);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.35, 6), mat(0xe8e2d2));
  tail.rotation.x = -Math.PI / 2.6;
  tail.position.set(0, 0.62, -0.42);
  g.add(tail);
  const legs = [];
  for (const lx of [-0.1, 0.1]) {
    const leg = makeLeg(0.05, 0.25, 0xf2953d);
    leg.position.set(lx, 0.25, 0);
    g.add(leg); legs.push(leg);
  }
  g.userData.legs = legs;
  return g;
}

const ROSTER = [
  { type: 'sheep', emoji: '🐑', names: ['Baabara', 'Woolliam', 'Ewegene'], build: buildSheep, count: 3 },
  { type: 'pig', emoji: '🐷', names: ['Hamlet', 'Truffle', 'Sir Oinksalot'], build: buildPig, count: 3 },
  { type: 'cow', emoji: '🐮', names: ['Moolinda', 'Sir Loin'], build: buildCow, count: 2 },
  { type: 'chicken', emoji: '🐔', names: ['Nugget', 'Henrietta', 'Cluck Norris', 'Omelette'], build: buildChicken, count: 4 },
];

let simTime = 0;

class Animal {
  constructor(spec, name) {
    this.type = spec.type;
    this.emoji = spec.emoji;
    this.name = name;
    this.pen = PENS[spec.type];
    this.mesh = spec.build();
    this.baseScale = spec.type === 'chicken' ? 0.9 : spec.type === 'cow' ? 0.95 : 1;
    this.mesh.scale.setScalar(this.baseScale);
    this.home = penPoint(this.pen);
    this.mesh.position.copy(this.home);
    this.mesh.rotation.y = rand(0, Math.PI * 2);
    this.state = 'roam'; // roam | panic | held | gone
    this.target = null;
    this.pause = rand(0, 2);
    this.panicUntil = 0;
    this.bobT = rand(0, 10);
    scene.add(this.mesh);
  }
  panic(dur = 3.2) {
    if (this.state === 'held' || this.state === 'gone') return;
    this.state = 'panic';
    this.panicUntil = simTime + dur;
    this.target = penPoint(this.pen);
    this.pause = 0;
  }
  update(dt) {
    if (this.state === 'held' || this.state === 'gone') return;
    const panicking = this.state === 'panic';
    if (panicking && simTime > this.panicUntil) {
      this.state = 'roam';
      this.target = null;
      this.pause = rand(0.5, 1.5);
    }
    if (!panicking && this.pause > 0) {
      this.pause -= dt;
      this.setLegs(0);
      this.mesh.position.y = 0;
      return;
    }
    if (!this.target) this.target = penPoint(this.pen);
    const dx = this.target.x - this.mesh.position.x;
    const dz = this.target.z - this.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.25) {
      this.target = panicking ? penPoint(this.pen) : null;
      if (!panicking) this.pause = rand(0.8, 3.2);
      return;
    }
    const speed = (panicking ? 4.2 : 0.85) * (this.type === 'chicken' ? 1.25 : 1);
    const heading = Math.atan2(dx, dz);
    this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, heading, 1 - Math.exp(-(panicking ? 14 : 7) * dt));
    const step = Math.min(dist, speed * dt);
    this.mesh.position.x += (dx / dist) * step;
    this.mesh.position.z += (dz / dist) * step;
    this.bobT += dt * (panicking ? 20 : 9);
    this.mesh.position.y = Math.abs(Math.sin(this.bobT)) * (panicking ? 0.22 : 0.07);
    this.setLegs(Math.sin(this.bobT) * (panicking ? 0.8 : 0.45));
  }
  setLegs(swing) {
    const legs = this.mesh.userData.legs;
    for (let i = 0; i < legs.length; i++) legs[i].rotation.x = i % 2 ? swing : -swing;
  }
}

const animals = [];
for (const spec of ROSTER)
  for (let i = 0; i < spec.count; i++) animals.push(new Animal(spec, spec.names[i]));

// ---------------------------------------------------------------- UFO
const ufo = new THREE.Group();
const ufoLights = [];
let beamGroup, beamOuter, beamInner, beamLight, groundGlow;
{
  const hull = new THREE.Mesh(new THREE.SphereGeometry(2.6, 28, 14), mat(0x9aa7b8, { roughness: 0.35, metalness: 0.6 }));
  hull.scale.set(1, 0.34, 1);
  hull.castShadow = true;
  ufo.add(hull);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 12), mat(0x76828f, { roughness: 0.4, metalness: 0.6 }));
  belly.scale.set(1, 0.55, 1);
  belly.position.y = -0.45;
  ufo.add(belly);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x9be8d8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55 }));
  dome.position.y = 0.55;
  ufo.add(dome);
  // tiny pilot silhouette
  const pilot = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.3, 4, 8), mat(0x3f6d5a));
  pilot.position.y = 0.75;
  ufo.add(pilot);
  const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), mat(0x111111));
  eye1.position.set(-0.11, 0.95, 0.24);
  ufo.add(eye1);
  const eye2 = eye1.clone();
  eye2.position.x = 0.11;
  ufo.add(eye2);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffd45c, emissive: 0xffb400, emissiveIntensity: 1 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), lightMat);
    bulb.position.set(Math.cos(a) * 2.05, -0.25, Math.sin(a) * 2.05);
    ufoLights.push(bulb);
    ufo.add(bulb);
  }

  // tractor beam (child of ufo, apex at the belly, opens downward)
  beamGroup = new THREE.Group();
  beamGroup.position.y = -0.6;
  const coneGeo = new THREE.ConeGeometry(3.1, 1, 28, 1, true);
  coneGeo.translate(0, -0.5, 0); // apex at y=0, base at y=-1
  beamOuter = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
    color: 0x8ff7ff, transparent: true, opacity: 0.0, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  beamGroup.add(beamOuter);
  const coneGeo2 = new THREE.ConeGeometry(1.6, 1, 20, 1, true);
  coneGeo2.translate(0, -0.5, 0);
  beamInner = new THREE.Mesh(coneGeo2, new THREE.MeshBasicMaterial({
    color: 0xe4fffb, transparent: true, opacity: 0.0, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  beamGroup.add(beamInner);
  beamLight = new THREE.PointLight(0x8ff7ff, 0, 30);
  beamLight.position.y = -2;
  beamGroup.add(beamLight);
  beamGroup.scale.y = 0.001;
  beamGroup.visible = false;
  ufo.add(beamGroup);

  groundGlow = new THREE.Mesh(new THREE.CircleGeometry(3.2, 28), new THREE.MeshBasicMaterial({
    color: 0x8ff7ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  groundGlow.rotation.x = -Math.PI / 2;
  groundGlow.position.y = 0.03;
  groundGlow.visible = false;
  scene.add(groundGlow);

  ufo.visible = false;
  scene.add(ufo);
}

// "!" alert marker
function makeAlertSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 100px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#fff';
  ctx.strokeText('!', 64, 68);
  ctx.fillStyle = '#e23d28';
  ctx.fillText('!', 64, 68);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(1.1, 1.1, 1);
  sp.visible = false;
  scene.add(sp);
  return sp;
}
const alertMark = makeAlertSprite();

// poof particle bursts
const effects = [];
function poof(pos, color = 0xffffff, count = 10, size = 0.22, speed = 3) {
  const g = new THREE.Group();
  const parts = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(size * rand(0.7, 1.3), 6, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    const dir = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.4, 1) * speed);
    m.userData.v = dir;
    g.add(m);
    parts.push(m);
  }
  g.position.copy(pos);
  scene.add(g);
  effects.push({ g, parts, t: 0, dur: 0.6 });
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t += dt;
    const u = e.t / e.dur;
    if (u >= 1) {
      scene.remove(e.g);
      e.parts.forEach(p => { p.geometry.dispose(); p.material.dispose(); });
      effects.splice(i, 1);
      continue;
    }
    for (const p of e.parts) {
      p.position.addScaledVector(p.userData.v, dt);
      p.userData.v.y -= 4 * dt;
      p.material.opacity = 0.95 * (1 - u);
      p.scale.setScalar(1 + u * 0.8);
    }
  }
}

// chimney smoke
const smokes = [];
let smokeTimer = 0;
function updateSmoke(dt) {
  smokeTimer -= dt;
  if (smokeTimer <= 0) {
    smokeTimer = rand(0.7, 1.1);
    const m = new THREE.Mesh(new THREE.SphereGeometry(rand(0.2, 0.3), 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xf2efe8, transparent: true, opacity: 0.55 }));
    m.position.copy(chimneyTip);
    scene.add(m);
    smokes.push({ m, t: 0, drift: rand(-0.3, 0.3) });
  }
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i];
    s.t += dt;
    s.m.position.y += dt * 0.9;
    s.m.position.x += dt * s.drift;
    s.m.scale.setScalar(1 + s.t * 0.8);
    s.m.material.opacity = 0.55 * Math.max(0, 1 - s.t / 3);
    if (s.t > 3) {
      scene.remove(s.m);
      s.m.geometry.dispose();
      s.m.material.dispose();
      smokes.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- sound (tiny synth, best-effort)
let AC = null;
function audio() {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    return AC;
  } catch { return null; }
}
function tone(freq0, freq1, dur, type = 'sine', vol = 0.06) {
  const ac = audio();
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq0, ac.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, freq1), ac.currentTime + dur);
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.connect(g).connect(ac.destination);
  o.start();
  o.stop(ac.currentTime + dur + 0.05);
}
let hum = null;
function humStart() {
  const ac = audio();
  if (!ac || hum) return;
  const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
  const lfo = ac.createOscillator(), lg = ac.createGain();
  o1.frequency.value = 82; o2.frequency.value = 86;
  o1.type = o2.type = 'sawtooth';
  g.gain.value = 0.03;
  lfo.frequency.value = 7; lg.gain.value = 0.015;
  lfo.connect(lg).connect(g.gain);
  o1.connect(g); o2.connect(g); g.connect(ac.destination);
  o1.start(); o2.start(); lfo.start();
  hum = { o1, o2, lfo, g };
}
function humStop() {
  if (!hum) return;
  const ac = AC;
  hum.g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.25);
  const h = hum;
  setTimeout(() => { try { h.o1.stop(); h.o2.stop(); h.lfo.stop(); } catch {} }, 300);
  hum = null;
}

// ---------------------------------------------------------------- sequencer
const seqs = [];
function runSeq(steps) { seqs.push({ steps, idx: 0, t: 0, started: false }); }
function updateSeqs(dt) {
  for (let i = seqs.length - 1; i >= 0; i--) {
    const s = seqs[i];
    if (s.idx >= s.steps.length) { seqs.splice(i, 1); continue; }
    const st = s.steps[s.idx];
    if (!s.started) { st.start && st.start(); s.started = true; }
    s.t += dt;
    const dur = st.dur || 0.0001;
    const u = Math.min(1, s.t / dur);
    st.update && st.update(u);
    if (u >= 1) {
      st.end && st.end();
      s.idx++; s.t = 0; s.started = false;
    }
  }
}

// ---------------------------------------------------------------- UI
const countEl = document.getElementById('count');
const tallyEl = document.getElementById('tally');
const captionEl = document.getElementById('caption');
const abductBtn = document.getElementById('abduct');
const returnBtn = document.getElementById('return');

let busy = false;
const abducted = []; // Animal[] in abduction order

function refreshUI() {
  const here = animals.filter(a => a.state !== 'gone' && a.state !== 'held').length;
  countEl.textContent = `Critters on the farm: ${here} / ${animals.length}`;
  if (abducted.length) {
    tallyEl.hidden = false;
    tallyEl.innerHTML = '<b>Aboard the mothership:</b>' +
      abducted.map(a => `${a.emoji} ${a.name}`).join(' · ');
  } else {
    tallyEl.hidden = true;
  }
  abductBtn.disabled = busy;
  returnBtn.disabled = busy || abducted.length === 0;
}

let captionTimer = null;
function caption(text, hold = 3000) {
  captionEl.textContent = text;
  captionEl.style.opacity = 1;
  if (captionTimer) clearTimeout(captionTimer);
  captionTimer = setTimeout(() => { captionEl.style.opacity = 0; }, hold);
}

const LINES = {
  arrive: ['Uh oh. Company.', 'A saucer slinks out of the clouds…', 'Something is humming up there…', 'The chickens saw it first.'],
  chosen: (a) => pick([
    `${a.name} the ${a.type} has been chosen.`,
    `Up you go, ${a.name}!`,
    `The mothership fancies ${a.name}.`,
    `${a.name} is getting a closer look at the stars.`,
  ]),
  depart: ['And it’s gone. The hay settles.', 'Zip. Like it was never here.', 'The farm is a little quieter now…'],
  empty: ['Empty pens. The saucer sulks away.', 'Nothing left to take… eerily quiet.'],
  returned: ['Everyone’s home! No one speaks of it.', 'All accounted for. Mostly unprobed.'],
};

// ---------------------------------------------------------------- abduction
const HOVER_Y = 12;

function setBeam(u, len) {
  beamGroup.visible = u > 0.01;
  beamGroup.scale.y = Math.max(0.001, u * len);
  const pulse = 0.75 + 0.25 * Math.sin(simTime * 18);
  beamOuter.material.opacity = 0.34 * u * pulse;
  beamInner.material.opacity = 0.5 * u * pulse;
  beamLight.intensity = 60 * u;
  groundGlow.visible = u > 0.01;
  groundGlow.material.opacity = 0.45 * u * pulse;
  groundGlow.scale.setScalar(0.6 + 0.4 * u + 0.06 * Math.sin(simTime * 12));
}

function abduct() {
  if (busy) return;
  const avail = animals.filter(a => a.state === 'roam' || a.state === 'panic');
  if (!avail.length) {
    caption(pick(LINES.empty));
    abductBtn.classList.remove('wiggle');
    void abductBtn.offsetWidth;
    abductBtn.classList.add('wiggle');
    return;
  }
  busy = true;
  refreshUI();

  const prey = pick(avail);
  let px = prey.mesh.position.x, pz = prey.mesh.position.z;
  const hover = new THREE.Vector3(px, HOVER_Y, pz);
  const entry = hover.clone().add(new THREE.Vector3(42, 17, -34));
  const exit = hover.clone().add(new THREE.Vector3(-48, 22, 30));
  let shakeBase = null;

  runSeq([
    { // arrival swoop
      dur: 2.1,
      start: () => {
        ufo.visible = true;
        ufo.position.copy(entry);
        caption(pick(LINES.arrive));
        tone(900, 180, 1.2, 'triangle', 0.05);
      },
      update: (u) => {
        const e = easeInOutCubic(u);
        ufo.position.lerpVectors(entry, hover, e);
        ufo.position.y += Math.sin(u * Math.PI) * 3;
        ufo.rotation.z = -0.4 * (1 - easeOutCubic(u));
        ufo.rotation.x = 0.22 * (1 - easeOutCubic(u));
      },
      end: () => { ufo.rotation.set(0, 0, 0); },
    },
    { // take aim: alert mark, pen-wide panic
      dur: 0.7,
      start: () => {
        alertMark.visible = true;
        prey.state = 'held';
        prey.setLegs(0);
        px = prey.mesh.position.x;
        pz = prey.mesh.position.z;
        hover.set(px, HOVER_Y, pz);
        prey.mesh.position.y = 0;
        shakeBase = prey.mesh.position.clone();
        for (const a of animals)
          if (a !== prey && a.pen === prey.pen) a.panic(3.4);
        caption(LINES.chosen(prey), 3600);
        tone(300, 640, 0.3, 'square', 0.04);
      },
      update: (u) => {
        alertMark.position.set(px, 2.6 + Math.sin(simTime * 10) * 0.15, pz);
        prey.mesh.position.x = shakeBase.x + Math.sin(simTime * 55) * 0.06;
        ufo.position.x += (px - ufo.position.x) * 0.18;
        ufo.position.z += (pz - ufo.position.z) * 0.18;
      },
      end: () => { alertMark.visible = false; prey.mesh.position.copy(shakeBase); },
    },
    { // beam down + lift
      dur: 2.7,
      start: () => { humStart(); },
      update: (u) => {
        ufo.position.y = HOVER_Y + Math.sin(simTime * 3) * 0.18;
        setBeam(Math.min(1, u * 4), ufo.position.y - 0.4);
        groundGlow.position.set(px, 0.03, pz);
        // struggle, then rise
        if (u < 0.25) {
          prey.mesh.position.x = shakeBase.x + Math.sin(simTime * 50) * 0.08;
          prey.mesh.rotation.z = Math.sin(simTime * 40) * 0.1;
        } else {
          const v = (u - 0.25) / 0.75;
          const e = easeInCubic(v);
          prey.mesh.position.set(
            px + Math.sin(simTime * 6) * 0.25 * (1 - v),
            e * (HOVER_Y - 1.6),
            pz + Math.cos(simTime * 5) * 0.25 * (1 - v)
          );
          prey.mesh.rotation.y += (2 + 14 * v) * 0.016;
          prey.mesh.rotation.z = Math.sin(simTime * 9) * 0.35 * (1 - v * 0.5);
          prey.mesh.scale.setScalar(prey.baseScale * (1 - 0.7 * e));
          prey.setLegs(Math.sin(simTime * 26) * 1.1); // flailing
        }
        if (u > 0.9) tone(500 + u * 900, 1400, 0.05, 'sine', 0.015);
      },
      end: () => {
        poof(new THREE.Vector3(px, HOVER_Y - 1.4, pz), 0xbdf8ff, 12, 0.18, 2.4);
        prey.mesh.visible = false;
        prey.mesh.rotation.set(0, 0, 0);
        prey.mesh.scale.setScalar(prey.baseScale);
        prey.state = 'gone';
        abducted.push(prey);
        tone(1200, 300, 0.25, 'sine', 0.05);
      },
    },
    { // retract beam, little anticipation dip
      dur: 0.45,
      update: (u) => {
        setBeam(1 - u, ufo.position.y - 0.4);
        ufo.position.y = HOVER_Y - Math.sin(u * Math.PI) * 0.7;
      },
      end: () => { setBeam(0, 1); beamGroup.visible = false; groundGlow.visible = false; humStop(); },
    },
    { // zoom off
      dur: 1.6,
      start: () => { tone(200, 950, 0.7, 'triangle', 0.05); },
      update: (u) => {
        const e = easeInCubic(u);
        ufo.position.lerpVectors(hover, exit, e);
        ufo.rotation.z = 0.5 * easeOutCubic(u);
        ufo.rotation.x = -0.18 * easeOutCubic(u);
      },
      end: () => {
        ufo.visible = false;
        ufo.rotation.set(0, 0, 0);
        busy = false;
        caption(pick(LINES.depart));
        refreshUI();
      },
    },
  ]);
}

// ---------------------------------------------------------------- return
function returnAll() {
  if (busy || !abducted.length) return;
  busy = true;
  refreshUI();

  const queue = abducted.slice();
  const center = new THREE.Vector3(0, HOVER_Y + 3, 2);
  const entry = center.clone().add(new THREE.Vector3(-45, 15, -30));
  const steps = [];

  steps.push({
    dur: 1.9,
    start: () => {
      ufo.visible = true;
      ufo.position.copy(entry);
      caption('The saucer returns… looking sheepish.');
      tone(900, 200, 1.1, 'triangle', 0.05);
    },
    update: (u) => {
      const e = easeInOutCubic(u);
      ufo.position.lerpVectors(entry, center, e);
      ufo.rotation.z = 0.35 * (1 - easeOutCubic(u));
    },
    end: () => { ufo.rotation.set(0, 0, 0); },
  });

  let from = center;
  for (const a of queue) {
    const drop = new THREE.Vector3(a.home.x, HOVER_Y - 2, a.home.z);
    const start = from;
    steps.push({
      dur: 0.55,
      update: (u) => {
        ufo.position.lerpVectors(start, drop, easeInOutCubic(u));
        ufo.position.y += Math.sin(u * Math.PI) * 1.2;
      },
    });
    steps.push({
      dur: 0.8,
      start: () => {
        a.mesh.visible = true;
        a.mesh.position.set(a.home.x, HOVER_Y - 3.2, a.home.z);
        a.mesh.scale.setScalar(a.baseScale * 0.35);
        tone(400, 900, 0.18, 'square', 0.035);
      },
      update: (u) => {
        setBeam(Math.sin(Math.min(1, u * 1.4) * Math.PI), ufo.position.y - 0.4);
        groundGlow.position.set(a.home.x, 0.03, a.home.z);
        const y = (HOVER_Y - 3.2) * (1 - easeOutBounce(u));
        a.mesh.position.y = y;
        a.mesh.rotation.y += 0.25 * (1 - u);
        a.mesh.scale.setScalar(a.baseScale * (0.35 + 0.65 * easeOutBack(Math.min(1, u * 1.15))));
      },
      end: () => {
        a.mesh.position.set(a.home.x, 0, a.home.z);
        a.mesh.scale.setScalar(a.baseScale);
        a.state = 'roam';
        a.target = null;
        a.pause = rand(0.3, 1.2);
        poof(new THREE.Vector3(a.home.x, 0.4, a.home.z), 0xd9c9a8, 8, 0.18, 2);
        tone(700, 250, 0.15, 'sine', 0.04);
        refreshTallyDuringReturn();
      },
    });
    from = drop;
  }

  steps.push({
    dur: 1.5,
    start: () => {
      setBeam(0, 1);
      beamGroup.visible = false;
      groundGlow.visible = false;
      tone(200, 950, 0.7, 'triangle', 0.05);
    },
    update: (u) => {
      const e = easeInCubic(u);
      const exit = new THREE.Vector3(50, HOVER_Y + 26, -38);
      ufo.position.lerpVectors(from, exit, e);
      ufo.rotation.z = -0.45 * easeOutCubic(u);
    },
    end: () => {
      ufo.visible = false;
      ufo.rotation.set(0, 0, 0);
      busy = false;
      caption(pick(LINES.returned));
      refreshUI();
    },
  });

  abducted.length = 0;
  runSeq(steps);
}
function refreshTallyDuringReturn() {
  const here = animals.filter(a => a.state !== 'gone' && a.state !== 'held').length;
  countEl.textContent = `Critters on the farm: ${here} / ${animals.length}`;
}

abductBtn.addEventListener('click', () => { audio(); abduct(); });
returnBtn.addEventListener('click', () => { audio(); returnAll(); });
refreshUI();

// ---------------------------------------------------------------- main loop
function tick(dt) {
  simTime += dt;

  for (const a of animals) a.update(dt);
  updateSeqs(dt);
  updateEffects(dt);
  updateSmoke(dt);

  windBlades.rotation.z += dt * 1.4;

  for (const c of clouds) {
    c.userData.ang += dt * c.userData.speed;
    c.position.set(Math.cos(c.userData.ang) * c.userData.r, c.userData.y, Math.sin(c.userData.ang) * c.userData.r);
  }

  for (const b of butterflies) {
    const s = b.userData.seed + simTime * 0.5;
    b.position.set(
      b.userData.cx + Math.sin(s) * 4 + Math.sin(s * 2.7) * 1.5,
      1.6 + Math.sin(s * 3.1) * 0.7,
      b.userData.cz + Math.cos(s * 0.8) * 4
    );
    const flap = Math.sin(simTime * 22 + b.userData.seed) * 0.9;
    b.userData.l.rotation.y = flap;
    b.userData.r.rotation.y = -flap;
  }

  if (ufo.visible) {
    const blink = Math.floor(simTime * 6);
    for (let i = 0; i < ufoLights.length; i++)
      ufoLights[i].material.emissiveIntensity = (i + blink) % 3 === 0 ? 2.2 : 0.35;
    ufo.rotation.y += dt * 0.8;
  }
}

// expose for smoke tests
window.__farm = {
  animals, abducted, abduct, returnAll, isBusy: () => busy, seqs, ufo,
  tick, render: () => { controls.update(); renderer.render(scene, camera); },
};

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  tick(Math.min(clock.getDelta(), 0.05));
  controls.update();
  renderer.render(scene, camera);
});
