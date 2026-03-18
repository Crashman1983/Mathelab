/**
 * Unit tests for the Canvas Layout System (Baustein 0).
 * Tests measure→layout→draw cycle for all 5 container types.
 */

import { describe, it, expect, vi } from "vitest";
import { VStack, HStack, ZStack, GridNode, Spacer, vstack, hstack, grid, spacer } from "./container";
import { BaseNode } from "./base";
import type { CanvasNode, MeasuredSize, Rect, Size } from "./types";

// ─── Mock Node (fixed size) ─────────────────────────────────────────────────

class MockNode extends BaseNode {
  private fixedW: number;
  private fixedH: number;
  layoutCalls: Rect[] = [];

  constructor(w: number, h: number, flex?: number) {
    super();
    this.fixedW = w;
    this.fixedH = h;
    if (flex !== undefined) this.flex = flex;
  }

  measure(_ctx: CanvasRenderingContext2D, _available: Size): MeasuredSize {
    return this.storeMeasure({
      minW: this.fixedW,
      minH: this.fixedH,
      prefW: this.fixedW,
      prefH: this.fixedH,
    });
  }

  layout(allocated: Rect): void {
    super.layout(allocated);
    this.layoutCalls.push({ ...allocated });
  }

  draw(_ctx: CanvasRenderingContext2D): void {
    // noop for tests
  }
}

// ─── Mock CanvasRenderingContext2D ───────────────────────────────────────────

