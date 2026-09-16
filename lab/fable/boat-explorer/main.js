import * as THREE from 'three';

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const FOG_COLOR = new THREE.Color(0x6b4160);
const FOG_NEAR = 150, FOG_FAR = 470;
scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 2600);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- lights
const SUN_DIR = new THREE.Vector3(-0.9, 0.14, -0.38).normalize();
const sun = new THREE.DirectionalLight(0xffa268, 2.4);
sun.position.copy(SUN_DIR).multiplyScalar(100);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x6a5595, 0x2b3040, 0.95));
scene.add(new THREE.AmbientLight(0x584060, 0.55));
const fill = new THREE.DirectionalLight(0x8a6a9a, 0.7); // twilight bounce so the boat isn't a pure silhouette
fill.position.set(SUN_DIR.x * -80, 40, SUN_DIR.z * -80);
scene.add(fill);

// ---------------------------------------------------------------- waves (shared JS + GLSL)
const WAVES = [
  { dir: [0.85, 0.35], L: 58, A: 1.05, Q: 0.55, speed: 1.0 },
  { dir: [0.55, -0.8], L: 30, A: 0.5, Q: 0.5, speed: 1.12 },
  { dir: [-0.35, 0.9], L: 16.5, A: 0.22, Q: 0.4, speed: 1.28 },
  { dir: [0.95, 0.6], L: 11, A: 0.1, Q: 0.3, speed: 1.5 },
];
for (const w of WAVES) {
  const len = Math.hypot(w.dir[0], w.dir[1]);
  w.dx = w.dir[0] / len; w.dz = w.dir[1] / len;
  w.k = (Math.PI * 2) / w.L;
  w.omega = w.speed * Math.sqrt(9.8 * w.k);
}
function waveHeight(x, z, t) {
  let h = 0;
  for (const w of WAVES) h += w.A * Math.sin(w.k * (w.dx * x + w.dz * z) - w.omega * t);
  return h;
}

const fmt = (n) => n.toFixed(6);
const waveGLSL = WAVES.map((w) => `
  {
    float ph = ${fmt(w.k)} * dot(vec2(${fmt(w.dx)}, ${fmt(w.dz)}), wp.xz) - ${fmt(w.omega)} * uTime;
    float s = sin(ph); float c = cos(ph);
    h += ${fmt(w.A)} * s;
    grad += vec2(${fmt(w.dx)}, ${fmt(w.dz)}) * ${fmt(w.A * w.k)} * c;
    hoff += vec2(${fmt(w.dx)}, ${fmt(w.dz)}) * ${fmt(w.Q * w.A)} * c;
  }`).join('\n');

