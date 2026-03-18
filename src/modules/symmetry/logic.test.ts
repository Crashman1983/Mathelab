/**
 * Tests für die Symmetrie-Logik (rein funktional, kein DOM).
 */
import { describe, it, expect } from "vitest";
import { computeExpected, checkAnswer, isInSourceRegion, isInAnswerRegion, SYMMETRY_TASKS } from "./logic.js";
import { gridKeyOf } from "@core/utils";

const GRID = 15;
const HALF = 7; // Math.floor(15/2)

describe("computeExpected – mirror-v", () => {
  it("spiegelt eine einzelne Zelle korrekt", () => {
    const source = new Set([gridKeyOf(3, 5)]);
    const expected = computeExpected(source, "mirror-v", GRID);
    // Achse bei col 7 (Mitte); Spiegelung: 2*7 - 3 = 11
    expect(expected.has(gridKeyOf(11, 5))).toBe(true);
    expect(expected.size).toBe(1);
  });

  it("spiegelt mehrere Zellen – alle Ergebnisse innerhalb des Gitters", () => {
    // x=0 → mirrorX = 2*7-0 = 14 → ok (jetzt immer gültig für Quellzellen)
    // x=1 → mirrorX = 13 → ok
    // x=6 → mirrorX = 8  → ok (erste Spalte des Antwortbereichs)
    const source = new Set([gridKeyOf(0, 0), gridKeyOf(1, 1), gridKeyOf(6, 3)]);
    const expected = computeExpected(source, "mirror-v", GRID);
    expect(expected.size).toBe(3);
    expect(expected.has(gridKeyOf(14, 0))).toBe(true);
    expect(expected.has(gridKeyOf(13, 1))).toBe(true);
    expect(expected.has(gridKeyOf(8, 3))).toBe(true);
  });
});

describe("computeExpected – mirror-h", () => {
  it("spiegelt eine einzelne Zelle vertikal", () => {
    const source = new Set([gridKeyOf(5, 3)]);
    const expected = computeExpected(source, "mirror-h", GRID);
    // Achse bei row 7 (Mitte); Spiegelung: 2*7 - 3 = 11
    expect(expected.has(gridKeyOf(5, 11))).toBe(true);
    expect(expected.size).toBe(1);
  });
});

describe("computeExpected – enlarge-2", () => {
  it("erzeugt 4 Felder pro Quellfeld", () => {
    const source = new Set([gridKeyOf(0, 0)]);
    const expected = computeExpected(source, "enlarge-2", GRID);
    expect(expected.size).toBe(4); // 2x2
    expect(expected.has(gridKeyOf(HALF + 1, 0))).toBe(true);
    expect(expected.has(gridKeyOf(HALF + 2, 0))).toBe(true);
    expect(expected.has(gridKeyOf(HALF + 1, 1))).toBe(true);
    expect(expected.has(gridKeyOf(HALF + 2, 1))).toBe(true);
  });
});

describe("computeExpected – enlarge-3", () => {
  it("erzeugt 9 Felder pro Quellfeld", () => {
    const source = new Set([gridKeyOf(0, 0)]);
    const expected = computeExpected(source, "enlarge-3", GRID);
    expect(expected.size).toBe(9); // 3x3
  });
});

describe("checkAnswer", () => {
  it("erkennt korrekte Antwort", () => {
    const expected = new Set([gridKeyOf(10, 5), gridKeyOf(11, 3)]);
    const answer = new Set([gridKeyOf(10, 5), gridKeyOf(11, 3)]);
    const result = checkAnswer(answer, expected);
    expect(result.correct).toBe(true);
    expect(result.matching.size).toBe(2);
    expect(result.wrong.size).toBe(0);
    expect(result.missing.size).toBe(0);
  });

  it("erkennt falsche Felder", () => {
    const expected = new Set([gridKeyOf(10, 5)]);
    const answer = new Set([gridKeyOf(10, 5), gridKeyOf(11, 6)]);
    const result = checkAnswer(answer, expected);
    expect(result.correct).toBe(false);
    expect(result.wrong.size).toBe(1);
    expect(result.wrong.has(gridKeyOf(11, 6))).toBe(true);
  });

  it("erkennt fehlende Felder", () => {
    const expected = new Set([gridKeyOf(10, 5), gridKeyOf(11, 3)]);
    const answer = new Set([gridKeyOf(10, 5)]);
    const result = checkAnswer(answer, expected);
    expect(result.correct).toBe(false);
    expect(result.missing.size).toBe(1);
    expect(result.missing.has(gridKeyOf(11, 3))).toBe(true);
  });

  it("leere Antwort bei leerer Erwartung ist korrekt", () => {
    const result = checkAnswer(new Set(), new Set());
    expect(result.correct).toBe(true);
  });
});

describe("isInSourceRegion / isInAnswerRegion", () => {
  it("erkennt Quellbereich bei mirror-v", () => {
    expect(isInSourceRegion(3, 5, "mirror-v", GRID)).toBe(true);
    expect(isInSourceRegion(HALF, 5, "mirror-v", GRID)).toBe(false); // Achse
    expect(isInSourceRegion(HALF + 2, 5, "mirror-v", GRID)).toBe(false);
  });

  it("erkennt Antwortbereich bei mirror-v", () => {
    expect(isInAnswerRegion(HALF + 1, 5, "mirror-v", GRID)).toBe(true);
    expect(isInAnswerRegion(3, 5, "mirror-v", GRID)).toBe(false);
  });

  it("erkennt Quellbereich bei mirror-h", () => {
    expect(isInSourceRegion(5, 3, "mirror-h", GRID)).toBe(true);
    expect(isInSourceRegion(5, HALF + 2, "mirror-h", GRID)).toBe(false);
  });

  it("erkennt Quellbereich bei enlarge-Modus (x < half)", () => {
    expect(isInSourceRegion(3, 5, "enlarge-2", GRID)).toBe(true);
    expect(isInSourceRegion(HALF + 1, 5, "enlarge-2", GRID)).toBe(false);
  });

  it("unbekannter Modus in isInSourceRegion gibt false zurück", () => {
    expect(isInSourceRegion(3, 3, "unknown" as never, GRID)).toBe(false);
  });

  it("erkennt Antwortbereich bei enlarge-Modus", () => {
    expect(isInAnswerRegion(HALF + 1, 5, "enlarge-2", GRID)).toBe(true);
    expect(isInAnswerRegion(3, 5, "enlarge-2", GRID)).toBe(false);
  });

  it("unbekannter Modus in isInAnswerRegion gibt false zurück", () => {
    expect(isInAnswerRegion(3, 3, "unknown" as never, GRID)).toBe(false);
  });
});

describe("SYMMETRY_TASKS", () => {
  it("decken alle Symmetriemodi ab", () => {
    const modes = new Set(SYMMETRY_TASKS.map((task) => task.mode));
    expect(modes.has("mirror-v")).toBe(true);
    expect(modes.has("mirror-h")).toBe(true);
    expect(modes.has("enlarge-2")).toBe(true);
    expect(modes.has("enlarge-3")).toBe(true);
  });
});
