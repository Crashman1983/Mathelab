/**
 * Muster & Strukturen – Reine Logik (kein DOM/Canvas)
 * Muster, Folgen, Funktionsmaschine Klasse 3/4
 */

export type PatternMode = "sequence" | "machine" | "figuren";

// ─── Zahlenfolge ────────────────────────────────────────────────────────────

export interface SequenceTask {
  /** Vollständige Folge (5 Glieder) */
  full: number[];
  /** Index des versteckten Glieds (1–3) */
  hiddenIndex: number;
  /** Angezeigte Folge (-1 = versteckt) */
  display: number[];
  /** Beschreibung der Regel */
  ruleLabel: string;
  answer: number;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateSequenceTask(exclude?: SequenceTask, difficulty: number = 2): SequenceTask {
  // Difficulty 1 (Junior): very simple +1, +2 patterns with tiny steps
  // Difficulty 2 (Checker): simple +n patterns with small steps (2–8)
  // Difficulty 3 (BossBaby): all pattern types including ×2, larger steps (3–20)
  const maxType = difficulty <= 1 ? 0 : difficulty === 2 ? 1 : 4;
  const type = randInt(0, maxType);
  let full: number[];
  let ruleLabel: string;

  switch (type) {
    case 0: { // +n
      const step = difficulty <= 1 ? randInt(1, 3) : difficulty === 2 ? randInt(2, 8) : randInt(3, 20);
      const start = difficulty <= 1 ? randInt(1, 10) : difficulty === 2 ? randInt(2, 20) : randInt(5, 50);
      full = [start, start + step, start + 2 * step, start + 3 * step, start + 4 * step];
      ruleLabel = `+${step}`;
      break;
    }
    case 1: { // -n
      const step = difficulty === 2 ? randInt(2, 8) : randInt(2, 15);
      const start = difficulty === 2 ? randInt(30, 60) : randInt(50, 120);
      full = [start, start - step, start - 2 * step, start - 3 * step, start - 4 * step];
      ruleLabel = `−${step}`;
      break;
    }
    case 2: { // ×2
      const start = randInt(1, 8);
      full = [start, start * 2, start * 4, start * 8, start * 16];
      ruleLabel = "×2";
      break;
    }
    case 3: { // Wachsende Differenzen (+3, +5, +7, …)
      const offset = randInt(1, 5);
      full = [offset, offset + 3, offset + 8, offset + 15, offset + 24];
      ruleLabel = "+3, +5, +7, …";
      break;
    }
    default: { // +n (growing)
      const step = randInt(5, 25);
      const start = randInt(2, 30);
      full = [start, start + step, start + 2 * step, start + 3 * step, start + 4 * step];
      ruleLabel = `+${step}`;
    }
  }

  const hiddenIndex = randInt(1, 3);
  const display = full.map((v, i) => (i === hiddenIndex ? -1 : v));
  const answer = full[hiddenIndex]!;

  if (exclude && exclude.answer === answer) {
    return generateSequenceTask(undefined, difficulty);
  }

  return { full, hiddenIndex, display, ruleLabel, answer };
}

// ─── Funktionsmaschine ──────────────────────────────────────────────────────

export type RuleType = "add" | "sub" | "mul" | "double" | "half";

export interface MachineTask {
  rule: RuleType;
  ruleValue: number;
  /** Beispiel-Paare (input → output) */
  examples: Array<{ input: number; output: number }>;
  /** Das zu berechnende Input */
  hiddenInput: number;
  answer: number;
}

export function applyRule(rule: RuleType, value: number, n: number): number {
  switch (rule) {
    case "add": return value + n;
    case "sub": return value - n;
    case "mul": return value * n;
    case "double": return value * 2;
    case "half": return Math.floor(value / 2);
  }
}

export function getRuleLabel(rule: RuleType, n: number): string {
  switch (rule) {
    case "add": return `+${n}`;
    case "sub": return `−${n}`;
    case "mul": return `×${n}`;
    case "double": return "×2";
    case "half": return "÷2";
  }
}

export function generateMachineTask(exclude?: MachineTask, difficulty: number = 2): MachineTask {
  // Difficulty 1 (Junior): very simple add rules, tiny inputs (1–5)
  // Difficulty 2 (Checker): simple add/double rules, small inputs (1–10)
  // Difficulty 3 (BossBaby): all rule types including mul, larger inputs (3–15)
  const rules: RuleType[] = difficulty <= 1
    ? ["add", "add"]
    : difficulty === 2
      ? ["add", "add", "double"]
      : ["add", "add", "sub", "mul", "mul", "double"];
  const rule = rules[randInt(0, rules.length - 1)]!;
  const n = rule === "mul" ? randInt(2, 8)
    : rule === "add" ? (difficulty <= 1 ? randInt(1, 5) : difficulty === 2 ? randInt(2, 10) : randInt(5, 25))
    : rule === "sub" ? randInt(3, 20)
    : 2;

  const inputMin = difficulty <= 1 ? 1 : difficulty === 2 ? 1 : 3;
  const inputMax = difficulty <= 1 ? 5 : difficulty === 2 ? 10 : 15;
  const inputs = [randInt(inputMin, inputMax), randInt(inputMin, inputMax), randInt(inputMin, inputMax)];
  const examples = inputs.map((inp) => ({
    input: inp,
    output: applyRule(rule, inp, n),
  }));

  const hiddenInput = difficulty <= 1 ? randInt(1, 5) : difficulty === 2 ? randInt(1, 10) : randInt(3, 15);
  const answer = applyRule(rule, hiddenInput, n);

  if (exclude && exclude.answer === answer) {
    return generateMachineTask(undefined, difficulty);
  }

  return { rule, ruleValue: n, examples, hiddenInput, answer };
}

// ─── Figurenfolge ───────────────────────────────────────────────────────────

export type FigurePattern = "square" | "triangle" | "plus" | "staircase";

export interface FigureTask {
  pattern: FigurePattern;
  /** Schritte die gezeigt werden (Index 0 = Schritt 1) */
  shownSteps: number;
  /** Anzahl Punkte an jedem gezeigten Schritt */
  counts: number[];
  /** Antwort: Anzahl beim nächsten Schritt */
  answer: number;
  /** Nächster Schritt = shownSteps+1 */
  nextStep: number;
}

function getCount(pattern: FigurePattern, step: number): number {
  switch (pattern) {
    case "square": return step * step;
    case "triangle": return (step * (step + 1)) / 2;
    case "plus": return step === 1 ? 1 : 1 + 4 * (step - 1);
    case "staircase": return (step * (step + 1)) / 2;
  }
}

export function generateFigureTask(): FigureTask {
  const patterns: FigurePattern[] = ["square", "triangle", "plus", "staircase"];
  const pattern = patterns[randInt(0, 3)]!;
  const shownSteps = randInt(2, 4);

  const counts = Array.from({ length: shownSteps }, (_, i) => getCount(pattern, i + 1));
  const answer = getCount(pattern, shownSteps + 1);

  return { pattern, shownSteps, counts, answer, nextStep: shownSteps + 1 };
}

/** Gibt Punktpositionen für einen Figurenschritt zurück */
export function getFigurePoints(
  pattern: FigurePattern,
  step: number
): Array<{ row: number; col: number }> {
  const pts: Array<{ row: number; col: number }> = [];
  switch (pattern) {
    case "square":
      for (let r = 0; r < step; r++)
        for (let c = 0; c < step; c++)
          pts.push({ row: r, col: c });
      break;
    case "triangle":
      for (let r = 0; r < step; r++)
        for (let c = 0; c <= r; c++)
          pts.push({ row: r, col: c });
      break;
    case "staircase":
      // Treppe: Spalte c hat (step - c) Punkte von unten — visuell unterschiedlich von Dreieck
      for (let c = 0; c < step; c++)
        for (let r = 0; r < step - c; r++)
          pts.push({ row: r, col: c });
      break;
    case "plus":
      pts.push({ row: 0, col: 0 }); // center
      for (let i = 1; i < step; i++) {
        pts.push({ row: -i, col: 0 });
        pts.push({ row: i, col: 0 });
        pts.push({ row: 0, col: -i });
        pts.push({ row: 0, col: i });
      }
      break;
  }
  return pts;
}

export function checkSequenceAnswer(task: SequenceTask, answer: number): boolean {
  return answer === task.answer;
}

export function checkMachineAnswer(task: MachineTask, answer: number): boolean {
  return answer === task.answer;
}

export function checkFigureAnswer(task: FigureTask, answer: number): boolean {
  return answer === task.answer;
}
