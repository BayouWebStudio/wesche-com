// js/islands.js — procedural islands: sculpted terrain, palm trees, collision heightfield
import * as THREE from 'three';

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// deterministic island shape noise
function islandNoise(x, z, rnd) {
  return Math.sin(x * 0.35 + rnd.a) * Math.cos(z * 0.28 + rnd.b) * 0.5 +
         Math.sin((x + z) * 0.18 + rnd.c) * 0.5;
}

// height above sea level at world point for island (used for collision + boat grounding)
export function islandHeight(isl, wx, wz) {
  const dx = wx - isl.x, dz = wz - isl.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const R = isl.R1;
  if (d >= R * 1.08) return -1; // below water
  const edge = 1 - smoothstep(R * 0.55, R, d);
  let h = edge * isl.H;
  const n = islandNoise(dx, dz, isl.rnd);
  h += n * isl.H * 0.22 * edge;
  return h; // >0 = solid ground above sea
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function makePalmTree(rnd) {
  const g = new THREE.Group();
  const trunkH = 4.2 + rnd() * 3.4;
  const curvePts = [];
  const lean = (rnd() - 0.5) * 2.2;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    curvePts.push(new THREE.Vector3(lean * t * t, trunkH * t, lean * 0.4 * t * t));
  }
  const curve = new THREE.CatmullRomCurve3(curvePts);
  const trunk = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 6, 0.16, 5),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2e })
  );
  g.add(trunk);
  const top = curvePts[8];
  const nF = 6 + Math.floor(rnd() * 3);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f6b32, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(mergedFronds(top, nF, rnd), frondMat));
  // coconuts
  const coco = new THREE.Mesh(new THREE.SphereGeometry(0.16, 5, 4),
    new THREE.MeshLambertMaterial({ color: 0x4a3220 }));
  coco.position.copy(top).add(new THREE.Vector3(0.2, -0.15, 0.15));
  g.add(coco);
  return g;
}

let _frondTemplate = null;
function palmFrondTemplate() {
  // single flat frond in XY plane, base at origin, tip at +X
  if (_frondTemplate) return _frondTemplate;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(1.2, 0.55, 2.6, 0.12);
  shape.lineTo(2.8, -0.12);
  shape.quadraticCurveTo(1.2, -0.45, 0, 0);
  _frondTemplate = new THREE.ShapeGeometry(shape, 5);
  return _frondTemplate;
}

// bake n fronds (rotated around the crown) into ONE geometry => 1 draw call per palm
function mergedFronds(top, nF, rndFn) {
  const tpl = palmFrondTemplate();
  const srcPos = tpl.attributes.position.array;
  const srcIdx = tpl.index.array;
  const verts = [], idx = [];
  const e = new THREE.Euler(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  for (let f = 0; f < nF; f++) {
    const a = (f / nF) * Math.PI * 2 + rndFn() * 0.6;
    e.set(-0.5 - rndFn() * 0.5, a, (rndFn() - 0.5) * 0.3, 'YXZ');
    m.makeRotationFromEuler(e);
    const base = verts.length / 3;
    for (let i = 0; i < srcPos.length; i += 3) {
      v.set(srcPos[i], srcPos[i + 1], srcPos[i + 2]).applyMatrix4(m).add(top);
      verts.push(v.x, v.y, v.z);
    }
    for (let i = 0; i < srcIdx.length; i++) idx.push(srcIdx[i] + base);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function makeIsland(x, z, seed) {
  const rnd = mulberry(seed);
  const R1 = 14 + rnd() * 16;          // shore radius (sandline ~ R1)
  const H = 5 + rnd() * 9;             // peak height
  const isl = {
    x, z, R1, R2: R1 + 30, H,
    rnd: { a: rnd() * 7, b: rnd() * 7, c: rnd() * 7 },
    seed, discovered: false,
    name: null, mesh: null,
  };

  // terrain heightfield disc
  const planeGeo = new THREE.PlaneGeometry(R1 * 2.3, R1 * 2.3, 36, 36);
  planeGeo.rotateX(-Math.PI / 2);
  const pos = planeGeo.attributes.position;
  const colArr = [];
  const sand = new THREE.Color(0xe8cf9a), grass = new THREE.Color(0x3e7a3a),
        rock = new THREE.Color(0x7a6a58), snowish = new THREE.Color(0xd8cfa8);
  const tmpC = new THREE.Color();
  let anyAbove = false;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i), lz = pos.getZ(i);
    const wx = x + lx, wz = z + lz;
    let h = islandHeight(isl, wx, wz);
    const clamped = Math.max(h, -0.6);
    pos.setY(i, clamped);
    if (clamped > 0.05) anyAbove = true;
    if (clamped < 0.4) tmpC.copy(sand);
    else if (clamped < H * 0.45) tmpC.copy(grass);
    else if (clamped < H * 0.8) tmpC.copy(rock);
    else tmpC.copy(snowish);
    tmpC.offsetHSL(0, 0, (rnd() - 0.5) * 0.03);
    colArr.push(tmpC.r, tmpC.g, tmpC.b);
  }
  planeGeo.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
  planeGeo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(planeGeo, mat);
  mesh.position.set(x, 0, z);
  mesh.receiveShadow = false;
  isl.mesh = mesh;

  // scatter palms + rocks on land
  const props = new THREE.Group();
  props.position.set(x, 0, z);
  let placed = 0, tries = 0;
  while (placed < 7 && tries < 60) {
    tries++;
    const a = rnd() * Math.PI * 2, r = rnd() * R1 * 0.7;
    const wx = x + Math.cos(a) * r, wz = z + Math.sin(a) * r;
    const h = islandHeight(isl, wx, wz);
    if (h > 1.4) {
      const palm = makePalmTree(rnd);
      palm.position.set(wx - x, h - 0.1, wz - z);
      palm.rotation.y = rnd() * 6.28;
      props.add(palm);
      placed++;
    }
  }
  // shoreline rocks
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const r = R1 * (0.95 + rnd() * 0.08);
    const rockMesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.4 + rnd() * 0.9, 0),
      new THREE.MeshLambertMaterial({ color: 0x6f6250 })
    );
    rockMesh.position.set(Math.cos(a) * r, 0.15, Math.sin(a) * r);
    rockMesh.scale.y = 0.6;
    props.add(rockMesh);
  }
  mesh.add(props);
  return isl;
}

const NAMES = [
  'Amber Cay', 'Solara', 'Duskfall Isle', 'Marlin Rock', 'Coral Ember',
  'Halcyon Key', 'Tidecrest', 'Palma Sola', 'Frigate Rest', 'Cinder Cay',
  'Glasswater', 'Herons Drift', 'Sundara', 'Pelican Rest', 'Wavebreak',
];
export function pickName(i) { return NAMES[i % NAMES.length]; }
