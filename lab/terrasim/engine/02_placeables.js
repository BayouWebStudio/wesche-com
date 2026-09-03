/* 02_placeables.js — generative brick-built placeable objects */
"use strict";

/* Each placeable is generated procedurally:
   - `make(obj, rng)` builds its brick layout (list of oriented bricks).
   - `draw(ctx, obj, time)` renders it with glossy plastic shading in world space.
   Objects are positioned on a cell; their buildings sit on a base plate of cells.
*/

/* The list of generator functions keyed by name. Returns an object with:
   { w, h, cells:[{dx,dy,layer,color,type}], sway:0..1 (how much it sways in wind),
     shadow:true }  where cells are brick blocks in tile-units (dx,dz offsets, layer=height stack)
*/
const PLACEABLE_FACTORIES = {};

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function pickColor(rng, arr) { const p = pick(rng, arr); return p; }

/* ---- helper to build a simple stack of bricks ---- */
function brickStack(rng, cx, cz, baseColor, height, wobble) {
  const cells = [];
  for (let l = 0; l < height; l++) {
    const w = 1, d = 1;
    const off = l > 0 && wobble ? Math.round((rng() - 0.5) * wobble) : 0;
    cells.push({ dx: off, dz: 0, layer: l, w, d, color: baseColor, type: "block" });
  }
  return cells;
}

/* ---- FACTORY: leafy round tree (grass) ---- */
PLACEABLE_FACTORIES.tree = function (rng) {
  const cells = [];
  const trunk = "#9a8666", leaf = pick(rng, PALETTE.flora);
  // trunk
  cells.push({ dx:0, dz:0, layer:0, w:1, d:1, color:trunk, type:"block" });
  cells.push({ dx:0, dz:0, layer:1, w:1, d:1, color:trunk, type:"block" });
  // canopy - blobby clusters
  const canopy = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < canopy; i++) {
    const dx = Math.round((rng() - 0.5) * 2.2), dz = Math.round((rng() - 0.5) * 2.2);
    const layer = 1 + Math.floor(rng() * 2);
    cells.push({ dx, dz, layer, w:1, d:1, color: leaf, type:"block" });
  }
  // round top
  cells.push({ dx:0, dz:0, layer:3, w:1, d:1, color: leaf, type:"block" });
  return { w: 3, h: 4, cells, sway: 0.18, shadow: true };
};

/* ---- FACTORY: pine (forest / snow) ---- */
PLACEABLE_FACTORIES.pine = function (rng) {
  const cells = [], c = pick(rng, PALETTE.flora);
  cells.push({ dx:0, dz:0, layer:0, w:1, d:1, color:"#9a8666", type:"block" });
  cells.push({ dx:0, dz:0, layer:1, w:1, d:1, color:c, type:"block" });
  cells.push({ dx:0, dz:0, layer:2, w:1, d:1, color:c, type:"block" });
  cells.push({ dx:0, dz:0, layer:3, w:1, d:1, color: pick(rng, PALETTE.flora), type:"block" });
  cells.push({ dx:-1, dz:0, layer:1, w:1, d:1, color:c, type:"block" });
  cells.push({ dx:1, dz:0, layer:1, w:1, d:1, color:c, type:"block" });
  return { w:3, h:4, cells, sway:0.1, shadow:true };
};

/* ---- FACTORY: flower patch (grass) ---- */
PLACEABLE_FACTORIES.flower = function (rng) {
  const cells = [], stem = "#a8ba8f";
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const dx = Math.round((rng() - 0.5) * 3), dz = Math.round((rng() - 0.5) * 3);
    cells.push({ dx, dz, layer:0, w:1, d:1, color:stem, type:"stem" });
    cells.push({ dx, dz, layer:1, w:1, d:1, color: pick(rng, PALETTE.petals), type:"petal" });
  }
  return { w:5, h:2, cells, sway:0.22, shadow:false };
};

