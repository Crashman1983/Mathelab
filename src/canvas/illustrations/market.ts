/**
 * Market illustration — awning/stall header for Maße/Geld module.
 * Pure draw function, stateless.
 */

import type { ColorPalette } from "@core/design";

/**
 * Draws a market stall awning (striped canopy) across the top of the given rect.
 */
export function drawMarketAwning(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  awningHeight: number,
  palette: ColorPalette,
  alpha = 0.12,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  const stripeCount = Math.max(4, Math.round(w / 40));
  const stripeW = w / stripeCount;

  for (let i = 0; i < stripeCount; i++) {
    const sx = x + i * stripeW;
    ctx.fillStyle = i % 2 === 0 ? palette.bad : palette.warn;
    ctx.beginPath();
    ctx.moveTo(sx, y);
    ctx.lineTo(sx + stripeW, y);
    ctx.lineTo(sx + stripeW, y + awningHeight * 0.75);
    // Scalloped bottom edge
    ctx.quadraticCurveTo(
      sx + stripeW / 2, y + awningHeight,
      sx, y + awningHeight * 0.75,
    );
    ctx.closePath();
    ctx.fill();
  }

  // Top bar
  ctx.fillStyle = palette.canvasTextDim;
  ctx.globalAlpha = alpha * 0.8;
  ctx.fillRect(x, y, w, 3);

  ctx.restore();
}

/**
 * Draws a simple price tag shape.
 */
export function drawPriceTag(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  palette: ColorPalette,
  alpha = 0.6,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  const r = Math.min(w, h) * 0.15;

  // Tag body
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
  ctx.fillStyle = palette.warnSubtle;
  ctx.fill();
  ctx.strokeStyle = palette.warn;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Hole
  ctx.beginPath();
  ctx.arc(cx - w / 2 + r * 1.5, cy, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = palette.canvasBg;
  ctx.fill();

  ctx.restore();
}
