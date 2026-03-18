/**
 * Layout Container Nodes (Baustein 0).
 *
 * 5 container types that cover 95% of module layouts:
 * - VStack: Vertical arrangement (task text → visualization → buttons)
 * - HStack: Horizontal arrangement (button rows, options side by side)
 * - ZStack: Overlay (canvas drawing with overlay text)
 * - Grid: Uniform grid (dot fields, fraction circles)
 * - Spacer: Flexible free space (like CSS flex: 1)
 */

import { BaseNode } from "./base";
import type {
  CanvasNode,
  GridOptions,
  MeasuredSize,
  Rect,
  Size,
  StackOptions,
} from "./types";

// ─── VStack ─────────────────────────────────────────────────────────────────

export class VStack extends BaseNode {
  children: CanvasNode[];
  private gap: number;
  private padding: number;
  private align: StackOptions["align"];

  constructor(
    children: CanvasNode[],
    opts: StackOptions = {},
  ) {
    super();
    this.children = children;
    this.gap = opts.gap ?? 0;
    this.padding = opts.padding ?? 0;
    this.align = opts.align ?? "stretch";
  }

  measure(ctx: CanvasRenderingContext2D, available: Size): MeasuredSize {
    const pad2 = this.padding * 2;
    const innerW = available.w - pad2;
    const innerAvail: Size = { w: innerW, h: available.h - pad2 };

    const visibleChildren = this.children.filter((c) => c.visible !== false);
    const measurements = visibleChildren.map((c) => c.measure(ctx, innerAvail));

    const gapTotal =
      this.gap * Math.max(0, visibleChildren.length - 1);
    const totalMinH =
      measurements.reduce((s, m) => s + m.minH, 0) + gapTotal + pad2;
    const totalPrefH =
      measurements.reduce((s, m) => s + m.prefH, 0) + gapTotal + pad2;
    const maxMinW =
      measurements.length > 0
        ? Math.max(...measurements.map((m) => m.minW))
        : 0;
    const maxPrefW =
      measurements.length > 0
        ? Math.max(...measurements.map((m) => m.prefW))
        : 0;

    return this.storeMeasure({
      minW: maxMinW + pad2,
      minH: totalMinH,
      prefW: Math.min(maxPrefW + pad2, available.w),
      prefH: Math.min(totalPrefH, available.h),
    });
  }

  layout(allocated: Rect): void {
    super.layout(allocated);
    const pad = this.padding;
    const gap = Math.round(this.gap);
    const innerX = Math.round(allocated.x + pad);
    const innerW = Math.round(allocated.w - pad * 2);
    const innerH = allocated.h - pad * 2;

    const visibleChildren = this.children.filter((c) => c.visible !== false);
    if (visibleChildren.length === 0) return;

    // Calculate total flex and fixed heights
    let totalFixed = 0;
    let totalFlex = 0;
    const gapTotal = gap * Math.max(0, visibleChildren.length - 1);

    for (const child of visibleChildren) {
      if (child.flex && child.flex > 0) {
        totalFlex += child.flex;
      } else {
        totalFixed += child.lastMeasured.prefH;
      }
    }

    const remainingForFlex = Math.max(
      0,
      innerH - totalFixed - gapTotal,
    );

    // Overflow detection + proportional compression
    const totalNeeded = totalFixed + gapTotal;
    const scale =
      totalFlex === 0 && totalNeeded > innerH
        ? innerH / totalNeeded
        : 1;

    if (scale < 1 && typeof console !== "undefined") {
      console.warn(
        `[CanvasLayout] VStack overflow: need ${totalNeeded}px, have ${innerH}px. Compressing.`,
      );
    }

    let y = Math.round(allocated.y + pad);

    for (const child of visibleChildren) {
      let h: number;
      if (child.flex && child.flex > 0) {
        h = Math.round((child.flex / totalFlex) * remainingForFlex);
      } else {
        h = Math.round(child.lastMeasured.prefH * scale);
      }

      // Cross-axis alignment
      let x = innerX;
      let w = innerW;
      if (this.align !== "stretch") {
        const childW = Math.min(child.lastMeasured.prefW, innerW);
        w = childW;
        if (this.align === "center") x = innerX + Math.round((innerW - childW) / 2);
        else if (this.align === "end") x = innerX + innerW - childW;
      }

      // Clearance: add top spacing if child declares it
      const clearTop = (child as BaseNode).clearance?.top ?? 0;
      if (clearTop > 0) y += clearTop;

      child.layout({ x, y, w, h });
      y += h + gap;

      // Clearance: add bottom spacing if child declares it
      const clearBottom = (child as BaseNode).clearance?.bottom ?? 0;
      if (clearBottom > 0) y += clearBottom;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const child of this.children) {
      if (child.visible !== false) child.draw(ctx);
    }
  }
}

