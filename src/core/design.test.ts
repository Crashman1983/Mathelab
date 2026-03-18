/**
 * Tests für das Design-System (src/core/design.ts).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getPalette, setColorMode, getColorMode, resolveCanvasFonts,
  resolveCanvasSpacing, resolveCanvasRadius,
  TYPOGRAPHY, SPACING, RADIUS, ANIMATION, BREAKPOINTS,
  EXPERIMENT_COLORS, PLACE_VALUE_COLORS, CLOCK_COLORS, COIN_COLORS, DICE_COLORS,
  getStatusColor, getStatusBgColor,
  type ColorPalette,
} from "./design";

describe("Design System", () => {
  beforeEach(() => {
    setColorMode("dark");
  });

  // ── Color Mode ──────────────────────────────────────────────────────────────

  describe("Color Mode", () => {
    it("Default ist dark", () => {
      expect(getColorMode()).toBe("dark");
    });

    it("setColorMode('light') wechselt zu Light-Palette", () => {
      setColorMode("light");
      expect(getColorMode()).toBe("light");
      expect(getPalette().bg).not.toBe("#0c1b33");
    });

    it("setColorMode('dark') wechselt zurück zu Dark-Palette", () => {
      setColorMode("light");
      setColorMode("dark");
      expect(getColorMode()).toBe("dark");
      expect(getPalette().bg).toBe("#0c1b33");
    });
  });

  // ── getPalette ──────────────────────────────────────────────────────────────

  describe("getPalette", () => {
    const REQUIRED_KEYS: (keyof ColorPalette)[] = [
      "bg", "panel", "panelSoft", "canvasBg",
      "line", "gridLine",
      "text", "textDim", "textOnAccent",
      "accent", "accentSubtle", "accentFocus",
      "ok", "okHover", "okSubtle",
      "warn", "warnHover", "warnSubtle",
      "bad", "badHover", "badSubtle",
      "canvasText", "canvasTextDim", "canvasPrimary", "canvasSuccess", "canvasError",
      "faceColors",
      "coinCopper", "coinGold", "coinSilver",
      "frogBody", "diverSuit",
      "pizzaCrust", "pizzaFill",
    ];

    it("Dark-Palette hat alle erforderlichen Farbtoken", () => {
      const p = getPalette();
      for (const key of REQUIRED_KEYS) {
        expect(p[key], `Missing key: ${key}`).toBeDefined();
      }
    });

    it("Light-Palette hat alle erforderlichen Farbtoken", () => {
      setColorMode("light");
      const p = getPalette();
      for (const key of REQUIRED_KEYS) {
        expect(p[key], `Missing key: ${key}`).toBeDefined();
      }
    });

    it("Light und Dark haben unterschiedliche bg/text/accent", () => {
      const dark = getPalette();
      setColorMode("light");
      const light = getPalette();
      expect(dark.bg).not.toBe(light.bg);
      expect(dark.text).not.toBe(light.text);
      expect(dark.accent).not.toBe(light.accent);
    });

    it("Theme-invariante Farben sind in beiden Paletten gleich", () => {
      const dark = getPalette();
      setColorMode("light");
      const light = getPalette();
      expect(dark.coinCopper).toBe(light.coinCopper);
      expect(dark.frogBody).toBe(light.frogBody);
      expect(dark.pizzaCrust).toBe(light.pizzaCrust);
      expect(dark.diverSuit).toBe(light.diverSuit);
    });

    it("faceColors enthält 12 Farben", () => {
      expect(getPalette().faceColors).toHaveLength(12);
    });
  });

  // ── resolveCanvasFonts ──────────────────────────────────────────────────────

  describe("resolveCanvasFonts", () => {
    it("gibt alle 5 Größen zurück (xl, lg, md, sm, xs)", () => {
      const f = resolveCanvasFonts(1000);
      expect(f).toHaveProperty("xl");
      expect(f).toHaveProperty("lg");
      expect(f).toHaveProperty("md");
      expect(f).toHaveProperty("sm");
      expect(f).toHaveProperty("xs");
    });

    it("skaliert proportional zur Canvas-Breite", () => {
      const small = resolveCanvasFonts(500);
      const large = resolveCanvasFonts(2000);
      expect(large.xl).toBeGreaterThan(small.xl);
      expect(large.lg).toBeGreaterThan(small.lg);
      expect(large.md).toBeGreaterThan(small.md);
    });

    it("erzwingt Mindestgrößen", () => {
      const f = resolveCanvasFonts(100); // very small
      expect(f.xl).toBeGreaterThanOrEqual(32);
      expect(f.lg).toBeGreaterThanOrEqual(28);
      expect(f.md).toBeGreaterThanOrEqual(24);
      expect(f.sm).toBeGreaterThanOrEqual(20);
      expect(f.xs).toBeGreaterThanOrEqual(16);
    });

    it("Breite 1000px ergibt plausible Werte", () => {
      const f = resolveCanvasFonts(1000);
      expect(f.xl).toBe(Math.max(Math.round(1000 * 0.038), 32));
      expect(f.xs).toBe(Math.max(Math.round(1000 * 0.020), 16));
    });

    it("Breite 3200px (Smartboard) ergibt große Werte", () => {
      const f = resolveCanvasFonts(3200);
      expect(f.xl).toBeGreaterThan(100);
      expect(f.xs).toBeGreaterThan(50);
    });
  });

  // ── resolveCanvasSpacing ────────────────────────────────────────────────────

  describe("resolveCanvasSpacing", () => {
    it("gibt xs, sm, md, lg, xl, inset zurück", () => {
      const s = resolveCanvasSpacing(1000);
      expect(s).toHaveProperty("xs");
      expect(s).toHaveProperty("sm");
      expect(s).toHaveProperty("md");
      expect(s).toHaveProperty("lg");
      expect(s).toHaveProperty("xl");
      expect(s).toHaveProperty("inset");
    });

    it("skaliert proportional zur Canvas-Breite", () => {
      const small = resolveCanvasSpacing(500);
      const large = resolveCanvasSpacing(2000);
      expect(large.md).toBeGreaterThan(small.md);
    });

    it("Breite 1000px ergibt gerundete Werte", () => {
      const s = resolveCanvasSpacing(1000);
      expect(s.xs).toBe(Math.round(1000 * 0.008));
      expect(s.md).toBe(Math.round(1000 * 0.022));
    });
  });

  // ── resolveCanvasRadius ─────────────────────────────────────────────────────

  describe("resolveCanvasRadius", () => {
    it("gibt sm, md, lg, xl, pill zurück", () => {
      const r = resolveCanvasRadius(1000);
      expect(r).toHaveProperty("sm");
      expect(r).toHaveProperty("md");
      expect(r).toHaveProperty("lg");
      expect(r).toHaveProperty("xl");
      expect(r).toHaveProperty("pill");
    });

    it("erzwingt Mindestradien", () => {
      const r = resolveCanvasRadius(100); // very small
      expect(r.sm).toBeGreaterThanOrEqual(6);
      expect(r.md).toBeGreaterThanOrEqual(10);
      expect(r.lg).toBeGreaterThanOrEqual(14);
      expect(r.xl).toBeGreaterThanOrEqual(20);
    });

    it("pill ist immer 9999", () => {
      expect(resolveCanvasRadius(100).pill).toBe(9999);
      expect(resolveCanvasRadius(3000).pill).toBe(9999);
    });
  });

  // ── Konstanten ──────────────────────────────────────────────────────────────

  describe("Konstanten", () => {
    it("TYPOGRAPHY hat alle erwarteten Schlüssel", () => {
      const keys = ["pageTitle", "panelTitle", "lead", "body", "small", "micro", "status", "pill"];
      for (const k of keys) {
        expect(TYPOGRAPHY).toHaveProperty(k);
      }
    });

    it("SPACING folgt rem-Werte-System", () => {
      expect(SPACING.xs).toBe("0.3rem");
      expect(SPACING.sm).toBe("0.5rem");
      expect(SPACING.md).toBe("0.75rem");
      expect(SPACING.lg).toBe("1rem");
      expect(SPACING.xl).toBe("1.5rem");
      expect(SPACING.xxl).toBe("2rem");
    });

    it("RADIUS hat korrekte Pixelwerte", () => {
      expect(RADIUS.sm).toBe(8);
      expect(RADIUS.md).toBe(12);
      expect(RADIUS.lg).toBe(16);
      expect(RADIUS.xl).toBe(24);
      expect(RADIUS.pill).toBe(999);
    });

    it("ANIMATION hat korrekte Dauern", () => {
      expect(ANIMATION.durationFast).toBe(150);
      expect(ANIMATION.durationMedium).toBe(300);
      expect(ANIMATION.durationSlow).toBe(500);
    });

    it("BREAKPOINTS hat 4 Stufen", () => {
      expect(BREAKPOINTS.mobile).toBe(1100);
      expect(BREAKPOINTS.tablet).toBe(1400);
      expect(BREAKPOINTS.desktop).toBe(1800);
      expect(BREAKPOINTS.wide).toBe(2200);
    });

    it("EXPERIMENT_COLORS hat 6 Farben", () => {
      expect(EXPERIMENT_COLORS).toHaveLength(6);
    });

    it("PLACE_VALUE_COLORS hat ht und zt", () => {
      expect(PLACE_VALUE_COLORS.ht).toBeDefined();
      expect(PLACE_VALUE_COLORS.zt).toBeDefined();
    });

    it("CLOCK_COLORS hat face, border, center", () => {
      expect(CLOCK_COLORS.face).toBeDefined();
      expect(CLOCK_COLORS.border).toBeDefined();
      expect(CLOCK_COLORS.center).toBeDefined();
    });

    it("DICE_COLORS hat face, border, pip", () => {
      expect(DICE_COLORS.face).toBe("#fffff8");
      expect(DICE_COLORS.border).toBe("#c8b97a");
      expect(DICE_COLORS.pip).toBe("#1a1a2e");
    });
  });

  // ── getStatusColor / getStatusBgColor ───────────────────────────────────────

  describe("getStatusColor", () => {
    it("ok gibt palette.ok zurück", () => {
      const p = getPalette();
      expect(getStatusColor("ok", p)).toBe(p.ok);
    });

    it("warn gibt palette.warn zurück", () => {
      const p = getPalette();
      expect(getStatusColor("warn", p)).toBe(p.warn);
    });

    it("bad gibt palette.bad zurück", () => {
      const p = getPalette();
      expect(getStatusColor("bad", p)).toBe(p.bad);
    });

    it("task gibt palette.accent zurück", () => {
      const p = getPalette();
      expect(getStatusColor("task", p)).toBe(p.accent);
    });

    it("neutral gibt palette.textDim zurück", () => {
      const p = getPalette();
      expect(getStatusColor("neutral", p)).toBe(p.textDim);
    });
  });

  describe("getStatusBgColor", () => {
    it("ok gibt palette.okSubtle zurück", () => {
      const p = getPalette();
      expect(getStatusBgColor("ok", p)).toBe(p.okSubtle);
    });

    it("neutral gibt transparent zurück", () => {
      const p = getPalette();
      expect(getStatusBgColor("neutral", p)).toBe("transparent");
    });
  });
});
