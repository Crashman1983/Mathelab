/**
 * PanelNode — Canvas panel with background, border, shadow, and optional children.
 */

import { BaseNode } from "./base";
import type { CanvasNode, MeasuredSize, PanelStyle, Rect, Size } from "./types";
import { getPalette, resolveCanvasRadius } from "@core/design";

export class PanelNode extends BaseNode {
  style: PanelStyle;
  child?: CanvasNode;

  constructor(style: PanelStyle = {}, child?: CanvasNode) {
    super();
    this.style = style;
    this.child = child;
  }

  measure(ctx: CanvasRenderingContext2D, available: Size): MeasuredSize {
    const pad = this.style.padding ?? 0;
    const pad2 = pad * 2;

    if (this.child) {
      const childSize = this.child.measure(ctx, {
        w: available.w - pad2,
        h: available.h - pad2,
      });
      return this.storeMeasure({
        minW: childSize.minW + pad2,
        minH: childSize.minH + pad2,
        prefW: childSize.prefW + pad2,
        prefH: childSize.prefH + pad2,
      });
    }

    return this.storeMeasure({
      minW: pad2,
      minH: pad2,
      prefW: available.w,
      prefH: available.h,
    });
  }

  layout(allocated: Rect): void {
    super.layout(allocated);
    if (this.child) {
      const pad = this.style.padding ?? 0;
      this.child.layout({
        x: Math.round(allocated.x + pad),
        y: Math.round(allocated.y + pad),
        w: Math.round(allocated.w - pad * 2),
        h: Math.round(allocated.h - pad * 2),
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const r = this.allocatedRect;
    if (r.w <= 0 || r.h <= 0) return;

    const palette = getPalette();
    const radius = this.style.radius ?? resolveCanvasRadius(r.w).md;
    const bg = resolveColor(this.style.bg, palette) ?? palette.panelSoft;
    const border = resolveColor(this.style.border, palette);
    const borderWidth = this.style.borderWidth ?? 1;
    const shadowBlur = this.style.shadowBlur ?? 0;

    ctx.save();

    // Shadow
    if (shadowBlur > 0) {
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetY = shadowBlur * 0.3;
    }

    // Background
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(r.x, r.y, r.w, r.h, radius);
    } else {
      ctx.rect(r.x, r.y, r.w, r.h);
    }
    ctx.fillStyle = bg;
    ctx.fill();

    // Reset shadow before border
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    // Border
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
    }

    ctx.restore();

    // Draw child
    this.child?.draw(ctx);
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

// ─── Factory ────────────────────────────────────────────────────────────────

export function panel(
  style?: PanelStyle & { id?: string; flex?: number },
  child?: CanvasNode,
): PanelNode {
  const node = new PanelNode(style, child);
  if (style?.id) node.id = style.id;
  if (style?.flex !== undefined) node.flex = style.flex;
  return node;
}
