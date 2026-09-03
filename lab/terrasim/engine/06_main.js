/* 06_main.js — bootstrap, input wiring, main loop */
"use strict";

let cv, ctx;
let raf = null;

function boot(canvasEl) {
  cv = canvasEl;
  ctx = cv.getContext("2d");
  cv.width = Math.max(320, cv.clientWidth || window.innerWidth);
  cv.height = Math.max(320, cv.clientHeight || window.innerHeight);
  // world size
  const cols = 64, rows = 44;
  S.worldW = cols; S.worldH = rows;
  S.grid = buildWorld(cols, rows, 1337);
  S.stats = countTerrain(S.grid);
  // isometric camera: center the island and frame it
  setIso(cv);
  S.zoom = 0.75;
  setIso(cv);
  const centerX = ((cols / 2) - (rows / 2)) * isoHW;
  const centerY = ((cols / 2) + (rows / 2)) * isoHH;
  camOffX = -centerX;
  camOffY = -centerY;
  S.mode = "PLAY";           // no menu needed — jump straight in
  seedAmbient();
  // pre-populate a few objects for a lively starting scene
  autoGrow();
  // wire input
  wireInput();
  // loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    S.t += dt;
    driveAmbient(dt);
    if (S.dirty) { renderScene(ctx, cv); S.dirty = false; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return S;
}

/* drive ambient motion: cloud drift, water shimmer */
function driveAmbient(dt) {
  const sp = CONFIG.ambientSpeed * dt;
  for (const c of S.clouds) { c.x += c.v * sp; if (c.x > 1.1) c.x = -0.1; if (c.x < -0.1) c.x = 1.1; }
  // occasionally add a sparkle twinkle (re-seed some) — cheap; keep as-is
  S.dirty = true;
}

/* auto-grow a scattering of starter placeables on valid land */
function autoGrow() {
  const rng = makeRng(2026);
  const kindsList = [];
  for (let z = 2; z < S.worldH - 2; z += 1) {
    for (let x = 2; x < S.worldW - 2; x += 1) {
      const t = S.grid[z][x];
      if (!TERRAIN[t] || !TERRAIN[t].buildable) continue;
      const valid = placeablesForTerrain(t);
      if (valid.length && rng() < CONFIG.placeableDensity * 0.06) {
        const kind = valid[Math.floor(rng() * valid.length)];
        const obj = makePlaceable(kind, (rng() * 1e9) | 0);
        if (obj) {
          obj.x = x; obj.z = z; obj.ox = (rng() - 0.5) * 0.4; obj.oz = (rng() - 0.5) * 0.4;
          S.objects.push(obj);
        }
      }
    }
  }
  S.stats.objects = S.objects.length;
}

/* ---- resize handler ---- */
function onResize() {
  if (!cv) return;
  cv.width = Math.max(320, cv.clientWidth || window.innerWidth);
  cv.height = Math.max(320, cv.clientHeight || window.innerHeight);
  S.dirty = true;
}

/* ---- input wiring ---- */
function wireInput() {
  window.addEventListener("resize", onResize);

  // mouse
  cv.addEventListener("mousemove", (e) => {
    const sx = e.clientX - (cv.getBoundingClientRect().left || 0);
    const sy = e.clientY - (cv.getBoundingClientRect().top || 0);
    const c = screenToCell(cv, sx, sy);
    S.hover.cx = c.cx; S.hover.cy = c.cy; S.hover.wx = c.wx; S.hover.wy = c.wy;
    if (S.drag && S.ui.tool === "pan") {
      if (S.lastPtr) { panBy(sx - S.lastPtr.sx, sy - S.lastPtr.sy); }
      S.lastPtr = { sx, sy };
    } else if (S.drag) {
      applyTool(c.cx, c.cy);
    }
    S.dirty = true;
  });
  cv.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const sx = e.clientX - (cv.getBoundingClientRect().left || 0);
    const sy = e.clientY - (cv.getBoundingClientRect().top || 0);
    const c = screenToCell(cv, sx, sy);
    S.drag = true; S.lastPaint.cx = c.cx; S.lastPaint.cy = c.cy;
    if (S.ui.tool === "pan") { S.lastPtr = { sx, sy }; }
    else applyTool(c.cx, c.cy);
  });
  window.addEventListener("mouseup", () => { S.drag = false; S.lastPtr = null; });
  cv.addEventListener("mouseleave", () => { S.drag = false; S.lastPtr = null; });

  // ---- touch support (painting + pinch zoom) ----
  let lastTouchDist = 0;
  const touchPos = (t) => ({ sx: t.clientX - (cv.getBoundingClientRect().left || 0),
                             sy: t.clientY - (cv.getBoundingClientRect().top || 0) });
  cv.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const p = touchPos(e.touches[0]);
      const c = screenToCell(cv, p.sx, p.sy);
      S.drag = true; S.lastPaint.cx = c.cx; S.lastPaint.cy = c.cy;
      applyTool(c.cx, c.cy);
    } else if (e.touches.length === 2) {
      const a = touchPos(e.touches[0]), b = touchPos(e.touches[1]);
      lastTouchDist = Math.hypot(a.sx - b.sx, a.sy - b.sy);
    }
    S.dirty = true;
  }, { passive: false });
  cv.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const p = touchPos(e.touches[0]);
      const c = screenToCell(cv, p.sx, p.sy);
      S.hover.cx = c.cx; S.hover.cy = c.cy;
      if (S.drag && S.ui.tool === "pan") {
        if (S.lastPtr) panBy(p.sx - S.lastPtr.sx, p.sy - S.lastPtr.sy);
        S.lastPtr = { sx: p.sx, sy: p.sy };
      } else if (S.drag) {
        applyTool(c.cx, c.cy);
      }
    } else if (e.touches.length === 2) {
      const a = touchPos(e.touches[0]), b = touchPos(e.touches[1]);
      const d = Math.hypot(a.sx - b.sx, a.sy - b.sy);
      if (lastTouchDist > 0) {
        const mid = { sx: (a.sx + b.sx) / 2, sy: (a.sy + b.sy) / 2 };
        zoomAt(cv, d / lastTouchDist, mid.sx, mid.sy);
      }
      lastTouchDist = d;
    }
    S.dirty = true;
  }, { passive: false });
  cv.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (e.touches.length < 2) lastTouchDist = 0;
    if (e.touches.length === 0) S.drag = false;
    S.dirty = true;
  }, { passive: false });

  // wheel zoom
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const sx = e.clientX - (cv.getBoundingClientRect().left || 0);
    const sy = e.clientY - (cv.getBoundingClientRect().top || 0);
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    zoomAt(cv, factor, sx, sy);
  }, { passive: false });

  // keyboard shortcuts (brush / tool / zoom)
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "[" || k === "-") S.brushSize = Math.max(1, S.brushSize - 1);
    if (k === "]" || k === "=") S.brushSize = Math.min(6, S.brushSize + 1);
    if (k === "1") selectTerrain("water");
    if (k === "2") selectTerrain("sand");
    if (k === "3") selectTerrain("grass");
    if (k === "4") selectTerrain("forest");
    if (k === "5") selectTerrain("rock");
    if (k === "6") selectTerrain("snow");
    if (k === "p") setMode("paint");
    if (k === "o") setMode("place");
    if (k === "e") setMode("erase");
    if (k === "m") setMode("pan");
    if (k === "g") { CONFIG.showGrid = !CONFIG.showGrid; S.dirty = true; }
    // arrow keys / WASD pan the camera
    const step = 40;
    if (k === "arrowleft" || k === "a") panBy(step, 0);
    if (k === "arrowright" || k === "d") panBy(-step, 0);
    if (k === "arrowup" || k === "w") panBy(0, step);
    if (k === "arrowdown" || k === "s") panBy(0, -step);
  });
}

/* apply the current tool at a cell */
function applyTool(cx, cy) {
  if (S.mode !== "PLAY") return;
  const mode = S.ui.tool;
  if (mode === "paint") paintAt(cv, cx, cy, S.ui.brush, true);
  else if (mode === "place") placeObject(cv, cx, cy);
  else if (mode === "erase") eraseAt(cx, cy, S.brushSize);
}

function selectTerrain(t) { S.ui.brush = t; S.ui.tool = "paint"; S.dirty = true; refreshToolbarUI(); }
function setMode(m) { S.ui.tool = m; S.dirty = true; refreshToolbarUI(); }

/* tell the DOM toolbar to reflect current tool/brush (used by UI glue) */
function refreshToolbarUI() {
  if (typeof window.updateToolbar === "function") window.updateToolbar();
}

/* expose for harness */
if (typeof window !== "undefined") {
  window.boot = boot; window.__S = () => S;
  window.selectTerrain = selectTerrain; window.setMode = setMode; window.applyTool = applyTool;
  window.refreshToolbarUI = refreshToolbarUI;
}