// ---------------------------------------------------------------- water
const WATER_SIZE = 1000, WATER_SEGS = 200;
const waterUniforms = {
  uTime: { value: 0 },
  uCamPos: { value: new THREE.Vector3() },
  uSunDir: { value: SUN_DIR },
  uDeep: { value: new THREE.Color(0x0d2e40) },
  uZenith: { value: new THREE.Color(0x2c1d52) },
  uHorizonCool: { value: new THREE.Color(0x8c5273) },
  uHorizonWarm: { value: new THREE.Color(0xff9055) },
  uSunColor: { value: new THREE.Color(0xffb36b) },
  uCrest: { value: new THREE.Color(0xff9f78) },
  uFogColor: { value: FOG_COLOR },
  uFogNear: { value: FOG_NEAR },
  uFogFar: { value: FOG_FAR },
};
const waterMat = new THREE.ShaderMaterial({
  uniforms: waterUniforms,
  vertexShader: `
    uniform float uTime;
    varying vec3 vPos;
    varying vec3 vNormal;
    varying float vH;
    void main() {
      vec4 wp4 = modelMatrix * vec4(position, 1.0);
      vec3 wp = wp4.xyz;
      float h = 0.0;
      vec2 grad = vec2(0.0);
      vec2 hoff = vec2(0.0);
      ${waveGLSL}
      vec3 displaced = vec3(wp.x + hoff.x, h, wp.z + hoff.y);
      vPos = displaced;
      vNormal = normalize(vec3(-grad.x, 1.0, -grad.y));
      vH = h;
      gl_Position = projectionMatrix * viewMatrix * vec4(displaced, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uCamPos, uSunDir;
    uniform vec3 uDeep, uZenith, uHorizonCool, uHorizonWarm, uSunColor, uCrest, uFogColor;
    uniform float uFogNear, uFogFar;
    varying vec3 vPos;
    varying vec3 vNormal;
    varying float vH;
    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCamPos - vPos);
      vec3 R = reflect(-V, N);
      float upness = clamp(R.y, 0.0, 1.0);
      float sunward = pow(max(dot(normalize(R.xz), normalize(uSunDir.xz)), 0.0), 3.0);
      vec3 horizon = mix(uHorizonCool, uHorizonWarm, sunward);
      vec3 sky = mix(horizon, uZenith, pow(upness, 0.55));
      float F = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
      vec3 col = mix(uDeep, sky, clamp(0.08 + F * 1.15, 0.0, 1.0));
      col += uCrest * smoothstep(1.1, 2.4, vH) * 0.14;
      float sd = max(dot(R, uSunDir), 0.0);
      col += uSunColor * (pow(sd, 420.0) * 2.6 + pow(sd, 90.0) * 0.25);
      float fd = length(uCamPos - vPos);
      col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, fd));
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});
const water = new THREE.Mesh(new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGS, WATER_SEGS), waterMat);
water.rotation.x = -Math.PI / 2;
water.frustumCulled = false;
scene.add(water);

// ---------------------------------------------------------------- sky dome
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uSunDir: { value: SUN_DIR },
    uZenith: { value: new THREE.Color(0x241a4e) },
    uHorizonCool: { value: new THREE.Color(0x9a5a78) },
    uHorizonWarm: { value: new THREE.Color(0xff9a52) },
    uSunColor: { value: new THREE.Color(0xffd9a0) },
    uFogColor: { value: FOG_COLOR },
  },
  vertexShader: `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uSunDir, uZenith, uHorizonCool, uHorizonWarm, uSunColor, uFogColor;
    varying vec3 vDir;
    void main() {
      vec3 dir = normalize(vDir);
      float sunwardXZ = pow(max(dot(normalize(dir.xz), normalize(uSunDir.xz)), 0.0), 2.4);
      vec3 horizon = mix(uHorizonCool, uHorizonWarm, sunwardXZ);
      vec3 grad = mix(horizon, uZenith, pow(smoothstep(0.0, 0.55, dir.y), 0.75));
      vec3 col = mix(uFogColor, grad, smoothstep(-0.01, 0.16, dir.y));
      float d = max(dot(dir, uSunDir), 0.0);
      col += uSunColor * smoothstep(0.99955, 0.99985, d) * 1.4;   // disc
      col += vec3(1.0, 0.55, 0.3) * pow(d, 16.0) * 0.5;           // near glow
      col += vec3(1.0, 0.45, 0.35) * pow(d, 3.0) * 0.16;          // wide wash
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 18), skyMat);
skyDome.frustumCulled = false;
scene.add(skyDome);

// clouds — unlit-ish warm blobs riding with the camera (far away feel)
const cloudGroup = new THREE.Group();
{
  const crng = mulberry32(1234567);
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    const tint = new THREE.Color().setHSL(0.04 + crng() * 0.05, 0.6, 0.55 + crng() * 0.15);
    const m = new THREE.MeshBasicMaterial({ color: tint, fog: false, transparent: true, opacity: 0.85 });
    const puffs = 3 + Math.floor(crng() * 3);
    for (let j = 0; j < puffs; j++) {
      const s = 16 + crng() * 22;
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), m);
      puff.position.set(j * (20 + crng() * 12) - puffs * 11, crng() * 8, crng() * 14 - 7);
      puff.scale.y = 0.3 + crng() * 0.12;
      c.add(puff);
    }
    const ang = crng() * Math.PI * 2;
    const rad = 750 + crng() * 350;
    c.position.set(Math.cos(ang) * rad, 130 + crng() * 170, Math.sin(ang) * rad);
    cloudGroup.add(c);
  }
}
scene.add(cloudGroup);

// ---------------------------------------------------------------- island field
const CELL = 420;
const NAME_A = ['Ember', 'Vesper', 'Coral', 'Drift', 'Gull', 'Lantern', 'Saffron', 'Mango', 'Pearl', 'Cinder', 'Moon', 'Fig', 'Halcyon', 'Amber', 'Sable', 'Tide'];
const NAME_B = ['Atoll', 'Isle', 'Cay', 'Key', 'Rock', 'Haven', 'Reef', 'Shoal', 'Point', 'Hollow'];

