/* 03_draw_bricks.js — glossy plastic brick rendering (the LEGO-style core) */
"use strict";

/* --- shared ctx shorthand --- */
function drawBrick(ctx, x, y, size, baseColor, opts) {
  opts = opts || {};
  const bevel = Math.max(1, size * 0.12);
  // shadow/edge (darker bottom-right bevel) using color darkening
  const edge = opts.edge || shade(baseColor, -0.18);
  const light = opts.light || shade(baseColor, 0.14);

  // bottom bevel
  ctx.fillStyle = edge;
  ctx.fillRect(x, y + size - bevel, size, bevel);
  ctx.fillRect(x + size - bevel, y, bevel, size);

  // main face (slightly inset, gradient top-light)
  const g = ctx.createLinearGradient(x, y, x, y + size);
  g.addColorStop(0, light);
  g.addColorStop(0.5, baseColor);
  g.addColorStop(1, baseColor);
  ctx.fillStyle = g;
  ctx.fillRect(x + bevel, y + bevel, size - bevel * 2, size - bevel * 2);
  ctx.fillRect(x, y, size, size - bevel);
  ctx.fillRect(x, y, size - bevel, size);

  // subtle top highlight line
  ctx.fillStyle = light;
  ctx.fillRect(x + bevel, y + bevel, size - bevel * 2, 1.5);
}

/* --- stud cap on a brick (the classic round top stud) --- */
function drawStud(ctx, cx, cy, r, baseColor) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, PALETTE.stud);
  g.addColorStop(0.6, baseColor);
  g.addColorStop(1, shade(baseColor, -0.12));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // tiny specular dot
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

/* --- a terrain cell rendered as a smooth glossy brick side (with stud if flat) --- */
function drawTerrainCell(ctx, sx, sy, cellSize, terrain, depth) {
  const c = PALETTE[terrain];
  if (!c) return;
  // base plate is offset upward by `depth` (stacked bricks for higher terrain)
  const lift = depth * (cellSize * 0.28);
  // draw a beveled brick
  drawBrick(ctx, sx, sy - lift, cellSize, c.base, { edge: c.edge, light: c.light });
  // stud cap on top (flat plateau look)
  drawStud(ctx, sx + cellSize / 2, sy + cellSize / 2 - lift, cellSize * 0.26, c.base);
}

/* --- light/dark shade helper (hex to hex scaled) --- */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    const f = 1 + amt;
    r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f);
  }
  return "rgb(" + r + "," + g + "," + b + ")";
}

/* --- draw a cm-block placeable cell as a stacked glossy brick --- */
function drawPlaceableCell(ctx, px, py, cellSize, cell, time, sway) {
  // sway offset (wind) for organic objects
  const wind = sway ? Math.sin(time * 1.4 + (cell.dx + cell.dz) * 0.8) * sway * 4 : 0;
  const px2 = px + wind;
  const layer = cell.layer;
  const h = cellSize;
  const c = cell.color;
  // stack height visual: each layer drawn taller
  const bh = h * 0.85;
  const y = py - (layer + 1) * bh + bh; // layer 0 at bottom

  // side bevel stack look
  ctx.fillStyle = shade(c, -0.2);
  ctx.fillRect(px2 + h * 0.15, y, h * 0.7, bh);
  const g = ctx.createLinearGradient(px2, y, px2, y + bh);
  g.addColorStop(0, shade(c, 0.12));
  g.addColorStop(0.6, c);
  g.addColorStop(1, c);
  ctx.fillStyle = g;
  ctx.fillRect(px2 + h * 0.1, y, h * 0.7, bh);

  // stud cap for the top of each brick
  drawStud(ctx, px2 + h * 0.45, y + bh * 0.2, h * 0.22, c);
  // outline
  ctx.strokeStyle = "rgba(61,69,72,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px2 + h * 0.1, y, h * 0.7, bh);
}

if (typeof window !== "undefined") {
  window.drawBrick = drawBrick; window.drawStud = drawStud;
  window.drawTerrainCell = drawTerrainCell; window.shade = shade;
  window.drawPlaceableCell = drawPlaceableCell;
}
