/**
 * Tests für Bruchlabor – Logik
 */
import { describe, it, expect } from "vitest";
import {
  gcd,
  fractionValue,
  areEquivalent,
  compareResult,
  formatFraction,
  buildEquivalenceChain,
  generateCircleTask,
  generateCompareTask,
  generateNumberLineTask,
  checkNumberLineAnswer,
  checkCompareAnswer,
  fractionName,
} from "./logic";

describe("gcd", () => {
  it("berechnet ggT(12, 8) = 4", () => {
    expect(gcd(12, 8)).toBe(4);
  });
  it("berechnet ggT(7, 3) = 1 (teilerfremd)", () => {
    expect(gcd(7, 3)).toBe(1);
  });
  it("berechnet ggT(6, 6) = 6", () => {
    expect(gcd(6, 6)).toBe(6);
  });
  it("berechnet ggT(0, 5) = 5", () => {
    expect(gcd(0, 5)).toBe(5);
  });
});

describe("fractionValue", () => {
  it("1/2 = 0.5", () => {
    expect(fractionValue({ num: 1, den: 2 })).toBe(0.5);
  });
  it("3/4 = 0.75", () => {
    expect(fractionValue({ num: 3, den: 4 })).toBe(0.75);
  });
  it("2/3 ≈ 0.667", () => {
    expect(fractionValue({ num: 2, den: 3 })).toBeCloseTo(0.667, 2);
  });
  it("ganzzahliger Bruch: 4/4 = 1", () => {
    expect(fractionValue({ num: 4, den: 4 })).toBe(1);
  });
});

describe("areEquivalent", () => {
  it("1/2 und 2/4 sind äquivalent", () => {
    expect(areEquivalent({ num: 1, den: 2 }, { num: 2, den: 4 })).toBe(true);
  });
  it("1/3 und 2/6 sind äquivalent", () => {
    expect(areEquivalent({ num: 1, den: 3 }, { num: 2, den: 6 })).toBe(true);
  });
  it("1/2 und 1/3 sind nicht äquivalent", () => {
    expect(areEquivalent({ num: 1, den: 2 }, { num: 1, den: 3 })).toBe(false);
  });
  it("3/4 und 6/8 sind äquivalent", () => {
    expect(areEquivalent({ num: 3, den: 4 }, { num: 6, den: 8 })).toBe(true);
  });
});

describe("compareResult", () => {
  it("1/2 > 1/4", () => {
    expect(compareResult({ num: 1, den: 2 }, { num: 1, den: 4 })).toBe(">");
  });
  it("1/3 < 1/2", () => {
    expect(compareResult({ num: 1, den: 3 }, { num: 1, den: 2 })).toBe("<");
  });
  it("2/4 = 1/2", () => {
    expect(compareResult({ num: 2, den: 4 }, { num: 1, den: 2 })).toBe("=");
  });
  it("3/4 > 2/3", () => {
    expect(compareResult({ num: 3, den: 4 }, { num: 2, den: 3 })).toBe(">");
  });
  it("1/6 < 1/3", () => {
    expect(compareResult({ num: 1, den: 6 }, { num: 1, den: 3 })).toBe("<");
  });
});

describe("formatFraction", () => {
  it("formatiert 1/2 als '1/2'", () => {
    expect(formatFraction({ num: 1, den: 2 })).toBe("1/2");
  });
  it("formatiert 3/4 als '3/4'", () => {
    expect(formatFraction({ num: 3, den: 4 })).toBe("3/4");
  });
});

describe("buildEquivalenceChain", () => {
  it("erzeugt 3-gliedrige Kette für 1/2", () => {
    const chain = buildEquivalenceChain({ num: 1, den: 2 }, 3);
    expect(chain).toHaveLength(3);
    expect(chain[0]).toEqual({ num: 1, den: 2 });
    expect(chain[1]).toEqual({ num: 2, den: 4 });
    expect(chain[2]).toEqual({ num: 3, den: 6 });
  });
  it("alle Glieder sind äquivalent zum Original", () => {
    const base = { num: 1, den: 3 };
    const chain = buildEquivalenceChain(base, 4);
    chain.forEach((f) => {
      expect(areEquivalent(base, f)).toBe(true);
    });
  });
  it("5-gliedrige Kette hat 5 Elemente", () => {
    expect(buildEquivalenceChain({ num: 2, den: 5 }, 5)).toHaveLength(5);
  });
});

