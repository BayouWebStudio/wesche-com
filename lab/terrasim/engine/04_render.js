/* 04_render.js — isometric 3D scene renderer */
"use strict";

/* tile/cube sizes (screen px) recomputed on resize/zoom */
let isoHW = 26, isoHH = 13, isoCube = 14;
/* camera pan in iso space (world units), zoom, and parallax origin */
let camOffX = 0, camOffY = 0;

/* baseline elevation (blocks) per terrain type */
const ELEV = { water: 1, sand: 2, grass: 3, forest: 4, rock: 5, snow: 6 };

function setIso(cv) {
  const s = CONFIG.cellSize * S.zoom;
  isoHW = s * 0.5;
  isoHH = s * 0.25;
  isoCube = s * 0.5;
}

/* project a grid cell (x,z) at elevation `elev` blocks to top-face center (screen) */
function projectCell(x, z, elev) {
  const cx = (x - z) * isoHW + camOffX + cv.width / 2;
  const cy = (x + z) * isoHH - elev * isoCube + camOffY + cv.height / 2;
  return { cx, cy };
}

function renderScene(ctx, cv) {
  setIso(cv);
  const w = cv.width, h = cv.height;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, PALETTE.skyTop); sky.addColorStop(0.55, PALETTE.skyMid); sky.addColorStop(1, PALETTE.skyLow);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

  // clouds behind the world
  drawClouds(ctx, w, h);

  // ---- terrain: depth-sort back-to-front (painter) ----
  // depth key = x + z (smaller = further back = draw first)
  const cells = [];
  for (let z = 0; z < S.worldH; z++) {
    for (let x = 0; x < S.worldW; x++) {
      const t = S.grid[z][x];
      if (!t) continue;
      const elev = ELEV[t] || 1;
      cells.push({ x, z, t, elev, depth: x + z });
    }
  }
  cells.sort((a, b) => (a.depth - b.depth) || (a.x - b.x));

  for (const c of cells) {
    const p = projectCell(c.x, c.z, c.elev);
    drawIsoBlock(ctx, p.cx, p.cy, isoHW, isoHH, c.elev * isoCube,
                 PALETTE[c.t].light, PALETTE[c.t].base, PALETTE[c.t].edge);
  }

  // ---- placeables: draw as voxel stacks on top of their base column ----
  drawPlaceables(ctx);

  // water shimmer on water columns' top faces (subtle)
  drawWaterShimmer(ctx);

  // grid overlay (optional)
  if (CONFIG.showGrid) drawIsoGrid(ctx);

  // hover brush preview
  drawHover(ctx);
}

/* ---- draw placeables as stacked iso voxels ---- */
function drawPlaceables(ctx) {
  for (const o of S.objects) {
    const baseElev = ELEV[S.grid[o.z] && S.grid[o.z][o.x]] || 1;
    const base = projectCell(o.x, o.z, baseElev);
    // top-face center of the base cell
    const cs = isoCube * 1.7; // placeable voxel size (bigger than stud, reads well)
    const px = base.cx, py = base.cy;
    // shadow
    ctx.save();
    ctx.globalAlpha = 0.14; ctx.fillStyle = "#3d4548";
    ctx.beginPath();
    ctx.ellipse(px, py + isoHH * 0.6, cs * o.spec.w * 0.7, cs * 0.4, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();
    for (const cell of o.spec.cells) {
      drawPlaceableVoxel(ctx, px, py, cs, cell, cell.layer, cell.color);
    }
  }
}

function drawClouds(ctx, w, h) {
  for (const c of S.clouds) {
    const px = c.x * w, py = c.y * h;
    ctx.save(); ctx.globalAlpha = c.a; ctx.fillStyle = "#f3f4f1";
    ctx.beginPath();
    ctx.ellipse(px, py, c.s * w * 0.07, c.s * h * 0.035, 0, 0, Math.PI * 2);
    ctx.ellipse(px + c.s * w * 0.035, py - c.s * h * 0.015, c.s * w * 0.045, c.s * h * 0.025, 0, 0, Math.PI * 2);
    ctx.ellipse(px - c.s * w * 0.035, py + c.s * h * 0.01, c.s * w * 0.04, c.s * h * 0.022, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();
  }
}

function drawWaterShimmer(ctx) {
  ctx.save();
  for (const sp of S.sparkles) {
    const t = S.grid[sp.y] && S.grid[sp.y][sp.x];
    if (t !== "water") continue;
    const p = projectCell(sp.x, sp.y, ELEV.water);
    const tw = (Math.sin(S.t * 2 + sp.p) + 1) / 2;
    ctx.globalAlpha = 0.12 + tw * 0.28;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(p.cx, p.cy - isoHH * 0.3, 2 + tw * 2, 1 + tw, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawIsoGrid(ctx) {
  ctx.strokeStyle = "rgba(61,69,72,0.12)";
  ctx.lineWidth = 1;
  for (let z = 0; z <= S.worldH; z++) {
    const a = projectCell(0, z, 0), b = projectCell(S.worldW, z, 0);
    ctx.beginPath(); ctx.moveTo(a.cx, a.cy); ctx.lineTo(b.cx, b.cy); ctx.stroke();
  }
  for (let x = 0; x <= S.worldW; x++) {
    const a = projectCell(x, 0, 0), b = projectCell(x, S.worldH, 0);
    ctx.beginPath(); ctx.moveTo(a.cx, a.cy); ctx.lineTo(b.cx, b.cy); ctx.stroke();
  }
}

function drawHover(ctx) {
  if (S.mode !== "PLAY" || S.hover.cx < 0) return;
  const t = S.grid[S.hover.cy] && S.grid[S.hover.cy][S.hover.cx];
  if (!t) return;
  const p = projectCell(S.hover.cx, S.hover.cy, (ELEV[t] || 1));
  ctx.save();
  ctx.strokeStyle = "rgba(201,167,95,0.9)";
  ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
  ctx.beginPath();
  const r = S.brushSize;
  // diamond outline of brush area around the hovered cell
  ctx.moveTo(p.cx, p.cy - isoHH * r);
  ctx.lineTo(p.cx + isoHW * r, p.cy + isoHH * r);
  ctx.lineTo(p.cx, p.cy + isoHH * (r + 1));
  ctx.lineTo(p.cx - isoHW * r, p.cy + isoHH * r);
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}

if (typeof window !== "undefined") {
  window.renderScene = renderScene; window.setIso = setIso; window.projectCell = projectCell;
  window.drawClouds = drawClouds; window.drawPlaceables = drawPlaceables; window.ELEV = ELEV;
}
