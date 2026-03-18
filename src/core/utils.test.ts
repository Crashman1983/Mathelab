/**
 * Tests für Core-Utilities.
 */
import { describe, it, expect } from "vitest";
import {
  clamp,
  lerp,
  invLerp,
  remap,
  easeInOutCubic,
  easeOutCubic,
  gridKeyOf,
  gridParseKey,
  padZero,
  shuffled,
  weightedPick,
  randomInt,
  last,
} from "./utils.js";

describe("clamp", () => {
  it("klemmt Werte an Minimum", () => expect(clamp(-5, 0, 10)).toBe(0));
  it("klemmt Werte an Maximum", () => expect(clamp(15, 0, 10)).toBe(10));
  it("lässt Werte im Bereich unverändert", () => expect(clamp(5, 0, 10)).toBe(5));
  it("min === max", () => expect(clamp(7, 3, 3)).toBe(3));
});

describe("lerp", () => {
  it("interpoliert bei t=0", () => expect(lerp(0, 10, 0)).toBe(0));
  it("interpoliert bei t=1", () => expect(lerp(0, 10, 1)).toBe(10));
  it("interpoliert bei t=0.5", () => expect(lerp(0, 10, 0.5)).toBe(5));
});

describe("invLerp", () => {
  it("berechnet t für einen Wert", () => expect(invLerp(0, 10, 5)).toBe(0.5));
  it("gibt 0 zurück wenn a === b", () => expect(invLerp(5, 5, 5)).toBe(0));
});

describe("remap", () => {
  it("remappt Wert korrekt", () => expect(remap(5, 0, 10, 0, 100)).toBe(50));
});

describe("easeInOutCubic", () => {
  it("startet bei 0", () => expect(easeInOutCubic(0)).toBe(0));
  it("endet bei 1", () => expect(easeInOutCubic(1)).toBe(1));
  it("hat Mittelpunkt bei 0.5", () => expect(easeInOutCubic(0.5)).toBeCloseTo(0.5));
  it("ist symmetrisch", () => {
    expect(easeInOutCubic(0.25)).toBeCloseTo(1 - easeInOutCubic(0.75), 5);
  });
});

describe("easeOutCubic", () => {
  it("startet bei 0", () => expect(easeOutCubic(0)).toBe(0));
  it("endet bei 1", () => expect(easeOutCubic(1)).toBe(1));
});

describe("gridKeyOf / gridParseKey", () => {
  it("kodiert und dekodiert Koordinaten", () => {
    expect(gridKeyOf(3, 7)).toBe("3,7");
    expect(gridParseKey("3,7")).toEqual({ x: 3, y: 7 });
  });

  it("funktioniert mit negativen Zahlen", () => {
    const key = gridKeyOf(-2, -5);
    const parsed = gridParseKey(key);
    expect(parsed.x).toBe(-2);
    expect(parsed.y).toBe(-5);
  });

  it("Roundtrip", () => {
    const orig = { x: 12, y: 4 };
    expect(gridParseKey(gridKeyOf(orig.x, orig.y))).toEqual(orig);
  });
});

describe("padZero", () => {
  it("fügt führende Null hinzu", () => expect(padZero(5)).toBe("05"));
  it("lässt zweistellige Zahlen unverändert", () => expect(padZero(12)).toBe("12"));
  it("unterstützt eigene Stellen", () => expect(padZero(5, 3)).toBe("005"));
});

describe("last", () => {
  it("gibt letztes Element", () => expect(last([1, 2, 3])).toBe(3));
  it("gibt undefined für leeres Array", () => expect(last([])).toBeUndefined());
});

describe("shuffled", () => {
  it("gibt Array gleicher Länge zurück", () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffled(arr)).toHaveLength(arr.length);
  });
  it("enthält alle Originalelemente", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffled(arr);
    expect(result.sort()).toEqual([...arr].sort());
  });
  it("verändert das Original nicht", () => {
    const arr = [1, 2, 3];
    shuffled(arr);
    expect(arr).toEqual([1, 2, 3]);
  });
});

describe("weightedPick", () => {
  it("wählt nur valide Elemente", () => {
    const items = ["a", "b", "c"];
    const weights = [1, 1, 1];
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(weightedPick(items, weights));
    }
  });

  it("bevorzugt höher gewichtete Elemente (statistisch)", () => {
    const items = ["low", "high"];
    const weights = [1, 100];
    const counts: Record<string, number> = { low: 0, high: 0 };
    for (let i = 0; i < 1000; i++) {
      counts[weightedPick(items, weights)]++;
    }
    expect(counts.high).toBeGreaterThan(counts.low * 5);
  });
});

describe("randomInt", () => {
  it("gibt Werte im Bereich zurück", () => {
    for (let i = 0; i < 100; i++) {
      const v = randomInt(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });
  it("kann min === max", () => {
    expect(randomInt(5, 5)).toBe(5);
  });
});
