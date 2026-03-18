/**
 * ButtonNode — Canvas button with auto HitArea registration.
 * Minimum touch target: 44×44 CSS pixels (CLAUDE.md MUST).
 * Focus ring: 3px solid accent, 3px offset (E15).
 */

import { BaseNode } from "./base";
import type {
  ButtonStyle,
  MeasuredSize,
  Rect,
  SceneHitArea,
  Size,
} from "./types";
import { MIN_TOUCH_TARGET } from "./types";
import {
  getPalette,
  resolveCanvasFonts,
  resolveCanvasRadius,
} from "@core/design";

const FONT_FAMILY = "'Atkinson Hyperlegible', system-ui, sans-serif";

export class ButtonNode extends BaseNode {
  label: string;
  style: ButtonStyle;
  onTap?: (x: number, y: number) => void;
  /** Stable test identifier for automation — survives label/id changes */
  testId?: string;
  /** Whether the button is currently pressed (set by CanvasScene pointer handling) */
  pressed = false;

  /** Resolved during measure */
  private resolvedFont = "";
  private textWidth = 0;
  private textHeight = 0;

  constructor(
    label: string,
    opts: ButtonStyle & {
      id?: string;
      testId?: string;
      onTap?: (x: number, y: number) => void;
    } = {},
  ) {
    super();
    this.label = label;
    this.id = opts.id;
    this.testId = opts.testId;
    this.onTap = opts.onTap;
    this.style = {
      variant: opts.variant ?? "secondary",
      minWidth: opts.minWidth,
      minHeight: opts.minHeight ?? MIN_TOUCH_TARGET,
      enabled: opts.enabled ?? true,
      focused: opts.focused ?? false,
    };
  }

  measure(ctx: CanvasRenderingContext2D, available: Size): MeasuredSize {
    const fonts = resolveCanvasFonts(available.w);
    this.resolvedFont = `600 ${fonts.sm}px ${FONT_FAMILY}`;

    ctx.font = this.resolvedFont;
    const metrics = ctx.measureText(this.label);
    this.textWidth = metrics.width;
    this.textHeight =
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

    const padH = fonts.sm * 0.8; // horizontal padding
    const padV = fonts.sm * 0.4; // vertical padding
    // Scale touch target on Smartboards: 44px baseline, up to 72px on wide canvases
    const scaledTouch = available.w > 2000 ? Math.min(Math.round(available.w * 0.025), 72) : MIN_TOUCH_TARGET;
    const minH = Math.max(this.style.minHeight ?? scaledTouch, scaledTouch);
    const minW = Math.max(
      this.style.minWidth ?? 0,
      MIN_TOUCH_TARGET,
      this.textWidth + padH * 2,
    );

    return this.storeMeasure({
      minW,
      minH,
      prefW: Math.min(minW, available.w),
      prefH: Math.max(this.textHeight + padV * 2, minH),
    });
  }

  layout(allocated: Rect): void {
    super.layout(allocated);
  }

  /** Set pressed state (called by CanvasScene pointer handling) */
  setPressed(p: boolean): void {
    this.pressed = p;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const r = this.allocatedRect;
    if (r.w <= 0 || r.h <= 0) return;

    const palette = getPalette();
    const radius = resolveCanvasRadius(r.w);
    const rad = Math.min(radius.md, r.h / 2);
    const enabled = this.style.enabled !== false;

    // Resolve colors from variant
    const { bg, fg, border } = resolveButtonColors(
      this.style.variant ?? "secondary",
      palette,
      enabled,
    );

    ctx.save();

    // Press animation: scale(0.95) around button center
    if (this.pressed && enabled) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      ctx.translate(cx, cy);
      ctx.scale(0.95, 0.95);
      ctx.translate(-cx, -cy);
    }

    // Shadow (subtle, reduced when pressed)
    if (enabled) {
      ctx.shadowColor = "rgba(0,0,0,0.12)";
      ctx.shadowBlur = this.pressed ? 2 : 4;
      ctx.shadowOffsetY = this.pressed ? 1 : 2;
    }

    // Background
    ctx.fillStyle = bg;
    ctx.beginPath();
    roundRect(ctx, r.x, r.y, r.w, r.h, rad);
    ctx.fill();

    // Reset shadow for border and text
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Border
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundRect(ctx, r.x, r.y, r.w, r.h, rad);
      ctx.stroke();
    }

    // Focus ring (3px solid accent, 3px offset — E15)
    if (this.style.focused) {
      const offset = 3;
      ctx.strokeStyle = palette.accentFocus;
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRect(
        ctx,
        r.x - offset,
        r.y - offset,
        r.w + offset * 2,
        r.h + offset * 2,
        rad + offset,
      );
      ctx.stroke();
    }

    // Label text
    ctx.font = this.resolvedFont;
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label, r.x + r.w / 2, r.y + r.h / 2, r.w - 16);

    ctx.restore();
  }

  /** Generate HitArea for this button (called by Scene after layout) */
  toHitArea(): SceneHitArea {
    return {
      id: this.testId ?? this.id ?? `btn-${this.label}`,
      testId: this.testId,
      rect: { ...this.allocatedRect },
      enabled: this.style.enabled !== false,
      onTap: this.onTap,
      node: this,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveButtonColors(
  variant: NonNullable<ButtonStyle["variant"]>,
  palette: ReturnType<typeof getPalette>,
  enabled: boolean,
): { bg: string; fg: string; border: string | null } {
  if (!enabled) {
    return {
      bg: palette.panelSoft,
      fg: palette.textDim,
      border: null,
    };
  }
  switch (variant) {
    case "primary":
      return { bg: palette.accent, fg: palette.textOnAccent, border: null };
    case "ok":
      return { bg: palette.ok, fg: palette.textOnAccent, border: null };
    case "warn":
      return { bg: palette.warn, fg: palette.textOnAccent, border: null };
    case "bad":
      return { bg: palette.bad, fg: palette.textOnAccent, border: null };
    case "ghost":
      return { bg: "transparent", fg: palette.text, border: palette.line };
    case "secondary":
    default:
      return { bg: palette.panel, fg: palette.text, border: palette.line };
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  // Use native roundRect if available (Chrome 99+)
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function button(
  label: string,
  opts?: ButtonStyle & {
    id?: string;
    onTap?: (x: number, y: number) => void;
  },
): ButtonNode {
  return new ButtonNode(label, opts);
}
