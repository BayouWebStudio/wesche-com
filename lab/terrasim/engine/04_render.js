/* 04_render.js — scene renderer: sky, clouds, terrain, placeables, water */
"use strict";

function renderScene(ctx, cv) {
  const w = cv.width, h = cv.height;
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.55, PALETTE.skyMid);
  sky.addColorStop(1, PALETTE.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // world->screen transform
  const cs = CONFIG.cellSize * S.zoom;
  const ox = w / 2 - (S.camX + S.worldW / 2) * cs;
  const oy = h / 2 - (S.camY + S.worldH / 2) * cs;

  // clouds (drawn behind terrain so they peek at horizon/water)
  drawClouds(ctx, w, h);

  // terrain bricks with elevation stacking (depth = distance from water plane)
  const startX = Math.max(0, Math.floor((0 - ox) / cs));
  const endX = Math.min(S.worldW, Math.ceil((w - ox) / cs));
  const startY = Math.max(0, Math.floor((0 - oy) / cs));
  const endY = Math.min(S.worldH, Math.ceil((h - oy) / cs));
  const depthFor = (t) => (t === "water" ? 0 : t === "sand" ? 0.5 : t === "grass" ? 1 : t === "forest" ? 1.4 : t === "rock" ? 1.9 : 2.4);
  // base plate under everything (soft drop)
  for (let z = startY; z < endY; z++) {
    for (let x = startX; x < endX; x++) {
      const t = S.grid[z] && S.grid[z][x];
      if (!t) continue;
      const sx = ox + x * cs, sy = oy + z * cs;
      drawTerrainCell(ctx, sx, sy, cs, t, depthFor(t));
    }
  }

  // water shimmer sparkles
  drawSparkles(ctx, w, h, cs, ox, oy);

  // placeables (sorted by z so nearer ones draw on top)
  drawPlaceables(ctx, cs, ox, oy);

  // grid overlay toggle
  if (CONFIG.showGrid) drawGrid(ctx, cs, ox, oy, startX, endX, startY, endY);

  // hover brush preview
  drawHover(ctx, cs, ox, oy);
}

function drawClouds(ctx, w, h) {
  for (const c of S.clouds) {
    const px = c.x * w, py = c.y * h;
    ctx.save();
    ctx.globalAlpha = c.a;
    ctx.fillStyle = "#f3f4f1";
    ctx.beginPath();
    ctx.ellipse(px, py, c.s * w * 0.08, c.s * h * 0.045, 0, 0, Math.PI * 2);
    ctx.ellipse(px + c.s * w * 0.04, py - c.s * h * 0.02, c.s * w * 0.05, c.s * h * 0.03, 0, 0, Math.PI * 2);
    ctx.ellipse(px - c.s * w * 0.04, py + c.s * h * 0.01, c.s * w * 0.05, c.s * h * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawSparkles(ctx, w, h, cs, ox, oy) {
  ctx.save();
  for (const sp of S.sparkles) {
    const sx = ox + sp.x * cs, sy = oy + sp.y * cs;
    if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
    const t = (Math.sin(S.t * 2 + sp.p) + 1) / 2;
    ctx.globalAlpha = 0.12 + t * 0.3;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(sx + cs / 2, sy + cs / 2, 1.2 + t * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGrid(ctx, cs, ox, oy, sx, ex, sy, ey) {
  ctx.strokeStyle = "rgba(61,69,72,0.12)";
  ctx.lineWidth = 1;
  for (let x = sx; x <= ex; x++) { const px = ox + x * cs; ctx.beginPath(); ctx.moveTo(px, oy + sy * cs); ctx.lineTo(px, oy + ey * cs); ctx.stroke(); }
  for (let z = sy; z <= ey; z++) { const py = oy + z * cs; ctx.beginPath(); ctx.moveTo(ox + sx * cs, py); ctx.lineTo(ox + ex * cs, py); ctx.stroke(); }
}

function drawPlaceables(ctx, cs, ox, oy) {
  const list = S.objects.slice().sort((a, b) => a.z - b.z);
  for (const o of list) {
    const px = ox + (o.x + o.ox) * cs;
    const py = oy + (o.z + o.oz) * cs;
    // shadow
    if (o.spec.shadow) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#3d4548";
      ctx.beginPath();
      ctx.ellipse(px, py + cs * 0.4, cs * o.spec.w * 0.42, cs * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // draw each brick cell
    for (const cell of o.spec.cells) {
      drawPlaceableCell(ctx, px + cell.dx * cs, py + cell.dz * cs, cs, cell, S.t, o.spec.sway);
    }
    // white outline wrap for LEGO-face look
    ctx.strokeStyle = "rgba(61,69,72,0.35)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px - cs * 0.5, py - cs * 0.5 - (o.spec.h) * cs * 0.85 + cs * 0.5, cs * o.spec.w, cs * (o.spec.h) * 0.85);
  }
}

function drawHover(ctx, cs, ox, oy) {
  if (S.mode !== "PLAY") return;
  if (S.hover.cx < 0) return;
  const t = S.grid[S.hover.cy] && S.grid[S.hover.cy][S.hover.cx];
  if (!t) return;
  const sx = ox + S.hover.cx * cs, sy = oy + S.hover.cy * cs;
  ctx.save();
  ctx.strokeStyle = "rgba(201,167,95,0.9)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  const r = S.brushSize * cs + cs * 0.5;
  ctx.strokeRect(sx - r / 2, sy - r / 2, r, r);
  ctx.restore();
}

if (typeof window !== "undefined") {
  window.renderScene = renderScene; window.drawClouds = drawClouds; window.drawPlaceables = drawPlaceables;
}
