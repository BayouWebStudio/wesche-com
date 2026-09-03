/* 03_draw_bricks.js — isometric 3D voxel brick rendering (LEGO-style cubes) */
"use strict";

/* Isometric projection constants are set on S via setIso() (tileW, tileH, cubeH).
   For a cell at grid (x,z) with `elev` blocks of height:
     screen(iso) center of TOP face:
       isoX = (x - z) * HW
       isoY = (x + z) * HH - elev * cubeH
   where HW = tileW/2, HH = tileH/2.
*/

/* --- draw a single isometric voxel column (terrain plateau) --- */
function drawIsoBlock(ctx, cx, cy, HW, HH, heightPx, topColor, leftColor, rightColor, opts) {
  opts = opts || {};
  // ---- left face (facing lower-left) ----
  ctx.beginPath();
  ctx.moveTo(cx - HW, cy);            // W
  ctx.lineTo(cx, cy + HH);            // S
  ctx.lineTo(cx, cy + HH + heightPx); // S'
  ctx.lineTo(cx - HW, cy + heightPx); // W'
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();
  ctx.strokeStyle = opts.line || "rgba(61,69,72,0.35)";
  ctx.lineWidth = opts.lineW || 1;
  ctx.stroke();

  // ---- right face (facing lower-right) ----
  ctx.beginPath();
  ctx.moveTo(cx, cy + HH);            // S
  ctx.lineTo(cx + HW, cy);            // E
  ctx.lineTo(cx + HW, cy + heightPx); // E'
  ctx.lineTo(cx, cy + HH + heightPx); // S'
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();
  ctx.strokeStyle = opts.line || "rgba(61,69,72,0.35)";
  ctx.stroke();

  // ---- top face (diamond) ----
  ctx.beginPath();
  ctx.moveTo(cx, cy - HH);            // N
  ctx.lineTo(cx + HW, cy);            // E
  ctx.lineTo(cx, cy + HH);            // S
  ctx.lineTo(cx - HW, cy);            // W
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();
  ctx.strokeStyle = "rgba(61,69,72,0.3)";
  ctx.stroke();

  // ---- LEGO stud caps on the top face ----
  const studR = HW * 0.24;
  drawStud(ctx, cx, cy - HH * 0.42, studR, topColor);
  drawStud(ctx, cx - HW * 0.42, cy + HH * 0.1, studR, topColor);
  drawStud(ctx, cx + HW * 0.42, cy + HH * 0.1, studR, topColor);
}

/* --- stud cap (small oval on the iso top face) --- */
function drawStud(ctx, cx, cy, r, baseColor) {
  // squash the circle into an isometric ellipse (height ~ HH/HW of width)
  const ry = r * 0.5;
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - ry * 0.5, r * 0.1, cx, cy, r);
  g.addColorStop(0, PALETTE.stud);
  g.addColorStop(0.6, baseColor);
  g.addColorStop(1, shade(baseColor, -0.12));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.3, cy - ry * 0.35, r * 0.22, ry * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
}

/* --- remaining-side shading helper (hex to rgb string) --- */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt); }
  else { const f = 1 + amt; r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f); }
  return "rgb(" + r + "," + g + "," + b + ")";
}

/* --- draw a placeable as a small stack of isometric voxel cells --- */
/* p is the top-face isometric origin (screen) for the placeable's base cell.
   cell = {dx,dz,layer,w,d,color,type}; cs is the per-voxel screen scale. */
function drawPlaceableVoxel(ctx, px, py, cs, cell, layer, color) {
  // a placeable voxel occupies HALF a terrain tile, so smaller isometric cube
  const HW = cs * 0.5, HH = cs * 0.25, cubeH = cs * 0.5;
  // offset within the grid cell by dx,dz (sub-tile); lift by layer* (base terrain already lifted)
  const cx = px + (cell.dx - cell.dz) * HW;
  const cy = py + (cell.dx + cell.dz) * HH - (layer) * cubeH;
  drawIsoBlock(ctx, cx, cy, HW, HH, cubeH, color, shade(color, -0.08), shade(color, -0.2),
               { line: "rgba(61,69,72,0.4)", lineW: 1 });
}

if (typeof window !== "undefined") {
  window.drawIsoBlock = drawIsoBlock; window.drawStudCaps = drawStud;
  window.shade = shade; window.drawPlaceableVoxel = drawPlaceableVoxel;
}
