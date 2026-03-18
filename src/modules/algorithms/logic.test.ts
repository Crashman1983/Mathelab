/**
 * Tests für Schriftliches Rechnen – Logik
 */
import { describe, it, expect } from "vitest";
import {
  generateTask,
  getDigits,
  numPlaces,
  computeAdditionSteps,
  computeSubtractionSteps,
  computeMultiplicationSteps,
  computeDivisionSteps,
  getQuotientDigits,
  checkAnswer,
  operatorLabel,
} from "./logic";

describe("numPlaces", () => {
  it("0 hat 1 Stelle", () => {
    expect(numPlaces(0)).toBe(1);
  });
  it("9 hat 1 Stelle", () => {
    expect(numPlaces(9)).toBe(1);
  });
  it("10 hat 2 Stellen", () => {
    expect(numPlaces(10)).toBe(2);
  });
  it("999 hat 3 Stellen", () => {
    expect(numPlaces(999)).toBe(3);
  });
  it("1000 hat 4 Stellen", () => {
    expect(numPlaces(1000)).toBe(4);
  });
  it("1234 hat 4 Stellen", () => {
    expect(numPlaces(1234)).toBe(4);
  });
});

describe("getDigits", () => {
  it("zerlegt 123 in [3,2,1] (Einer zuerst)", () => {
    expect(getDigits(123, 3)).toEqual([3, 2, 1]);
  });
  it("zerlegt 5 in [5,0] bei 2 Stellen", () => {
    expect(getDigits(5, 2)).toEqual([5, 0]);
  });
  it("zerlegt 0 in [0,0,0] bei 3 Stellen", () => {
    expect(getDigits(0, 3)).toEqual([0, 0, 0]);
  });
  it("zerlegt 999 in [9,9,9]", () => {
    expect(getDigits(999, 3)).toEqual([9, 9, 9]);
  });
  it("liefert korrekte Anzahl Stellen", () => {
    expect(getDigits(42, 4)).toHaveLength(4);
  });
});

describe("computeAdditionSteps", () => {
  it("125 + 234 → Ergebnis 359 (keine Überträge)", () => {
    const steps = computeAdditionSteps(125, 234);
    const result = steps.map((s) => s.result);
    // Stellen von rechts: 9, 5, 3
    expect(result[0]).toBe(9);
    expect(result[1]).toBe(5);
    expect(result[2]).toBe(3);
  });

  it("199 + 1 → Übertrag erkannt", () => {
    const steps = computeAdditionSteps(199, 1);
    // Einer: 9+1=10 → result=0, carryOut=1
    expect(steps[0]!.result).toBe(0);
    expect(steps[0]!.carryOut).toBe(1);
  });

  it("Gesamtergebnis stimmt: Ziffern ergeben korrekte Zahl", () => {
    const a = 378, b = 265;
    const steps = computeAdditionSteps(a, b);
    const reconstructed = steps.reduce((acc, s, i) => acc + s.result * Math.pow(10, i), 0);
    expect(reconstructed).toBe(a + b);
  });

  it("543 + 457 = 1000", () => {
    const steps = computeAdditionSteps(543, 457);
    const result = steps.reduce((acc, s, i) => acc + s.result * Math.pow(10, i), 0);
    expect(result).toBe(1000);
  });

  it("kein carryIn im ersten Schritt", () => {
    const steps = computeAdditionSteps(100, 200);
    expect(steps[0]!.carryIn).toBe(0);
  });

  it("Übertrag propagiert korrekt (999 + 1)", () => {
    const steps = computeAdditionSteps(999, 1);
    expect(steps[0]!.carryOut).toBe(1);
    expect(steps[1]!.carryIn).toBe(1);
    expect(steps[1]!.carryOut).toBe(1);
  });
});