/* ---- FACTORY: bush (grass) ---- */
PLACEABLE_FACTORIES.bush = function (rng) {
  const cells = [], c = pick(rng, PALETTE.flora);
  const n = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    cells.push({ dx: Math.round((rng()-0.5)*2.4), dz: Math.round((rng()-0.5)*2.4), layer: Math.floor(rng()*2), w:1, d:1, color: c, type:"block" });
  }
  return { w:4, h:3, cells, sway:0.16, shadow:true };
};

/* ---- FACTORY: rock (grass/forest) ---- */
PLACEABLE_FACTORIES.rock = function (rng) {
  const cells = [], c = pick(rng, [PALETTE.rock.base, PALETTE.rock.light, PALETTE.rock.edge]);
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    cells.push({ dx: Math.round((rng()-0.5)*2), dz: Math.round((rng()-0.5)*2), layer: Math.floor(rng()*2), w:1, d:1, color: c, type:"block" });
  }
  cells.push({ dx:0, dz:0, layer:2, w:1, d:1, color:pick(rng,[PALETTE.rock.light,PALETTE.rock.base]), type:"block" });
  return { w:4, h:3, cells, sway:0, shadow:true };
};

/* ---- FACTORY: boulder (rock) ---- */
PLACEABLE_FACTORIES.boulder = function (rng) {
  const cells = [], c = PALETTE.rock.base;
  cells.push({ dx:0, dz:0, layer:0, w:2, d:2, color:c, type:"block" });
  cells.push({ dx:0, dz:0, layer:1, w:2, d:2, color:c, type:"block" });
  cells.push({ dx:0.5, dz:0.5, layer:2, w:1, d:1, color:"#bdbdba", type:"block" });
  return { w:3, h:3, cells, sway:0, shadow:true };
};

/* ---- FACTORY: crag (rock) ---- */
PLACEABLE_FACTORIES.crag = function (rng) {
  const cells = [];
  const h = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < h; i++) cells.push({ dx:0, dz:0, layer:i, w:1, d:1, color: PALETTE.rock.edge, type:"block" });
  for (let i = 0; i < 2; i++) { const l = Math.floor(rng()*h); cells.push({ dx:(rng()<0.5?-1:1), dz:0, layer:l, w:1, d:1, color:PALETTE.rock.base, type:"block" }); }
  return { w:3, h:h+1, cells, sway:0, shadow:true };
};

/* ---- FACTORY: owlet (rock) — a single little owl-ish brick creature ---- */
PLACEABLE_FACTORIES.owlet = function (rng) {
  const cells = [], c = "#b0a58f";
  cells.push({ dx:0, dz:0, layer:0, w:1, d:1, color:c, type:"block" });
  cells.push({ dx:0, dz:0, layer:1, w:1, d:1, color:c, type:"block" });
  cells.push({ dx:-1, dz:0, layer:1, w:1, d:1, color:"#e9dcc4", type:"block" });
  cells.push({ dx:1, dz:0, layer:1, w:1, d:1, color:"#e9dcc4", type:"block" });
  cells.push({ dx:0, dz:0, layer:2, w:1, d:1, color:"#c9bfae", type:"block" });
  return { w:3, h:3, cells, sway:0.06, shadow:true };
};

/* ---- FACTORY: palm (sand) ---- */
PLACEABLE_FACTORIES.palm = function (rng) {
  const cells = [], trunk = "#b09470", frond = pick(rng, PALETTE.flora);
  for (let i = 0; i < 3; i++) { const lean = Math.round((rng()-0.5)*1); cells.push({ dx:lean, dz:0, layer:i, w:1, d:1, color:trunk, type:"block" }); }
  for (let i = 0; i < 5; i++) { const dx = Math.round((rng()-0.5)*3), dz = Math.round((rng()-0.5)*2); cells.push({ dx, dz, layer:3, w:1, d:1, color:frond, type:"block" }); }
  return { w:4, h:4, cells, sway:0.24, shadow:true };
};

/* ---- FACTORY: shell (sand) ---- */
PLACEABLE_FACTORIES.shell = function (rng) {
  const cells = [], c = pick(rng, ["#e3d7a8", "#e9dcc4", "#d8cba6"]);
  cells.push({ dx:0, dz:0, layer:0, w:1, d:1, color:c, type:"block" });
  return { w:1, h:1, cells, sway:0, shadow:false };
};

