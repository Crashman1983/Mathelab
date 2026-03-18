/**
 * Tests für Zahlenlabor-Logik
 */
import { describe, it, expect } from "vitest";
import {
  getPlaceValues,
  compareNumbers,
  checkCompare,
  applyJump,
  recordJump,
  undoLastJump,
  isAtTarget,
  stepsToTarget,
  generatePlaceTask,
  generateCompareTask,
  generateJumpTask,
  computeNumberLineRange,
  MAX_VALUE,
} from "./logic";
import type { NumbersState } from "./types";

describe("getPlaceValues", () => {
  it("zerlegt 1234 korrekt", () => {
    expect(getPlaceValues(1234)).toEqual({ hundredThousands: 0, tenThousands: 0, thousands: 1, hundreds: 2, tens: 3, ones: 4 });
  });
  it("zerlegt 0", () => {
    expect(getPlaceValues(0)).toEqual({ hundredThousands: 0, tenThousands: 0, thousands: 0, hundreds: 0, tens: 0, ones: 0 });
  });
  it("zerlegt 9999", () => {
    expect(getPlaceValues(9999)).toEqual({ hundredThousands: 0, tenThousands: 0, thousands: 9, hundreds: 9, tens: 9, ones: 9 });
  });
  it("klemmt negative Werte an 0", () => {
    expect(getPlaceValues(-5)).toEqual({ hundredThousands: 0, tenThousands: 0, thousands: 0, hundreds: 0, tens: 0, ones: 0 });
  });
  it("klemmt zu große Werte an MAX", () => {
    const r = getPlaceValues(10000);
    expect(r.tenThousands).toBe(1);
    expect(r.thousands).toBe(0);
  });
  it("ignoriert Dezimalen", () => {
    expect(getPlaceValues(12.9)).toEqual({ hundredThousands: 0, tenThousands: 0, thousands: 0, hundreds: 0, tens: 1, ones: 2 });
  });
  it("zerlegt 123456 korrekt", () => {
    expect(getPlaceValues(123456)).toEqual({ hundredThousands: 1, tenThousands: 2, thousands: 3, hundreds: 4, tens: 5, ones: 6 });
  });
});

describe("compareNumbers", () => {
  it("kleiner", () => expect(compareNumbers(3, 7)).toBe("<"));
  it("gleich", () => expect(compareNumbers(5, 5)).toBe("="));
  it("größer", () => expect(compareNumbers(9, 2)).toBe(">"));
});

describe("checkCompare", () => {
  it("gibt true für richtige Antwort", () => {
    expect(checkCompare("<", 3, 7)).toBe(true);
    expect(checkCompare("=", 5, 5)).toBe(true);
    expect(checkCompare(">", 9, 2)).toBe(true);
  });
  it("gibt false für falsche Antwort", () => {
    expect(checkCompare(">", 3, 7)).toBe(false);
  });
});

describe("applyJump", () => {
  it("addiert positiven Schritt", () => expect(applyJump(100, 10)).toBe(110));
  it("subtrahiert negativen Schritt", () => expect(applyJump(100, -10)).toBe(90));
  it("klemmt an 0", () => expect(applyJump(5, -10)).toBe(0));
  it("klemmt an MAX_VALUE", () => expect(applyJump(MAX_VALUE - 5, 20)).toBe(MAX_VALUE));
});

describe("recordJump", () => {
  it("fügt Eintrag hinzu", () => {
    const result = recordJump([], 100, 110, 10);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ from: 100, to: 110, delta: 10 });
  });

  it("begrenzt auf MAX_JUMP_HISTORY", () => {
    let history: ReturnType<typeof recordJump> = [];
    for (let i = 0; i < 10; i++) {
      history = recordJump(history, i, i + 1, 1);
    }
    expect(history.length).toBeLessThanOrEqual(5);
  });

  it("verändert Original-Array nicht", () => {
    const orig: ReturnType<typeof recordJump> = [];
    recordJump(orig, 0, 1, 1);
    expect(orig).toHaveLength(0);
  });
});