describe("computeSubtractionSteps", () => {
  it("567 - 234 → keine Borgen", () => {
    const steps = computeSubtractionSteps(567, 234);
    const result = steps.reduce((acc, s, i) => acc + s.result * Math.pow(10, i), 0);
    expect(result).toBe(333);
  });

  it("300 - 1 → Borgen erforderlich", () => {
    const steps = computeSubtractionSteps(300, 1);
    const result = steps.reduce((acc, s, i) => acc + s.result * Math.pow(10, i), 0);
    expect(result).toBe(299);
  });

  it("Gesamtergebnis stimmt für zufällige Werte", () => {
    const pairs = [[500, 123], [800, 399], [234, 98], [999, 111]];
    for (const [a, b] of pairs) {
      const steps = computeSubtractionSteps(a!, b!);
      const result = steps.reduce((acc, s, i) => acc + s.result * Math.pow(10, i), 0);
      expect(result).toBe(a! - b!);
    }
  });

  it("Borgen setzt carryOut auf 1", () => {
    // 10 - 1: Einer: 0-1 → borrow, diff=9, carryOut=1
    const steps = computeSubtractionSteps(10, 1);
    expect(steps[0]!.result).toBe(9);
    expect(steps[0]!.carryOut).toBe(1); // borrow from next column
  });
});

describe("computeMultiplicationSteps", () => {
  it("23 × 4 = 92", () => {
    const steps = computeMultiplicationSteps(23, 4);
    const result = steps.reduce((acc, s, i) => acc + s.result * Math.pow(10, i), 0);
    expect(result).toBe(92);
  });

  it("99 × 9 = 891", () => {
    const steps = computeMultiplicationSteps(99, 9);
    const result = steps.reduce((acc, s, i) => acc + s.result * Math.pow(10, i), 0);
    expect(result).toBe(891);
  });

  it("Gesamtergebnis stimmt für mehrere Werte", () => {
    const cases = [[12, 3], [45, 6], [78, 9], [50, 4], [13, 7]];
    for (const [a, b] of cases) {
      const steps = computeMultiplicationSteps(a!, b!);
      const result = steps.reduce((acc, s, i) => acc + s.result * Math.pow(10, i), 0);
      expect(result).toBe(a! * b!);
    }
  });

  it("b ist in allen Schritten gleich", () => {
    const steps = computeMultiplicationSteps(34, 5);
    steps.forEach((s) => expect(s.digitB).toBe(5));
  });

  it("kein carryIn im ersten Schritt", () => {
    const steps = computeMultiplicationSteps(20, 3);
    expect(steps[0]!.carryIn).toBe(0);
  });
});

describe("generateTask", () => {
  it("Addition: answer = a + b, positive integers", () => {
    for (let i = 0; i < 20; i++) {
      const t = generateTask("addition");
      expect(t.a).toBeGreaterThan(0);
      expect(t.b).toBeGreaterThan(0);
      expect(t.answer).toBe(t.a + t.b);
    }
  });

  it("Subtraktion: a > b und answer = a - b", () => {
    for (let i = 0; i < 20; i++) {
      const t = generateTask("subtraction");
      expect(t.a).toBeGreaterThan(t.b);
      expect(t.answer).toBe(t.a - t.b);
    }
  });

  it("Multiplikation difficulty 1 (Junior): small numbers", () => {
    for (let i = 0; i < 20; i++) {
      const t = generateTask("multiplication", 1);
      expect(t.a).toBeGreaterThanOrEqual(2);
      expect(t.b).toBeGreaterThanOrEqual(2);
      expect(t.answer).toBe(t.a * t.b);
    }
  });

  it("Multiplikation: answer = a * b", () => {
    for (let i = 0; i < 20; i++) {
      const t = generateTask("multiplication");
      expect(t.a).toBeGreaterThanOrEqual(2);
      expect(t.b).toBeGreaterThanOrEqual(2);
      expect(t.answer).toBe(t.a * t.b);
    }
  });
});

describe("checkAnswer", () => {
  it("richtige Antwort wird akzeptiert", () => {
    expect(checkAnswer({ mode: "addition", a: 200, b: 300, answer: 500 }, 500)).toBe(true);
  });
  it("falsche Antwort wird abgelehnt", () => {
    expect(checkAnswer({ mode: "addition", a: 200, b: 300, answer: 500 }, 499)).toBe(false);
  });
  it("Off-by-one wird abgelehnt", () => {
    expect(checkAnswer({ mode: "subtraction", a: 500, b: 200, answer: 300 }, 301)).toBe(false);
    expect(checkAnswer({ mode: "subtraction", a: 500, b: 200, answer: 300 }, 299)).toBe(false);
  });
});