/* ---- FACTORY: crab (sand) ---- */
PLACEABLE_FACTORIES.crab = function (rng) {
  const cells = [], c = "#c9977a";
  cells.push({ dx:0, dz:0, layer:0, w:1, d:1, color:c, type:"block" });
  cells.push({ dx:-1, dz:0, layer:0, w:1, d:1, color:c, type:"block" });
  cells.push({ dx:1, dz:0, layer:0, w:1, d:1, color:c, type:"block" });
  cells.push({ dx:0, dz:0, layer:1, w:1, d:1, color:"#a87458", type:"block" });
  return { w:3, h:2, cells, sway:0.1, shadow:false };
};

/* ---- FACTORY: rockpile (sand) ---- */
PLACEABLE_FACTORIES.rockpile = function (rng) {
  const cells = [];
  for (let i = 0; i < 3; i++) cells.push({ dx: Math.round((rng()-0.5)*2), dz:0, layer:0, w:1, d:1, color:PALETTE.rock.base, type:"block" });
  cells.push({ dx:0, dz:0, layer:1, w:1, d:1, color:PALETTE.rock.light, type:"block" });
  return { w:3, h:2, cells, sway:0, shadow:true };
};

/* ---- FACTORY: lily pad (water) ---- */
PLACEABLE_FACTORIES.lily = function (rng) {
  const cells = [], c = "#93a97e";
  cells.push({ dx:0, dz:0, layer:0, w:1, d:1, color:c, type:"pad" });
  if (rng() < 0.5) cells.push({ dx:0, dz:0, layer:1, w:1, d:1, color: pick(rng, PALETTE.petals), type:"petal" });
  return { w:1, h:1, cells, sway:0.12, shadow:false };
};

/* ---- manufacture from an rng; returns object or null if none ---- */
function makePlaceable(kind, seed) {
  const fn = PLACEABLE_FACTORIES[kind];
  if (!fn) return null;
  const rng = makeRng(seed);
  const spec = fn(rng);
  return { kind, rng, spec, seed,
           phase: rng() * 6.28,   // sway phase
           scale: 0.9 + rng() * 0.5 };
}

/* List of placeable kinds valid for a given terrain type */
function placeablesForTerrain(terrain) {
  return TERRAIN[terrain] ? TERRAIN[terrain].placeables : [];
}

/* ---- Factory: mushroom (forest) ---- */
PLACEABLE_FACTORIES.mushroom = function (rng) {
  const cells = [], stem = "#e9dcc4", cap = pick(rng, ["#cdb3a0", "#c9bfae", "#bfc6c2"]);
  cells.push({ dx:0, dz:0, layer:0, w:1, d:1, color:stem, type:"stem" });
  cells.push({ dx:0, dz:0, layer:1, w:1, d:1, color:cap, type:"block" });
  cells.push({ dx:0.5, dz:0, layer:1, w:1, d:1, color:cap, type:"block" });
  return { w:2, h:2, cells, sway:0.14, shadow:true };
};

/* ---- Factory: deer (forest/snow) — small brick doe ---- */
PLACEABLE_FACTORIES.deer = function (rng) {
  const cells = [], body = pick(rng, ["#b09470", "#c9a97e", "#e3d7a8"]);
  cells.push({ dx:0, dz:0, layer:0, w:1, d:1, color: body, type:"block" });
  cells.push({ dx:0, dz:0, layer:1, w:1, d:1, color: body, type:"block" });
  cells.push({ dx:1, dz:0, layer:1, w:1, d:1, color: body, type:"block" }); // neck
  cells.push({ dx:1, dz:0, layer:2, w:1, d:1, color: body, type:"block" }); // head
  cells.push({ dx:-1, dz:0, layer:0, w:1, d:1, color: body, type:"block" }); // tail
  return { w:3, h:3, cells, sway:0.08, shadow:true };
};

