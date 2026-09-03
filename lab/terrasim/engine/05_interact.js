/* 05_interact.js — painting, placeables placement, camera controls, tools */
"use strict";

/* Convert a screen pixel to world grid coords */
function screenToCell(cv, sx, sy) {
  const cs = CONFIG.cellSize * S.zoom;
  const ox = cv.width / 2 - (S.camX + S.worldW / 2) * cs;
  const oy = cv.height / 2 - (S.camY + S.worldH / 2) * cs;
  const cx = Math.floor((sx - ox) / cs);
  const cy = Math.floor((sy - oy) / cs);
  return { cx, cy, wx: (sx - ox) / cs, wy: (sy - oy) / cs };
}

/* Paint a brush of terrain around a cell */
function paintAt(cv, cx, cy, terrain, eraseObjects) {
  const r = S.brushSize;
  const cs = CONFIG.cellSize * S.zoom;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > r * r + 1) continue;
      const x = cx + dx, z = cy + dz;
      if (x < 0 || z < 0 || x >= S.worldW || z >= S.worldH) continue;
      // water is the only unbuildable plane
      S.grid[z][x] = terrain;
    }
  }
  // if we painted over objects with non-matching terrain, remove those that no longer fit
  if (eraseObjects) reconcileObjects();
  S.stats = countTerrain(S.grid);
  S.dirty = true;
}

/* Place a generative object; chooses a random valid placeable for the cell's terrain */
function placeObject(cv, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= S.worldW || cy >= S.worldH) return;
  const t = S.grid[cy][cx];
  if (!TERRAIN[t] || !TERRAIN[t].buildable) return; // can't build on water
  let kind = S.ui.placeable;
  const valid = placeablesForTerrain(t);
  if (!valid.includes(kind)) kind = valid[Math.floor(Math.random() * valid.length)] || null;
  if (!kind) return;
  const seed = (Math.random() * 1e9) | 0;
  const obj = makePlaceable(kind, seed);
  if (!obj) return;
  // avoid stacking on top of another object on same cell (optional light check)
  obj.x = cx; obj.z = cy;
  // sub-cell jitter + offset
  obj.ox = (Math.random() - 0.5) * 0.4;
  obj.oz = (Math.random() - 0.5) * 0.4;
  S.objects.push(obj);
  S.stats.objects = S.objects.length;
  S.dirty = true;
}

/* Remove objects that no longer match their terrain (e.g. tree re-painted to water) */
function reconcileObjects() {
  S.objects = S.objects.filter((o) => {
    const t = S.grid[o.z] && S.grid[o.z][o.x];
    if (!t) return false;
    return placeablesForTerrain(t).includes(o.kind);
  });
  S.stats.objects = S.objects.length;
}

/* Erase objects (placeable brush) */
function eraseAt(cx, cy, radius) {
  const r = radius;
  const before = S.objects.length;
  S.objects = S.objects.filter((o) => {
    const dx = o.x - cx, dz = o.z - cy;
    return dx * dx + dz * dz > r * r;
  });
  S.stats.objects = S.objects.length;
  S.dirty = true;
  return before !== S.objects.length;
}

/* ---- camera ---- */
function panBy(dx, dy) {
  S.camX -= dx / (CONFIG.cellSize * S.zoom);
  S.camY -= dy / (CONFIG.cellSize * S.zoom);
  S.dirty = true;
}
function zoomAt(cv, factor, px, py) {
  const cs = CONFIG.cellSize * S.zoom;
  const wx = (px - cv.width / 2) / cs + S.camX + S.worldW / 2;
  const wy = (py - cv.height / 2) / cs + S.camY + S.worldH / 2;
  S.zoom = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, S.zoom * factor));
  const cs2 = CONFIG.cellSize * S.zoom;
  S.camX = wx - (px - cv.width / 2) / cs2 - S.worldW / 2;
  S.camY = wy - (py - cv.height / 2) / cs2 - S.worldH / 2;
  S.dirty = true;
}

/* seed ambient clouds + sparkles */
function seedAmbient() {
  S.clouds = [];
  for (let i = 0; i < 7; i++) {
    S.clouds.push({ x: Math.random(), y: 0.08 + Math.random() * 0.34, s: 0.6 + Math.random() * 1.4,
                    a: 0.5 + Math.random() * 0.3, v: (Math.random() - 0.5) * 0.006 });
  }
  S.sparkles = [];
  for (let i = 0; i < 40; i++) {
    S.sparkles.push({ x: Math.floor(Math.random() * S.worldW), y: Math.floor(Math.random() * S.worldH), p: Math.random() * 6.28 });
  }
}

/* scan a cell for an existing object (hit test) */
function objectAt(cx, cy) {
  for (let i = S.objects.length - 1; i >= 0; i--) {
    const o = S.objects[i];
    if (Math.abs(o.x + o.ox - cx) < 0.6 && Math.abs(o.z + o.oz - cy) < 0.6) return o;
  }
  return null;
}

if (typeof window !== "undefined") {
  window.screenToCell = screenToCell; window.paintAt = paintAt; window.placeObject = placeObject;
  window.panBy = panBy; window.zoomAt = zoomAt; window.seedAmbient = seedAmbient; window.objectAt = objectAt;
  window.eraseAt = eraseAt; window.reconcileObjects = reconcileObjects;
}
