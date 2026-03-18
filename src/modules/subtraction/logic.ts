/**
 * Subtraktion – Reine Logik (kein DOM/Canvas)
 * Subtraktion auf dem Zahlenstrahl: Taucher schwimmt zurück.
 * Klasse 3/4 (Zahlenraum bis 1000)
 */

export type SubMode = "numberline" | "decompose" | "written";

export interface SubTask {
  a: number; // Minuend
  b: number; // Subtrahend
  mode: SubMode;
  /** Zerlege b in zwei Schritte (z.B. zum Zehner zurück, dann Rest) */
  step1?: number;
  step2?: number;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Erzeugt eine passende Subtraktion abhängig von Schwierigkeit (1–3) */
export function generateTask(
  mode: SubMode,
  difficulty: number = 1,
  exclude?: SubTask
): SubTask {
  let a: number, b: number;

  if (difficulty === 1) {
    // Junior: Zahlenraum bis 20 (Klasse 1-2)
    a = randInt(5, 20);
    b = randInt(1, Math.min(a - 1, 10));
  } else if (difficulty === 2) {
    // Checker: Zahlenraum bis 100 (Klasse 3)
    a = randInt(20, 100);
    b = randInt(5, Math.min(a - 1, 80));
  } else {
    // BossBaby: Zahlenraum bis 1000 (Klasse 4)
    a = randInt(100, 1000);
    b = randInt(20, Math.min(a - 10, 500));
  }

  // Vermeide gleiche Aufgabe zweimal
  if (exclude && exclude.a === a && exclude.b === b) {
    return generateTask(mode, difficulty, undefined);
  }

  // Stellenwertzerlegung (LehrplanPLUS): Zerlege b nach höchster Stelle + Rest
  // z.B. 237 → 200 + 37, 45 → 40 + 5
  let step1: number;
  let step2: number;
  if (b >= 100) {
    step1 = Math.floor(b / 100) * 100; // Hunderter
    step2 = b - step1;
  } else if (b >= 10) {
    step1 = Math.floor(b / 10) * 10;   // Zehner
    step2 = b - step1;
  } else {
    step1 = b;
    step2 = 0;
  }

  return { a, b, mode, step1: step1 > 0 ? step1 : b, step2: step2 > 0 ? step2 : 0 };
}

export function getDifference(t: SubTask): number {
  return t.a - t.b;
}

export function checkAnswer(t: SubTask, answer: number): boolean {
  return answer === getDifference(t);
}

/**
 * Alle Positionen auf dem Zahlenstrahl (rückwärts).
 * Von a zurück um step1, dann nochmal um step2.
 */
export function getJumpPositions(t: SubTask): number[] {
  if (t.step1 && t.step2 && t.step1 > 0 && t.step2 > 0) {
    return [t.a, t.a - t.step1, getDifference(t)];
  }
  return [t.a, getDifference(t)];
}

export function getNumberLineRange(t: SubTask): { min: number; max: number } {
  const diff = getDifference(t);
  const padding = Math.ceil(t.a * 0.1);
  return { min: Math.max(0, diff - padding), max: t.a + padding };
}

export function getHints(t: SubTask): string[] {
  const diff = getDifference(t);
  return [
    `Starte bei ${t.a} und geh ${t.b} Schritte zurück.`,
    `${t.a} − ${t.b}: Zerlege ${t.b} in ${t.step1} und ${t.step2 ?? 0}.`,
    `${t.a} − ${t.b} = ${diff}.`,
    `Rechne: ${t.a} − ${t.step1 ?? t.b} = ${t.a - (t.step1 ?? t.b)}, dann noch −${t.step2 ?? 0} = ...`,
  ];
}