const islandDataCache = new Map();
function islandData(ci, cj) {
  const key = ci + ',' + cj;
  if (islandDataCache.has(key)) return islandDataCache.get(key);
  let d = null;
  const seed = hash2(ci, cj);
  const rng = mulberry32(seed);
  if (rng() < 0.55) {
    const x = (ci + 0.18 + rng() * 0.64) * CELL;
    const z = (cj + 0.18 + rng() * 0.64) * CELL;
    if (Math.hypot(x, z) > 170) {
      const R = 26 + rng() * 46;
      const p1 = rng() * Math.PI * 2, p2 = rng() * Math.PI * 2;
      const a2 = 0.14 + rng() * 0.12;
      const prof = (th) => 1 + 0.2 * Math.sin(3 * th + p1) + a2 * Math.sin(7 * th + p2);
      d = {
        key, seed, x, z, R, prof,
        shoreR: (th) => R * 0.75 * prof(th),
        H: R * 0.4 * (0.7 + rng() * 0.55),
        name: NAME_A[Math.floor(rng() * NAME_A.length)] + ' ' + NAME_B[Math.floor(rng() * NAME_B.length)],
        gulls: rng() < 0.35,
        palms: 2 + Math.floor(rng() * 5),
      };
    }
  }
  islandDataCache.set(key, d);
  return d;
}

const sandMat = new THREE.MeshStandardMaterial({ color: 0xdfb084, roughness: 1, flatShading: true });
const grassMat = new THREE.MeshStandardMaterial({ color: 0x5f9660, roughness: 1, flatShading: true });
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x96684a, roughness: 1, flatShading: true });
const frondMat = new THREE.MeshStandardMaterial({ color: 0x4a8a52, roughness: 1, flatShading: true });
const rockMat = new THREE.MeshStandardMaterial({ color: 0x8d7a85, roughness: 1, flatShading: true });
const gullMat = new THREE.MeshStandardMaterial({ color: 0xf5e8e0, roughness: 1, flatShading: true, side: THREE.DoubleSide });

function displaceRadial(geo, prof) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.001) continue;
    const f = prof(Math.atan2(z, x));
    p.setX(i, x * f);
    p.setZ(i, z * f);
  }
  geo.computeVertexNormals();
  return geo;
}

const foamRings = [];
const gullFlocks = [];
function buildIsland(d) {
  const g = new THREE.Group();
  const rng = mulberry32(d.seed ^ 0x9e3779b9);
  const prof = d.prof;
  const p2 = rng() * Math.PI * 2;

  // shore mound: wide below water, narrowing above
  const mound = new THREE.CylinderGeometry(d.R * 0.55, d.R, 11, 26, 3);
  displaceRadial(mound, prof);
  const moundMesh = new THREE.Mesh(mound, sandMat);
  moundMesh.position.y = -0.5; // spans -6 .. 5
  g.add(moundMesh);

  // beach cap
  const beach = new THREE.CircleGeometry(d.R * 0.74, 26);
  beach.rotateX(-Math.PI / 2);
  displaceRadial(beach, prof);
  const beachMesh = new THREE.Mesh(beach, sandMat);
  beachMesh.position.y = 1.1;
  g.add(beachMesh);

  // green hill
  const hill = new THREE.ConeGeometry(d.R * 0.55, d.H, 24, 6);
  {
    const p = hill.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r > 0.001) {
        const th = Math.atan2(z, x);
        const f = prof(th) * (0.86 + 0.16 * Math.sin(5 * th + p2)) * (1 + 0.14 * Math.sin(y * 1.6 + th * 3 + p2 * 2));
        p.setX(i, x * f);
        p.setZ(i, z * f);
      }
      p.setY(i, y + 0.028 * d.H * Math.sin(x * 0.7 + z * 0.9 + p2));
    }
    hill.computeVertexNormals();
  }
  const hillMesh = new THREE.Mesh(hill, grassMat);
  hillMesh.position.set(d.R * 0.05, d.H / 2 + 0.8, d.R * 0.03);
  g.add(hillMesh);

  // palms on the beach
  for (let i = 0; i < d.palms; i++) {
    const th = rng() * Math.PI * 2;
    const rr = d.R * (0.5 + rng() * 0.2) * prof(th);
    const palm = new THREE.Group();
    const lean = (rng() - 0.5) * 0.5;
    const h = 4.5 + rng() * 2.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, h, 6), trunkMat);
    trunk.position.y = h / 2;
    palm.add(trunk);
    const crown = new THREE.Group();
    crown.position.y = h;
    for (let f = 0; f < 6; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.6, 4), frondMat);
      frond.scale.y = 0.32; frond.scale.z = 0.5;
      const fa = (f / 6) * Math.PI * 2 + rng();
      frond.position.set(Math.cos(fa) * 1.3, 0.25, Math.sin(fa) * 1.3);
      frond.rotation.z = Math.PI / 2 - Math.cos(fa) * 1.15;
      frond.rotation.x = Math.sin(fa) * 1.15;
      crown.add(frond);
    }
    palm.add(crown);
    palm.rotation.z = lean;
    palm.position.set(Math.cos(th) * rr, 1.0, Math.sin(th) * rr);
    g.add(palm);
  }

  // rocks
  const nRocks = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < nRocks; i++) {
    const th = rng() * Math.PI * 2;
    const rr = d.R * (0.62 + rng() * 0.25) * prof(th);
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + rng() * 2.2, 0), rockMat);
    rock.position.set(Math.cos(th) * rr, 0.6, Math.sin(th) * rr);
    rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    g.add(rock);
  }

  // foam ring at the waterline
  const foamGeo = new THREE.RingGeometry(d.R * 0.9, d.R * 1.06, 40, 1);
  foamGeo.rotateX(-Math.PI / 2);
  displaceRadial(foamGeo, prof);
  const foam = new THREE.Mesh(foamGeo, new THREE.MeshBasicMaterial({
    color: 0xfff1e2, transparent: true, opacity: 0.12, depthWrite: false,
  }));
  foam.position.y = 0.25;
  g.add(foam);
  foamRings.push({ mesh: foam, phase: rng() * 10 });

  // gulls circling the peak
  if (d.gulls) {
    const flock = { center: new THREE.Vector3(d.x, d.H + 9, d.z), r: d.R * 0.85, birds: [], group: g };
    for (let b = 0; b < 3; b++) {
      const bird = new THREE.Group();
      const wl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.45), gullMat);
      const wr = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.45), gullMat);
      wl.position.x = -0.8; wr.position.x = 0.8;
      const gl = new THREE.Group(); gl.add(wl);
      const gr = new THREE.Group(); gr.add(wr);
      bird.add(gl, gr);
      bird.userData = { gl, gr, phase: b * 2.1 + rng() * 2 };
      scene.add(bird);
      flock.birds.push(bird);
    }
    gullFlocks.push(flock);
  }

  g.position.set(d.x, 0, d.z);
  scene.add(g);
  return g;
}

