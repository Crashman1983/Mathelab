/**
 * Daten und Zufall – Logik (rein funktional, testbar)
 */

import { weightedPick } from "@core/utils";
import { EXPERIMENT_COLORS } from "@core/design";

// ─── Experiment Definitions ──────────────────────────────────────────────────

export type ExperimentId = "dice" | "wheel-a" | "wheel-b";

export interface Outcome {
  id: string;
  label: string;
  color: string;
}

export interface ExperimentDef {
  id: ExperimentId;
  label: string;
  outcomes: Outcome[];
  weights: number[];
  icon: string;
  description: string;
}

export const EXPERIMENTS: Record<ExperimentId, ExperimentDef> = {
  dice: {
    id: "dice",
    label: "Würfel",
    icon: "🎲",
    description: "Ein fairer sechsseitiger Würfel. Jede Seite (1–6) hat gleiche Wahrscheinlichkeit.",
    outcomes: [
      { id: "1", label: "1", color: EXPERIMENT_COLORS[0] },
      { id: "2", label: "2", color: EXPERIMENT_COLORS[1] },
      { id: "3", label: "3", color: EXPERIMENT_COLORS[2] },
      { id: "4", label: "4", color: EXPERIMENT_COLORS[3] },
      { id: "5", label: "5", color: EXPERIMENT_COLORS[4] },
      { id: "6", label: "6", color: EXPERIMENT_COLORS[5] },
    ],
    weights: [1, 1, 1, 1, 1, 1],
  },
  "wheel-a": {
    id: "wheel-a",
    label: "Rad A (fair)",
    icon: "🎡",
    description: "Ein faires Glücksrad mit vier gleich großen Feldern (Rot, Blau, Grün, Gelb).",
    outcomes: [
      { id: "red", label: "Rot", color: EXPERIMENT_COLORS[3] },
      { id: "blue", label: "Blau", color: EXPERIMENT_COLORS[0] },
      { id: "green", label: "Grün", color: EXPERIMENT_COLORS[1] },
      { id: "yellow", label: "Gelb", color: EXPERIMENT_COLORS[2] },
    ],
    weights: [1, 1, 1, 1],
  },
  "wheel-b": {
    id: "wheel-b",
    label: "Rad B (unfair)",
    icon: "🎡",
    description: "Ein unfaires Rad: Rot ist 4× so groß wie die anderen Felder.",
    outcomes: [
      { id: "red", label: "Rot", color: EXPERIMENT_COLORS[3] },
      { id: "blue", label: "Blau", color: EXPERIMENT_COLORS[0] },
      { id: "green", label: "Grün", color: EXPERIMENT_COLORS[1] },
      { id: "yellow", label: "Gelb", color: EXPERIMENT_COLORS[2] },
    ],
    weights: [4, 1, 1, 1],
  },
};

// ─── Simulation ───────────────────────────────────────────────────────────────

export interface DiceAnimState {
  startTime: number;
  duration: number; // 500ms
  targetValue: number; // outcome index
  bounceY: number; // current Y-offset (negative = above)
}

export interface WheelAnimState {
  startTime: number;
  duration: number;     // zufällig 2500–3500ms
  startAngle: number;
  totalRotation: number; // 3-5 volle Umdrehungen + Zielposition
  result: number;        // Index des Ergebnis-Sektors
}

export interface ChanceState {
  experimentId: ExperimentId;
  counts: number[]; // per outcome
  total: number;
  lastResult: number | null; // index into outcomes
  isAnimating: boolean;
  wheelAngle: number; // current visual angle (radians)
  wheelTargetAngle: number;
  savedRuns: SavedRun[];
  convergenceHistory: Map<string, number[]>; // outcomeId → [rel. Häufigkeit nach 1,2,3... Würfen]
  diceAnim: DiceAnimState | null;
  wheelAnim: WheelAnimState | null;
  wheelFlashAlpha: number; // 0–1, for sector highlight after wheel stop
  wheelFlashResult: number | null; // sector index to flash
  /** Vorhersage: Index des vorhergesagten häufigsten Ergebnisses (null = noch keine) */
  prediction: number | null;
}

export interface SavedRun {
  label: string;
  experimentId: ExperimentId;
  total: number;
  counts: number[];
  leader: string; // label of most-frequent outcome
}

/**
 * Führt N Würfe durch und gibt die Ergebnisindices zurück.
 */
export function runExperiment(
  exp: ExperimentDef,
  n: number
): number[] {
  // Single pick per trial (audit fix: was double-sampling)
  return Array.from({ length: n }, () => {
    const picked = weightedPick(exp.outcomes, exp.weights);
    return exp.outcomes.findIndex((o) => o.id === picked.id);
  });
}

/**
 * Akkumuliert Ergebnisse in einen Counts-Array.
 */
export function addResults(counts: number[], results: number[]): number[] {
  const next = [...counts];
  for (const r of results) {
    if (r >= 0 && r < next.length) next[r]++;
  }
  return next;
}

/**
 * Erstellt leere Counts für eine Anzahl Outcomes.
 */
export function emptyCounts(n: number): number[] {
  return new Array(n).fill(0);
}

/**
 * Berechnet den Index des häufigsten Outcomes.
 */
export function getLeaderIndex(counts: number[]): number {
  let best = 0;
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] > counts[best]) best = i;
  }
  return best;
}

/**
 * Berechnet den theoretischen Erwartungswert (Anteil) für ein Outcome.
 */
export function theoreticalShare(weights: number[], index: number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  return total > 0 ? weights[index] / total : 0;
}

/**
 * Berechnet den tatsächlichen Anteil eines Outcomes.
 */
export function actualShare(counts: number[], index: number): number {
  const total = counts.reduce((a, b) => a + b, 0);
  return total > 0 ? counts[index] / total : 0;
}

/**
 * Berechnet den nächsten Zielwinkel für das Rad (mit mehreren Umdrehungen).
 */
export function computeWheelTargetAngle(
  currentAngle: number,
  outcomeIndex: number,
  weights: number[],
  minSpins = 5
): number {
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // Center of target sector
  let sectorStart = 0;
  for (let i = 0; i < outcomeIndex; i++) {
    sectorStart += (weights[i] / totalWeight) * Math.PI * 2;
  }
  const sectorSize = (weights[outcomeIndex] / totalWeight) * Math.PI * 2;
  const sectorCenter = sectorStart + sectorSize / 2;

  // The wheel stops when the pointer (top, -π/2) points to sectorCenter
  // So we need to rotate such that -π/2 - targetAngle ≡ sectorCenter (mod 2π)
  // targetAngle = -π/2 - sectorCenter
  const desiredStop = -Math.PI / 2 - sectorCenter;

  // Normalize and add multiple full spins
  const normalized = ((desiredStop % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const fullSpins = Math.PI * 2 * (minSpins + Math.floor(Math.random() * 3));
  return currentAngle + fullSpins + (normalized - (currentAngle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2);
}

// ─── Tests ────────────────────────────────────────────────────────────────────
// (Tests in separate logic.test.ts)
