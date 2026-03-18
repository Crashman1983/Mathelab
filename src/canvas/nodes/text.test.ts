/**
 * Unit-Tests fuer TextNode und text() Factory.
 */

import { describe, it, expect, vi } from "vitest";
import { text, TextNode } from "./text";
import { mockCtx } from "@test/test-helpers";

// Mock design.ts — getPalette und resolveCanvasFonts
vi.mock("@core/design", () => ({
  getPalette: () => ({
    canvasText: "#1E293B",
    text: "#1E293B",
    accent: "#1982C4",
  }),
  resolveCanvasFonts: (_w: number) => ({
    xs: 14,
    sm: 18,
    md: 24,
    lg: 28,
    xl: 36,
  }),
}));

describe("TextNode", () => {
  describe("measure", () => {
    it("gibt Dimensionen basierend auf measureText zurueck", () => {
      const ctx = mockCtx();
      // mockCtx measureText returns width=50, ascent=8, descent=2 → textHeight=10
      const node = new TextNode("Hallo");
      const result = node.measure(ctx, { w: 800, h: 600 });
      // textWidth=50, textHeight=10, padding=0
      expect(result.minW).toBe(50);
      expect(result.minH).toBe(10);
      expect(result.prefW).toBe(50);
      expect(result.prefH).toBe(10);
    });

    it("beruecksichtigt padding in der Messung", () => {
      const ctx = mockCtx();
      const node = new TextNode("Test", { padding: 8 });
      const result = node.measure(ctx, { w: 800, h: 600 });
      // textWidth=50 + 2*8 = 66, textHeight=10 + 2*8 = 26
      expect(result.minW).toBe(66);
      expect(result.minH).toBe(26);
    });

    it("begrenzt minW auf verfuegbare Breite", () => {
      const ctx = mockCtx();
      const node = new TextNode("Langer Text");
      const result = node.measure(ctx, { w: 30, h: 600 });
      // textWidth=50 but available.w=30 → capped at 30
      expect(result.minW).toBe(30);
    });
  });

  describe("draw", () => {
    it("ruft ctx.fillText mit Text, Position und maxWidth auf", () => {
      const ctx = mockCtx();
      const node = new TextNode("Hallo");
      node.measure(ctx, { w: 800, h: 600 });
      node.layout({ x: 10, y: 20, w: 200, h: 50 });
      node.draw(ctx);
      expect(ctx.fillText).toHaveBeenCalledWith(
        "Hallo",
        expect.any(Number),
        expect.any(Number),
        200,
      );
    });

    it("zeichnet nichts bei width 0", () => {
      const ctx = mockCtx();
      const node = new TextNode("Test");
      node.measure(ctx, { w: 800, h: 600 });
      node.layout({ x: 0, y: 0, w: 0, h: 50 });
      node.draw(ctx);
      expect(ctx.fillText).not.toHaveBeenCalled();
    });

    it("zeichnet nichts bei height 0", () => {
      const ctx = mockCtx();
      const node = new TextNode("Test");
      node.measure(ctx, { w: 800, h: 600 });
      node.layout({ x: 0, y: 0, w: 200, h: 0 });
      node.draw(ctx);
      expect(ctx.fillText).not.toHaveBeenCalled();
    });
  });

  describe("fontSize Optionen", () => {
    it("setzt xl Font bei fontSize xl", () => {
      const ctx = mockCtx();
      const node = new TextNode("Gross", { fontSize: "xl" });
      node.measure(ctx, { w: 800, h: 600 });
      expect(ctx.font).toContain("36px");
    });

    it("setzt md Font bei fontSize md (default)", () => {
      const ctx = mockCtx();
      const node = new TextNode("Normal");
      node.measure(ctx, { w: 800, h: 600 });
      expect(ctx.font).toContain("24px");
    });

    it("setzt sm Font bei fontSize sm", () => {
      const ctx = mockCtx();
      const node = new TextNode("Klein", { fontSize: "sm" });
      node.measure(ctx, { w: 800, h: 600 });
      expect(ctx.font).toContain("18px");
    });
  });

  describe("Alignment", () => {
    it("setzt textAlign left bei align left", () => {
      const ctx = mockCtx();
      const node = new TextNode("Links", { align: "left" });
      node.measure(ctx, { w: 800, h: 600 });
      node.layout({ x: 10, y: 20, w: 200, h: 50 });
      node.draw(ctx);
      expect(ctx.textAlign).toBe("left");
    });

    it("setzt textAlign center bei align center", () => {
      const ctx = mockCtx();
      const node = new TextNode("Mitte", { align: "center" });
      node.measure(ctx, { w: 800, h: 600 });
      node.layout({ x: 10, y: 20, w: 200, h: 50 });
      node.draw(ctx);
      expect(ctx.textAlign).toBe("center");
    });

    it("setzt textAlign right bei align right", () => {
      const ctx = mockCtx();
      const node = new TextNode("Rechts", { align: "right" });
      node.measure(ctx, { w: 800, h: 600 });
      node.layout({ x: 10, y: 20, w: 200, h: 50 });
      node.draw(ctx);
      expect(ctx.textAlign).toBe("right");
    });

    it("setzt textBaseline top bei vAlign top", () => {
      const ctx = mockCtx();
      const node = new TextNode("Oben", { vAlign: "top" });
      node.measure(ctx, { w: 800, h: 600 });
      node.layout({ x: 10, y: 20, w: 200, h: 50 });
      node.draw(ctx);
      expect(ctx.textBaseline).toBe("top");
    });

    it("setzt textBaseline middle bei vAlign middle (default)", () => {
      const ctx = mockCtx();
      const node = new TextNode("Mitte");
      node.measure(ctx, { w: 800, h: 600 });
      node.layout({ x: 10, y: 20, w: 200, h: 50 });
      node.draw(ctx);
      expect(ctx.textBaseline).toBe("middle");
    });
  });

  describe("text() Factory", () => {
    it("setzt id korrekt", () => {
      const node = text("Label", { id: "mein-text" });
      expect(node.id).toBe("mein-text");
    });

    it("setzt flex korrekt", () => {
      const node = text("Label", { flex: 2 });
      expect(node.flex).toBe(2);
    });
  });
});