// ─── HStack ─────────────────────────────────────────────────────────────────

export class HStack extends BaseNode {
  children: CanvasNode[];
  private gap: number;
  private padding: number;
  private align: StackOptions["align"];
  private justify: StackOptions["justify"];

  constructor(
    children: CanvasNode[],
    opts: StackOptions = {},
  ) {
    super();
    this.children = children;
    this.gap = opts.gap ?? 0;
    this.padding = opts.padding ?? 0;
    this.align = opts.align ?? "stretch";
    this.justify = opts.justify ?? "start";
  }

  measure(ctx: CanvasRenderingContext2D, available: Size): MeasuredSize {
    const pad2 = this.padding * 2;
    const innerAvail: Size = {
      w: available.w - pad2,
      h: available.h - pad2,
    };

    const visibleChildren = this.children.filter((c) => c.visible !== false);
    const measurements = visibleChildren.map((c) => c.measure(ctx, innerAvail));

    const gapTotal =
      this.gap * Math.max(0, visibleChildren.length - 1);
    const totalMinW =
      measurements.reduce((s, m) => s + m.minW, 0) + gapTotal + pad2;
    const totalPrefW =
      measurements.reduce((s, m) => s + m.prefW, 0) + gapTotal + pad2;
    const maxMinH =
      measurements.length > 0
        ? Math.max(...measurements.map((m) => m.minH))
        : 0;
    const maxPrefH =
      measurements.length > 0
        ? Math.max(...measurements.map((m) => m.prefH))
        : 0;

    return this.storeMeasure({
      minW: totalMinW,
      minH: maxMinH + pad2,
      prefW: Math.min(totalPrefW, available.w),
      prefH: Math.min(maxPrefH + pad2, available.h),
    });
  }

