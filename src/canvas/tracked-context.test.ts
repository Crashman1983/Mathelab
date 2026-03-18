/**
 * Tests for TrackedContext — canvas drawing quality violations.
 *
 * Verifies that the tracked context correctly detects:
 * - text-too-small: font < 12px
 * - text-occluded: text >30% covered by non-text region
 * - custom-draw-overlap: text-on-text overlaps
 */

import { describe, it, expect, vi } from "vitest";
import { createTrackedContext } from "./tracked-context";

/** Minimal mock for CanvasRenderingContext2D */
function createMockCtx(): CanvasRenderingContext2D {
  const ctx = {
    font: "400 16px sans-serif",
    fillStyle: "#000",
    textAlign: "start" as CanvasTextAlign,
    textBaseline: "alphabetic" as CanvasTextBaseline,
    globalAlpha: 1,
    measureText: vi.fn((str: string) => ({
      width: str.length * 8,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 3,
    })),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    fillRect: vi.fn(),
    arc: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  return ctx;
}

describe("TrackedContext", () => {
  describe("text-too-small violation", () => {
    it("detects text rendered below 12px", () => {
      const ctx = createMockCtx();
      ctx.font = "400 10px sans-serif";
      // Mock measureText to return small height
      (ctx.measureText as ReturnType<typeof vi.fn>).mockReturnValue({
        width: 40,
        actualBoundingBoxAscent: 7,
        actualBoundingBoxDescent: 2,
      });

      const tracked = createTrackedContext(ctx, "test-node");
      tracked.proxy.fillText("tiny text", 100, 100);

      const violations = tracked.checkViolations();
      const small = violations.filter((v: { type: string }) => v.type === "text-too-small");
      expect(small.length).toBeGreaterThanOrEqual(1);
      expect(small[0]!.detail).toContain("tiny text");
    });

    it("does NOT flag text at normal size", () => {
      const ctx = createMockCtx();
      ctx.font = "400 18px sans-serif";
      (ctx.measureText as ReturnType<typeof vi.fn>).mockReturnValue({
        width: 60,
        actualBoundingBoxAscent: 14,
        actualBoundingBoxDescent: 4,
      });

      const tracked = createTrackedContext(ctx, "test-node");
      tracked.proxy.fillText("normal text", 100, 100);

      const violations = tracked.checkViolations();
      const small = violations.filter((v: { type: string }) => v.type === "text-too-small");
      expect(small).toHaveLength(0);
    });
  });

  describe("text-occluded violation", () => {
    it("detects text covered >30% by a shape", () => {
      const ctx = createMockCtx();
      ctx.font = "400 16px sans-serif";
      ctx.textAlign = "start";
      ctx.textBaseline = "top";
      // Text at (100, 100) with bbox ~ (100, 100, 40, 16)
      (ctx.measureText as ReturnType<typeof vi.fn>).mockReturnValue({
        width: 40,
        actualBoundingBoxAscent: 0,
        actualBoundingBoxDescent: 16,
      });

      const tracked = createTrackedContext(ctx, "test-node");
      tracked.proxy.fillText("+90", 100, 100);
      // Large rect covering the text entirely
      tracked.proxy.fillRect(80, 80, 100, 100);

      const violations = tracked.checkViolations();
      const occluded = violations.filter((v: { type: string }) => v.type === "text-occluded");
      expect(occluded.length).toBeGreaterThanOrEqual(1);
      expect(occluded[0]!.detail).toContain("occluded");
    });

    it("does NOT flag text with no overlapping shapes", () => {
      const ctx = createMockCtx();
      ctx.font = "400 16px sans-serif";
      ctx.textAlign = "start";
      ctx.textBaseline = "top";
      (ctx.measureText as ReturnType<typeof vi.fn>).mockReturnValue({
        width: 40,
        actualBoundingBoxAscent: 0,
        actualBoundingBoxDescent: 16,
      });

      const tracked = createTrackedContext(ctx, "test-node");
      tracked.proxy.fillText("+90", 100, 100);
      // Rect far away from text
      tracked.proxy.fillRect(500, 500, 100, 100);

      const violations = tracked.checkViolations();
      const occluded = violations.filter((v: { type: string }) => v.type === "text-occluded");
      expect(occluded).toHaveLength(0);
    });
  });

  describe("custom-draw-overlap violation", () => {
    it("detects text-on-text overlap", () => {
      const ctx = createMockCtx();
      ctx.font = "400 16px sans-serif";
      ctx.textAlign = "start";
      ctx.textBaseline = "top";
      (ctx.measureText as ReturnType<typeof vi.fn>).mockReturnValue({
        width: 60,
        actualBoundingBoxAscent: 0,
        actualBoundingBoxDescent: 16,
      });

      const tracked = createTrackedContext(ctx, "test-node");
      // Two overlapping texts
      tracked.proxy.fillText("Label A", 100, 100);
      tracked.proxy.fillText("Label B", 120, 100);

      const violations = tracked.checkViolations();
      const overlaps = violations.filter((v: { type: string }) => v.type === "custom-draw-overlap");
      expect(overlaps.length).toBeGreaterThanOrEqual(1);
    });
  });
});
