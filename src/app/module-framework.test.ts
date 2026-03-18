import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DIFFICULTIES, defineModule } from "./module-framework";
import type { DifficultyDefinition } from "./module-framework";
import { vstack } from "@canvas/nodes/container";

describe("DIFFICULTIES Konstante", () => {
  it("hat genau 3 Einträge (Junior, Checker, BossBaby)", () => {
    expect(DIFFICULTIES).toHaveLength(3);
  });

  it("erster Eintrag hat level 1 und Label 'Junior'", () => {
    expect(DIFFICULTIES[0].level).toBe(1);
    expect(DIFFICULTIES[0].label).toBe("Junior");
  });

  it("zweiter Eintrag hat level 2 und Label 'Checker'", () => {
    expect(DIFFICULTIES[1].level).toBe(2);
    expect(DIFFICULTIES[1].label).toBe("Checker");
  });

  it("dritter Eintrag hat level 3 und Label 'BossBaby'", () => {
    expect(DIFFICULTIES[2].level).toBe(3);
    expect(DIFFICULTIES[2].label).toBe("BossBaby");
  });

  it("beide Einträge haben ein Icon", () => {
    for (const d of DIFFICULTIES) {
      expect(d.icon).toBeDefined();
      expect(typeof d.icon).toBe("string");
      expect(d.icon!.length).toBeGreaterThan(0);
    }
  });

  it("alle Labels sind nicht-leere Strings", () => {
    for (const d of DIFFICULTIES) {
      expect(typeof d.label).toBe("string");
      expect(d.label.length).toBeGreaterThan(0);
    }
  });

  it("alle Levels sind positive ganze Zahlen", () => {
    for (const d of DIFFICULTIES) {
      expect(Number.isInteger(d.level)).toBe(true);
      expect(d.level).toBeGreaterThan(0);
    }
  });

  it("Level-Werte sind aufsteigend sortiert", () => {
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      expect(DIFFICULTIES[i].level).toBeGreaterThan(DIFFICULTIES[i - 1].level);
    }
  });

  it("jeder Eintrag hat genau die Felder level, label und icon", () => {
    for (const d of DIFFICULTIES) {
      expect(d).toHaveProperty("level");
      expect(d).toHaveProperty("label");
      expect(d).toHaveProperty("icon");
    }
  });

  it("Level-Werte sind eindeutig", () => {
    const levels = DIFFICULTIES.map((d) => d.level);
    const unique = new Set(levels);
    expect(unique.size).toBe(levels.length);
  });

  it("erfüllt das DifficultyDefinition-Interface", () => {
    // Typsicherheit: jeder Eintrag muss level (number), label (string) haben
    for (const d of DIFFICULTIES) {
      const typed: DifficultyDefinition = d;
      expect(typeof typed.level).toBe("number");
      expect(typeof typed.label).toBe("string");
    }
  });

  it("Icons sind Emoji-Strings (nicht leer, kein reiner Whitespace)", () => {
    for (const d of DIFFICULTIES) {
      expect(d.icon).toBeDefined();
      expect(d.icon!.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("defineModule Struktur (via Multiplication-Modul)", () => {
  it("multiplicationV2Registration hat id, label, icon, description, factory", async () => {
    const mod = await import("@modules/multiplication/v2");
    const reg = mod.multiplicationV2Registration;
    expect(reg).toBeDefined();
    expect(typeof reg.id).toBe("string");
    expect(typeof reg.label).toBe("string");
    expect(typeof reg.icon).toBe("string");
    expect(typeof reg.description).toBe("string");
    expect(typeof reg.factory).toBe("function");
  });

  it("multiplicationV2Registration hat id 'multiplication'", async () => {
    const mod = await import("@modules/multiplication/v2");
    expect(mod.multiplicationV2Registration.id).toBe("multiplication");
  });

  it("factory gibt ein Objekt mit mount, activate, deactivate, resize, destroy zurück", async () => {
    const mod = await import("@modules/multiplication/v2");
    const lernModul = mod.multiplicationV2Registration.factory();
    expect(typeof lernModul.mount).toBe("function");
    expect(typeof lernModul.activate).toBe("function");
    expect(typeof lernModul.deactivate).toBe("function");
    expect(typeof lernModul.resize).toBe("function");
    expect(typeof lernModul.destroy).toBe("function");
  });
});

// ─── Minimal helper: minimal module without DOM side-effects ────────────────

function makeMinimalModule(opts: { input?: "numberPad" | "canvas" } = {}) {
  return defineModule({
    id: "test-module",
    label: "Test",
    icon: "🧪",
    description: "Testmodul",
    flowType: "explore",
    taskTypes: [{ id: "default", label: "Standard" }],
    input: opts.input,
    generate: () => ({ value: 42 }),
    buildScene: () => vstack([]),
  }).factory();
}

// ─── Suite: mount() DOM-Erzeugung ───────────────────────────────────────────

describe("defineModule — mount() DOM-Erzeugung", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it("mount() erzeugt ein <canvas>-Element im Container", () => {
    const mod = makeMinimalModule();
    mod.mount(container);
    expect(container.querySelector("canvas")).not.toBeNull();
  });

  it("mount() erzeugt eine control-bar", () => {
    const mod = makeMinimalModule();
    mod.mount(container);
    expect(container.querySelector(".control-bar")).not.toBeNull();
  });

  it("mount() mit input: 'numberPad' erzeugt ein numpad-Panel", () => {
    const mod = makeMinimalModule({ input: "numberPad" });
    mod.mount(container);
    expect(container.querySelector(".v2-numpad")).not.toBeNull();
  });

  it("mount() ohne numpad erzeugt kein sichtbares numpad-Panel", () => {
    const mod = makeMinimalModule({ input: "canvas" });
    mod.mount(container);
    const numpad = container.querySelector(".v2-numpad") as HTMLElement | null;
    const isHidden = !numpad || numpad.style.display === "none";
    expect(isHidden).toBe(true);
  });

  it("canvas hat aria-label nach mount()", () => {
    const mod = makeMinimalModule();
    mod.mount(container);
    const canvas = container.querySelector("canvas");
    expect(canvas?.getAttribute("aria-label")).toBeTruthy();
  });
});

// ─── Suite: Lifecycle mount → activate → deactivate → destroy ───────────────

describe("defineModule — Lifecycle ohne Crash", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it("activate() nach mount() wirft keinen Fehler", () => {
    const mod = makeMinimalModule();
    mod.mount(container);
    expect(() => mod.activate()).not.toThrow();
  });

  it("deactivate() nach activate() wirft keinen Fehler", () => {
    const mod = makeMinimalModule();
    mod.mount(container);
    mod.activate();
    expect(() => mod.deactivate()).not.toThrow();
  });

  it("activate() → deactivate() → activate() Zyklus ohne Crash", () => {
    const mod = makeMinimalModule();
    mod.mount(container);
    expect(() => {
      mod.activate();
      mod.deactivate();
      mod.activate();
      mod.deactivate();
    }).not.toThrow();
  });

  it("destroy() nach deactivate() wirft keinen Fehler", () => {
    const mod = makeMinimalModule();
    mod.mount(container);
    mod.activate();
    mod.deactivate();
    expect(() => mod.destroy()).not.toThrow();
  });

  it("resize() nach mount() wirft keinen Fehler", () => {
    const mod = makeMinimalModule();
    mod.mount(container);
    expect(() => mod.resize()).not.toThrow();
  });
});

// ─── Suite: autoAdvancePending Guard (Regressions-Test) ─────────────────────

describe("defineModule — autoAdvancePending Guard", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.useFakeTimers();
  });

  afterEach(() => {
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("deactivate() vor rAF-Fire hinterlässt keinen globalen click-capture-Listener", async () => {
    // Regression: if autoAdvancePending guard is missing, a stale rAF would add a
    // capture-phase click listener after cancelAutoAdvance() was already called,
    // causing subsequent canvas button taps to be swallowed.

    const mod = defineModule({
      id: "test-guard",
      label: "Guard-Test",
      icon: "🧪",
      description: "Test",
      flowType: "task",
      taskTypes: [{ id: "default", label: "Standard" }],
      autoAdvanceMs: 3000,
      generate: () => ({ answer: 5 }),
      check: (_task: { answer: number }, _input: unknown) => ({
        correct: false,
      }),
      buildScene: () => vstack([]),
    }).factory();

    mod.mount(container);
    mod.activate();

    // Spy AFTER activate (to ignore the listeners activate itself adds)
    const addEventSpy = vi.spyOn(document, "addEventListener");

    // deactivate() calls cancelAutoAdvance() → sets autoAdvancePending = false
    // AND stops the scene loop → no more rAFs scheduled
    mod.deactivate();

    // Advance timers 50ms (≈3 RAF slots at 16ms each) — should be safe since loop is stopped
    await vi.advanceTimersByTimeAsync(50);

    // The stale rAF from startAutoAdvance (if any) must NOT add a click-capture listener
    const clickCaptureListeners = addEventSpy.mock.calls.filter(
      ([event, , capture]) => event === "click" && capture === true,
    );
    expect(clickCaptureListeners).toHaveLength(0);
  });
});
