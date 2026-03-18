/**
 * Tests fuer bisher ungetestete Utils-Funktionen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  easeOutBounce,
  easeOutExpo,
  randomChoice,
  safeGetLocalStorage,
  safeSetLocalStorage,
  debounce,
} from "./utils";

// ---- easeOutBounce ----

describe("easeOutBounce()", () => {
  it("easeOutBounce(0) gibt 0 zurueck", () => {
    expect(easeOutBounce(0)).toBe(0);
  });

  it("easeOutBounce(1) gibt 1 zurueck", () => {
    expect(easeOutBounce(1)).toBeCloseTo(1, 5);
  });

  it("easeOutBounce(0.5) gibt Wert zwischen 0 und 1", () => {
    const v = easeOutBounce(0.5);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  it("easeOutBounce ist monoton steigend (grob)", () => {
    const steps = [0, 0.25, 0.5, 0.75, 1.0];
    const values = steps.map(easeOutBounce);
    // Bounce-Funktion ist nicht streng monoton, aber Endwert > Startwert
    expect(values[values.length - 1]).toBeGreaterThan(values[0]);
    // Und alle Werte liegen in [0, 1]
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1.001);
    }
  });
});

// ---- easeOutExpo ----

describe("easeOutExpo()", () => {
  it("easeOutExpo(0) gibt 0 zurueck", () => {
    // easeOutExpo(0) = 1 - 2^0 = 0
    expect(easeOutExpo(0)).toBeCloseTo(0, 5);
  });

  it("easeOutExpo(1) gibt 1 zurueck", () => {
    expect(easeOutExpo(1)).toBe(1);
  });

  it("easeOutExpo(0.5) gibt Wert > 0.9", () => {
    expect(easeOutExpo(0.5)).toBeGreaterThan(0.9);
  });
});

// ---- randomChoice ----

describe("randomChoice()", () => {
  it("gibt Element aus Array zurueck", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = randomChoice(arr);
    expect(arr).toContain(result);
  });

  it("bei Array mit einem Element gibt dieses zurueck", () => {
    expect(randomChoice([42])).toBe(42);
  });
});

// ---- safeGetLocalStorage / safeSetLocalStorage ----

describe("safeGetLocalStorage()", () => {
  beforeEach(() => localStorage.clear());

  it("liest Wert aus localStorage", () => {
    localStorage.setItem("testKey", "testValue");
    expect(safeGetLocalStorage("testKey")).toBe("testValue");
  });

  it("gibt null fuer nicht existierenden Key", () => {
    expect(safeGetLocalStorage("nonExistent")).toBeNull();
  });
});

describe("safeSetLocalStorage()", () => {
  beforeEach(() => localStorage.clear());

  it("schreibt Wert in localStorage", () => {
    safeSetLocalStorage("myKey", "myVal");
    expect(localStorage.getItem("myKey")).toBe("myVal");
  });
});

// ---- debounce ----

describe("debounce()", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ruft Funktion nach Verzoegerung auf", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("setzt Timer zurueck bei erneutem Aufruf", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced(); // reset
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledOnce();
  });
});
