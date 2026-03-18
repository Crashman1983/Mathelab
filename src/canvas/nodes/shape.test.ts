/**
 * Unit-Tests fuer ShapeNode und rect()/circle() Factories.
 */

import { describe, it, expect, vi } from "vitest";
import { rect, circle, ShapeNode } from "./shape";
import { mockCtx } from "@test/test-helpers";

// Mock design.ts
vi.mock("@core/design", () => ({
  getPalette: () => ({
    accent: "#1982C4",
    text: "#1E293B",
  }),
}));

describe("ShapeNode", () => {
  describe("Factories", () => {
    it("rect() erstellt ShapeNode mit type rect", () => {
      const node = rect();
      expect(node).toBeInstanceOf(ShapeNode);
      expect(node.shapeType).toBe("rect");
    });

    it("circle() erstellt ShapeNode mit type circle", () => {
      const node = circle();
      expect(node).toBeInstanceOf(ShapeNode);
      expect(node.shapeType).toBe("circle");
    });

    it("id und flex werden korrekt gesetzt", () => {
      const node = rect({ id: "bg-rect", flex: 1 });
      expect(node.id).toBe("bg-rect");
      expect(node.flex).toBe(1);
    });
  });

  describe("measure", () => {
    it("gibt korrekte Groesse bei fixedW/fixedH", () => {
      const ctx = mockCtx();
      const node = rect({ w: 100, h: 60 });
      const result = node.measure(ctx, { w: 800, h: 600 });
      expect(result.minW).toBe(100);
      expect(result.minH).toBe(60);
      expect(result.prefW).toBe(100);
      expect(result.prefH).toBe(60);
    });

    it("fuellt verfuegbaren Platz ohne fixedW/fixedH", () => {
      const ctx = mockCtx();
      const node = rect();
      const result = node.measure(ctx, { w: 800, h: 600 });
      expect(result.minW).toBe(0);
      expect(result.minH).toBe(0);
      expect(result.prefW).toBe(800);
      expect(result.prefH).toBe(600);
    });
  });

  describe("draw", () => {
    it("ruft ctx.fill auf wenn fill angegeben", () => {
      const ctx = mockCtx();
      const node = rect({ fill: "#FF0000" });
      node.measure(ctx, { w: 800, h: 600 });
      node.layout({ x: 0, y: 0, w: 100, h: 100 });
      node.draw(ctx);
      expect(ctx.fill).toHaveBeenCalled();
    });

    it("ruft ctx.stroke auf wenn stroke angegeben", () => {
      const ctx = mockCtx();
      const node = rect({ stroke: "#000000" });
      node.measure(ctx, { w: 800, h: 600 });
      node.layout({ x: 0, y: 0, w: 100, h: 100 });
      node.draw(ctx);
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it("zeichnet nichts bei width/height 0", () => {
      const ctx = mockCtx();
      const node = rect({ fill: "#FF0000" });
      node.layout({ x: 0, y: 0, w: 0, h: 0 });
      node.draw(ctx);
      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
    });

    it("circle draw ruft ctx.arc auf", () => {
      const ctx = mockCtx();
      const node = circle({ fill: "#0000FF" });
      node.measure(ctx, { w: 800, h: 600 });
      node.layout({ x: 10, y: 10, w: 80, h: 80 });
      node.draw(ctx);
      expect(ctx.arc).toHaveBeenCalledWith(50, 50, 40, 0, Math.PI * 2);
    });

    it("rect draw mit radius>0 verwendet roundRect", () => {
      const ctx = mockCtx();
      const node = rect({ fill: "#00FF00", radius: 8 });
      node.measure(ctx, { w: 800, h: 600 });
      node.layout({ x: 0, y: 0, w: 100, h: 100 });
      node.draw(ctx);
      expect(ctx.roundRect).toHaveBeenCalledWith(0, 0, 100, 100, 8);
    });
  });
});
