/**
 * Zahlenlabor – Logik (rein funktional, testbar)
 */

import { clamp, randomInt } from "@core/utils";
import type { NumbersState, NumbersTask, JumpEntry } from "./types";

// ─── Constraints ─────────────────────────────────────────────────────────────

export const MIN_VALUE = 0;
export const MAX_VALUE = 999999; // Bayern Kl. 3 → 100.000, Kl. 4 → 1.000.000
export const MAX_JUMP_HISTORY = 5;

// ─── Place Values ─────────────────────────────────────────────────────────────

export interface PlaceValues {
  hundredThousands: number; // Hunderttausender (100 000er)
  tenThousands: number;     // Zehntausender   (10 000er)
  thousands: number;        // Tausender        (1 000er)
  hundreds: number;         // Hunderter          (100er)
  tens: number;             // Zehner              (10er)
  ones: number;             // Einer                (1er)
}

export function getPlaceValues(n: number): PlaceValues {
  const v = Math.max(0, Math.min(MAX_VALUE, Math.floor(n)));
  return {
    hundredThousands: Math.floor(v / 100000),
    tenThousands: Math.floor((v % 100000) / 10000),
    thousands: Math.floor((v % 10000) / 1000),
    hundreds: Math.floor((v % 1000) / 100),
    tens: Math.floor((v % 100) / 10),
    ones: v % 10,
  };
}

export function placeValueName(place: keyof PlaceValues): string {
  const names: Record<keyof PlaceValues, string> = {
    hundredThousands: "Hunderttausender",
    tenThousands: "Zehntausender",
    thousands: "Tausender",
    hundreds: "Hunderter",
    tens: "Zehner",
    ones: "Einer",
  };
  return names[place];
}

// ─── Compare ──────────────────────────────────────────────────────────────────

export type CompareResult = "<" | "=" | ">";

export function compareNumbers(a: number, b: number): CompareResult {
  if (a < b) return "<";
  if (a > b) return ">";
  return "=";
}

export function checkCompare(
  answer: "<" | "=" | ">",
  a: number,
  b: number
): boolean {
  return answer === compareNumbers(a, b);
}

// ─── Jump / Steps ─────────────────────────────────────────────────────────────

export function applyJump(value: number, delta: number): number {
  return clamp(value + delta, MIN_VALUE, MAX_VALUE);
}

export function recordJump(
  history: JumpEntry[],
  from: number,
  to: number,
  delta: number
): JumpEntry[] {
  const entry: JumpEntry = { from, to, delta, timestamp: Date.now() };
  const next = [...history, entry];
  // Keep only last N jumps
  return next.slice(-MAX_JUMP_HISTORY);
}

export function undoLastJump(
  history: JumpEntry[]
): { value: number; history: JumpEntry[] } | null {
  const last = history[history.length - 1];
  if (!last) return null;
  return {
    value: last.from,
    history: history.slice(0, -1),
  };
}

export function stepsToTarget(from: number, target: number): number {
  return target - from;
}

export function isAtTarget(state: NumbersState): boolean {
  if (!state.task || state.task.type !== "jump") return false;
  return state.value === state.task.target;
}

// ─── Task Generation ──────────────────────────────────────────────────────────

export function generatePlaceTask(difficulty = 2): NumbersTask {
  // D1 (Junior): ZR 10–99 (2-stellig, Klasse 1-2)
  // D2 (Checker): ZR 100–999 (3-stellig, Klasse 3 Einstieg)
  // D3 (BossBaby): ZR 1.000–999.999 (4-6-stellig, Klasse 3-4 Kern)
  const min = difficulty === 1 ? 10 : difficulty === 2 ? 100 : 1000;
  const max = difficulty === 1 ? 99 : difficulty === 2 ? 999 : MAX_VALUE;
  return {
    type: "place",
    target: randomInt(min, max),
  };
}

export function generateCompareTask(difficulty = 2): NumbersTask {
  // D1 (Junior): ZR 10–99 (2-stellig, Kl. 1-2)
  // D2 (Checker): ZR 100–999 (3-stellig, Kl. 3)
  // D3 (BossBaby): ZR bis 999.999 (Kl. 4)
  const max = difficulty === 1 ? 99 : difficulty === 2 ? 999 : MAX_VALUE;
  const a = randomInt(0, max);
  let b = randomInt(0, max);
  // ~25% chance of equal values for balanced practice
  if (Math.random() < 0.25) b = a;
  return {
    type: "compare",
    value: a, // linke Zahl des Vergleichs
    target: b, // rechte Zahl des Vergleichs
  };
}

export function generateJumpTask(difficulty = 2): NumbersTask {
  const jumpSteps = difficulty === 1
    ? [1, 2, 5, 10]                      // Junior: bis 99
    : difficulty === 2
      ? [1, 10, 100]                     // Checker: bis 1.000
      : [1, 10, 100, 1000, 10000];       // BossBaby: bis 1.000.000
  const max = difficulty === 1 ? 99 : difficulty === 2 ? 999 : MAX_VALUE;
  const stepSize = jumpSteps[randomInt(0, jumpSteps.length - 1)]!;
  const steps = randomInt(2, 8);
  const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  // Choose start so both directions stay within [0, max]
  const margin = steps * stepSize;
  // Align start to stepSize for cleaner number line
  const rawStart = direction > 0
    ? randomInt(0, max - margin)
    : randomInt(margin, max);
  const start = Math.round(rawStart / stepSize) * stepSize;
  const target = clamp(start + direction * steps * stepSize, 0, max);
  return {
    type: "jump",
    start,
    target,
    stepSize,
    steps,
    direction,
  };
}

// ─── Number Line Helpers ──────────────────────────────────────────────────────

export interface NumberLineRange {
  min: number;
  max: number;
  step: number;
}

/**
 * Berechnet sinnvollen Zahlenstrahl-Bereich für gegebene Werte.
 * stepHint: wenn angegeben (z.B. Schrittweite der Aufgabe), wird dieser Wert
 * als Teilstrich-Abstand verwendet, damit die Sprunglandepunkte auf Strichen liegen.
 */
export function computeNumberLineRange(
  values: number[],
  preferredStepCount = 10,
  stepHint?: number
): NumberLineRange {
  if (values.length === 0) return { min: 0, max: 100, step: 10 };

  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const span = mx - mn || 100;

  let step: number;

  if (stepHint && stepHint >= 1) {
    // Use the task's step size directly so tick marks align with jump positions
    step = stepHint;
  } else {
    const rawStep = span / preferredStepCount;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const niceSteps = [1, 2, 5, 10];
    step = magnitude;
    for (const ns of niceSteps) {
      if (rawStep <= ns * magnitude) {
        step = ns * magnitude;
        break;
      }
    }
    step = Math.max(1, step);
  }

  const padding = step * 2;
  const min = Math.max(0, Math.floor((mn - padding) / step) * step);
  const max = Math.min(MAX_VALUE, Math.ceil((mx + padding) / step) * step);

  return { min, max, step };
}
