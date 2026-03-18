/**
 * Unit-Tests fuer CustomDrawNode und custom() Factory.
 */

import { describe, it, expect, vi } from "vitest";
import { custom, CustomDrawNode } from "./custom";
import { mockCtx } from "@test/test-helpers";

describe("CustomDrawNode", () => {
  describe("measure", () => {
    it("ruft benutzerdefinierte measureFn auf", () => {
      const measureFn = vi.fn((_ctx, available) => ({
        minW: 50,
        minH: 30,
        prefW: available.w,
        prefH: available.h,
      }));
      const node = new CustomDrawNode({
        measure: measureFn,
        draw: () => {},
      });
      const ctx = mockCtx();
      const result = node.measure(ctx, { w: 800, h: 600 });
      expect(measureFn).toHaveBeenCalledWith(ctx, { w: 800, h: 600 });
      expect(result.minW).toBe(50);
      expect(result.minH).toBe(30);
      expect(result.prefW).toBe(800);
      expect(result.prefH).toBe(600);
    });

    it("gibt fixedW/fixedH zurueck ohne measureFn", () => {
      const node = new CustomDrawNode({
        w: 120,
        h: 80,
        draw: () => {},
      });
      const ctx = mockCtx();
      const result = node.measure(ctx, { w: 800, h: 600 });
      expect(result.minW).toBe(120);
      expect(result.minH).toBe(80);
      expect(result.prefW).toBe(120);
      expect(result.prefH).toBe(80);
    });

    it("fuellt verfuegbaren Platz ohne measureFn und ohne fixedW", () => {
      const node = new CustomDrawNode({ draw: () => {} });
      const ctx = mockCtx();
      const result = node.measure(ctx, { w: 800, h: 600 });
      expect(result.minW).toBe(0);
      expect(result.minH).toBe(0);
      expect(result.prefW).toBe(800);
      expect(result.prefH).toBe(600);
    });
  });

  describe("draw", () => {
    it("ruft drawFn mit korrekt zugewiesenem Rect auf", () => {
      const drawFn = vi.fn();
      const node = new CustomDrawNode({ draw: drawFn });
      const ctx = mockCtx();
      const rect = { x: 10, y: 20, w: 300, h: 200 };
      node.layout(rect);
      node.draw(ctx);
      expect(drawFn).toHaveBeenCalledTimes(1);
      // Verify rect argument (ctx may be wrapped in DEV mode)
      const callArgs = drawFn.mock.calls[0];
      expect(callArgs[1]).toEqual(rect);
    });

    it("ruft drawFn nicht auf bei width/height 0", () => {
      const drawFn = vi.fn();
      const node = new CustomDrawNode({ draw: drawFn });
      const ctx = mockCtx();
      node.layout({ x: 0, y: 0, w: 0, h: 0 });
      node.draw(ctx);
      expect(drawFn).not.toHaveBeenCalled();
    });

    it("ruft ctx.save/restore auf", () => {
      const node = new CustomDrawNode({ draw: () => {} });
      const ctx = mockCtx();
      node.layout({ x: 0, y: 0, w: 100, h: 100 });
      node.draw(ctx);
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });
  });

  describe("Constructor und Factory", () => {
    it("setzt id korrekt", () => {
      const node = new CustomDrawNode({ id: "mein-custom", draw: () => {} });
      expect(node.id).toBe("mein-custom");
    });

    it("custom() Factory erstellt CustomDrawNode", () => {
      const drawFn = vi.fn();
      const node = custom({ id: "factory-node", flex: 2, draw: drawFn });
      expect(node).toBeInstanceOf(CustomDrawNode);
      expect(node.id).toBe("factory-node");
      expect(node.flex).toBe(2);
    });
  });
});