const islandMeshes = new Map();
function updateIslands(bx, bz) {
  const ci = Math.floor(bx / CELL), cj = Math.floor(bz / CELL);
  const keep = new Set();
  for (let i = ci - 2; i <= ci + 2; i++)
    for (let j = cj - 2; j <= cj + 2; j++) {
      const d = islandData(i, j);
      if (!d) continue;
      keep.add(d.key);
      if (!islandMeshes.has(d.key)) islandMeshes.set(d.key, { mesh: buildIsland(d), d });
      // fog hides everything past ~500m — don't draw islands beyond it
      islandMeshes.get(d.key).mesh.visible = Math.hypot(d.x - bx, d.z - bz) < 580;
    }
  for (const [key, entry] of islandMeshes)
    if (!keep.has(key)) entry.mesh.visible = false;
}
function nearbyIslands(bx, bz, range = 1) {
  const ci = Math.floor(bx / CELL), cj = Math.floor(bz / CELL);
  const out = [];
  for (let i = ci - range; i <= ci + range; i++)
    for (let j = cj - range; j <= cj + range; j++) {
      const d = islandData(i, j);
      if (d) out.push(d);
    }
  return out;
}

// ---------------------------------------------------------------- boat
const boat = {
  pos: new THREE.Vector3(0, 0, 0),
  heading: Math.atan2(SUN_DIR.x, SUN_DIR.z),
  speed: 0,
  pitch: 0, roll: 0, y: 0,
};
const boatRoot = new THREE.Group();
const boatTilt = new THREE.Group();
boatRoot.add(boatTilt);
scene.add(boatRoot);

