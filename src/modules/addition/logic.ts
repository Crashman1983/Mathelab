/**
 * Addition – Reine Logik (kein DOM/Canvas)
 * Addition auf dem Zahlenstrahl: Frosch springt nach vorne.
 * Klasse 3/4 (Zahlenraum bis 1000)
 */

export type AddMode = "numberline" | "decompose" | "written";

export interface AddTask {
  a: number; // erster Summand
  b: number; // zweiter Summand
  mode: AddMode;
  /** Zerlege b in zwei Schritte (für Übergänge) */
  step1?: number;
  step2?: number;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Erzeugt eine passende Addition abhängig von Schwierigkeit (1–3) */
export function generateTask(
  mode: AddMode,
  difficulty: number = 1,
  exclude?: AddTask
): AddTask {
  let a: number, b: number;

  if (difficulty === 1) {
    // Junior: Zahlenraum bis 20 (Klasse 1-2)
    a = randInt(1, 10);
    b = randInt(1, 20 - a);
  } else if (difficulty === 2) {
    // Checker: Zahlenraum bis 200 (Klasse 3 – Kopfrechnen)
    a = randInt(10, 100);
    b = randInt(5, Math.min(100, 200 - a));
  } else {
    // BossBaby: Zahlenraum bis 1000 (Klasse 4 – Kopfrechnen)
    a = randInt(50, 500);
    b = randInt(20, Math.min(500, 1000 - a));
  }

  // Vermeide gleiche Aufgabe zweimal
  if (exclude && exclude.a === a && exclude.b === b) {
    return generateTask(mode, difficulty, undefined);
  }

  // Stellenwertzerlegung (LehrplanPLUS): Zerlege b nach höchster Stelle + Rest
  // z.B. 289 → 200 + 89, 37 → 30 + 7
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

export function getSum(t: AddTask): number {
  return t.a + t.b;
}

export function checkAnswer(t: AddTask, answer: number): boolean {
  return answer === getSum(t);
}

/**
 * Alle Sprungpositionen auf dem Zahlenstrahl.
 * Für mode "numberline": a → (a+step1) → (a+step1+step2)
 * Für einfache Aufgaben: nur a → (a+b)
 */
export function getJumpPositions(t: AddTask): number[] {
  if (t.step1 && t.step2 && t.step1 > 0 && t.step2 > 0) {
    return [t.a, t.a + t.step1, getSum(t)];
  }
  return [t.a, getSum(t)];
}

export function getNumberLineRange(t: AddTask): { min: number; max: number } {
  const sum = getSum(t);
  // Etwas Platz links und rechts lassen
  const padding = Math.ceil(sum * 0.1);
  return { min: Math.max(0, t.a - padding), max: sum + padding };
}

export function getHints(t: AddTask): string[] {
  const sum = getSum(t);
  return [
    `Starte bei ${t.a} und mach ${t.b} Schritte nach vorne.`,
    `${t.a} + ${t.b}: Zerlege ${t.b} in ${t.step1} und ${t.step2 ?? 0}.`,
    `${t.a} + ${t.b} = ${sum}.`,
    `Die Summe ist eine Zahl zwischen ${sum - 5} und ${sum + 5}. Rechne: ${t.a} + ${t.step1 ?? t.b} = ${t.a + (t.step1 ?? t.b)}, dann noch +${t.step2 ?? 0} = ...`,
  ];
}
