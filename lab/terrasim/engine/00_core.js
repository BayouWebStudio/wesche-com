/* 00_core.js — design tokens, palette, config, and global game state */
"use strict";

/* ============================================================
   LEGO Terraform — calm-brick diorama terraforming simulator
   Visual language: The LEGO Movie style (glossy plastic bricks,
   beveled edges, studs everywhere, soft tilt-shift) but with a
   very calm, muted, pastel palette. NO minifigures.
   ============================================================ */

const LEGO_TF = { SCALE: 1 };

/* ---- Very calm, muted pastel palette (oklch-ish hand-tuned) ---- */
const PALETTE = {
  // Sky — soft gray-blue gradient
  skyTop:    "#b9c8cf",
  skyMid:    "#cfd9dd",
  skyLow:    "#e3e8e6",
  // Bricks
  brickEdge: "#8a9294",   // darker bevel side of each brick
  brickInk:  "#3d4548",   // near-black linework on brick faces
  stud:      "#d7dcd8",   // top highlight on stud caps
  studShadow:"#aab1ad",
  // Terrain color families (calm, desaturated)
  water:  { base: "#9fbecb", deep: "#7fa4b5", light: "#c3d7de" },
  sand:   { base: "#e7ddc2", edge: "#d8cba6", light: "#f2ecda" },
  grass:  { base: "#b9c9a1", edge: "#a8ba8f", light: "#cdd9b6" },
  forest: { base: "#93ab7d", edge: "#7f9a6c", light: "#a9bf95" },
  rock:   { base: "#b0b0ad", edge: "#97989a", light: "#c4c4c0" },
  snow:   { base: "#eaeff0", edge: "#dfe6e7", light: "#f6f9f9" },
  // Placeable accents (muted, calm)
  flora: [ "#cdd9b6", "#b9c9a1", "#a9bf95", "#e3d7a8", "#d8cba6" ],
  petals:[ "#e6d5e0", "#e9dcc4", "#cfd9dd" ],
  roof:  [ "#c9bfae", "#bfc6c2", "#d7cdbd", "#b9c0b6" ],
  // UI surfaces — soft warm off-white plastic
  uiBg:      "#e7e4dc",
  uiSurface: "#f0ede5",
  uiPanel:   "#efece2",
  uiEdge:    "#c3bcae",
  uiInk:     "#45413a",
  uiMuted:   "#8c8474",
  uiAccent:  "#c9a75f",   // warm brass stud accent
  uiAccent2: "#7f9a6c",
  white:     "#f7f4ec",
};

/* ---- Config knobs (tweakable in Tweaks panel) ---- */
const CONFIG = {
  cellSize: 22,          // px per tile cell
  brushRadius: 2.6,      // tiles
  maxZoom: 2.6,
  minZoom: 0.55,
  placeableDensity: 0.85,
  ambientSpeed: 1.0,     // cloud drift / water shimmer
  showGrid: false,
  reducedMotion: false,
  showHints: true,
};

/* ---- Terrain types & how each placeable targets them ---- */
const TERRAIN = {
  water:  { name: "Water",   buildable: false, placeables: ["lily"] },
  sand:   { name: "Sand",    buildable: true,  placeables: ["palm", "shell", "crab", "rockpile"] },
  grass:  { name: "Grass",   buildable: true,  placeables: ["tree", "flower", "bush", "rock", "house", "sheep"] },
  forest: { name: "Forest",  buildable: true,  placeables: ["pine", "mushroom", "rock", "deer", "stream"] },
  rock:   { name: "Rock",    buildable: true,  placeables: ["boulder", "crag", "owlet"] },
  snow:   { name: "Snow",    buildable: true,  placeables: ["pine", "igloo", "snowman", "deer"] },
};

/* ---- Global game state ---- */
const S = {
  mode: "MENU",            // MENU | PLAY
  t: 0,                    // seconds since start
  camX: 0, camY: 0, zoom: 1,
  worldW: 0, worldH: 0,
  grid: [],                // 2D array of terrain type ids
  objects: [],             // placed generative placeables
  brush: "grass",
  brushSize: 2,
  selectedTool: "paint",
  hover: { cx: -1, cy: -1, wx: 0, wy: 0 },
  drag: false,
  lastPaint: { cx: -1, cy: -1 },
  stats: { water:0, sand:0, grass:0, forest:0, rock:0, snow:0, objects:0 },
  clouds: [],
  sparkles: [],            // ambient sparkle/shimmer points
  ui: { tool: "paint", brush: "grass", placeable: "tree" },
  dirty: true,
};

/* ---- Expose for harness ---- */
if (typeof window !== "undefined") { window.LEGO_TF = LEGO_TF; window.S = S; window.PALETTE = PALETTE; window.CONFIG = CONFIG; window.TERRAIN = TERRAIN; }
if (typeof window === "undefined") { global.window = global; global.LEGO_TF = LEGO_TF; global.S = S; global.PALETTE = PALETTE; global.CONFIG = CONFIG; global.TERRAIN = TERRAIN; }
