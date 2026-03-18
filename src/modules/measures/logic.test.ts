/**
 * Tests für Größen & Messen – Logik
 */
import { describe, it, expect } from "vitest";
import {
  COIN_VALUES_CT,
  UNIT_PAIRS,
  coinLabel,
  formatCents,
  generateMoneyTask,
  generateUnitsTask,
  applyCoin,
  undoCoinState,
  evaluateMoneyProgress,
  parseUnitsAnswer,
  isUnitsAnswerCorrect,
} from "./logic";

describe("coinLabel", () => {
  it("formatiert Cent-Münzen", () => {
    expect(coinLabel(20)).toBe("20¢");
  });

  it("formatiert Euro-Münzen", () => {
    expect(coinLabel(200)).toBe("2€");
  });
});

describe("formatCents", () => {
  it("formatiert null korrekt", () => {
    expect(formatCents(0)).toBe("0,00 €");
  });

  it("formatiert Cent-Beträge korrekt", () => {
    expect(formatCents(45)).toBe("0,45 €");
  });

  it("formatiert Euro-Beträge korrekt", () => {
    expect(formatCents(260)).toBe("2,60 €");
  });
});

describe("generateMoneyTask", () => {
  it("liefert immer einen positiven Zielbetrag", () => {
    for (let i = 0; i < 50; i++) {
      const task = generateMoneyTask();
      expect(task.targetCents).toBeGreaterThan(0);
    }
  });

  it("liefert bei Wechselgeld-Aufgaben konsistente Beträge", () => {
    for (let i = 0; i < 50; i++) {
      const task = generateMoneyTask();
      if (task.taskType === "change") {
        expect(task.paidInCt).toBeGreaterThan(task.priceInCt);
        expect(task.targetCents).toBe(task.paidInCt - task.priceInCt);
      }
    }
  });
});

describe("generateUnitsTask", () => {
  it("liefert konsistente Aufgaben für glatte und gemischte Werte", () => {
    UNIT_PAIRS.forEach((pair, index) => {
      // Mehrfach aufrufen, um beide Varianten (glatt + gemischt) zu treffen
      for (let i = 0; i < 30; i++) {
        const task = generateUnitsTask(index);
        if (task.isMixed) {
          expect(task.correctRemainder).toBeGreaterThan(0);
          expect(task.correctRemainder).toBeLessThan(pair.factor);
          expect(task.sourceValue).toBe(task.correctAnswer * pair.factor + task.correctRemainder);
        } else {
          expect(task.correctRemainder).toBe(0);
          expect(task.sourceValue % pair.factor).toBe(0);
          expect(task.correctAnswer).toBe(task.sourceValue / pair.factor);
        }
      }
    });
  });
});

describe("applyCoin", () => {
  it("addiert Münzwerte", () => {
    expect(applyCoin(30, 20)).toBe(50);
  });
});

describe("undoCoinState", () => {
  it("nimmt die letzte Münze zurück", () => {
    expect(undoCoinState([10, 20, 50], 80)).toEqual({
      history: [10, 20],
      totalCents: 30,
    });
  });

  it("gibt null bei leerer History zurück", () => {
    expect(undoCoinState([], 0)).toBeNull();
  });
});

describe("evaluateMoneyProgress", () => {
  it("erkennt exakte Treffer", () => {
    expect(evaluateMoneyProgress(100, 100)).toEqual({ result: "correct", delta: 0 });
  });

  it("erkennt Überschreitungen", () => {
    expect(evaluateMoneyProgress(120, 100)).toEqual({ result: "over", delta: 20 });
  });

  it("erkennt unvollständige Beträge", () => {
    expect(evaluateMoneyProgress(80, 100)).toEqual({ result: "incomplete", delta: 20 });
  });
});

describe("parseUnitsAnswer", () => {
  it("parst ganze Zahlen", () => {
    expect(parseUnitsAnswer("5")).toBe(5);
  });

  it("parst Dezimalkomma", () => {
    expect(parseUnitsAnswer("1,5")).toBe(1.5);
  });

  it("gibt null für leere Eingaben zurück", () => {
    expect(parseUnitsAnswer("")).toBeNull();
  });
});

describe("isUnitsAnswerCorrect", () => {
  it("akzeptiert exakte Treffer", () => {
    expect(isUnitsAnswerCorrect(2, 2)).toBe(true);
  });

  it("akzeptiert kleine Rundungsfehler innerhalb der Toleranz", () => {
    expect(isUnitsAnswerCorrect(2.0005, 2)).toBe(true);
  });

  it("lehnt größere Abweichungen ab", () => {
    expect(isUnitsAnswerCorrect(2.01, 2)).toBe(false);
  });
});

describe("constants", () => {
  it("enthält alle 8 Euro-Münzen", () => {
    expect(COIN_VALUES_CT).toEqual([1, 2, 5, 10, 20, 50, 100, 200]);
  });

  it("enthält mindestens 6 Umrechnungspaare", () => {
    expect(UNIT_PAIRS.length).toBeGreaterThanOrEqual(6);
  });
});
