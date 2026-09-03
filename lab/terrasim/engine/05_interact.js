/* 05_interact.js — isometric painting, placeables, camera, tools */
"use strict";

/* Invert the iso projection to a grid cell at a reference elevation */
function screenToCell(cv, sx, sy) {
  setIso(cv);
  const refElev = 3; // grass-ish reference for picking
  const u = sx - cv.width / 2 - camOffX;
  const v = sy - cv.height / 2 - camOffY + refElev * isoCube;
  const dw = u / isoHW, dh = v / isoHH;
  const cx = Math.floor((dw + dh) / 2);
  const cy = Math.floor((dh - dw) / 2);
  return { cx, cy, wx: (dw + dh) / 2, wy: (dh - dw) / 2 };
}

/* Paint a brush of terrain around a cell */
function paintAt(cv, cx, cy, terrain, eraseObjects) {
  const r = S.brushSize;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > r * r + 1) continue;
      const x = cx + dx, z = cy + dz;
      if (x < 0 || z < 0 || x >= S.worldW || z >= S.worldH) continue;
      S.grid[z][x] = terrain;
    }
  }
  if (eraseObjects) reconcileObjects();
  S.stats = countTerrain(S.grid);
  S.dirty = true;
}

/* Place a generative object on a cell */
function placeObject(cv, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= S.worldW || cy >= S.worldH) return;
  const t = S.grid[cy][cx];
  if (!TERRAIN[t] || !TERRAIN[t].buildable) return;
  let kind = S.ui.placeable;
  const valid = placeablesForTerrain(t);
  if (!valid.includes(kind)) kind = valid[Math.floor(Math.random() * valid.length)] || null;
  if (!kind) return;
  const seed = (Math.random() * 1e9) | 0;
  const obj = makePlaceable(kind, seed);
  if (!obj) return;
  obj.x = cx; obj.z = cy;
  obj.ox = (Math.random() - 0.5) * 0.4;
  obj.oz = (Math.random() - 0.5) * 0.4;
  S.objects.push(obj);
  S.stats.objects = S.objects.length;
  S.dirty = true;
}

/* Remove objects whose terrain no longer supports them */
function reconcileObjects() {
  S.objects = S.objects.filter((o) => {
    const t = S.grid[o.z] && S.grid[o.z][o.x];
    if (!t) return false;
    return placeablesForTerrain(t).includes(o.kind);
  });
  S.stats.objects = S.objects.length;
}

/* Erase objects near a cell */
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

/* ---- camera: pan in iso screen space, zoom via S.zoom ---- */
function panBy(dx, dy) {
  camOffX += dx;
  camOffY += dy;
  S.dirty = true;
}
function zoomAt(cv, factor, px, py) {
  // keep the hovered world point roughly under the cursor by adjusting pan
  const before = screenToCell(cv, px, py);
  S.zoom = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, S.zoom * factor));
  setIso(cv);
  const after = screenToCell(cv, px, py);
  camOffX += (before.wx - after.wx) * isoHW;
  camOffY += (before.wy - after.wy) * isoHH;
  S.dirty = true;
}

/* seed ambient clouds + sparkles */
function seedAmbient() {
  S.clouds = [];
  for (let i = 0; i < 7; i++) {
    S.clouds.push({ x: Math.random(), y: 0.06 + Math.random() * 0.3, s: 0.6 + Math.random() * 1.4,
                    a: 0.5 + Math.random() * 0.3, v: (Math.random() - 0.5) * 0.006 });
  }
  S.sparkles = [];
  for (let i = 0; i < 40; i++) {
    S.sparkles.push({ x: Math.floor(Math.random() * S.worldW), y: Math.floor(Math.random() * S.worldH), p: Math.random() * 6.28 });
  }
}

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
