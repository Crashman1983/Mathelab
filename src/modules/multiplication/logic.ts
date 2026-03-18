/**
 * Einmaleins-Maschine – Reine Logik (kein DOM/Canvas)
 * Multiplikation & Division Klasse 3/4
 */

export type MultiMode = "dot" | "jumps" | "divide";

export interface MultiTask {
  a: number; // Faktor 1 (Zeilen)
  b: number; // Faktor 2 (Spalten)
  mode: MultiMode;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateTask(mode: MultiMode, exclude?: MultiTask, difficulty: number = 2): MultiTask {
  // Difficulty 1 (Junior): kleines Einmaleins 2–5
  // Difficulty 2 (Checker): großes Einmaleins 2–10
  // Difficulty 3 (BossBaby): erweitertes Einmaleins 2–12
  const max = difficulty <= 1 ? 5 : difficulty === 2 ? 10 : 12;
  const a = randInt(2, max);
  const b = randInt(2, max);
  const task: MultiTask = { a, b, mode };
  // Avoid same task twice
  if (exclude && exclude.a === a && exclude.b === b) {
    return generateTask(mode, undefined, difficulty);
  }
  return task;
}

export function getProduct(t: MultiTask): number {
  return t.a * t.b;
}

/** Für Division: Aufgabe ist (a*b) ÷ a = ? */
export function getDividend(t: MultiTask): number {
  return t.a * t.b;
}

export function checkAnswer(t: MultiTask, answer: number): boolean {
  return answer === getProduct(t);
}

export function checkDivisionAnswer(t: MultiTask, answer: number): boolean {
  return answer === t.b;
}

/** Gibt alle Sprungpositionen für Multiplikation als Vielfache zurück */
export function getJumpPositions(t: MultiTask): number[] {
  const positions: number[] = [0];
  for (let i = 1; i <= t.a; i++) {
    positions.push(i * t.b);
  }
  return positions;
}

/** Gibt an, ab welchem Punkt der Zahlenstrahl beginnt/endet */
export function getNumberLineRange(t: MultiTask): { min: number; max: number } {
  return { min: 0, max: t.a * t.b };
}

/** Erzeugt das Punktfeld als 2D-Array: rows=a, cols=b */
export function buildDotField(a: number, b: number): boolean[][] {
  return Array.from({ length: a }, () => Array(b).fill(true));
}

/** Überprüft ob ein Punkt im Feld hervorgehoben werden soll (für Animation) */
export function isHighlighted(row: number, _col: number, revealedRows: number): boolean {
  return row < revealedRows;
}

/** Gibt den Tauschgesetz-Hint zurück */
export function commutativeHint(t: MultiTask): string {
  return `${t.a} × ${t.b} = ${t.b} × ${t.a} = ${t.a * t.b}`;
}
