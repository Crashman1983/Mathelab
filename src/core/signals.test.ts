/**
 * Tests fuer Micro-Signals (signal, effect, persisted).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { signal, effect, persisted } from "./signals";

// ---- signal() ----

describe("signal()", () => {
  it("erstellt Signal mit Initialwert", () => {
    const s = signal(42);
    expect(s()).toBe(42);
  });

  it("Signal lesen gibt aktuellen Wert zurueck", () => {
    const s = signal("hello");
    expect(s()).toBe("hello");
  });

  it("set() aendert den Wert", () => {
    const s = signal(1);
    s.set(2);
    expect(s()).toBe(2);
  });

  it("set() mit gleichem Wert loest keine Subscriber aus (Object.is)", () => {
    const s = signal(5);
    const fn = vi.fn();
    s.subscribe(fn);
    s.set(5);
    expect(fn).not.toHaveBeenCalled();
  });

  it("subscribe() wird bei Wertaenderung aufgerufen", () => {
    const s = signal(0);
    const fn = vi.fn();
    s.subscribe(fn);
    s.set(1);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("subscribe() gibt unsubscribe-Funktion zurueck", () => {
    const s = signal(0);
    const fn = vi.fn();
    const unsub = s.subscribe(fn);
    unsub();
    s.set(1);
    expect(fn).not.toHaveBeenCalled();
  });

  it("peek() liest Wert ohne Tracking", () => {
    const s = signal(99);
    expect(s.peek()).toBe(99);
  });

  it("Mehrere Subscriber werden alle benachrichtigt", () => {
    const s = signal(0);
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    s.subscribe(fn1);
    s.subscribe(fn2);
    s.set(1);
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
  });
});

// ---- effect() ----

describe("effect()", () => {
  it("fuehrt fn sofort aus (initial run)", () => {
    const fn = vi.fn();
    effect(fn);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("fuehrt fn erneut aus wenn gelesenes Signal sich aendert", () => {
    const s = signal(0);
    const values: number[] = [];
    effect(() => {
      values.push(s());
    });
    expect(values).toEqual([0]);
    s.set(1);
    expect(values).toEqual([0, 1]);
  });

  it("gibt dispose-Funktion zurueck", () => {
    const s = signal(0);
    const dispose = effect(() => {
      s(); // track
    });
    expect(typeof dispose).toBe("function");
    dispose();
  });
});

// ---- persisted() ----

describe("persisted()", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("liest Initialwert aus localStorage", () => {
    localStorage.setItem("mathelabor_testKey", JSON.stringify(42));
    const s = persisted("testKey", 0);
    expect(s()).toBe(42);
  });

  it("faellt auf Fallback zurueck wenn localStorage leer", () => {
    const s = persisted("missingKey", "default");
    expect(s()).toBe("default");
  });

  it("set() schreibt in localStorage", () => {
    const s = persisted("writeKey", 0);
    s.set(123);
    expect(s()).toBe(123);
    const stored = localStorage.getItem("mathelabor_writeKey");
    expect(stored).toBe("123");
  });

  it("ignoriert korrupte JSON-Daten", () => {
    localStorage.setItem("mathelabor_corrupt", "{broken json!!!");
    const s = persisted("corrupt", "safe");
    expect(s()).toBe("safe");
  });
});