function mockCtx(): CanvasRenderingContext2D {
  return {
    measureText: () => ({
      width: 50,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    }),
    font: "",
    fillStyle: "",
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

// ─── VStack Tests ───────────────────────────────────────────────────────────

describe("VStack", () => {
  const ctx = mockCtx();

  it("measures total height as sum of children + gaps", () => {
    const a = new MockNode(100, 30);
    const b = new MockNode(80, 40);
    const stack = new VStack([a, b], { gap: 10 });

    const m = stack.measure(ctx, { w: 200, h: 300 });
    expect(m.minH).toBe(30 + 40 + 10); // 80
    expect(m.minW).toBe(100); // max of children
  });

  it("lays out children vertically with gap", () => {
    const a = new MockNode(100, 30);
    const b = new MockNode(80, 40);
    const stack = new VStack([a, b], { gap: 10 });

    stack.measure(ctx, { w: 200, h: 300 });
    stack.layout({ x: 0, y: 0, w: 200, h: 300 });

    expect(a.allocatedRect).toEqual({ x: 0, y: 0, w: 200, h: 30 });
    expect(b.allocatedRect).toEqual({ x: 0, y: 40, w: 200, h: 40 });
  });

  it("distributes flex space proportionally", () => {
    const a = new MockNode(100, 30);
    const b = new MockNode(100, 0, 1); // flex: 1
    const c = new MockNode(100, 20);
    const stack = new VStack([a, b, c], { gap: 0 });

    stack.measure(ctx, { w: 200, h: 200 });
    stack.layout({ x: 0, y: 0, w: 200, h: 200 });

    // b should get remaining: 200 - 30 - 20 = 150
    expect(b.allocatedRect.h).toBe(150);
  });

  it("applies padding", () => {
    const a = new MockNode(100, 30);
    const stack = new VStack([a], { padding: 10 });

    stack.measure(ctx, { w: 200, h: 200 });
    stack.layout({ x: 0, y: 0, w: 200, h: 200 });

    expect(a.allocatedRect.x).toBe(10);
    expect(a.allocatedRect.y).toBe(10);
    expect(a.allocatedRect.w).toBe(180);
  });

  it("hides invisible children", () => {
    const a = new MockNode(100, 30);
    const b = new MockNode(80, 40);
    b.visible = false;
    const stack = new VStack([a, b], { gap: 10 });

    const m = stack.measure(ctx, { w: 200, h: 300 });
    // Only a is visible
    expect(m.minH).toBe(30);
  });

  it("compresses children on overflow", () => {
    const a = new MockNode(100, 100);
    const b = new MockNode(100, 100);
    const stack = new VStack([a, b], { gap: 0 });

    stack.measure(ctx, { w: 200, h: 150 });
    stack.layout({ x: 0, y: 0, w: 200, h: 150 });

    // Both should be compressed proportionally (75% of original)
    expect(a.allocatedRect.h).toBe(75);
    expect(b.allocatedRect.h).toBe(75);
  });

  it("aligns children to center", () => {
    const a = new MockNode(60, 30);
    const stack = new VStack([a], { align: "center" });

    stack.measure(ctx, { w: 200, h: 200 });
    stack.layout({ x: 0, y: 0, w: 200, h: 200 });

    expect(a.allocatedRect.x).toBe(70); // (200 - 60) / 2
    expect(a.allocatedRect.w).toBe(60);
  });
});

// ─── HStack Tests ───────────────────────────────────────────────────────────

describe("HStack", () => {
  const ctx = mockCtx();

  it("measures total width as sum of children + gaps", () => {
    const a = new MockNode(60, 30);
    const b = new MockNode(80, 40);
    const stack = new HStack([a, b], { gap: 10 });

    const m = stack.measure(ctx, { w: 300, h: 200 });
    expect(m.minW).toBe(60 + 80 + 10); // 150
    expect(m.minH).toBe(40); // max of children
  });

  it("lays out children horizontally with gap", () => {
    const a = new MockNode(60, 30);
    const b = new MockNode(80, 40);
    const stack = new HStack([a, b], { gap: 10 });

    stack.measure(ctx, { w: 300, h: 200 });
    stack.layout({ x: 0, y: 0, w: 300, h: 200 });

    expect(a.allocatedRect).toEqual({ x: 0, y: 0, w: 60, h: 200 });
    expect(b.allocatedRect).toEqual({ x: 70, y: 0, w: 80, h: 200 });
  });

  it("distributes flex space", () => {
    const a = new MockNode(50, 30);
    const b = new MockNode(0, 30, 1);
    const c = new MockNode(50, 30);
    const stack = new HStack([a, b, c], { gap: 0 });

    stack.measure(ctx, { w: 300, h: 100 });
    stack.layout({ x: 0, y: 0, w: 300, h: 100 });

    expect(b.allocatedRect.w).toBe(200); // 300 - 50 - 50
  });

  it("centers children with justify center", () => {
    const a = new MockNode(40, 30);
    const b = new MockNode(40, 30);
    const stack = new HStack([a, b], { gap: 10, justify: "center" });

    stack.measure(ctx, { w: 200, h: 100 });
    stack.layout({ x: 0, y: 0, w: 200, h: 100 });

    // Total: 40 + 10 + 40 = 90, offset = (200 - 90) / 2 = 55
    expect(a.allocatedRect.x).toBe(55);
    expect(b.allocatedRect.x).toBe(105);
  });
});

// ─── ZStack Tests ───────────────────────────────────────────────────────────

describe("ZStack", () => {
  const ctx = mockCtx();

  it("gives all children the same rect", () => {
    const a = new MockNode(100, 50);
    const b = new MockNode(80, 40);
    const stack = new ZStack([a, b]);

    stack.measure(ctx, { w: 200, h: 200 });
    stack.layout({ x: 10, y: 20, w: 200, h: 200 });

    expect(a.allocatedRect).toEqual({ x: 10, y: 20, w: 200, h: 200 });
    expect(b.allocatedRect).toEqual({ x: 10, y: 20, w: 200, h: 200 });
  });

  it("applies padding equally", () => {
    const a = new MockNode(100, 50);
    const stack = new ZStack([a], { padding: 10 });

    stack.measure(ctx, { w: 200, h: 200 });
    stack.layout({ x: 0, y: 0, w: 200, h: 200 });

    expect(a.allocatedRect).toEqual({ x: 10, y: 10, w: 180, h: 180 });
  });
});

// ─── Grid Tests ─────────────────────────────────────────────────────────────

describe("GridNode", () => {
  const ctx = mockCtx();

  it("distributes children into grid cells", () => {
    const children = Array.from({ length: 6 }, () => new MockNode(30, 20));
    const g = new GridNode(children, { cols: 3, gap: 0 });

    g.measure(ctx, { w: 300, h: 200 });
    g.layout({ x: 0, y: 0, w: 300, h: 200 });

    // 3 columns × 2 rows
    expect(children[0].allocatedRect).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(children[1].allocatedRect).toEqual({ x: 100, y: 0, w: 100, h: 100 });
    expect(children[2].allocatedRect).toEqual({ x: 200, y: 0, w: 100, h: 100 });
    expect(children[3].allocatedRect).toEqual({ x: 0, y: 100, w: 100, h: 100 });
  });

  it("applies gap between cells", () => {
    const children = Array.from({ length: 4 }, () => new MockNode(30, 20));
    const g = new GridNode(children, { cols: 2, gap: 10 });

    g.measure(ctx, { w: 210, h: 210 });
    g.layout({ x: 0, y: 0, w: 210, h: 210 });

    // (210 - 10) / 2 = 100 per cell
    expect(children[0].allocatedRect.w).toBe(100);
    expect(children[1].allocatedRect.x).toBe(110); // 100 + 10 gap
  });
});

// ─── Spacer Tests ───────────────────────────────────────────────────────────

describe("Spacer", () => {
  const ctx = mockCtx();

  it("has zero preferred size", () => {
    const s = new Spacer(1);
    const m = s.measure(ctx, { w: 200, h: 200 });
    expect(m.prefW).toBe(0);
    expect(m.prefH).toBe(0);
  });

  it("takes flex space in VStack", () => {
    const a = new MockNode(100, 30);
    const s = new Spacer(1);
    const b = new MockNode(100, 30);
    const stack = new VStack([a, s, b], { gap: 0 });

    stack.measure(ctx, { w: 200, h: 200 });
    stack.layout({ x: 0, y: 0, w: 200, h: 200 });

    expect(s.allocatedRect.h).toBe(140); // 200 - 30 - 30
    expect(b.allocatedRect.y).toBe(170); // 30 + 140
  });
});

// ─── Factory Functions ──────────────────────────────────────────────────────

describe("Factory functions", () => {
  it("vstack creates VStack", () => {
    const s = vstack([], { gap: 5 });
    expect(s).toBeInstanceOf(VStack);
  });

  it("hstack creates HStack", () => {
    const s = hstack([], { gap: 5 });
    expect(s).toBeInstanceOf(HStack);
  });

  it("grid creates GridNode", () => {
    const g = grid([], { cols: 3 });
    expect(g).toBeInstanceOf(GridNode);
  });

  it("spacer creates Spacer with flex", () => {
    const s = spacer(2);
    expect(s).toBeInstanceOf(Spacer);
    expect(s.flex).toBe(2);
  });
});