let sailMesh, boomGroup, pennant, lanternLight;
{
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x8a4f32, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xb07a4a, roughness: 1, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x4a3226, roughness: 1, flatShading: true });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xffe4c4, roughness: 0.85, side: THREE.DoubleSide, flatShading: true });

  // lofted hull: sections stern -> bow, parabolic cross-sections
  const sections = [
    { z: -3.3, w: 1.05, keel: -0.5, deck: 0.62 },
    { z: -1.8, w: 1.42, keel: -0.78, deck: 0.62 },
    { z: 0.4, w: 1.5, keel: -0.84, deck: 0.62 },
    { z: 2.2, w: 1.12, keel: -0.68, deck: 0.7 },
    { z: 3.6, w: 0.1, keel: -0.3, deck: 0.95 },
  ];
  const ACROSS = 9;
  const verts = [], idx = [];
  for (let s = 0; s < sections.length; s++) {
    const sec = sections[s];
    for (let a = 0; a < ACROSS; a++) {
      const t = (a / (ACROSS - 1)) * 2 - 1;
      verts.push(t * sec.w, sec.keel + (sec.deck - sec.keel) * t * t, sec.z);
    }
  }
  for (let s = 0; s < sections.length - 1; s++)
    for (let a = 0; a < ACROSS - 1; a++) {
      const i0 = s * ACROSS + a, i1 = i0 + 1, i2 = i0 + ACROSS, i3 = i2 + 1;
      idx.push(i0, i2, i1, i1, i2, i3);
    }
  // stern transom
  const st = 0;
  for (let a = 1; a < ACROSS - 1; a++) idx.push(st, st + a + 1, st + a);
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  hullGeo.setIndex(idx);
  hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, hullMat);
  boatTilt.add(hull);

  // deck
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-1.02, -3.25);
  deckShape.lineTo(-1.44, -1.8);
  deckShape.lineTo(-1.47, 0.4);
  deckShape.lineTo(-1.1, 2.2);
  deckShape.lineTo(0, 3.55);
  deckShape.lineTo(1.1, 2.2);
  deckShape.lineTo(1.47, 0.4);
  deckShape.lineTo(1.44, -1.8);
  deckShape.lineTo(1.02, -3.25);
  deckShape.closePath();
  const deckGeo = new THREE.ShapeGeometry(deckShape);
  deckGeo.rotateX(-Math.PI / 2);
  deckGeo.scale(0.97, 1, 1);
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.y = 0.58;
  boatTilt.add(deck);

  // mast + boom + sails
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.4, 8), trimMat);
  mast.position.set(0, 3.6, 0.8);
  boatTilt.add(mast);

  boomGroup = new THREE.Group();
  boomGroup.position.set(0, 1.55, 0.8);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.1, 6), trimMat);
  boom.rotation.x = Math.PI / 2;
  boom.position.z = -1.55;
  boomGroup.add(boom);

  // main sail: triangle in (z,y), bellied in x
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0.15);
  sailShape.lineTo(0, 4.9);
  sailShape.lineTo(-2.9, 0.15);
  sailShape.closePath();
  const sailGeo = new THREE.ShapeGeometry(sailShape, 6);
  {
    const p = sailGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const sx = p.getX(i), sy = p.getY(i);
      const belly = Math.sin(Math.PI * clamp(-sx / 2.9, 0, 1)) * Math.sin(Math.PI * clamp(sy / 4.9, 0, 1));
      p.setZ(i, belly * 0.55);
    }
    sailGeo.computeVertexNormals();
  }
  sailGeo.rotateY(-Math.PI / 2); // shape x -> world -z... rotate so triangle spans z
  sailMesh = new THREE.Mesh(sailGeo, sailMat);
  sailMesh.position.set(0, 0.05, 0);
  boomGroup.add(sailMesh);
  boatTilt.add(boomGroup);

  // jib
  const jibShape = new THREE.Shape();
  jibShape.moveTo(0, 0);
  jibShape.lineTo(0, 3.9);
  jibShape.lineTo(2.4, 0);
  jibShape.closePath();
  const jibGeo = new THREE.ShapeGeometry(jibShape, 4);
  jibGeo.rotateY(-Math.PI / 2);
  const jib = new THREE.Mesh(jibGeo, sailMat);
  jib.position.set(0, 1.15, 1.05);
  boatTilt.add(jib);

  // pennant
  pennant = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0xd8543f, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
  pennant.rotation.z = Math.PI / 2;
  pennant.scale.z = 0.25;
  pennant.position.set(0, 6.9, 0.45);
  boatTilt.add(pennant);

  // stern lantern
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), trimMat);
  post.position.set(0, 1.1, -3.0);
  boatTilt.add(post);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xffc887, emissive: 0xff9b3d, emissiveIntensity: 2.4, roughness: 0.6 }));
  bulb.position.set(0, 1.72, -3.0);
  boatTilt.add(bulb);
  lanternLight = new THREE.PointLight(0xff9b4d, 14, 26, 2);
  lanternLight.position.set(0, 2.1, -2.8);
  boatTilt.add(lanternLight);

  // tiller
  const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.3, 6), trimMat);
  tiller.rotation.x = Math.PI / 2 - 0.35;
  tiller.position.set(0, 0.85, -2.5);
  boatTilt.add(tiller);
}