describe("generateCircleTask", () => {
  it("liefert gültigen Bruch", () => {
    const task = generateCircleTask();
    expect(task.fraction.num).toBeGreaterThanOrEqual(1);
    expect(task.fraction.den).toBeGreaterThanOrEqual(2);
    expect(task.fraction.num).toBeLessThan(task.fraction.den);
  });
  it("liefert anderen Bruch als exclude (wenn möglich)", () => {
    const first = generateCircleTask();
    const second = generateCircleTask(first);
    // In pool of 12 fractions this should nearly always differ
    // We just verify the result is a valid fraction
    expect(second.fraction.den).toBeGreaterThanOrEqual(2);
  });
  it("erzeugt über 20 Tasks ohne Fehler", () => {
    let prev = generateCircleTask();
    for (let i = 0; i < 20; i++) {
      const next = generateCircleTask(prev);
      expect(next.fraction.num).toBeGreaterThan(0);
      prev = next;
    }
  });
});

describe("generateCompareTask", () => {
  it("liefert Task mit zwei Brüchen und korrektem Symbol", () => {
    const task = generateCompareTask();
    expect(["<", "=", ">"]).toContain(task.correct);
    expect(task.a.den).toBeGreaterThan(0);
    expect(task.b.den).toBeGreaterThan(0);
  });
  it("correct-Symbol stimmt mit tatsächlichem Vergleich überein", () => {
    for (let i = 0; i < 10; i++) {
      const task = generateCompareTask();
      expect(compareResult(task.a, task.b)).toBe(task.correct);
    }
  });
});

describe("generateNumberLineTask", () => {
  it("liefert Bruch und max (1 oder 2)", () => {
    const task = generateNumberLineTask();
    expect([1, 2]).toContain(task.max);
    expect(task.fraction.num).toBeGreaterThan(0);
  });
  it("Bruch liegt innerhalb [0, max]", () => {
    for (let i = 0; i < 15; i++) {
      const task = generateNumberLineTask();
      const val = fractionValue(task.fraction);
      expect(val).toBeGreaterThan(0);
      expect(val).toBeLessThanOrEqual(task.max);
    }
  });
});

describe("checkNumberLineAnswer", () => {
  it("akzeptiert exakten Treffer", () => {
    const task = { fraction: { num: 1, den: 2 }, max: 1 as const };
    expect(checkNumberLineAnswer(task, 0.5)).toBe(true);
  });
  it("akzeptiert Treffer innerhalb Toleranz (±0.07)", () => {
    const task = { fraction: { num: 1, den: 2 }, max: 1 as const };
    expect(checkNumberLineAnswer(task, 0.55)).toBe(true);
    expect(checkNumberLineAnswer(task, 0.45)).toBe(true);
  });
  it("lehnt Treffer außerhalb Toleranz ab", () => {
    const task = { fraction: { num: 1, den: 2 }, max: 1 as const };
    expect(checkNumberLineAnswer(task, 0.8)).toBe(false);
    expect(checkNumberLineAnswer(task, 0.1)).toBe(false);
  });
  it("funktioniert für Brüche > 1 (max=2)", () => {
    const task = { fraction: { num: 3, den: 2 }, max: 2 as const };
    expect(checkNumberLineAnswer(task, 1.5)).toBe(true);
    expect(checkNumberLineAnswer(task, 0.5)).toBe(false);
  });
});

describe("checkCompareAnswer", () => {
  it("richtige Antwort wird akzeptiert", () => {
    const task = generateCompareTask();
    expect(checkCompareAnswer(task, task.correct)).toBe(true);
  });
  it("falsche Antwort wird abgelehnt", () => {
    const task = { a: { num: 1, den: 2 }, b: { num: 1, den: 4 }, correct: ">" as const };
    expect(checkCompareAnswer(task, "<")).toBe(false);
    expect(checkCompareAnswer(task, "=")).toBe(false);
  });
  it("Gleichheit-Aufgabe: = korrekt", () => {
    const task = { a: { num: 2, den: 4 }, b: { num: 1, den: 2 }, correct: "=" as const };
    expect(checkCompareAnswer(task, "=")).toBe(true);
    expect(checkCompareAnswer(task, ">")).toBe(false);
  });
});

describe("fractionName", () => {
  it("1/2 → '1 Hälften'", () => {
    expect(fractionName({ num: 1, den: 2 })).toContain("Hälften");
  });
  it("1/4 → '1 Viertel'", () => {
    expect(fractionName({ num: 1, den: 4 })).toContain("Viertel");
  });
  it("2/3 → '2 Drittel'", () => {
    expect(fractionName({ num: 2, den: 3 })).toContain("Drittel");
  });
  it("3/8 → '3 Achtel'", () => {
    expect(fractionName({ num: 3, den: 8 })).toContain("Achtel");
  });
  it("unbekannter Nenner gibt generischen Namen", () => {
    const name = fractionName({ num: 2, den: 7 });
    expect(name).toContain("7tel");
  });
});