describe("computeDivisionSteps", () => {
  it("84 : 4 → Quotient 21", () => {
    const steps = computeDivisionSteps(84, 4);
    expect(steps).toHaveLength(2); // 2 Ziffern im Dividend
    expect(steps[0]!.quotientDigit).toBe(2); // 8:4=2
    expect(steps[0]!.remainder).toBe(0);
    expect(steps[1]!.quotientDigit).toBe(1); // 4:4=1
    expect(steps[1]!.remainder).toBe(0);
  });

  it("756 : 4 → Quotient 189", () => {
    const steps = computeDivisionSteps(756, 4);
    expect(steps).toHaveLength(3);
    // 7:4 = 1 Rest 3 → 36:4 = 9 Rest 0 → 06:4...
    expect(steps[0]!.quotientDigit).toBe(1); // 7:4=1 R3
    expect(steps[0]!.remainder).toBe(3);
    expect(steps[1]!.quotientDigit).toBe(8); // 35:4=8 R3
    expect(steps[2]!.quotientDigit).toBe(9); // 36:4=9 R0
  });

  it("Quotient-Ziffern ergeben korrekte Zahl", () => {
    const cases = [[84, 4], [756, 4], [630, 7], [96, 3], [100, 5]];
    for (const [a, b] of cases) {
      const digits = getQuotientDigits(a!, b!);
      const quotient = digits.reduce((acc, d, i) => acc + d * Math.pow(10, digits.length - 1 - i), 0);
      expect(quotient).toBe(Math.floor(a! / b!));
    }
  });

  it("Rest wird korrekt berechnet", () => {
    // 83 : 4 = 20 Rest 3
    const steps = computeDivisionSteps(83, 4);
    const lastStep = steps[steps.length - 1]!;
    expect(lastStep.remainder).toBe(83 % 4);
  });

  it("Division ohne Rest: letzter Remainder = 0", () => {
    const steps = computeDivisionSteps(84, 4);
    expect(steps[steps.length - 1]!.remainder).toBe(0);
  });

  it("Divisor 10: 100 : 10 = 10", () => {
    const steps = computeDivisionSteps(100, 10);
    const digits = steps.map(s => s.quotientDigit);
    const quotient = digits.reduce((acc, d, i) => acc + d * Math.pow(10, digits.length - 1 - i), 0);
    expect(quotient).toBe(10);
  });
});

describe("generateTask division", () => {
  it("Division: valid task with divisor ≥ 2", () => {
    for (let i = 0; i < 20; i++) {
      const t = generateTask("division", 1);
      expect(t.mode).toBe("division");
      expect(t.b).toBeGreaterThanOrEqual(2);
      expect(t.answer).toBe(Math.floor(t.a / t.b));
    }
  });

  it("Division difficulty 2 (Checker): answer correct", () => {
    for (let i = 0; i < 20; i++) {
      const t = generateTask("division", 2);
      expect(t.mode).toBe("division");
      expect(t.b).toBeGreaterThanOrEqual(2);
      expect(t.answer).toBe(Math.floor(t.a / t.b));
    }
  });

  it("Division: Dividend ist immer positiv und mehrziffrig", () => {
    for (let i = 0; i < 20; i++) {
      const t = generateTask("division", 2);
      expect(t.a).toBeGreaterThanOrEqual(20);
    }
  });
});

describe("operatorLabel", () => {
  it("Addition → '+'", () => {
    expect(operatorLabel("addition")).toBe("+");
  });
  it("Subtraktion → '−'", () => {
    expect(operatorLabel("subtraction")).toBe("−");
  });
  it("Multiplikation → '×'", () => {
    expect(operatorLabel("multiplication")).toBe("×");
  });
  it("Division → ':'", () => {
    expect(operatorLabel("division")).toBe(":");
  });
});
