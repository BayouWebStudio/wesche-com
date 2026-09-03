/* 01_world.js — procedural world generation (calm island) */
"use strict";

/* Deterministic pseudo-random (mulberry32) so the starting world is stable */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* Smooth value noise (1D & 2D) built on rng-fixed permutation */
function makeNoise(seed) {
  const rng = makeRng(seed);
  const perm = new Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function hash(ix, iz) {
    let h = perm[ix & 255] + perm[iz & 255];
    h = (h * 374761393) & 0xffffffff;
    h = (h ^ (h >>> 13)) * 1274126177 & 0xffffffff;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function noise2(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const u = smooth(fx), v = smooth(fz);
    const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  return noise2;
}

/* Build a calm island: water rim, sand, grass, a couple of forest/rock/snow patches */
function buildWorld(cols, rows, seed) {
  const noise = makeNoise(seed);
  const grid = [];
  // Fraction of the map that is land roughly; radial falloff for island feel
  for (let z = 0; z < rows; z++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      // normalized coords, island center
      const nx = x / cols, nz = z / rows;
      const dx = (nx - 0.5) * 2, dz = (nz - 0.5) * 2;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const e = noise(x * 0.07, z * 0.07) * 0.6 +
                noise(x * 0.021, z * 0.021) * 0.4;
      // island falloff pushes edges to water
      const land = e - dist * 0.55 + 0.34;
      let t;
      if (land < 0.30) t = "water";
      else if (land < 0.40) t = "sand";
      else {
        // elevation bands -> grass/forest/rock/snow
        const e2 = noise(x * 0.05 + 40, z * 0.05 + 40);
        if (land > 0.74 && e2 > 0.62) t = "snow";
        else if (land > 0.66 && e2 > 0.55) t = "rock";
        else if (e2 > 0.5) t = "forest";
        else t = "grass";
      }
      row.push(t);
    }
    grid.push(row);
  }
  return grid;
}

/* Count terrain for stats */
function countTerrain(grid) {
  const counts = { water:0, sand:0, grass:0, forest:0, rock:0, snow:0, objects:0 };
  for (const row of grid) for (const t of row) counts[t] = (counts[t] || 0) + 1;
  return counts;
}

/* Expose */
if (typeof window !== "undefined") {
  window.buildWorld = buildWorld; window.countTerrain = countTerrain; window.makeRng = makeRng; window.makeNoise = makeNoise;
}
