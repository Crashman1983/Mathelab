/**
 * Gemeinsame Utility-Funktionen.
 * Alle mathematischen und allgemeinen Hilfsfunktionen – modul-unabhängig.
 */

// ─── Math ─────────────────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function invLerp(a: number, b: number, v: number): number {
  return b === a ? 0 : (v - a) / (b - a);
}

export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return lerp(outMin, outMax, invLerp(inMin, inMax, value));
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** Gibt true zurück wenn der Nutzer reduzierte Bewegung bevorzugt (WCAG 2.3 / CLAUDE.md MUST). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

export function gridKeyOf(x: number, y: number): string {
  return `${x},${y}`;
}

export function gridParseKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

// ─── DOM ─────────────────────────────────────────────────────────────────────

/**
 * Typsicheres Abrufen von DOM-Elementen.
 * Wirft einen klaren Fehler wenn das Element fehlt.
 */
export function requireElement<T extends HTMLElement>(
  selector: string,
  context: Document | HTMLElement = document
): T {
  const el = context.querySelector<T>(selector);
  if (!el) {
    throw new Error(
      `[DOM] Required element not found: "${selector}"`
    );
  }
  return el;
}

export function requireCanvas(id: string): HTMLCanvasElement {
  const el = document.getElementById(id);
  if (!el || !(el instanceof HTMLCanvasElement)) {
    throw new Error(`[DOM] Canvas not found or wrong type: #${id}`);
  }
  return el;
}

/**
 * Synchronisiert die interne Canvas-Auflösung mit der CSS-Displaygröße.
 * Berücksichtigt devicePixelRatio für scharfe Darstellung.
 * Gibt true zurück wenn sich die Größe geändert hat.
 */
export function syncCanvasSize(canvas: HTMLCanvasElement): boolean {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    return true;
  }
  return false;
}

/**
 * Berechnet die skalierten Canvas-Koordinaten für ein Maus/Touch-Event.
 * Berücksichtigt DPI-Skalierung korrekt.
 */
export function canvasEventCoords(
  event: MouseEvent | PointerEvent,
  canvas: HTMLCanvasElement
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return {
    x: (event.clientX - rect.left) * dpr,
    y: (event.clientY - rect.top) * dpr,
  };
}

// ─── Array ────────────────────────────────────────────────────────────────────

export function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

export function shuffled<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Gewichtete Zufallswahl */
export function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export function safeGetLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors (e.g. private mode, quota exceeded)
  }
}

// ─── Format ───────────────────────────────────────────────────────────────────

/** Formatiert eine Zahl mit führenden Nullen */
export function padZero(n: number, digits = 2): string {
  return String(n).padStart(digits, "0");
}

// ─── Debounce / Throttle ──────────────────────────────────────────────────────

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
}
