/**
 * Tests für Einmaleins-Maschine – Logik
 */
import { describe, it, expect } from "vitest";
import {
  generateTask,
  getProduct,
  checkAnswer,
  checkDivisionAnswer,
  getJumpPositions,
  getNumberLineRange,
  getDividend,
  buildDotField,
  isHighlighted,
  commutativeHint,
} from "./logic";

describe("generateTask", () => {
  it("erzeugt Task mit gültigen Faktoren (2–10)", () => {
    const task = generateTask("dot");
    expect(task.a).toBeGreaterThanOrEqual(2);
    expect(task.a).toBeLessThanOrEqual(10);
    expect(task.b).toBeGreaterThanOrEqual(2);
    expect(task.b).toBeLessThanOrEqual(10);
  });
  it("Mode wird korrekt gesetzt", () => {
    expect(generateTask("dot").mode).toBe("dot");
    expect(generateTask("jumps").mode).toBe("jumps");
    expect(generateTask("divide").mode).toBe("divide");
  });
  it("erzeugt andere Aufgabe als exclude (fast immer)", () => {
    const first = generateTask("dot");
    let foundDiff = false;
    for (let i = 0; i < 30; i++) {
      const next = generateTask("dot", first);
      if (next.a !== first.a || next.b !== first.b) {
        foundDiff = true;
        break;
      }
    }
    expect(foundDiff).toBe(true);
  });
  it("erzeugt über 50 Tasks ohne Fehler", () => {
    for (let i = 0; i < 50; i++) {
      const t = generateTask("dot");
      expect(t.a * t.b).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("getProduct", () => {
  it("3 × 4 = 12", () => {
    expect(getProduct({ a: 3, b: 4, mode: "dot" })).toBe(12);
  });
  it("7 × 8 = 56", () => {
    expect(getProduct({ a: 7, b: 8, mode: "dot" })).toBe(56);
  });
  it("10 × 10 = 100", () => {
    expect(getProduct({ a: 10, b: 10, mode: "dot" })).toBe(100);
  });
  it("2 × 2 = 4", () => {
    expect(getProduct({ a: 2, b: 2, mode: "jumps" })).toBe(4);
  });
});

describe("getDividend", () => {
  it("6 ÷ 3 → Dividend = 18", () => {
    // a=6, b=3 → 6*3=18
    expect(getDividend({ a: 6, b: 3, mode: "divide" })).toBe(18);
  });
  it("entspricht a × b", () => {
    const t = generateTask("divide");
    expect(getDividend(t)).toBe(t.a * t.b);
  });
});

describe("checkAnswer", () => {
  it("akzeptiert korrektes Ergebnis", () => {
    expect(checkAnswer({ a: 3, b: 4, mode: "dot" }, 12)).toBe(true);
  });
  it("lehnt falsches Ergebnis ab", () => {
    expect(checkAnswer({ a: 3, b: 4, mode: "dot" }, 11)).toBe(false);
    expect(checkAnswer({ a: 3, b: 4, mode: "dot" }, 13)).toBe(false);
  });
  it("Grenzfall 2×2=4", () => {
    expect(checkAnswer({ a: 2, b: 2, mode: "dot" }, 4)).toBe(true);
    expect(checkAnswer({ a: 2, b: 2, mode: "dot" }, 5)).toBe(false);
  });
});

describe("checkDivisionAnswer", () => {
  it("akzeptiert korrekten Quotienten", () => {
    expect(checkDivisionAnswer({ a: 4, b: 3, mode: "divide" }, 3)).toBe(true);
  });
  it("lehnt falschen Quotienten ab", () => {
    expect(checkDivisionAnswer({ a: 4, b: 3, mode: "divide" }, 4)).toBe(false);
  });
  it("12 ÷ 4 = 3", () => {
    expect(checkDivisionAnswer({ a: 4, b: 3, mode: "divide" }, 3)).toBe(true);
  });
});

describe("getJumpPositions", () => {
  it("startet bei 0", () => {
    const pos = getJumpPositions({ a: 3, b: 5, mode: "jumps" });
    expect(pos[0]).toBe(0);
  });
  it("hat a+1 Positionen", () => {
    const pos = getJumpPositions({ a: 4, b: 3, mode: "jumps" });
    expect(pos).toHaveLength(5); // 0, 3, 6, 9, 12
  });
  it("jeder Schritt ist +b", () => {
    const t = { a: 5, b: 4, mode: "jumps" as const };
    const pos = getJumpPositions(t);
    for (let i = 1; i < pos.length; i++) {
      expect(pos[i]! - pos[i - 1]!).toBe(t.b);
    }
  });
  it("letztes Element = a × b", () => {
    const t = { a: 6, b: 7, mode: "jumps" as const };
    const pos = getJumpPositions(t);
    expect(pos[pos.length - 1]).toBe(42);
  });
});

describe("getNumberLineRange", () => {
  it("min ist immer 0", () => {
    const range = getNumberLineRange({ a: 3, b: 5, mode: "jumps" });
    expect(range.min).toBe(0);
  });
  it("max ist a × b", () => {
    const range = getNumberLineRange({ a: 4, b: 6, mode: "jumps" });
    expect(range.max).toBe(24);
  });
});

describe("buildDotField", () => {
  it("erzeugt a Zeilen und b Spalten", () => {
    const field = buildDotField(3, 4);
    expect(field).toHaveLength(3);
    field.forEach((row) => expect(row).toHaveLength(4));
  });
  it("alle Zellen sind true", () => {
    const field = buildDotField(2, 3);
    field.forEach((row) => row.forEach((cell) => expect(cell).toBe(true)));
  });
  it("1×1 Feld", () => {
    const field = buildDotField(1, 1);
    expect(field).toHaveLength(1);
    expect(field[0]).toHaveLength(1);
  });
});

describe("isHighlighted", () => {
  it("Zeile 0 ist hervorgehoben wenn revealedRows >= 1", () => {
    expect(isHighlighted(0, 0, 1)).toBe(true);
  });
  it("Zeile 2 ist nicht hervorgehoben wenn nur 2 Zeilen revealed", () => {
    expect(isHighlighted(2, 0, 2)).toBe(false);
  });
  it("Zeile 1 ist hervorgehoben bei revealedRows=2", () => {
    expect(isHighlighted(1, 3, 2)).toBe(true);
  });
  it("keine Zeile hervorgehoben bei revealedRows=0", () => {
    expect(isHighlighted(0, 0, 0)).toBe(false);
  });
});

describe("commutativeHint", () => {
  it("enthält beide Schreibweisen", () => {
    const hint = commutativeHint({ a: 3, b: 4, mode: "dot" });
    expect(hint).toContain("3 × 4");
    expect(hint).toContain("4 × 3");
    expect(hint).toContain("12");
  });
  it("funktioniert für quadratische Aufgaben", () => {
    const hint = commutativeHint({ a: 5, b: 5, mode: "dot" });
    expect(hint).toContain("25");
  });
});
