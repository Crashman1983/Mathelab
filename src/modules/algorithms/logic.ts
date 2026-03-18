/**
 * Schriftliches Rechnen – Reine Logik (kein DOM/Canvas)
 * Addition, Subtraktion, Multiplikation, Division Klasse 3/4
 */

export type AlgoMode = "addition" | "subtraction" | "multiplication" | "division";

export interface AlgoTask {
  mode: AlgoMode;
  a: number;       // Dividend (Division) / erster Operand
  b: number;       // Divisor (Division) / zweiter Operand
  answer: number;  // Quotient (Division) / Ergebnis
  remainder?: number; // Rest (nur Division)
}

/** Ein Schritt in der Spaltenrechnung */
export interface ColumnStep {
  colIndex: number;   // 0 = Einer, 1 = Zehner, …
  digitA: number;
  digitB: number;
  carryIn: number;    // Übertrag rein
  result: number;     // Ziffernergebnis an dieser Stelle
  carryOut: number;   // Übertrag weiter
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateTask(mode: AlgoMode, difficulty: number = 2): AlgoTask {
  switch (mode) {
    case "addition": {
      if (difficulty === 1) {
        // Junior: 1-digit + 1-digit
        const a = randInt(2, 9);
        const b = randInt(2, 9);
        return { mode, a, b, answer: a + b };
      }
      if (difficulty === 2) {
        // Checker: 2-digit + 2-digit
        const a = randInt(10, 99);
        const b = randInt(10, 99);
        return { mode, a, b, answer: a + b };
      }
      // BossBaby: 3-digit + 3-digit
      const a = randInt(100, 999);
      const b = randInt(100, 999);
      return { mode, a, b, answer: a + b };
    }
    case "subtraction": {
      if (difficulty === 1) {
        // Junior: 1-digit - 1-digit (a > b)
        const a = randInt(5, 9);
        const b = randInt(2, a - 1);
        return { mode, a, b, answer: a - b };
      }
      if (difficulty === 2) {
        // Checker: 2-digit - 2-digit (a > b)
        const a = randInt(20, 99);
        const b = randInt(10, a - 1);
        return { mode, a, b, answer: a - b };
      }
      // BossBaby: 3-digit - 3-digit
      const a = randInt(200, 999);
      const b = randInt(100, a - 1);
      return { mode, a, b, answer: a - b };
    }
    case "multiplication": {
      if (difficulty === 1) {
        // Junior: 1-digit × 1-digit
        const a = randInt(2, 9);
        const b = randInt(2, 9);
        return { mode, a, b, answer: a * b };
      }
      if (difficulty === 2) {
        // Checker: 2-digit × 1-digit
        const a = randInt(12, 50);
        const b = randInt(2, 5);
        return { mode, a, b, answer: a * b };
      }
      // BossBaby: 3-digit × 1-digit
      const a = randInt(100, 999);
      const b = randInt(2, 9);
      return { mode, a, b, answer: a * b };
    }
    case "division": {
      if (difficulty === 1) {
        // Junior: 1-digit ÷ 1-digit, no remainder
        const b = randInt(2, 9);
        const quotient = randInt(2, 9);
        const a = quotient * b;
        return { mode, a, b, answer: quotient, remainder: 0 };
      }
      if (difficulty === 2) {
        // Checker: 2-digit ÷ 1-digit, no remainder
        const b = randInt(2, 5);
        const quotient = randInt(10, 30);
        const a = quotient * b;
        return { mode, a, b, answer: quotient, remainder: 0 };
      }
      // BossBaby: 3-digit ÷ 1-digit, with possible remainder
      const b = randInt(2, 10);
      const quotient = randInt(10, 99);
      const remainder = randInt(0, b - 1);
      const a = quotient * b + remainder;
      return { mode, a, b, answer: quotient, remainder };
    }
  }
}

/** Gibt die Ziffern einer Zahl als Array zurück (Index 0 = Einer) */
export function getDigits(n: number, places: number): number[] {
  const digits: number[] = [];
  for (let i = 0; i < places; i++) {
    digits.push(Math.floor(n / Math.pow(10, i)) % 10);
  }
  return digits;
}

export function numPlaces(n: number): number {
  if (n === 0) return 1;
  return Math.floor(Math.log10(Math.abs(n))) + 1;
}

export function computeAdditionSteps(a: number, b: number): ColumnStep[] {
  const places = Math.max(numPlaces(a), numPlaces(b)) + 1;
  const da = getDigits(a, places);
  const db = getDigits(b, places);
  const steps: ColumnStep[] = [];
  let carry = 0;
  for (let i = 0; i < places; i++) {
    const sum = da[i]! + db[i]! + carry;
    const result = sum % 10;
    const newCarry = Math.floor(sum / 10);
    steps.push({ colIndex: i, digitA: da[i]!, digitB: db[i]!, carryIn: carry, result, carryOut: newCarry });
    carry = newCarry;
  }
  // Drop leading zero steps
  while (steps.length > 1 && steps[steps.length - 1]!.result === 0 && steps[steps.length - 1]!.carryOut === 0) {
    steps.pop();
  }
  return steps;
}

export function computeSubtractionSteps(a: number, b: number): ColumnStep[] {
  const places = Math.max(numPlaces(a), numPlaces(b));
  const da = getDigits(a, places);
  const db = getDigits(b, places);
  const steps: ColumnStep[] = [];
  let borrow = 0;
  for (let i = 0; i < places; i++) {
    let diff = da[i]! - db[i]! - borrow;
    let newBorrow = 0;
    if (diff < 0) { diff += 10; newBorrow = 1; }
    steps.push({ colIndex: i, digitA: da[i]!, digitB: db[i]!, carryIn: borrow, result: diff, carryOut: newBorrow });
    borrow = newBorrow;
  }
  while (steps.length > 1 && steps[steps.length - 1]!.result === 0) {
    steps.pop();
  }
  return steps;
}

export function computeMultiplicationSteps(a: number, b: number): ColumnStep[] {
  // b ist einstellig
  const places = numPlaces(a) + 1;
  const da = getDigits(a, places);
  const steps: ColumnStep[] = [];
  let carry = 0;
  for (let i = 0; i < places; i++) {
    const prod = da[i]! * b + carry;
    const result = prod % 10;
    const newCarry = Math.floor(prod / 10);
    steps.push({ colIndex: i, digitA: da[i]!, digitB: b, carryIn: carry, result, carryOut: newCarry });
    carry = newCarry;
  }
  while (steps.length > 1 && steps[steps.length - 1]!.result === 0) {
    steps.pop();
  }
  return steps;
}

// ─── Division Steps ──────────────────────────────────────────────────────────

/** Ein Schritt der schriftlichen Division (von links nach rechts) */
export interface DivisionStep {
  /** Position der Quotient-Ziffer (0 = linkeste Stelle) */
  position: number;
  /** Aktueller "herunterholter" Wert, der geteilt wird */
  currentValue: number;
  /** Ergebnisziffer an dieser Stelle */
  quotientDigit: number;
  /** Zwischenprodukt (quotientDigit × divisor) */
  product: number;
  /** Rest nach Subtraktion */
  remainder: number;
}

/**
 * Berechnet die Einzelschritte der schriftlichen Division.
 * Dividend ÷ Divisor = Quotient Rest remainder
 *
 * Algorithmus (wie im Schulbuch):
 * 1. Nimm so viele Ziffern von links, bis die Zahl ≥ Divisor ist
 * 2. Teile, schreibe Quotient-Ziffer
 * 3. Subtrahiere Produkt, hole nächste Ziffer herunter
 * 4. Wiederhole bis alle Ziffern verarbeitet
 */
export function computeDivisionSteps(dividend: number, divisor: number): DivisionStep[] {
  const digits = String(dividend).split("").map(Number);
  const steps: DivisionStep[] = [];
  let current = 0;

  for (let i = 0; i < digits.length; i++) {
    current = current * 10 + digits[i]!;
    const q = Math.floor(current / divisor);
    const product = q * divisor;
    const remainder = current - product;

    steps.push({
      position: i,
      currentValue: current,
      quotientDigit: q,
      product,
      remainder,
    });

    current = remainder;
  }

  return steps;
}

/** Gibt die Ziffern des Quotienten als Array zurück (Index 0 = linkeste Stelle) */
export function getQuotientDigits(dividend: number, divisor: number): number[] {
  return computeDivisionSteps(dividend, divisor).map(s => s.quotientDigit);
}

/** Überprüft ob die eingegebene Antwort korrekt ist */
export function checkAnswer(task: AlgoTask, answer: number): boolean {
  return answer === task.answer;
}

/** Gibt Label für den Operator zurück */
export function operatorLabel(mode: AlgoMode): string {
  switch (mode) {
    case "addition": return "+";
    case "subtraction": return "−";
    case "multiplication": return "×";
    case "division": return ":";
  }
}
