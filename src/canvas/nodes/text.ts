/**
 * TextNode — Canvas text with measure-before-draw.
 * Uses resolveCanvasFonts() for font sizes. No free ctx.fillText() in modules.
 */

import { BaseNode } from "./base";
import type {
  CanvasNode,
  MeasuredSize,
  Rect,
  Size,
  TextStyle,
} from "./types";
import { getPalette, resolveCanvasFonts } from "@core/design";

const FONT_FAMILY = "'Atkinson Hyperlegible', system-ui, sans-serif";

export class TextNode extends BaseNode {
  text: string;
  style: TextStyle;

  /** Resolved font string (set during measure) */
  private resolvedFont = "";
  /** Measured text metrics (set during measure) */
  private textWidth = 0;
  private textHeight = 0;
  /** The canvas width used for font resolution */
  private lastCanvasWidth = 0;

  constructor(text: string, style: TextStyle = {}) {
    super();
    this.text = text;
    this.style = style;
  }

  measure(ctx: CanvasRenderingContext2D, available: Size): MeasuredSize {
    // Resolve font from canvas width (CSS pixels)
    this.lastCanvasWidth = available.w;
    const fonts = resolveCanvasFonts(available.w);
    const sizeKey = this.style.fontSize ?? "md";
    const fontSizePx = fonts[sizeKey];
    const weight = this.style.bold ? "700" : "400";
    this.resolvedFont = `${weight} ${fontSizePx}px ${FONT_FAMILY}`;

    ctx.font = this.resolvedFont;
    const metrics = ctx.measureText(this.text);
    this.textWidth = metrics.width;
    this.textHeight =
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

    const pad = this.style.padding ?? 0;
    const pad2 = pad * 2;

    return this.storeMeasure({
      minW: Math.min(this.textWidth + pad2, available.w),
      minH: this.textHeight + pad2,
      prefW: Math.min(this.textWidth + pad2, available.w),
      prefH: this.textHeight + pad2,
    });
  }

  layout(allocated: Rect): void {
    super.layout(allocated);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const r = this.allocatedRect;
    if (r.w <= 0 || r.h <= 0) return;

    const palette = getPalette();
    const pad = this.style.padding ?? 0;
    const color = this.style.color
      ? resolveColor(this.style.color, palette)
      : palette.canvasText;

    ctx.save();
    ctx.font = this.resolvedFont;
    ctx.fillStyle = color;

    // Horizontal alignment
    const align = this.style.align ?? "center";
    let x: number;
    if (align === "left") {
      ctx.textAlign = "left";
      x = r.x + pad;
    } else if (align === "right") {
      ctx.textAlign = "right";
      x = r.x + r.w - pad;
    } else {
      ctx.textAlign = "center";
      x = r.x + r.w / 2;
    }

    // Vertical alignment
    const vAlign = this.style.vAlign ?? "middle";
    let y: number;
    if (vAlign === "top") {
      ctx.textBaseline = "top";
      y = r.y + pad;
    } else if (vAlign === "bottom") {
      ctx.textBaseline = "bottom";
      y = r.y + r.h - pad;
    } else {
      ctx.textBaseline = "middle";
      y = r.y + r.h / 2;
    }

    // Draw with maxWidth to prevent overflow
    ctx.fillText(this.text, x, y, r.w - pad * 2);
    ctx.restore();
  }
}

/** Resolve semantic color key to actual color string */
function resolveColor(
  key: string,
  palette: ReturnType<typeof getPalette>,
): string {
  // If it starts with # or rgb, it's a direct color
  if (key.startsWith("#") || key.startsWith("rgb")) return key;
  // Try palette keys
  const value = (palette as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ? value : key;
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function text(
  content: string,
  style?: TextStyle & { id?: string; flex?: number },
): TextNode {
  const node = new TextNode(content, style);
  if (style?.id) node.id = style.id;
  if (style?.flex !== undefined) node.flex = style.flex;
  return node;
}
