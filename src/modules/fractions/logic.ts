/**
 * Bruchlabor – Reine Logik (kein DOM/Canvas)
 * Brüche für Klasse 3/4: Darstellen, Vergleichen, Zahlenstrahl
 */

export type FractionsMode = "circle" | "bar" | "compare" | "numberline";

export interface Fraction {
  num: number;
  den: number;
}

// ─── Math helpers ──────────────────────────────────────────────────────────

export function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function fractionValue(f: Fraction): number {
  return f.num / f.den;
}

export function areEquivalent(a: Fraction, b: Fraction): boolean {
  return a.num * b.den === b.num * a.den;
}

export function compareResult(a: Fraction, b: Fraction): "<" | "=" | ">" {
  const d = a.num * b.den - b.num * a.den;
  if (d === 0) return "=";
  return d < 0 ? "<" : ">";
}

export function formatFraction(f: Fraction): string {
  return `${f.num}/${f.den}`;
}

/** Kette äquivalenter Brüche: 1/2 → 2/4 → 3/6 → … */
export function buildEquivalenceChain(f: Fraction, steps: number): Fraction[] {
  return Array.from({ length: steps }, (_, i) => ({
    num: f.num * (i + 1),
    den: f.den * (i + 1),
  }));
}

// ─── Task Pools ────────────────────────────────────────────────────────────

export interface CircleTask {
  fraction: Fraction;
}

export interface CompareTask {
  a: Fraction;
  b: Fraction;
  correct: "<" | "=" | ">";
}

export interface NumberLineTask {
  fraction: Fraction;
  /** 0–2 number line */
  max: 1 | 2;
}

const CIRCLE_POOL: Fraction[] = [
  { num: 1, den: 2 }, { num: 1, den: 4 }, { num: 3, den: 4 },
  { num: 1, den: 3 }, { num: 2, den: 3 }, { num: 1, den: 6 },
  { num: 5, den: 6 }, { num: 2, den: 5 }, { num: 3, den: 5 },
  { num: 1, den: 8 }, { num: 3, den: 8 }, { num: 5, den: 8 },
];

const COMPARE_POOL: CompareTask[] = [
  { a: { num: 1, den: 2 }, b: { num: 1, den: 4 }, correct: ">" },
  { a: { num: 1, den: 3 }, b: { num: 1, den: 2 }, correct: "<" },
  { a: { num: 2, den: 4 }, b: { num: 1, den: 2 }, correct: "=" },
  { a: { num: 2, den: 3 }, b: { num: 3, den: 4 }, correct: "<" },
  { a: { num: 3, den: 6 }, b: { num: 1, den: 2 }, correct: "=" },
  { a: { num: 3, den: 4 }, b: { num: 2, den: 3 }, correct: ">" },
  { a: { num: 2, den: 5 }, b: { num: 3, den: 10 }, correct: ">" },
  { a: { num: 1, den: 4 }, b: { num: 2, den: 8 }, correct: "=" },
  { a: { num: 5, den: 6 }, b: { num: 3, den: 4 }, correct: ">" },
  { a: { num: 1, den: 3 }, b: { num: 2, den: 6 }, correct: "=" },
];

const NUMBERLINE_POOL: NumberLineTask[] = [
  { fraction: { num: 1, den: 2 }, max: 1 },
  { fraction: { num: 1, den: 4 }, max: 1 },
  { fraction: { num: 3, den: 4 }, max: 1 },
  { fraction: { num: 1, den: 3 }, max: 1 },
  { fraction: { num: 2, den: 3 }, max: 1 },
  { fraction: { num: 3, den: 2 }, max: 2 },
  { fraction: { num: 5, den: 4 }, max: 2 },
  { fraction: { num: 7, den: 4 }, max: 2 },
  { fraction: { num: 4, den: 3 }, max: 2 },
];

function pickRandom<T>(pool: T[], exclude?: T): T {
  const available = pool.filter((x) => x !== exclude);
  const list = available.length > 0 ? available : pool;
  return list[Math.floor(Math.random() * list.length)]!;
}

/** Junior: denominators 2, 4. Checker: 2-6. BossBaby: all (2–12). */
const JUNIOR_DENS = new Set([2, 4]);
const CHECKER_DENS = new Set([2, 3, 4, 5, 6]);