  layout(allocated: Rect): void {
    super.layout(allocated);
    const pad = this.padding;
    const gap = Math.round(this.gap);
    const innerY = Math.round(allocated.y + pad);
    const innerW = allocated.w - pad * 2;
    const innerH = Math.round(allocated.h - pad * 2);

    const visibleChildren = this.children.filter((c) => c.visible !== false);
    if (visibleChildren.length === 0) return;

    let totalFixed = 0;
    let totalFlex = 0;
    const gapTotal = gap * Math.max(0, visibleChildren.length - 1);

    for (const child of visibleChildren) {
      if (child.flex && child.flex > 0) {
        totalFlex += child.flex;
      } else {
        totalFixed += child.lastMeasured.prefW;
      }
    }

    const remainingForFlex = Math.max(0, innerW - totalFixed - gapTotal);

    const totalNeeded = totalFixed + gapTotal;
    const scale =
      totalFlex === 0 && totalNeeded > innerW
        ? innerW / totalNeeded
        : 1;

    // Calculate starting x based on justify
    let x = Math.round(allocated.x + pad);
    if (this.justify === "center" && totalFlex === 0) {
      const totalUsed = totalNeeded * scale;
      x = Math.round(allocated.x + pad + (innerW - totalUsed) / 2);
    } else if (this.justify === "end" && totalFlex === 0) {
      const totalUsed = totalNeeded * scale;
      x = Math.round(allocated.x + pad + innerW - totalUsed);
    }

    // spaceBetween: distribute extra space as gaps
    let effectiveGap = gap;
    if (
      this.justify === "spaceBetween" &&
      totalFlex === 0 &&
      visibleChildren.length > 1
    ) {
      const totalChildW = visibleChildren.reduce(
        (s, c) => s + c.lastMeasured.prefW,
        0,
      );
      effectiveGap = Math.round(
        (innerW - totalChildW) / (visibleChildren.length - 1),
      );
      effectiveGap = Math.max(effectiveGap, gap);
    }

    for (const child of visibleChildren) {
      let w: number;
      if (child.flex && child.flex > 0) {
        w = Math.round((child.flex / totalFlex) * remainingForFlex);
      } else {
        w = Math.round(child.lastMeasured.prefW * scale);
      }

      // Cross-axis alignment
      let y = innerY;
      let h = innerH;
      if (this.align !== "stretch") {
        const childH = Math.min(child.lastMeasured.prefH, innerH);
        h = childH;
        if (this.align === "center") y = innerY + Math.round((innerH - childH) / 2);
        else if (this.align === "end") y = innerY + innerH - childH;
      }

      // Clearance: add left spacing if child declares it
      const clearLeft = (child as BaseNode).clearance?.left ?? 0;
      if (clearLeft > 0) x += clearLeft;

      child.layout({ x, y, w, h });
      x += w + (this.justify === "spaceBetween" ? effectiveGap : gap);

      // Clearance: add right spacing if child declares it
      const clearRight = (child as BaseNode).clearance?.right ?? 0;
      if (clearRight > 0) x += clearRight;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const child of this.children) {
      if (child.visible !== false) child.draw(ctx);
    }
  }
}

// ─── ZStack ─────────────────────────────────────────────────────────────────

export class ZStack extends BaseNode {
  children: CanvasNode[];
  private padding: number;

  constructor(
    children: CanvasNode[],
    opts: { padding?: number } = {},
  ) {
    super();
    this.children = children;
    this.padding = opts.padding ?? 0;
  }

  measure(ctx: CanvasRenderingContext2D, available: Size): MeasuredSize {
    const pad2 = this.padding * 2;
    const innerAvail: Size = {
      w: available.w - pad2,
      h: available.h - pad2,
    };

    const visibleChildren = this.children.filter((c) => c.visible !== false);
    const measurements = visibleChildren.map((c) => c.measure(ctx, innerAvail));

    const maxMinW =
      measurements.length > 0
        ? Math.max(...measurements.map((m) => m.minW))
        : 0;
    const maxMinH =
      measurements.length > 0
        ? Math.max(...measurements.map((m) => m.minH))
        : 0;
    const maxPrefW =
      measurements.length > 0
        ? Math.max(...measurements.map((m) => m.prefW))
        : 0;
    const maxPrefH =
      measurements.length > 0
        ? Math.max(...measurements.map((m) => m.prefH))
        : 0;

    return this.storeMeasure({
      minW: maxMinW + pad2,
      minH: maxMinH + pad2,
      prefW: Math.min(maxPrefW + pad2, available.w),
      prefH: Math.min(maxPrefH + pad2, available.h),
    });
  }

  layout(allocated: Rect): void {
    super.layout(allocated);
    const pad = this.padding;
    const inner: Rect = {
      x: Math.round(allocated.x + pad),
      y: Math.round(allocated.y + pad),
      w: Math.round(allocated.w - pad * 2),
      h: Math.round(allocated.h - pad * 2),
    };

    for (const child of this.children) {
      if (child.visible !== false) child.layout(inner);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Draw back to front (first child = bottom, last = top)
    for (const child of this.children) {
      if (child.visible !== false) child.draw(ctx);
    }
  }
}

// ─── Grid ───────────────────────────────────────────────────────────────────

export class GridNode extends BaseNode {
  children: CanvasNode[];
  private cols: number;
  private rows: number | undefined;
  private gap: number;
  private padding: number;

  constructor(children: CanvasNode[], opts: GridOptions) {
    super();
    this.children = children;
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.gap = opts.gap ?? 0;
    this.padding = opts.padding ?? 0;
  }

