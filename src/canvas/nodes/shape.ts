/**
 * ShapeNode — Basic geometric shapes for Canvas rendering.
 * Circle, Rectangle, Polygon.
 */

import { BaseNode } from "./base";
import type { MeasuredSize, Rect, ShapeStyle, Size } from "./types";
import { getPalette } from "@core/design";

export type ShapeType = "rect" | "circle" | "ellipse";

export class ShapeNode extends BaseNode {
  shapeType: ShapeType;
  style: ShapeStyle;
  /** Fixed size (if provided), otherwise fills available space */
  fixedW?: number;
  fixedH?: number;

  constructor(
    shapeType: ShapeType,
    style: ShapeStyle = {},
    opts?: { id?: string; flex?: number; w?: number; h?: number },
  ) {
    super();
    this.shapeType = shapeType;
    this.style = style;
    if (opts?.id) this.id = opts.id;
    if (opts?.flex !== undefined) this.flex = opts.flex;
    this.fixedW = opts?.w;
    this.fixedH = opts?.h;
  }

  measure(_ctx: CanvasRenderingContext2D, available: Size): MeasuredSize {
    const w = this.fixedW ?? available.w;
    const h = this.fixedH ?? available.h;
    return this.storeMeasure({
      minW: this.fixedW ?? 0,
      minH: this.fixedH ?? 0,
      prefW: Math.min(w, available.w),
      prefH: Math.min(h, available.h),
    });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const r = this.allocatedRect;
    if (r.w <= 0 || r.h <= 0) return;

    const palette = getPalette();
    const fill = resolveColor(this.style.fill, palette);
    const stroke = resolveColor(this.style.stroke, palette);
    const strokeWidth = this.style.strokeWidth ?? 1;
    const radius = this.style.radius ?? 0;

    ctx.save();

    switch (this.shapeType) {
      case "rect":
        ctx.beginPath();
        if (radius > 0 && typeof ctx.roundRect === "function") {
          ctx.roundRect(r.x, r.y, r.w, r.h, radius);
        } else if (radius > 0) {
          // Fallback for older browsers
          ctx.moveTo(r.x + radius, r.y);
          ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, radius);
          ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, radius);
          ctx.arcTo(r.x, r.y + r.h, r.x, r.y, radius);
          ctx.arcTo(r.x, r.y, r.x + r.w, r.y, radius);
          ctx.closePath();
        } else {
          ctx.rect(r.x, r.y, r.w, r.h);
        }
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = strokeWidth;
          ctx.stroke();
        }
        break;

      case "circle": {
        const rad = Math.min(r.w, r.h) / 2;
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = strokeWidth;
          ctx.stroke();
        }
        break;
      }

      case "ellipse": {
        const rx = r.w / 2;
        const ry = r.h / 2;
        const cx = r.x + rx;
        const cy = r.y + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = strokeWidth;
          ctx.stroke();
        }
        break;
      }
    }

    ctx.restore();
  }
}

function resolveColor(
  key: string | undefined,
  palette: ReturnType<typeof getPalette>,
): string | undefined {
  if (!key) return undefined;
  if (key.startsWith("#") || key.startsWith("rgb")) return key;
  const value = (palette as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ? value : key;
}

// ─── Factories ──────────────────────────────────────────────────────────────

export function rect(
  style?: ShapeStyle & { id?: string; flex?: number; w?: number; h?: number },
): ShapeNode {
  return new ShapeNode("rect", style, style);
}

export function circle(
  style?: ShapeStyle & { id?: string; flex?: number; w?: number; h?: number },
): ShapeNode {
  return new ShapeNode("circle", style, style);
}