// ---------------------------------------------------------------- wake
const wakePool = [];
{
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,240,225,0.85)');
  grad.addColorStop(1, 'rgba(255,240,225,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  for (let i = 0; i < 70; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    sp.visible = false;
    scene.add(sp);
    wakePool.push({ sp, t: 0, life: 1, active: false });
  }
}
let wakeTimer = 0, wakeIdx = 0;
function spawnWake(x, y, z, big) {
  const w = wakePool[wakeIdx = (wakeIdx + 1) % wakePool.length];
  w.sp.position.set(x, y, z);
  w.t = 0;
  w.life = big ? 1.6 : 1.1;
  w.big = big;
  w.active = true;
  w.sp.visible = true;
}
function updateWake(dt, t) {
  for (const w of wakePool) {
    if (!w.active) continue;
    w.t += dt;
    const u = w.t / w.life;
    if (u >= 1) { w.active = false; w.sp.visible = false; continue; }
    const s = (w.big ? 2.6 : 1.4) + u * (w.big ? 5 : 2.6);
    w.sp.scale.set(s, s, 1);
    w.sp.material.opacity = 0.25 * (1 - u);
    w.sp.position.y = waveHeight(w.sp.position.x, w.sp.position.z, t) + 0.25;
  }
}

// ---------------------------------------------------------------- input
const input = { throttle: 0, steer: 0 };
const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; startAudio(); });
addEventListener('keyup', (e) => { keys[e.code] = false; });

const stickBase = document.getElementById('stick-base');
const stickKnob = document.getElementById('stick-knob');
const touch = { active: false, id: null, ox: 0, oy: 0, tx: 0, ty: 0 };
renderer.domElement.addEventListener('pointerdown', (e) => {
  startAudio();
  if (touch.active) return;
  touch.active = true; touch.id = e.pointerId;
  touch.ox = e.clientX; touch.oy = e.clientY;
  touch.tx = 0; touch.ty = 0;
  stickBase.style.display = stickKnob.style.display = 'block';
  stickBase.style.left = stickKnob.style.left = e.clientX + 'px';
  stickBase.style.top = stickKnob.style.top = e.clientY + 'px';
});
addEventListener('pointermove', (e) => {
  if (!touch.active || e.pointerId !== touch.id) return;
  let dx = e.clientX - touch.ox, dy = e.clientY - touch.oy;
  const len = Math.hypot(dx, dy), max = 52;
  if (len > max) { dx *= max / len; dy *= max / len; }
  touch.tx = dx / max; touch.ty = dy / max;
  stickKnob.style.left = (touch.ox + dx) + 'px';
  stickKnob.style.top = (touch.oy + dy) + 'px';
});
function endTouch(e) {
  if (!touch.active || e.pointerId !== touch.id) return;
  touch.active = false; touch.tx = 0; touch.ty = 0;
  stickBase.style.display = stickKnob.style.display = 'none';
}
addEventListener('pointerup', endTouch);
addEventListener('pointercancel', endTouch);

function readInput(dt) {
  let th = 0, st = 0;
  if (keys.KeyW || keys.ArrowUp) th += 1;
  if (keys.KeyS || keys.ArrowDown) th -= 1;
  if (keys.KeyD || keys.ArrowRight) st += 1;
  if (keys.KeyA || keys.ArrowLeft) st -= 1;
  th += -touch.ty;
  st += touch.tx;
  input.throttle += (clamp(th, -1, 1) - input.throttle) * damp(9, dt);
  input.steer += (clamp(st, -1, 1) - input.steer) * damp(9, dt);
}

// ---------------------------------------------------------------- audio (tiny, optional)
let AC = null, ambientOn = false;
function startAudio() {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    if (!ambientOn && AC) {
      ambientOn = true;
      const len = AC.sampleRate * 3;
      const buf = AC.createBuffer(1, len, AC.sampleRate);
      const ch = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = last * 0.985 + (Math.random() * 2 - 1) * 0.05; // brownish
        ch[i] = last;
      }
      const src = AC.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filt = AC.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      const g = AC.createGain();
      g.gain.value = 0.05;
      const lfo = AC.createOscillator(), lg = AC.createGain();
      lfo.frequency.value = 0.08; lg.gain.value = 0.025;
      lfo.connect(lg).connect(g.gain);
      src.connect(filt).connect(g).connect(AC.destination);
      src.start(); lfo.start();
    }
  } catch { /* audio unavailable */ }
}
function chime() {
  try {
    if (!AC) return;
    [[660, 0], [880, 0.13]].forEach(([f, delay]) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t0 = AC.currentTime + delay;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      o.connect(g).connect(AC.destination);
      o.start(t0); o.stop(t0 + 0.7);
    });
  } catch { /* no-op */ }
}