  measure(ctx: CanvasRenderingContext2D, available: Size): MeasuredSize {
    const pad2 = this.padding * 2;
    const visibleChildren = this.children.filter((c) => c.visible !== false);
    const rows =
      this.rows ?? Math.ceil(visibleChildren.length / this.cols);

    const gapW = this.gap * Math.max(0, this.cols - 1);
    const gapH = this.gap * Math.max(0, rows - 1);

    const cellAvailW = (available.w - pad2 - gapW) / this.cols;
    const cellAvailH = (available.h - pad2 - gapH) / Math.max(1, rows);
    const cellAvail: Size = {
      w: Math.max(0, cellAvailW),
      h: Math.max(0, cellAvailH),
    };

    // Measure all children to find max cell size
    let maxCellMinW = 0;
    let maxCellMinH = 0;
    let maxCellPrefW = 0;
    let maxCellPrefH = 0;

    for (const child of visibleChildren) {
      const m = child.measure(ctx, cellAvail);
      maxCellMinW = Math.max(maxCellMinW, m.minW);
      maxCellMinH = Math.max(maxCellMinH, m.minH);
      maxCellPrefW = Math.max(maxCellPrefW, m.prefW);
      maxCellPrefH = Math.max(maxCellPrefH, m.prefH);
    }

    return this.storeMeasure({
      minW: maxCellMinW * this.cols + gapW + pad2,
      minH: maxCellMinH * rows + gapH + pad2,
      prefW: Math.min(
        maxCellPrefW * this.cols + gapW + pad2,
        available.w,
      ),
      prefH: Math.min(
        maxCellPrefH * rows + gapH + pad2,
        available.h,
      ),
    });
  }

  layout(allocated: Rect): void {
    super.layout(allocated);
    const pad = this.padding;
    const gap = Math.round(this.gap);
    const visibleChildren = this.children.filter((c) => c.visible !== false);
    const rows =
      this.rows ?? Math.ceil(visibleChildren.length / this.cols);

    const gapW = gap * Math.max(0, this.cols - 1);
    const gapH = gap * Math.max(0, rows - 1);
    const innerW = allocated.w - pad * 2;
    const innerH = allocated.h - pad * 2;

    const cellW = Math.round((innerW - gapW) / this.cols);
    const cellH = Math.round((innerH - gapH) / Math.max(1, rows));

    for (let i = 0; i < visibleChildren.length; i++) {
      const col = i % this.cols;
      const row = Math.floor(i / this.cols);
      const x = Math.round(allocated.x + pad + col * (cellW + gap));
      const y = Math.round(allocated.y + pad + row * (cellH + gap));

      visibleChildren[i].layout({ x, y, w: cellW, h: cellH });
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const child of this.children) {
      if (child.visible !== false) child.draw(ctx);
    }
  }
}

// ─── Spacer ─────────────────────────────────────────────────────────────────

export class Spacer extends BaseNode {
  constructor(flexWeight = 1) {
    super();
    this.flex = flexWeight;
  }

  measure(_ctx: CanvasRenderingContext2D, _available: Size): MeasuredSize {
    return this.storeMeasure({
      minW: 0,
      minH: 0,
      prefW: 0,
      prefH: 0,
    });
  }

  draw(_ctx: CanvasRenderingContext2D): void {
    // Spacer is invisible — just occupies space
  }
}

// ─── Factory Functions ──────────────────────────────────────────────────────

export function vstack(
  children: CanvasNode[],
  opts?: StackOptions,
): VStack {
  return new VStack(children, opts);
}

export function hstack(
  children: CanvasNode[],
  opts?: StackOptions,
): HStack {
  return new HStack(children, opts);
}

export function zstack(
  children: CanvasNode[],
  opts?: { padding?: number },
): ZStack {
  return new ZStack(children, opts);
}

export function grid(
  children: CanvasNode[],
  opts: GridOptions,
): GridNode {
  return new GridNode(children, opts);
}

export function spacer(flexWeight = 1): Spacer {
  return new Spacer(flexWeight);
}
