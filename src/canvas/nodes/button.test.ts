/**
 * Unit-Tests fuer ButtonNode und button() Factory.
 */

import { describe, it, expect, vi } from "vitest";
import { button, ButtonNode } from "./button";
import { mockCtx } from "@test/test-helpers";
import { MIN_TOUCH_TARGET } from "./types";

// Mock design.ts
vi.mock("@core/design", () => ({
  getPalette: () => ({
    accent: "#1982C4",
    ok: "#8AC926",
    warn: "#FF9F1C",
    bad: "#FF595E",
    panel: "#FFFFFF",
    panelSoft: "#E8EDF5",
    text: "#1E293B",
    textDim: "rgba(26,35,64,0.65)",
    textOnAccent: "#FFFFFF",
    line: "#D1D5DB",
    accentFocus: "#1982C4",
    canvasText: "#1E293B",
  }),
  resolveCanvasFonts: (_w: number) => ({
    xs: 14,
    sm: 18,
    md: 24,
    lg: 28,
    xl: 36,
  }),
  resolveCanvasRadius: (_w: number) => ({
    sm: 6,
    md: 10,
    lg: 14,
    pill: 999,
  }),
}));

describe("ButtonNode", () => {
  describe("measure", () => {
    it("erzwingt MIN_TOUCH_TARGET Mindeshoehe", () => {
      const ctx = mockCtx();
      const node = new ButtonNode("OK");
      const result = node.measure(ctx, { w: 800, h: 600 });
      expect(result.prefH).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    });

    it("erzwingt MIN_TOUCH_TARGET Mindestbreite", () => {
      const ctx = mockCtx();
      const node = new ButtonNode("A");
      const result = node.measure(ctx, { w: 800, h: 600 });
      expect(result.minW).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    });

    it("beruecksichtigt benutzerdefinierte minWidth", () => {
      const ctx = mockCtx();
      const node = new ButtonNode("Breit", { minWidth: 200 });
      const result = node.measure(ctx, { w: 800, h: 600 });
      expect(result.minW).toBeGreaterThanOrEqual(200);
    });
  });

  describe("toHitArea", () => {
    it("gibt korrekte Rect zurueck nach layout", () => {
      const node = new ButtonNode("Klick");
      const rect = { x: 10, y: 20, w: 100, h: 50 };
      node.layout(rect);
      const hit = node.toHitArea();
      expect(hit.rect).toEqual(rect);
    });

    it("verwendet testId wenn vorhanden", () => {
      const node = new ButtonNode("Label", { testId: "test-btn" });
      const hit = node.toHitArea();
      expect(hit.id).toBe("test-btn");
      expect(hit.testId).toBe("test-btn");
    });

    it("faellt auf id zurueck wenn kein testId", () => {
      const node = new ButtonNode("Label", { id: "mein-btn" });
      const hit = node.toHitArea();
      expect(hit.id).toBe("mein-btn");
    });

    it("generiert ID aus Label wenn weder testId noch id", () => {
      const node = new ButtonNode("Weiter");
      const hit = node.toHitArea();
      expect(hit.id).toBe("btn-Weiter");
    });

    it("setzt enabled korrekt", () => {
      const enabledNode = new ButtonNode("An", { enabled: true });
      expect(enabledNode.toHitArea().enabled).toBe(true);

      const disabledNode = new ButtonNode("Aus", { enabled: false });
      expect(disabledNode.toHitArea().enabled).toBe(false);
    });
  });

  describe("setPressed", () => {
    it("setzt pressed-State", () => {
      const node = new ButtonNode("Drueck");
      expect(node.pressed).toBe(false);
      node.setPressed(true);
      expect(node.pressed).toBe(true);
      node.setPressed(false);
      expect(node.pressed).toBe(false);
    });
  });

  describe("draw", () => {
    it("zeichnet nichts bei width/height 0", () => {
      const ctx = mockCtx();
      const node = new ButtonNode("Test");
      node.layout({ x: 0, y: 0, w: 0, h: 0 });
      node.draw(ctx);
      expect(ctx.save).not.toHaveBeenCalled();
    });

    it("ruft ctx.scale(0.95,0.95) auf wenn pressed und enabled", () => {
      const ctx = mockCtx();
      const node = new ButtonNode("Klick", { enabled: true });
      node.measure(ctx, { w: 800, h: 600 });
      node.layout({ x: 10, y: 10, w: 120, h: 48 });
      node.setPressed(true);
      node.draw(ctx);
      expect(ctx.scale).toHaveBeenCalledWith(0.95, 0.95);
    });

    it("rendert disabled-Button mit panelSoft-Hintergrund", () => {
      const ctx = mockCtx();
      const fillStyles: string[] = [];
      Object.getOwnPropertyDescriptor(ctx, "fillStyle");
      let _fillStyle = ctx.fillStyle as string;
      Object.defineProperty(ctx, "fillStyle", {
        get: () => _fillStyle,
        set: (v: string) => { _fillStyle = v; fillStyles.push(v); },
        configurable: true,
      });
      const node = new ButtonNode("Inaktiv", { enabled: false });
      node.measure(ctx, { w: 800, h: 600 });
      node.layout({ x: 10, y: 10, w: 120, h: 48 });
      node.draw(ctx);
      // panelSoft (#E8EDF5) should be among the fillStyles used
      expect(fillStyles).toContain("#E8EDF5");
    });
  });

  describe("Factory und Defaults", () => {
    it("button() erstellt ButtonNode mit label", () => {
      const node = button("Absenden");
      expect(node).toBeInstanceOf(ButtonNode);
      expect(node.label).toBe("Absenden");
    });

    it("default variant ist secondary", () => {
      const node = new ButtonNode("Test");
      expect(node.style.variant).toBe("secondary");
    });

    it("default enabled ist true", () => {
      const node = new ButtonNode("Test");
      expect(node.style.enabled).toBe(true);
    });
  });
});
