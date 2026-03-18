/**
 * Unit-Tests fuer PanelNode und panel() Factory.
 */

import { describe, it, expect, vi } from "vitest";
import { panel, PanelNode } from "./panel";
import { mockCtx, MockNode } from "@test/test-helpers";

// Mock design.ts
vi.mock("@core/design", () => ({
  getPalette: () => ({
    panelSoft: "#E8EDF5",
    text: "#1E293B",
    line: "#D1D5DB",
  }),
  resolveCanvasRadius: (_w: number) => ({
    sm: 6,
    md: 10,
    lg: 14,
    pill: 999,
  }),
}));

describe("PanelNode", () => {
  describe("measure", () => {
    it("gibt padding*2 als Minimum ohne child", () => {
      const ctx = mockCtx();
      const node = new PanelNode({ padding: 16 });
      const result = node.measure(ctx, { w: 800, h: 600 });
      expect(result.minW).toBe(32);
      expect(result.minH).toBe(32);
    });

    it("addiert padding zur child-Groesse mit child", () => {
      const ctx = mockCtx();
      const child = new MockNode(100, 60);
      const node = new PanelNode({ padding: 12 }, child);
      const result = node.measure(ctx, { w: 800, h: 600 });
      expect(result.minW).toBe(124); // 100 + 2*12
      expect(result.minH).toBe(84);  // 60 + 2*12
      expect(result.prefW).toBe(124);
      expect(result.prefH).toBe(84);
    });
  });

  describe("layout", () => {
    it("positioniert child mit padding-Offset", () => {
      const child = new MockNode(100, 60);
      const node = new PanelNode({ padding: 10 }, child);
      node.layout({ x: 20, y: 30, w: 200, h: 150 });
      expect(child.allocatedRect).toEqual({
        x: 30,   // 20 + 10
        y: 40,   // 30 + 10
        w: 180,  // 200 - 2*10
        h: 130,  // 150 - 2*10
      });
    });
  });

  describe("draw", () => {
    it("zeichnet Hintergrund", () => {
      const ctx = mockCtx();
      const node = new PanelNode({ bg: "#FFFFFF" });
      node.layout({ x: 0, y: 0, w: 200, h: 100 });
      node.draw(ctx);
      expect(ctx.fill).toHaveBeenCalled();
    });

    it("zeichnet nichts bei width/height 0", () => {
      const ctx = mockCtx();
      const node = new PanelNode();
      node.layout({ x: 0, y: 0, w: 0, h: 0 });
      node.draw(ctx);
      expect(ctx.fill).not.toHaveBeenCalled();
    });

    it("ruft child.draw auf", () => {
      const ctx = mockCtx();
      const child = new MockNode(80, 40);
      const drawSpy = vi.spyOn(child, "draw");
      const node = new PanelNode({ padding: 8 }, child);
      node.layout({ x: 0, y: 0, w: 200, h: 100 });
      node.draw(ctx);
      expect(drawSpy).toHaveBeenCalledWith(ctx);
    });

    it("setzt ctx.shadowBlur bei shadow", () => {
      const ctx = mockCtx();
      let maxShadowBlur = 0;
      let _shadowBlur = 0;
      Object.defineProperty(ctx, "shadowBlur", {
        get: () => _shadowBlur,
        set: (v: number) => { _shadowBlur = v; if (v > maxShadowBlur) maxShadowBlur = v; },
        configurable: true,
      });
      const node = new PanelNode({ shadowBlur: 12 });
      node.layout({ x: 0, y: 0, w: 200, h: 100 });
      node.draw(ctx);
      expect(maxShadowBlur).toBe(12);
    });
  });

  describe("panel() Factory", () => {
    it("setzt id korrekt", () => {
      const node = panel({ id: "info-panel" });
      expect(node.id).toBe("info-panel");
    });

    it("setzt flex korrekt", () => {
      const node = panel({ flex: 3 });
      expect(node.flex).toBe(3);
    });
  });
});