// ---------------------------------------------------------------- UI
const countEl = document.getElementById('count');
const toastEl = document.getElementById('toast');
const needleEl = document.getElementById('needle');
const distEl = document.getElementById('dist');
const hintEl = document.getElementById('hint');
setTimeout(() => { hintEl.style.opacity = 0; }, 9000);

const discovered = new Set();
let toastTimer = null;
function discover(d) {
  discovered.add(d.key);
  countEl.textContent = `Islands discovered: ${discovered.size}`;
  toastEl.textContent = `⚑ Discovered — ${d.name}`;
  toastEl.style.opacity = 1;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.opacity = 0; }, 3800);
  chime();
}

function updateCompass() {
  let best = null, bestD = Infinity;
  for (const d of nearbyIslands(boat.pos.x, boat.pos.z, 4)) {
    if (discovered.has(d.key)) continue;
    const dd = Math.hypot(d.x - boat.pos.x, d.z - boat.pos.z);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  if (!best) { distEl.textContent = '—'; return; }
  const worldBearing = Math.atan2(best.x - boat.pos.x, best.z - boat.pos.z);
  const camYaw = Math.atan2(camera.position.x - boat.pos.x, camera.position.z - boat.pos.z) + Math.PI;
  const rel = worldBearing - camYaw;
  needleEl.style.transform = `rotate(${(-rel * 180 / Math.PI).toFixed(1)}deg)`;
  distEl.textContent = Math.round(bestD) + 'm';
}

// ---------------------------------------------------------------- physics
const BOAT_R = 3;
function updateBoat(dt, t) {
  const accel = input.throttle > 0 ? 8.5 * input.throttle : 4.5 * input.throttle;
  boat.speed += accel * dt;
  boat.speed *= Math.exp(-0.55 * dt);
  boat.speed = clamp(boat.speed, -4.5, 15.5);
  if (Math.abs(boat.speed) < 0.01 && input.throttle === 0) boat.speed = 0;

  const spdF = clamp(Math.abs(boat.speed) / 9, 0, 1);
  const dir = boat.speed < -0.2 ? -1 : 1;
  boat.heading -= input.steer * dt * 1.05 * (0.35 + spdF) * dir;

  const fx = Math.sin(boat.heading), fz = Math.cos(boat.heading);
  boat.pos.x += fx * boat.speed * dt;
  boat.pos.z += fz * boat.speed * dt;

  // solid shores (collision follows each island's blobby waterline)
  for (const d of nearbyIslands(boat.pos.x, boat.pos.z, 1)) {
    const dx = boat.pos.x - d.x, dz = boat.pos.z - d.z;
    const dist = Math.hypot(dx, dz);
    const minD = d.shoreR(Math.atan2(dz, dx)) + BOAT_R;
    if (dist < minD && dist > 0.001) {
      const nx = dx / dist, nz = dz / dist;
      boat.pos.x = d.x + nx * minD;
      boat.pos.z = d.z + nz * minD;
      // kill inward velocity, scrub speed
      const vInto = -(fx * nx + fz * nz) * boat.speed;
      if (vInto > 0) boat.speed *= 0.55;
      spawnWake(boat.pos.x + nx * -1.5, 0.3, boat.pos.z + nz * -1.5, true);
    }
    if (!discovered.has(d.key) && dist < d.R * 0.75 + 45) discover(d);
  }

  // buoyancy from 4 hull samples
  const bowX = boat.pos.x + fx * 3.1, bowZ = boat.pos.z + fz * 3.1;
  const stX = boat.pos.x - fx * 3.1, stZ = boat.pos.z - fz * 3.1;
  const rx = Math.cos(boat.heading), rz = -Math.sin(boat.heading);
  const pX = boat.pos.x + rx * 1.4, pZ = boat.pos.z + rz * 1.4;
  const sX = boat.pos.x - rx * 1.4, sZ = boat.pos.z - rz * 1.4;
  const hBow = waveHeight(bowX, bowZ, t), hSt = waveHeight(stX, stZ, t);
  const hP = waveHeight(pX, pZ, t), hS = waveHeight(sX, sZ, t);
  const targetY = (hBow + hSt + hP + hS) / 4 + 0.35;
  const targetPitch = Math.atan2(hSt - hBow, 6.2) * 0.85;
  const heel = input.steer * spdF * 0.24;
  const targetRoll = Math.atan2(hP - hS, 2.8) * 0.7 + heel;

  boat.y += (targetY - boat.y) * damp(7, dt);
  boat.pitch += (targetPitch - boat.pitch) * damp(4.5, dt);
  boat.roll += (targetRoll - boat.roll) * damp(4.5, dt);

  boatRoot.position.set(boat.pos.x, boat.y, boat.pos.z);
  boatRoot.rotation.y = boat.heading;
  boatTilt.rotation.x = boat.pitch;
  boatTilt.rotation.z = boat.roll;

  // boom swings gently with steering, pennant flutters
  boomGroup.rotation.y += ((input.steer * 0.5 - 0.28) - boomGroup.rotation.y) * damp(2.5, dt);
  pennant.rotation.y = Math.sin(t * 7) * 0.35;

  // wake
  wakeTimer -= dt;
  if (Math.abs(boat.speed) > 2.5 && wakeTimer <= 0) {
    wakeTimer = 0.07;
    spawnWake(stX + (Math.random() - 0.5), 0.3, stZ + (Math.random() - 0.5), false);
    if (boat.speed > 8) spawnWake(bowX, 0.3, bowZ, false);
  }
}

// ---------------------------------------------------------------- camera
const camPos = new THREE.Vector3(0, 8, -18);
const camTarget = new THREE.Vector3();
let camInit = false;
function updateCamera(dt) {
  const fx = Math.sin(boat.heading), fz = Math.cos(boat.heading);
  const dist = 13 + Math.abs(boat.speed) * 0.28;
  const desired = new THREE.Vector3(
    boat.pos.x - fx * dist,
    boat.y + 6.4,
    boat.pos.z - fz * dist
  );
  const tgt = new THREE.Vector3(boat.pos.x + fx * 7, boat.y + 2.4, boat.pos.z + fz * 7);
  if (!camInit) { camPos.copy(desired); camTarget.copy(tgt); camInit = true; }
  camPos.lerp(desired, damp(3.2, dt));
  camTarget.lerp(tgt, damp(5, dt));
  // keep camera above the waves
  const minY = waveHeight(camPos.x, camPos.z, simTime) + 2.2;
  if (camPos.y < minY) camPos.y = minY;
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
}

// ---------------------------------------------------------------- main loop
let simTime = 0;
const SEG = WATER_SIZE / WATER_SEGS;
function tick(dt) {
  simTime += dt;
  readInput(dt);
  updateBoat(dt, simTime);
  updateCamera(dt);
  updateIslands(boat.pos.x, boat.pos.z);
  updateWake(dt, simTime);
  updateCompass();

  waterUniforms.uTime.value = simTime;
  waterUniforms.uCamPos.value.copy(camera.position);
  water.position.set(
    Math.round(boat.pos.x / SEG) * SEG, 0,
    Math.round(boat.pos.z / SEG) * SEG
  );
  skyDome.position.copy(camera.position);
  cloudGroup.position.set(camera.position.x, 0, camera.position.z);
  cloudGroup.rotation.y += dt * 0.002;

  for (const f of foamRings) {
    if (!f.mesh.parent.visible) continue;
    f.mesh.material.opacity = 0.1 + 0.05 * Math.sin(simTime * 1.6 + f.phase);
    const s = 1 + 0.03 * Math.sin(simTime * 1.1 + f.phase);
    f.mesh.scale.set(s, 1, s);
  }
  for (const fl of gullFlocks) {
    const vis = fl.group.visible;
    for (const bird of fl.birds) {
      bird.visible = vis;
      if (!vis) continue;
      const ph = simTime * 0.45 + bird.userData.phase;
      bird.position.set(
        fl.center.x + Math.cos(ph) * fl.r,
        fl.center.y + Math.sin(ph * 1.7) * 2.5,
        fl.center.z + Math.sin(ph) * fl.r
      );
      bird.rotation.y = -ph - Math.PI / 2;
      const flap = Math.sin(simTime * 9 + bird.userData.phase) * 0.6;
      bird.userData.gl.rotation.z = flap;
      bird.userData.gr.rotation.z = -flap;
    }
  }
}

// test hooks (browser pane throttles rAF when hidden — drive via tick/render)
window.__sea = {
  tick,
  render: () => renderer.render(scene, camera),
  boat,
  input,
  setInput: (th, st) => { keys.__test = true; touch.tx = st; touch.ty = -th; touch.active = true; },
  clearInput: () => { touch.active = false; touch.tx = 0; touch.ty = 0; for (const k in keys) keys[k] = false; },
  teleport: (x, z) => { boat.pos.set(x, 0, z); boat.speed = 0; camInit = false; },
  nearbyIslands: (r = 2) => nearbyIslands(boat.pos.x, boat.pos.z, r),
  discovered,
  waveHeight,
  camera,
  info: renderer.info,
};

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  tick(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
});
