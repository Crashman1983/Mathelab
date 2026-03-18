/**
 * CustomDrawNode — Escape hatch for module-specific drawing.
 * Allows free ctx drawing within allocated bounds.
 *
 * In DEV mode: wraps ctx in TrackedContext to detect overlapping
 * text/shapes inside the draw function. Violations are collected
 * by CanvasScene after each render.
 */

import { BaseNode } from "./base";
import type { MeasuredSize, Rect, Size } from "./types";
import type { DrawOverlap, DrawViolationEntry, DrawnRegion } from "../tracked-context";

// DEV-only: Store factory on window to survive Vite HMR reloads.
// The tracked-context module is loaded once, reused across HMR updates.
declare global {
  interface Window {
    __createTrackedContext?: typeof import("../tracked-context").createTrackedContext;
  }
}

if (import.meta.env.DEV && !window.__createTrackedContext) {
  import("../tracked-context").then((mod) => {
    window.__createTrackedContext = mod.createTrackedContext;
  });
}

export class CustomDrawNode extends BaseNode {
  private measureFn?: (
    ctx: CanvasRenderingContext2D,
    available: Size,
  ) => MeasuredSize;
  private drawFn: (ctx: CanvasRenderingContext2D, rect: Rect) => void;
  private fixedW?: number;
  private fixedH?: number;

  /** Last draw's tracked regions (DEV only) */
  _debugRegions: DrawnRegion[] = [];
  /** Last draw's detected overlaps (DEV only) */
  _debugOverlaps: DrawOverlap[] = [];
  /** Last draw's quality violations: text-too-small, text-occluded, etc. (DEV only) */
  _debugViolations: DrawViolationEntry[] = [];

  constructor(opts: {
    id?: string;
    flex?: number;
    w?: number;
    h?: number;
    measure?: (ctx: CanvasRenderingContext2D, available: Size) => MeasuredSize;
    draw: (ctx: CanvasRenderingContext2D, rect: Rect) => void;
  }) {
    super();
    this.id = opts.id;
    this.flex = opts.flex;
    this.fixedW = opts.w;
    this.fixedH = opts.h;
    this.measureFn = opts.measure;
    this.drawFn = opts.draw;
  }

  measure(ctx: CanvasRenderingContext2D, available: Size): MeasuredSize {
    if (this.measureFn) {
      return this.storeMeasure(this.measureFn(ctx, available));
    }
    return this.storeMeasure({
      minW: this.fixedW ?? 0,
      minH: this.fixedH ?? 0,
      prefW: this.fixedW ?? available.w,
      prefH: this.fixedH ?? available.h,
    });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const r = this.allocatedRect;
    if (r.w <= 0 || r.h <= 0) return;

    if (import.meta.env.DEV && window.__createTrackedContext) {
      const nodeId = this.id ?? "custom";
      const tracked = window.__createTrackedContext(ctx, nodeId);
      ctx.save();
      this.drawFn(tracked.proxy, r);
      ctx.restore();
      this._debugRegions = tracked.getRegions();
      this._debugOverlaps = tracked.checkOverlaps();
      this._debugViolations = tracked.checkViolations();
      return;
    }

    ctx.save();
    this.drawFn(ctx, r);
    ctx.restore();
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function custom(opts: {
  id?: string;
  flex?: number;
  w?: number;
  h?: number;
  measure?: (ctx: CanvasRenderingContext2D, available: Size) => MeasuredSize;
  draw: (ctx: CanvasRenderingContext2D, rect: Rect) => void;
}): CustomDrawNode {
  return new CustomDrawNode(opts);
}
