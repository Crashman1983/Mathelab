/**
 * Shared Test-Utilities für Canvas-Tests.
 * Extrahiert aus container.test.ts für Wiederverwendung.
 */
import { vi } from "vitest";
import { BaseNode } from "@canvas/nodes/base";
import type { CanvasNode, MeasuredSize, Rect, Size } from "@canvas/nodes/types";

// ─── Mock Node (feste Größe) ────────────────────────────────────────────────

export class MockNode extends BaseNode {
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

export function mockCtx(): CanvasRenderingContext2D {
  return {
    measureText: vi.fn(() => ({
      width: 50,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    })),
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: "start",
    textBaseline: "alphabetic",
    shadowBlur: 0,
    shadowColor: "rgba(0,0,0,0)",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    fillText: vi.fn(),
    strokeText: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    drawImage: vi.fn(),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D;
}

// ─── Mock Canvas Element ────────────────────────────────────────────────────

export function mockCanvas(width = 800, height = 600): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // getBoundingClientRect mock
  canvas.getBoundingClientRect = () => ({
    x: 0, y: 0, width, height,
    top: 0, left: 0, right: width, bottom: height,
    toJSON: () => ({}),
  });
  return canvas;
}
