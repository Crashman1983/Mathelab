/**
 * Treasure Map illustration — parchment background + compass rose for Koordinaten module.
 * Pure draw function, stateless.
 */

import type { ColorPalette } from "@core/design";

/**
 * Draws a subtle parchment/paper background texture.
 */
export function drawParchmentBg(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: ColorPalette,
  alpha = 0.06,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  // Warm parchment tint
  const r = Math.min(w, h) * 0.02;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, h - 4, r);
  ctx.fillStyle = palette.warnSubtle;
  ctx.fill();

  // Subtle edge darkening
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = palette.canvasTextDim;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws a compass rose at the given position.
 */
export function drawCompassRose(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  palette: ColorPalette,
  alpha = 0.15,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);

  const r = size / 2;

  // Outer circle
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = palette.canvasTextDim;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Cardinal directions (N, E, S, W)
  const dirs = [
    { angle: -Math.PI / 2, label: "N" },
    { angle: 0, label: "O" },
    { angle: Math.PI / 2, label: "S" },
    { angle: Math.PI, label: "W" },
  ];

  for (const d of dirs) {
    // Pointer triangle
    ctx.save();
    ctx.rotate(d.angle);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.85);
    ctx.lineTo(-r * 0.12, -r * 0.3);
    ctx.lineTo(r * 0.12, -r * 0.3);
    ctx.closePath();
    ctx.fillStyle = d.label === "N" ? palette.bad : palette.canvasTextDim;
    ctx.globalAlpha = d.label === "N" ? alpha * 1.5 : alpha * 0.7;
    ctx.fill();
    ctx.restore();
  }

  // Center dot
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = palette.canvasTextDim;
  ctx.fill();

  ctx.restore();
}

/**
 * Draws an X mark (treasure) at the given position.
 */
export function drawTreasureX(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  palette: ColorPalette,
  alpha = 0.7,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  const half = size / 2;

  ctx.strokeStyle = palette.bad;
  ctx.lineWidth = Math.max(2, size * 0.15);
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(cx - half, cy - half);
  ctx.lineTo(cx + half, cy + half);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + half, cy - half);
  ctx.lineTo(cx - half, cy + half);
  ctx.stroke();

  ctx.restore();
}
