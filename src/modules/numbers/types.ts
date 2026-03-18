/**
 * Zahlenlabor – Typen
 */

export type NumbersMode = "place" | "compare" | "jump";

export interface JumpEntry {
  from: number;
  to: number;
  delta: number;
  timestamp: number;
}

export interface NumbersTask {
  type: NumbersMode;
  /** Zielwert / Vergleichswert rechts (alle Modi) */
  target: number;
  /** Erste Zahl im Vergleich links (compare mode) */
  value?: number;
  /** Start (jump mode) */
  start?: number;
  /** Schrittweite der Aufgabe (jump mode: 1 | 10 | 100 | 1000 | 10000) */
  stepSize?: number;
  /** Anzahl Sprünge (jump mode) — das ist die gesuchte Antwort */
  steps?: number;
  /** Sprungrichtung: 1 = vorwärts, -1 = rückwärts */
  direction?: 1 | -1;
}

export interface BundleAnim {
  /** Welche Einheit wird gebündelt (Einer→Zehner, …, Zehntausender→Hunderttausender) */
  fromUnit: "ones" | "tens" | "hundreds" | "thousands" | "tenThousands";
  /** Pixel-Startpositionen der 10 animierten Blöcke */
  positions: { x: number; y: number }[];
  /** Zielposition (Mittelpunkt des neuen, größeren Blocks) */
  targetX: number;
  targetY: number;
  startTime: number;
  phase: 1 | 2;
}

export interface NumbersState {
  mode: NumbersMode;
  /** Aktuell angezeigte Zahl (0–999 999) */
  value: number;
  /** Vergleichswert für Compare-Modus */
  compareValue: number;
  /** Sprung-Verlauf (letzten 5 Sprünge) */
  jumpHistory: JumpEntry[];
  /** Aktuelle Aufgabe */
  task: NumbersTask | null;
  /** Läuft gerade eine Animation? */
  isAnimating: boolean;
  /** Gewählte Antwort im Compare-Modus */
  compareAnswer: "<" | "=" | ">" | null;
  /** Validierungsergebnis */
  lastResult: "correct" | "wrong" | null;
  /** Sprung-Animation */
  jumpAnimation: {
    from: number;
    to: number;
    delta: number;
    progress: number; // 0–1
  } | null;
  /** Bündelungs-Animation */
  bundleAnim: BundleAnim | null;
}

export interface DienesLayout {
  /** Koordinaten für jede Stelle */
  hundredThousands: { x: number; y: number; w: number; h: number };
  tenThousands: { x: number; y: number; w: number; h: number };
  thousands: { x: number; y: number; w: number; h: number };
  hundreds: { x: number; y: number; w: number; h: number };
  tens: { x: number; y: number; w: number; h: number };
  ones: { x: number; y: number; w: number; h: number };
}
