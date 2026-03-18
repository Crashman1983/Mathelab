/**
 * Tests für Muster & Strukturen – Logik
 */
import { describe, it, expect } from "vitest";
import {
  generateSequenceTask,
  generateMachineTask,
  generateFigureTask,
  applyRule,
  getRuleLabel,
  getFigurePoints,
  checkSequenceAnswer,
  checkMachineAnswer,
  checkFigureAnswer,
} from "./logic";

// ─── Sequenz ────────────────────────────────────────────────────────────────

describe("generateSequenceTask", () => {
  it("liefert 5-gliedrige Folge", () => {
    const task = generateSequenceTask();
    expect(task.full).toHaveLength(5);
  });

  it("hiddenIndex liegt zwischen 1 und 3", () => {
    for (let i = 0; i < 20; i++) {
      const task = generateSequenceTask();
      expect(task.hiddenIndex).toBeGreaterThanOrEqual(1);
      expect(task.hiddenIndex).toBeLessThanOrEqual(3);
    }
  });

  it("display enthält -1 an hiddenIndex", () => {
    const task = generateSequenceTask();
    expect(task.display[task.hiddenIndex]).toBe(-1);
  });

  it("alle anderen display-Werte sind >= 0", () => {
    const task = generateSequenceTask();
    task.display.forEach((v, i) => {
      if (i !== task.hiddenIndex) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it("answer stimmt mit full[hiddenIndex] überein", () => {
    const task = generateSequenceTask();
    expect(task.answer).toBe(task.full[task.hiddenIndex]);
  });

  it("ruleLabel ist nicht leer", () => {
    const task = generateSequenceTask();
    expect(task.ruleLabel.length).toBeGreaterThan(0);
  });

  it("erzeugt 50 Tasks ohne Fehler", () => {
    for (let i = 0; i < 50; i++) {
      const t = generateSequenceTask();
      expect(t.answer).toBeGreaterThan(0);
    }
  });
});

describe("checkSequenceAnswer", () => {
  it("korrekte Antwort wird akzeptiert", () => {
    const task = generateSequenceTask();
    expect(checkSequenceAnswer(task, task.answer)).toBe(true);
  });

  it("falsche Antwort wird abgelehnt", () => {
    const task = generateSequenceTask();
    expect(checkSequenceAnswer(task, task.answer + 1)).toBe(false);
    expect(checkSequenceAnswer(task, task.answer - 1)).toBe(false);
  });

  it("0 wird als falsch erkannt (da answer immer > 0)", () => {
    const task = generateSequenceTask();
    expect(checkSequenceAnswer(task, 0)).toBe(false);
  });
});

// ─── Maschine ─────────────────────────────────────────────────────────────────

describe("applyRule", () => {
  it("add: 5 + 3 = 8", () => {
    expect(applyRule("add", 5, 3)).toBe(8);
  });
  it("sub: 10 - 4 = 6", () => {
    expect(applyRule("sub", 10, 4)).toBe(6);
  });
  it("mul: 6 × 4 = 24", () => {
    expect(applyRule("mul", 6, 4)).toBe(24);
  });
  it("double: 7 × 2 = 14", () => {
    expect(applyRule("double", 7, 0)).toBe(14);
  });
  it("half: 8 ÷ 2 = 4", () => {
    expect(applyRule("half", 8, 0)).toBe(4);
  });
  it("half rundet ab bei ungeraden Zahlen", () => {
    expect(applyRule("half", 7, 0)).toBe(3);
  });
});

describe("getRuleLabel", () => {
  it("add → '+n'", () => {
    expect(getRuleLabel("add", 5)).toBe("+5");
  });
  it("sub → '−n'", () => {
    expect(getRuleLabel("sub", 3)).toBe("−3");
  });
  it("mul → '×n'", () => {
    expect(getRuleLabel("mul", 4)).toBe("×4");
  });
  it("double → '×2'", () => {
    expect(getRuleLabel("double", 0)).toBe("×2");
  });
  it("half → '÷2'", () => {
    expect(getRuleLabel("half", 0)).toBe("÷2");
  });
});

describe("generateMachineTask", () => {
  it("liefert 3 Beispielpaare", () => {
    const task = generateMachineTask();
    expect(task.examples).toHaveLength(3);
  });

  it("Outputs stimmen mit Regel überein", () => {
    const task = generateMachineTask();
    task.examples.forEach(({ input, output }) => {
      expect(applyRule(task.rule, input, task.ruleValue)).toBe(output);
    });
  });

  it("answer ist korrekte Anwendung der Regel auf hiddenInput", () => {
    for (let i = 0; i < 20; i++) {
      const task = generateMachineTask();
      expect(task.answer).toBe(applyRule(task.rule, task.hiddenInput, task.ruleValue));
    }
  });

  it("hiddenInput liegt im Bereich 1–20", () => {
    for (let i = 0; i < 20; i++) {
      const task = generateMachineTask();
      expect(task.hiddenInput).toBeGreaterThanOrEqual(1);
      expect(task.hiddenInput).toBeLessThanOrEqual(20);
    }
  });

  it("erzeugt 50 Tasks ohne Fehler", () => {
    for (let i = 0; i < 50; i++) {
      const t = generateMachineTask();
      expect(typeof t.answer).toBe("number");
    }
  });
});

describe("checkMachineAnswer", () => {
  it("korrekte Antwort wird akzeptiert", () => {
    const task = generateMachineTask();
    expect(checkMachineAnswer(task, task.answer)).toBe(true);
  });

  it("falsche Antwort wird abgelehnt", () => {
    const task = generateMachineTask();
    expect(checkMachineAnswer(task, task.answer + 1)).toBe(false);
    expect(checkMachineAnswer(task, task.answer - 1)).toBe(false);
  });
});

// ─── Figuren ──────────────────────────────────────────────────────────────────

describe("getFigurePoints", () => {
  it("square Schritt 1: 1 Punkt", () => {
    expect(getFigurePoints("square", 1)).toHaveLength(1);
  });
  it("square Schritt 2: 4 Punkte", () => {
    expect(getFigurePoints("square", 2)).toHaveLength(4);
  });
  it("square Schritt 3: 9 Punkte", () => {
    expect(getFigurePoints("square", 3)).toHaveLength(9);
  });

  it("triangle Schritt 1: 1 Punkt", () => {
    expect(getFigurePoints("triangle", 1)).toHaveLength(1);
  });
  it("triangle Schritt 2: 3 Punkte", () => {
    expect(getFigurePoints("triangle", 2)).toHaveLength(3);
  });
  it("triangle Schritt 3: 6 Punkte", () => {
    expect(getFigurePoints("triangle", 3)).toHaveLength(6);
  });

  it("plus Schritt 1: 1 Punkt (nur Mitte)", () => {
    expect(getFigurePoints("plus", 1)).toHaveLength(1);
  });
  it("plus Schritt 2: 5 Punkte", () => {
    expect(getFigurePoints("plus", 2)).toHaveLength(5);
  });
  it("plus Schritt 3: 9 Punkte", () => {
    expect(getFigurePoints("plus", 3)).toHaveLength(9);
  });

  it("staircase Schritt 3: 6 Punkte", () => {
    expect(getFigurePoints("staircase", 3)).toHaveLength(6);
  });

  it("liefert row/col Objekte", () => {
    const pts = getFigurePoints("square", 2);
    pts.forEach((p) => {
      expect(typeof p.row).toBe("number");
      expect(typeof p.col).toBe("number");
    });
  });
});

describe("generateFigureTask", () => {
  it("shownSteps liegt zwischen 2 und 4", () => {
    for (let i = 0; i < 20; i++) {
      const task = generateFigureTask();
      expect(task.shownSteps).toBeGreaterThanOrEqual(2);
      expect(task.shownSteps).toBeLessThanOrEqual(4);
    }
  });

  it("counts hat shownSteps Einträge", () => {
    const task = generateFigureTask();
    expect(task.counts).toHaveLength(task.shownSteps);
  });

  it("answer ist größer als letzter Eintrag in counts", () => {
    for (let i = 0; i < 20; i++) {
      const task = generateFigureTask();
      const last = task.counts[task.counts.length - 1]!;
      expect(task.answer).toBeGreaterThan(last);
    }
  });

  it("nextStep = shownSteps + 1", () => {
    const task = generateFigureTask();
    expect(task.nextStep).toBe(task.shownSteps + 1);
  });

  it("erzeugt 50 Tasks ohne Fehler", () => {
    for (let i = 0; i < 50; i++) {
      const t = generateFigureTask();
      expect(t.answer).toBeGreaterThan(0);
    }
  });
});

describe("checkFigureAnswer", () => {
  it("korrekte Antwort wird akzeptiert", () => {
    const task = generateFigureTask();
    expect(checkFigureAnswer(task, task.answer)).toBe(true);
  });

  it("falsche Antwort wird abgelehnt", () => {
    const task = generateFigureTask();
    expect(checkFigureAnswer(task, task.answer + 1)).toBe(false);
    expect(checkFigureAnswer(task, task.answer - 1)).toBe(false);
  });

  it("0 wird als falsch erkannt", () => {
    const task = generateFigureTask();
    expect(checkFigureAnswer(task, 0)).toBe(false);
  });
});