/* ---- Factory: sheep (grass) ---- */
PLACEABLE_FACTORIES.sheep = function (rng) {
  const cells = [], wool = "#eaeff0", face = "#9a8666";
  cells.push({ dx:0, dz:0, layer:0, w:1, d:1, color: wool, type:"block" });
  cells.push({ dx:0, dz:0, layer:1, w:1, d:1, color: wool, type:"block" });
  cells.push({ dx:1, dz:0, layer:1, w:1, d:1, color: face, type:"block" });
  cells.push({ dx:-1, dz:0, layer:0, w:1, d:1, color: face, type:"block" });
  return { w:3, h:2, cells, sway:0.06, shadow:true };
};

/* ---- Factory: house (grass) — cozy brick cottage ---- */
PLACEABLE_FACTORIES.house = function (rng) {
  const cells = [], wall = pick(rng, ["#e9dcc4", "#f2ecda", "#d7cdbd"]), roof = pick(rng, PALETTE.roof);
  // base walls (L-shape footprint)
  for (let x = 0; x < 2; x++) for (let z = 0; z < 2; z++) {
    cells.push({ dx:x, dz:z, layer:0, w:1, d:1, color: wall, type:"block" });
    cells.push({ dx:x, dz:z, layer:1, w:1, d:1, color: wall, type:"block" });
  }
  // roof slabs (pitched suggestion)
  cells.push({ dx:0, dz:0, layer:2, w:2, d:2, color: roof, type:"block" });
  cells.push({ dx:0, dz:0, layer:3, w:1, d:1, color: roof, type:"block" });
  // chimney
  cells.push({ dx:1, dz:1, layer:3, w:1, d:1, color:"#b0a58f", type:"block" });
  // door
  cells.push({ dx:0, dz:1, layer:0, w:1, d:1, color:"#8c8474", type:"block" });
  return { w:2, h:4, cells, sway:0, shadow:true };
};

/* ---- Factory: igloo (snow) ---- */
PLACEABLE_FACTORIES.igloo = function (rng) {
  const cells = [], c = "#eaeff0", d = "#dfe6e7";
  for (let x = 0; x < 2; x++) for (let z = 0; z < 2; z++) { cells.push({dx:x, dz:z, layer:0, w:1, d:1, color:c, type:"block"}); }
  cells.push({ dx:0, dz:0, layer:1, w:1, d:1, color:c, type:"block" });
  cells.push({ dx:1, dz:0, layer:1, w:1, d:1, color:c, type:"block" });
  return { w:2, h:2, cells, sway:0, shadow:true };
};

/* ---- Factory: snowman (snow) ---- */
PLACEABLE_FACTORIES.snowman = function (rng) {
  const cells = [], c = "#f6f9f9", d = "#e6e9e9";
  cells.push({ dx:0, dz:0, layer:0, w:1, d:1, color:c, type:"block" });
  cells.push({ dx:0, dz:0, layer:1, w:1, d:1, color:d, type:"block" });
  cells.push({ dx:0, dz:0, layer:2, w:1, d:1, color:c, type:"block" });
  cells.push({ dx:-1, dz:0, layer:2, w:1, d:1, color:"#c9977a", type:"block" }); // arm
  cells.push({ dx:1, dz:0, layer:2, w:1, d:1, color:"#c9977a", type:"block" });
  return { w:3, h:3, cells, sway:0.05, shadow:true };
};

/* ---- stream: a flowing brick water ribbon (forest) ---- */
PLACEABLE_FACTORIES.stream = function (rng) {
  const cells = [], c = PALETTE.water.light;
  const n = 4 + Math.floor(rng() * 3);
  let dx = 0;
  for (let i = 0; i < n; i++) {
    cells.push({ dx, dz:0, layer:0, w:1, d:1, color:c, type:"pad" });
    dx += (rng() < 0.5 ? 1 : 0) ? 0 : 1; // mostly forward
  }
  return { w:n, h:2, cells, sway:0.1, shadow:false, stream:true };
};

if (typeof window !== "undefined") {
  window.PLACEABLE_FACTORIES = PLACEABLE_FACTORIES;
  window.makePlaceable = makePlaceable;
  window.placeablesForTerrain = placeablesForTerrain;
}
