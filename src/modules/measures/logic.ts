/**
 * Größen & Messen – reine Logik (testbar, kein DOM/Canvas)
 */

import { randomInt } from "@core/utils";

export const COIN_VALUES_CT = [1, 2, 5, 10, 20, 50, 100, 200] as const;
export type CoinCt = typeof COIN_VALUES_CT[number];

export interface UnitPair {
  fromUnit: string;
  toUnit: string;
  factor: number;
  label: string;
}

export const UNIT_PAIRS: UnitPair[] = [
  { fromUnit: "cm", toUnit: "m", factor: 100, label: "cm → m" },
  { fromUnit: "mm", toUnit: "cm", factor: 10, label: "mm → cm" },
  { fromUnit: "g", toUnit: "kg", factor: 1000, label: "g → kg" },
  { fromUnit: "ml", toUnit: "l", factor: 1000, label: "ml → l" },
  { fromUnit: "m", toUnit: "km", factor: 1000, label: "m → km" },
  { fromUnit: "min", toUnit: "h", factor: 60, label: "min → h" },
];

// ─── Difficulty-dependent data ──────────────────────────────────────────────

// Difficulty 1 (Einsteiger): ≤ 100 Cent (1 €)
const MONEY_TARGETS_CT_D1 = [5, 10, 20, 25, 45, 50, 75, 85, 99, 100] as const;
// Difficulty 2 (Fortgeschritten): bis 500 Cent (5 €)
const MONEY_TARGETS_CT_D2 = [
  5, 10, 20, 25, 45, 50, 75, 85, 99,
  100, 130, 150, 175, 200, 250, 260, 299, 350, 500,
] as const;

// Typische Kaufpreise für Wechselgeld-Aufgaben
const MONEY_PRICES_CT_D1 = [15, 25, 35, 45, 55, 65, 75, 85, 95, 99] as const;
const MONEY_PRICES_CT_D2 = [
  15, 25, 35, 45, 55, 65, 75, 85, 95, 99,
  105, 115, 125, 145, 155, 175, 195, 199,
  205, 225, 245, 275, 295, 299,
  305, 345, 395, 445, 495,
] as const;

// Runde "Zahler"-Beträge (Münzen/Scheine, die Kinder häufig verwenden)
const NICE_PAID_CT_D1 = [50, 100, 200] as const;
const NICE_PAID_CT_D2 = [50, 100, 200, 500, 1000] as const;

export type MoneyTaskType = "assemble" | "change";

export interface MoneyTaskData {
  taskType: MoneyTaskType;
  targetCents: number;   // zu erreichender Betrag (bei change: Wechselgeld)
  priceInCt: number;     // Kaufpreis (nur bei change relevant)
  paidInCt: number;      // gezahlter Betrag (nur bei change relevant)
}

export function coinLabel(ct: CoinCt): string {
  return ct < 100 ? `${ct}¢` : `${ct / 100}€`;
}

export function formatCents(ct: number): string {
  if (ct === 0) return "0,00 €";
  const euros = Math.floor(ct / 100);
  const cents = ct % 100;
  return `${euros},${String(cents).padStart(2, "0")} €`;
}

export function generateMoneyTask(difficulty = 1): MoneyTaskData {
  const targets = difficulty >= 3 ? MONEY_TARGETS_CT_D2 : MONEY_TARGETS_CT_D1;
  const prices = difficulty >= 3 ? MONEY_PRICES_CT_D2 : MONEY_PRICES_CT_D1;
  const nicePaid = difficulty >= 3 ? NICE_PAID_CT_D2 : NICE_PAID_CT_D1;

  // ~40 % Wechselgeld-Aufgaben (LehrplanPLUS Kl. 3: Wechselgeld berechnen)
  if (Math.random() < 0.4) {
    const price = prices[randomInt(0, prices.length - 1)];
    // Wähle den kleinsten "netten" Betrag, der größer als der Preis ist
    const paid = nicePaid.find((n) => n > price) ?? (difficulty >= 3 ? 1000 : 200);
    return {
      taskType: "change",
      targetCents: paid - price,
      priceInCt: price,
      paidInCt: paid,
    };
  }
  return {
    taskType: "assemble",
    targetCents: targets[randomInt(0, targets.length - 1)],
    priceInCt: 0,
    paidInCt: 0,
  };
}

export interface UnitsTaskResult {
  sourceValue: number;
  /** Ganze Einheiten (z.B. 1 für 1 m) */
  correctAnswer: number;
  /** Rest in der kleineren Einheit (0 bei glatter Aufgabe, z.B. 50 für 50 cm) */
  correctRemainder: number;
  /** true → gemischte Schreibweise (z.B. 1 m 50 cm) */
  isMixed: boolean;
}

export function generateUnitsTask(pairIndex: number, difficulty = 1): UnitsTaskResult {
  const pair = UNIT_PAIRS[pairIndex];
  const wholes = difficulty <= 1 ? randomInt(1, 5) : randomInt(1, 9);

  // Difficulty 1-2: whole numbers only (no remainder)
  if (difficulty <= 2) {
    return {
      sourceValue: wholes * pair.factor,
      correctAnswer: wholes,
      correctRemainder: 0,
      isMixed: false,
    };
  }

  // Difficulty 3 (BossBaby): ~50 % mixed with remainders (LehrplanPLUS Kl. 3/4: gemischte Schreibweise)
  if (Math.random() < 0.5) {
    const remainder = randomInt(1, pair.factor - 1);
    return {
      sourceValue: wholes * pair.factor + remainder,
      correctAnswer: wholes,
      correctRemainder: remainder,
      isMixed: true,
    };
  }
  return {
    sourceValue: wholes * pair.factor,
    correctAnswer: wholes,
    correctRemainder: 0,
    isMixed: false,
  };
}

export function applyCoin(total: number, coin: CoinCt): number {
  return total + coin;
}

export function undoCoinState(history: CoinCt[], totalCents: number): { history: CoinCt[]; totalCents: number } | null {
  const last = history[history.length - 1];
  if (last === undefined) return null;
  return {
    history: history.slice(0, -1),
    totalCents: totalCents - last,
  };
}

export function evaluateMoneyProgress(totalCents: number, targetCents: number): {
  result: "correct" | "over" | "incomplete";
  delta: number;
} {
  if (totalCents === targetCents) {
    return { result: "correct", delta: 0 };
  }
  if (totalCents > targetCents) {
    return { result: "over", delta: totalCents - targetCents };
  }
  return { result: "incomplete", delta: targetCents - totalCents };
}

export function parseUnitsAnswer(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isUnitsAnswerCorrect(answer: number, correctAnswer: number, tolerance = 0.001): boolean {
  return Math.abs(answer - correctAnswer) < tolerance;
}

// ─── Explanations ────────────────────────────────────────────────────────────

export function explainUnits(
  sourceValue: number,
  pair: UnitPair,
  correctAnswer: number,
  correctRemainder = 0
): string {
  if (correctRemainder > 0) {
    return `${sourceValue} ${pair.fromUnit} = ${correctAnswer} ${pair.toUnit} ${correctRemainder} ${pair.fromUnit}`;
  }
  return `${sourceValue} ${pair.fromUnit} ÷ ${pair.factor} = ${correctAnswer} ${pair.toUnit}`;
}
