/**
 * Notebook illustration — lined paper background for Algorithmen module.
 * Pure draw function, stateless.
 */

import type { ColorPalette } from "@core/design";

/**
 * Draws a subtle ruled/lined paper background.
 * @param lineSpacing - vertical pixel distance between lines
 */
export function drawLinedPaper(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: ColorPalette,
  lineSpacing = 28,
  alpha = 0.08,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 0.8;

  // Horizontal ruled lines
  const startY = y + lineSpacing;
  for (let ly = startY; ly < y + h - 4; ly += lineSpacing) {
    ctx.beginPath();
    ctx.moveTo(x + 4, ly);
    ctx.lineTo(x + w - 4, ly);
    ctx.stroke();
  }

  // Left margin line (red)
  ctx.strokeStyle = palette.bad;
  ctx.globalAlpha = alpha * 0.6;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.08, y + 4);
  ctx.lineTo(x + w * 0.08, y + h - 4);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws a pencil icon at the given position.
 */
export function drawPencil(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  palette: ColorPalette,
  alpha = 0.12,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);

  const len = size * 0.8;
  const w = size * 0.12;

  // Body
  ctx.fillStyle = palette.warn;
  ctx.fillRect(-w / 2, -len / 2, w, len * 0.75);

  // Tip
  ctx.beginPath();
  ctx.moveTo(-w / 2, -len / 2 + len * 0.75);
  ctx.lineTo(0, len / 2);
  ctx.lineTo(w / 2, -len / 2 + len * 0.75);
  ctx.closePath();
  ctx.fillStyle = palette.canvasTextDim;
  ctx.fill();

  // Eraser
  ctx.fillStyle = palette.bad;
  ctx.fillRect(-w / 2, -len / 2, w, len * 0.08);

  ctx.restore();
}
