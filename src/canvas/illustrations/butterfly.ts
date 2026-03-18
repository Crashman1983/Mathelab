/**
 * Butterfly illustration — decorative wing outline for Symmetrie module.
 * Pure draw function, stateless. Uses palette colors.
 */

import type { ColorPalette } from "@core/design";

export interface ButterflyOptions {
  /** 0–1: how much of the wing is filled (progress indicator) */
  fillRatio?: number;
  /** Overall opacity (0–1) */
  alpha?: number;
  /** Mirror axis: vertical center of the rect */
  mirror?: boolean;
}

/**
 * Draws a decorative butterfly outline centered in the given rect.
 * Wings fill proportionally to `fillRatio` (default 0).
 */
export function drawButterfly(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: ColorPalette,
  opts: ButterflyOptions = {},
): void {
  const fillRatio = opts.fillRatio ?? 0;
  const alpha = opts.alpha ?? 0.18;

  const cx = x + w / 2;
  const cy = y + h / 2;
  const wingW = w * 0.42;
  const wingH = h * 0.44;
  const bodyW = w * 0.04;
  const bodyH = h * 0.5;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Body
  ctx.beginPath();
  ctx.ellipse(cx, cy, bodyW, bodyH, 0, 0, Math.PI * 2);
  ctx.fillStyle = palette.canvasTextDim;
  ctx.fill();

  // Antennae
  ctx.strokeStyle = palette.canvasTextDim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy - bodyH * 0.85);
  ctx.quadraticCurveTo(cx - wingW * 0.3, cy - bodyH * 1.1, cx - wingW * 0.4, cy - bodyH * 1.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 2, cy - bodyH * 0.85);
  ctx.quadraticCurveTo(cx + wingW * 0.3, cy - bodyH * 1.1, cx + wingW * 0.4, cy - bodyH * 1.2);
  ctx.stroke();

  // Wings (left + right mirrored)
  for (const side of [-1, 1] as const) {
    // Upper wing
    ctx.beginPath();
    ctx.moveTo(cx, cy - bodyH * 0.3);
    ctx.quadraticCurveTo(
      cx + side * wingW * 1.1, cy - wingH * 1.0,
      cx + side * wingW, cy - wingH * 0.1,
    );
    ctx.quadraticCurveTo(
      cx + side * wingW * 0.7, cy + wingH * 0.05,
      cx, cy + bodyH * 0.1,
    );
    ctx.closePath();

    // Fill based on ratio
    if (fillRatio > 0) {
      ctx.save();
      ctx.globalAlpha = alpha * fillRatio * 0.6;
      ctx.fillStyle = palette.canvasSecondary;
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = palette.canvasSecondary;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Lower wing (smaller)
    ctx.beginPath();
    ctx.moveTo(cx, cy + bodyH * 0.1);
    ctx.quadraticCurveTo(
      cx + side * wingW * 0.9, cy + wingH * 0.2,
      cx + side * wingW * 0.7, cy + wingH * 0.7,
    );
    ctx.quadraticCurveTo(
      cx + side * wingW * 0.3, cy + wingH * 0.8,
      cx, cy + bodyH * 0.4,
    );
    ctx.closePath();

    if (fillRatio > 0) {
      ctx.save();
      ctx.globalAlpha = alpha * fillRatio * 0.5;
      ctx.fillStyle = palette.accent;
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  ctx.restore();
}