function filterFractionByDifficulty(f: Fraction, difficulty: number): boolean {
  if (difficulty >= 3) return true;
  if (difficulty >= 2) return CHECKER_DENS.has(f.den);
  return JUNIOR_DENS.has(f.den);
}

function filterCirclePool(difficulty: number): Fraction[] {
  const filtered = CIRCLE_POOL.filter(f => filterFractionByDifficulty(f, difficulty));
  return filtered.length > 0 ? filtered : CIRCLE_POOL;
}

function filterComparePool(difficulty: number): CompareTask[] {
  const filtered = COMPARE_POOL.filter(t =>
    filterFractionByDifficulty(t.a, difficulty) && filterFractionByDifficulty(t.b, difficulty),
  );
  return filtered.length > 0 ? filtered : COMPARE_POOL;
}

function filterNumberLinePool(difficulty: number): NumberLineTask[] {
  const filtered = NUMBERLINE_POOL.filter(t => filterFractionByDifficulty(t.fraction, difficulty));
  return filtered.length > 0 ? filtered : NUMBERLINE_POOL;
}

export function generateCircleTask(exclude?: CircleTask, difficulty = 1): CircleTask {
  const pool = filterCirclePool(difficulty);
  const f = pickRandom(pool, exclude?.fraction);
  return { fraction: f };
}

export function generateCompareTask(exclude?: CompareTask, difficulty = 1): CompareTask {
  const pool = filterComparePool(difficulty);
  return pickRandom(pool, exclude);
}

export function generateNumberLineTask(exclude?: NumberLineTask, difficulty = 1): NumberLineTask {
  const pool = filterNumberLinePool(difficulty);
  return pickRandom(pool, exclude);
}

/** Überprüft Zahlenstrahlantwort: Toleranz ±0.07 */
export function checkNumberLineAnswer(task: NumberLineTask, tappedValue: number): boolean {
  const target = fractionValue(task.fraction);
  return Math.abs(tappedValue - target) <= 0.07;
}

/** Überprüft Vergleichsantwort */
export function checkCompareAnswer(task: CompareTask, answer: "<" | "=" | ">"): boolean {
  return answer === task.correct;
}

// ─── Procedural Generation ──────────────────────────────────────────────────

const JUNIOR_DENOMINATORS = [2, 4] as const;
const EASY_DENOMINATORS = [2, 3, 4, 5, 6] as const;
const ADVANCED_DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12] as const;

/** Generates a random proper fraction based on difficulty level.
 *  Difficulty 1 (Junior): denominators 2, 4
 *  Difficulty 2 (Checker): denominators 2-6
 *  Difficulty 3 (BossBaby): denominators 2-12
 */
export function generateProceduralFraction(difficulty: number): { numerator: number; denominator: number } {
  const pool = difficulty >= 3 ? ADVANCED_DENOMINATORS : difficulty >= 2 ? EASY_DENOMINATORS : JUNIOR_DENOMINATORS;
  const denominator = pool[Math.floor(Math.random() * pool.length)]!;
  const numerator = Math.floor(Math.random() * (denominator - 1)) + 1; // 1 to (den-1)
  return { numerator, denominator };
}

/** Generates two different fractions for comparison, guarantees they are not equal.
 *  Returns { left: {num, den}, right: {num, den} }
 */
export function generateProceduralComparison(difficulty: number): {
  left: { num: number; den: number };
  right: { num: number; den: number };
} {
  const a = generateProceduralFraction(difficulty);
  let b = generateProceduralFraction(difficulty);

  // Retry until we get a pair that is not equivalent (a/b != c/d iff a*d != c*b)
  let attempts = 0;
  while (a.numerator * b.denominator === b.numerator * a.denominator && attempts < 20) {
    b = generateProceduralFraction(difficulty);
    attempts++;
  }

  return {
    left: { num: a.numerator, den: a.denominator },
    right: { num: b.numerator, den: b.denominator },
  };
}

/** Bruchname auf Deutsch */
export function fractionName(f: Fraction): string {
  const names: Record<number, string> = {
    2: "Hälften", 3: "Drittel", 4: "Viertel",
    5: "Fünftel", 6: "Sechstel", 8: "Achtel",
  };
  const partName = names[f.den] ?? `${f.den}tel`;
  return `${f.num} ${partName}`;
}
