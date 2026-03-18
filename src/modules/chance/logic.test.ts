/**
 * Tests für Daten und Zufall – Logik
 */
import { describe, it, expect } from "vitest";
import {
  runExperiment,
  addResults,
  emptyCounts,
  getLeaderIndex,
  theoreticalShare,
  actualShare,
  computeWheelTargetAngle,
  EXPERIMENTS,
} from "./logic";

describe("EXPERIMENTS", () => {
  it("alle Experimente haben gleich viele Outcomes und Weights", () => {
    for (const exp of Object.values(EXPERIMENTS)) {
      expect(exp.outcomes.length).toBe(exp.weights.length);
    }
  });
  it("alle Weights sind positiv", () => {
    for (const exp of Object.values(EXPERIMENTS)) {
      for (const w of exp.weights) {
        expect(w).toBeGreaterThan(0);
      }
    }
  });
});

describe("emptyCounts", () => {
  it("erstellt Array mit Nullen", () => {
    expect(emptyCounts(6)).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it("funktioniert für n=1", () => {
    expect(emptyCounts(1)).toEqual([0]);
  });
});

describe("addResults", () => {
  it("akkumuliert Ergebnisse", () => {
    const counts = [0, 0, 0];
    const result = addResults(counts, [0, 1, 1, 2]);
    expect(result).toEqual([1, 2, 1]);
  });
  it("verändert Original nicht", () => {
    const orig = [0, 0, 0];
    addResults(orig, [0, 1]);
    expect(orig).toEqual([0, 0, 0]);
  });
  it("ignoriert out-of-bounds Indices", () => {
    const counts = [0, 0];
    const result = addResults(counts, [0, 5, -1, 1]);
    expect(result).toEqual([1, 1]);
  });
});

describe("getLeaderIndex", () => {
  it("gibt Index des größten Werts", () => {
    expect(getLeaderIndex([1, 3, 2])).toBe(1);
  });
  it("gibt 0 bei Gleichstand", () => {
    expect(getLeaderIndex([2, 2, 2])).toBe(0);
  });
  it("funktioniert mit einem Element", () => {
    expect(getLeaderIndex([5])).toBe(0);
  });
});

describe("theoreticalShare", () => {
  it("berechnet gleiche Anteile für fairen Würfel", () => {
    const weights = [1, 1, 1, 1, 1, 1];
    for (let i = 0; i < 6; i++) {
      expect(theoreticalShare(weights, i)).toBeCloseTo(1 / 6);
    }
  });
  it("berechnet korrekten Anteil für unfaires Rad", () => {
    const weights = [4, 1, 1, 1]; // total = 7
    expect(theoreticalShare(weights, 0)).toBeCloseTo(4 / 7);
    expect(theoreticalShare(weights, 1)).toBeCloseTo(1 / 7);
    expect(theoreticalShare(weights, 2)).toBeCloseTo(1 / 7);
    expect(theoreticalShare(weights, 3)).toBeCloseTo(1 / 7);
  });
  it("gibt 0 für leere Weights", () => {
    expect(theoreticalShare([], 0)).toBe(0);
  });
});

describe("wheel-b", () => {
  it("macht Rot exakt viermal so wahrscheinlich wie jede andere Farbe", () => {
    const weights = EXPERIMENTS["wheel-b"].weights;
    expect(weights[0]).toBe(weights[1] * 4);
    expect(weights[0]).toBe(weights[2] * 4);
    expect(weights[0]).toBe(weights[3] * 4);
  });
});

describe("actualShare", () => {
  it("berechnet korrekten Anteil", () => {
    expect(actualShare([10, 30, 60], 2)).toBeCloseTo(0.6);
  });
  it("gibt 0 für leere Counts", () => {
    expect(actualShare([0, 0, 0], 1)).toBe(0);
  });
});

describe("runExperiment", () => {
  const dice = EXPERIMENTS.dice;

  it("gibt N Ergebnisse zurück", () => {
    const results = runExperiment(dice, 100);
    expect(results).toHaveLength(100);
  });

  it("alle Ergebnisse sind gültige Indices", () => {
    const results = runExperiment(dice, 200);
    for (const r of results) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(dice.outcomes.length);
    }
  });

  it("statistisch alle Seiten treffen (großes N)", () => {
    const results = runExperiment(dice, 1000);
    const counts = emptyCounts(6);
    const accumulated = addResults(counts, results);
    // Jede Seite sollte mindestens einmal vorkommen
    for (const c of accumulated) {
      expect(c).toBeGreaterThan(0);
    }
  });
});

describe("computeWheelTargetAngle", () => {
  it("gibt einen endlichen Winkel zurück", () => {
    const angle = computeWheelTargetAngle(0, 0, [1, 1, 1, 1]);
    expect(isFinite(angle)).toBe(true);
  });

  it("Zielwinkel ist größer als Startwinkel (mindestens 5 volle Umdrehungen)", () => {
    const start = 0;
    const angle = computeWheelTargetAngle(0, start, [1, 1, 1, 1]);
    expect(angle).toBeGreaterThan(start + Math.PI * 2 * 5);
  });

  it("funktioniert für alle Outcomes eines fairen Rads", () => {
    const weights = [1, 1, 1, 1];
    for (let i = 0; i < weights.length; i++) {
      const angle = computeWheelTargetAngle(i, 0, weights);
      expect(isFinite(angle)).toBe(true);
    }
  });
});