describe("undoLastJump", () => {
  it("gibt den vorherigen Wert und gekürzte History zurück", () => {
    const history = [
      { from: 10, to: 20, delta: 10, timestamp: 1 },
      { from: 20, to: 30, delta: 10, timestamp: 2 },
    ];
    expect(undoLastJump(history)).toEqual({
      value: 20,
      history: [{ from: 10, to: 20, delta: 10, timestamp: 1 }],
    });
  });

  it("gibt null bei leerer History zurück", () => {
    expect(undoLastJump([])).toBeNull();
  });
});

describe("isAtTarget", () => {
  const baseState = (): NumbersState => ({
    mode: "jump",
    value: 50,
    compareValue: 0,
    jumpHistory: [],
    task: { type: "jump", target: 50, start: 0 },
    isAnimating: false,
    compareAnswer: null,
    lastResult: null,
    jumpAnimation: null,
    bundleAnim: null,
  });

  it("gibt true wenn value === target", () => {
    expect(isAtTarget(baseState())).toBe(true);
  });

  it("gibt false wenn value !== target", () => {
    const s = baseState();
    s.value = 30;
    expect(isAtTarget(s)).toBe(false);
  });

  it("gibt false ohne Task", () => {
    const s = baseState();
    s.task = null;
    expect(isAtTarget(s)).toBe(false);
  });

  it("gibt false in falschem Modus", () => {
    const s = baseState();
    s.task = { type: "compare", target: 50 };
    expect(isAtTarget(s)).toBe(false);
  });
});

describe("computeNumberLineRange", () => {
  it("gibt vernünftigen Bereich für leeres Array", () => {
    const r = computeNumberLineRange([]);
    expect(r.min).toBeGreaterThanOrEqual(0);
    expect(r.max).toBeGreaterThan(r.min);
  });

  it("enthält alle Werte (mit Puffer)", () => {
    const values = [100, 200];
    const r = computeNumberLineRange(values);
    expect(r.min).toBeLessThanOrEqual(100);
    expect(r.max).toBeGreaterThanOrEqual(200);
  });

  it("step teilt Range sinnvoll auf", () => {
    const r = computeNumberLineRange([0, 100]);
    expect((r.max - r.min) / r.step).toBeLessThanOrEqual(20);
  });

  it("stepHint wird direkt als step verwendet", () => {
    const r = computeNumberLineRange([0, 1000], 10, 100);
    expect(r.step).toBe(100);
  });
});

describe("stepsToTarget", () => {
  it("gibt positive Schritte zurück", () => {
    expect(stepsToTarget(100, 300)).toBe(200);
  });

  it("gibt negative Schritte zurück", () => {
    expect(stepsToTarget(500, 200)).toBe(-300);
  });

  it("gibt 0 zurück wenn gleich", () => {
    expect(stepsToTarget(400, 400)).toBe(0);
  });
});

describe("generatePlaceTask", () => {
  it("gibt Task vom Typ 'place' zurück", () => {
    expect(generatePlaceTask().type).toBe("place");
  });

  it("target liegt im gültigen Bereich", () => {
    for (let i = 0; i < 20; i++) {
      const t = generatePlaceTask();
      expect(t.target).toBeGreaterThanOrEqual(0);
      expect(t.target).toBeLessThanOrEqual(MAX_VALUE);
    }
  });
});

describe("generateCompareTask", () => {
  it("gibt Task vom Typ 'compare' zurück", () => {
    expect(generateCompareTask().type).toBe("compare");
  });
});

describe("generateJumpTask", () => {
  it("gibt Task vom Typ 'jump' zurück", () => {
    expect(generateJumpTask().type).toBe("jump");
  });

  it("start und target liegen im gültigen Bereich", () => {
    for (let i = 0; i < 20; i++) {
      const t = generateJumpTask();
      expect(t.start).toBeGreaterThanOrEqual(0);
      expect(t.start).toBeLessThanOrEqual(MAX_VALUE);
      expect(t.target).toBeGreaterThanOrEqual(0);
      expect(t.target).toBeLessThanOrEqual(MAX_VALUE);
    }
  });
});
