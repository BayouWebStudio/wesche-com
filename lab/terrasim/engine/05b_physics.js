/* 05b_physics.js — cellular simulation: water flow, erosion, vegetation, snow melt */
"use strict";

/* Base ground elevation (voxel units) per terrain — the "height" the ground sits at. */
const GROUND_ELEV = { water: 0, sand: 1, grass: 3, forest: 4, rock: 6, snow: 8 };

/* Allocate elevation + water layers and seed them from the terrain grid. */
function initPhysics(worldW, worldH, grid) {
  const noise = makeNoise(1337);
  const elev = [];
  const water = [];
  for (let z = 0; z < worldH; z++) {
    const er = [], wr = [];
    for (let x = 0; x < worldW; x++) {
      const t = grid[z][x];
      const base = GROUND_ELEV[t] != null ? GROUND_ELEV[t] : 3;
      const n = Math.round((noise(x * 0.25, z * 0.25) - 0.5) * 1.6);
      const e = Math.max(0, base + n);
      er.push(e);
      wr.push(t === "water" ? 1.0 : 0);
    }
    elev.push(er); water.push(wr);
  }
  return { elev, water };
}

function initSimState() {
  if (!S.sim) S.sim = { on: true, speed: 1, tick: 0, erosion: true, veg: true, melt: true, rate: 0.10 };
  return S.sim;
}

/* ---- water flow: explicit relaxation toward level surfaces ---- */
function stepWater(elev, water, worldW, worldH, rate) {
  const next = [];
  for (let z = 0; z < worldH; z++) next.push(new Float64Array(worldW).fill(0));
  for (let z = 0; z < worldH; z++) {
    for (let x = 0; x < worldW; x++) {
      const w = water[z][x];
      if (w <= 0.0001) continue;
      const y = elev[z][x] + w;
      // how much this cell can give away this step (cap so it doesn't over-drain)
      const budget = w * rate * 0.5;
      let remaining = w;
      const nbr = [
        [x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]
      ];
      let moved = 0;
      for (const [nx, nz] of nbr) {
        if (nx < 0 || nz < 0 || nx >= worldW || nz >= worldH) continue;
        const yn = elev[nz][nx] + water[nz][nx];
        if (yn < y) {
          let f = Math.min(budget, (y - yn) * 0.25, remaining - 0.0001);
          if (f > 0.0001) { moved += f; remaining -= f; next[nz][nx] += f; }
        }
      }
      next[z][x] += remaining; // keep what didn't move
    }
  }
  // write back: blend for smoothness
  for (let z = 0; z < worldH; z++) for (let x = 0; x < worldW; x++) water[z][x] = next[z][x];
  return next;
}

/* ---- erosion: fast-moving surface water wears high ground, deposits in low ---- */
function stepErosion(elev, water, grid, worldW, worldH) {
  // only on cells that have water above them
  for (let z = 1; z < worldH - 1; z++) {
    for (let x = 1; x < worldW - 1; x++) {
      const g = grid[z][x];
      if (g === "water" || g === "rock" || g === "snow") continue;
      if (water[z][x] < 0.4) continue;
      // if a neighbor is lower, shave a hair off this cell
      const myTop = elev[z][x];
      const lower = [[x-1,z],[x+1,z],[x,z-1],[x,z+1]].some(([nx,nz]) =>
        (elev[nz][nx] < myTop - 0.5) && grid[nz][nx] !== "water");
      if (lower && myTop > GROUND_ELEV[g]) {
        elev[z][x] -= 0.02;
        // turn very eroded ground into sand (sediment)
        if (g === "grass" && elev[z][x] <= GROUND_ELEV.grass - 1.2) grid[z][x] = "sand";
        else if (g === "grass" && elev[z][x] <= GROUND_ELEV.grass - 1.0) grid[z][x] = "sand";
      }
    }
  }
}

/* ---- vegetation: grass spreads to sand, forest to grass (slow, calm) ---- */
function stepVegetation(grid, worldW, worldH, chance) {
  const changes = [];
  for (let z = 1; z < worldH - 1; z++) {
    for (let x = 1; x < worldW - 1; x++) {
      const g = grid[z][x];
      if (g === "sand") {
        if (hasNeighbor(grid, x, z, "grass") && Math.random() < chance) changes.push([x, z, "grass"]);
      } else if (g === "grass") {
        if (hasNeighbor(grid, x, z, "forest") && Math.random() < chance * 0.5) changes.push([x, z, "forest"]);
      }
    }
  }
  for (const [x, z, t] of changes) grid[z][x] = t;
}

function hasNeighbor(grid, x, z, t) {
  return grid[z] && (grid[z][x-1] === t || grid[z][x+1] === t ||
    (grid[z-1] && grid[z-1][x] === t) || (grid[z+1] && grid[z+1][x] === t));
}

/* ---- snow melt: snow next to warm sand lowers and adds a bit of water ---- */
function stepMelt(elev, water, grid, worldW, worldH, chance) {
  for (let z = 1; z < worldH - 1; z++) {
    for (let x = 1; x < worldW - 1; x++) {
      if (grid[z][x] === "snow" && hasNeighbor(grid, x, z, "sand") && Math.random() < chance) {
        grid[z][x] = "rock";
        water[z][x] = Math.min(3, water[z][x] + 0.4);
      }
    }
  }
}

/* ---- one physics tick ---- */
function simTick() {
  if (!S.sim || !S.sim.on) return;
  const t = S.sim.tick++;
  const rate = S.sim.rate * Math.min(2, S.sim.speed);
  // water flow (run a couple sub-steps for smoother leveling)
  stepWater(S.elev, S.water, S.worldW, S.worldH, rate);
  if (S.sim.erosion) stepErosion(S.elev, S.water, S.grid, S.worldW, S.worldH);
  if (S.sim.veg && t % 8 === 0) stepVegetation(S.grid, S.worldW, S.worldH, 0.02);
  if (S.sim.melt && t % 12 === 0) stepMelt(S.elev, S.water, S.grid, S.worldW, S.worldH, 0.02);
  S.stats = countTerrain(S.grid);
  S.dirty = true;
}

/* ---- rain: add water to a random patch of land (a "rain cloud" burst) ---- */
function rainPatch(amount) {
  const cx = Math.floor(Math.random() * S.worldW), cz = Math.floor(Math.random() * S.worldH);
  const r = 3 + Math.floor(Math.random() * 3);
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (dx*dx + dz*dz > r*r) continue;
    const x = cx + dx, z = cz + dz;
    if (x < 0 || z < 0 || x >= S.worldW || z >= S.worldH) continue;
    if (S.grid[z][x] === "water") continue;
    S.water[z][x] = Math.min(3, (S.water[z][x] || 0) + amount * (0.6 + Math.random() * 0.6));
  }
  S.dirty = true;
}

if (typeof window !== "undefined") {
  window.initPhysics = initPhysics; window.initSimState = initSimState; window.simTick = simTick;
  window.stepWater = stepWater; window.stepErosion = stepErosion; window.stepVegetation = stepVegetation;
  window.stepMelt = stepMelt; window.rainPatch = rainPatch; window.GROUND_ELEV = GROUND_ELEV;
}
