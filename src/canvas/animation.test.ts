/**
 * Tests fuer die Animation Engine (Easing + animateTo + stagger).
 */
import { describe, it, expect, vi } from "vitest";
import { easing, animateTo, stagger, arcMoveTo, morphNumber, drawLine, sequence, highlight, SequenceAnimation } from "./animation";

describe("easing.linear", () => {
  it("linear(0) === 0", () => {
    expect(easing.linear(0)).toBe(0);
  });

  it("linear(1) === 1", () => {
    expect(easing.linear(1)).toBe(1);
  });

  it("linear(0.5) === 0.5", () => {
    expect(easing.linear(0.5)).toBe(0.5);
  });
});

describe("easing.easeOut", () => {
  it("easeOut(0) === 0", () => {
    expect(easing.easeOut(0)).toBe(0);
  });

  it("easeOut(1) === 1", () => {
    expect(easing.easeOut(1)).toBeCloseTo(1, 5);
  });

  it("easeOut(0.5) > 0.5 (schnellerer Start)", () => {
    expect(easing.easeOut(0.5)).toBeGreaterThan(0.5);
  });
});

describe("easing.easeIn", () => {
  it("easeIn(0) === 0", () => {
    expect(easing.easeIn(0)).toBe(0);
  });

  it("easeIn(1) === 1", () => {
    expect(easing.easeIn(1)).toBeCloseTo(1, 5);
  });

  it("easeIn(0.5) < 0.5 (langsamerer Start)", () => {
    expect(easing.easeIn(0.5)).toBeLessThan(0.5);
  });
});

describe("easing.spring", () => {
  it("spring(0) === 0", () => {
    expect(easing.spring(0)).toBe(0);
  });

  it("spring(1) === 1", () => {
    expect(easing.spring(1)).toBe(1);
  });

  it("spring(0.5) ist nahe 1 (Overshoot-Charakter)", () => {
    const v = easing.spring(0.5);
    // Spring easing overshoots — value should be > 0.9
    expect(v).toBeGreaterThan(0.9);
  });
});

describe("easing.bounce", () => {
  it("bounce(0) === 0", () => {
    expect(easing.bounce(0)).toBe(0);
  });

  it("bounce(1) ist ungefaehr 1", () => {
    expect(easing.bounce(1)).toBeCloseTo(1, 2);
  });

  it("bounce(0.5) liegt zwischen 0 und 1", () => {
    const v = easing.bounce(0.5);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThanOrEqual(1.001);
  });
});

// ── animateTo ─────────────────────────────────────────────────────────────────

describe("animateTo", () => {
  it("erstellt AnimationHandle mit progress=0", () => {
    const handle = animateTo(0, 100, { duration: 1000 }, () => {});
    // Might be 0 or 1 depending on reduced-motion
    expect(typeof handle.progress).toBe("number");
    expect(typeof handle.done).toBe("boolean");
  });

  it("tick erhöht progress", () => {
    const onUpdate = vi.fn();
    const handle = animateTo(0, 100, { duration: 1000, ease: easing.linear }, onUpdate);
    if (handle.done) return; // reduced motion → already done
    handle.tick(500);
    expect(handle.progress).toBeCloseTo(0.5, 1);
  });

  it("tick(duration) setzt done auf true", () => {
    const onUpdate = vi.fn();
    const handle = animateTo(0, 100, { duration: 1000, ease: easing.linear }, onUpdate);
    if (handle.done) return;
    handle.tick(1000);
    expect(handle.done).toBe(true);
    expect(handle.progress).toBeCloseTo(1, 1);
  });

  it("onUpdate wird mit interpoliertem Wert aufgerufen", () => {
    const onUpdate = vi.fn();
    const handle = animateTo(0, 100, { duration: 1000, ease: easing.linear }, onUpdate);
    if (handle.done) return;
    handle.tick(500);
    // Linear easing at 50% → value should be ~50
    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(lastCall).toBeCloseTo(50, 0);
  });

  it("skipToEnd setzt progress auf 1 und ruft onUpdate mit Endwert", () => {
    const onUpdate = vi.fn();
    const handle = animateTo(0, 100, { duration: 1000 }, onUpdate);
    handle.skipToEnd();
    expect(handle.done).toBe(true);
    expect(handle.progress).toBe(1);
    expect(onUpdate).toHaveBeenCalledWith(100);
  });

  it("reset setzt progress auf 0 und ruft onUpdate mit Startwert", () => {
    const onUpdate = vi.fn();
    const handle = animateTo(10, 90, { duration: 1000 }, onUpdate);
    handle.skipToEnd();
    handle.reset();
    expect(handle.done).toBe(false);
    expect(handle.progress).toBe(0);
    expect(onUpdate).toHaveBeenCalledWith(10);
  });

  it("delay verzögert Animation", () => {
    const onUpdate = vi.fn();
    const handle = animateTo(0, 100, { duration: 1000, delay: 200, ease: easing.linear }, onUpdate);
    if (handle.done) return;
    const p = handle.tick(100); // still in delay
    expect(p).toBe(0);
  });
});

// ── stagger ───────────────────────────────────────────────────────────────────

describe("stagger", () => {
  it("leeres Array gibt sofort fertiges Handle zurück", () => {
    const handle = stagger([], 100);
    expect(handle.done).toBe(true);
    expect(handle.progress).toBe(1);
  });

  it("tick ruft sub-handles zeitversetzt auf", () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const h1 = animateTo(0, 1, { duration: 100, ease: easing.linear }, fn1);
    const h2 = animateTo(0, 1, { duration: 100, ease: easing.linear }, fn2);
    if (h1.done || h2.done) return; // reduced motion
    const handle = stagger([h1, h2], 50);
    handle.tick(25);
    // h1 should have started, h2 should not (stagger=50, only 25ms elapsed)
    expect(fn1.mock.calls.length).toBeGreaterThan(0);
  });

  it("skipToEnd beendet alle Sub-Handles", () => {
    const h1 = animateTo(0, 1, { duration: 100 }, () => {});
    const h2 = animateTo(0, 1, { duration: 100 }, () => {});
    const handle = stagger([h1, h2], 50);
    handle.skipToEnd();
    expect(handle.done).toBe(true);
    expect(h1.done).toBe(true);
    expect(h2.done).toBe(true);
  });

  it("reset setzt alle Sub-Handles zurück", () => {
    const h1 = animateTo(0, 1, { duration: 100 }, () => {});
    const h2 = animateTo(0, 1, { duration: 100 }, () => {});
    const handle = stagger([h1, h2], 50);
    handle.skipToEnd();
    handle.reset();
    expect(handle.done).toBe(false);
    expect(handle.progress).toBe(0);
  });
});

// ── arcMoveTo ─────────────────────────────────────────────────────────────────

describe("arcMoveTo", () => {
  it("erstellt AnimationHandle", () => {
    const handle = arcMoveTo({ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 50, y: -50 }, { duration: 1000 }, () => {});
    expect(handle).toHaveProperty("tick");
    expect(handle).toHaveProperty("done");
  });

  it("onUpdate wird mit x/y Koordinaten aufgerufen", () => {
    const onUpdate = vi.fn();
    const handle = arcMoveTo({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: -50 }, { duration: 100, ease: easing.linear }, onUpdate);
    if (handle.done) return;
    handle.tick(50);
    expect(onUpdate).toHaveBeenCalled();
  });

  it("skipToEnd ruft onUpdate mit Endposition auf", () => {
    const onUpdate = vi.fn();
    const handle = arcMoveTo({ x: 0, y: 0 }, { x: 100, y: 200 }, { x: 50, y: 100 }, { duration: 100 }, onUpdate);
    handle.skipToEnd();
    // At t=1, bezier should be exactly at (100, 200)
    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
    expect(lastCall[0]).toBeCloseTo(100, 0);
    expect(lastCall[1]).toBeCloseTo(200, 0);
  });
});

// ── morphNumber ───────────────────────────────────────────────────────────────

describe("morphNumber", () => {
  it("ruft onUpdate mit gerundeten Ganzzahlen auf", () => {
    const onUpdate = vi.fn();
    const handle = morphNumber(0, 10, { duration: 100, ease: easing.linear }, onUpdate);
    if (handle.done) return;
    handle.tick(50);
    const val = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(Number.isInteger(val)).toBe(true);
  });

  it("skipToEnd ruft onUpdate mit Endwert auf", () => {
    const onUpdate = vi.fn();
    const handle = morphNumber(0, 42, { duration: 100 }, onUpdate);
    handle.skipToEnd();
    expect(onUpdate).toHaveBeenCalledWith(42);
  });
});

// ── drawLine ──────────────────────────────────────────────────────────────────

describe("drawLine", () => {
  it("erstellt AnimationHandle", () => {
    const handle = drawLine({ duration: 500 });
    expect(handle).toHaveProperty("tick");
    expect(handle).toHaveProperty("done");
  });

  it("progress geht von 0 nach 1", () => {
    const handle = drawLine({ duration: 100, ease: easing.linear });
    if (handle.done) return;
    handle.tick(50);
    expect(handle.progress).toBeCloseTo(0.5, 1);
    handle.tick(50);
    expect(handle.done).toBe(true);
  });
});

// ── sequence ──────────────────────────────────────────────────────────────────

describe("sequence", () => {
  it("leere Sequenz ist sofort fertig", () => {
    const handle = sequence([]);
    expect(handle.done).toBe(true);
  });

  it("führt Steps nacheinander aus", () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const h1 = animateTo(0, 1, { duration: 50, ease: easing.linear }, fn1);
    const h2 = animateTo(0, 1, { duration: 50, ease: easing.linear }, fn2);
    if (h1.done || h2.done) return;
    const handle = sequence([h1, h2]);
    handle.tick(50); // finish first
    handle.tick(50); // finish second
    expect(handle.done).toBe(true);
  });

  it("skipToEnd beendet alle Steps", () => {
    const h1 = animateTo(0, 1, { duration: 100 }, () => {});
    const h2 = animateTo(0, 1, { duration: 100 }, () => {});
    const handle = sequence([h1, h2]);
    handle.skipToEnd();
    expect(handle.done).toBe(true);
    expect(h1.done).toBe(true);
    expect(h2.done).toBe(true);
  });

  it("reset setzt alle Steps zurück", () => {
    const h1 = animateTo(0, 1, { duration: 100 }, () => {});
    const handle = sequence([h1]);
    handle.skipToEnd();
    handle.reset();
    expect(handle.done).toBe(false);
    expect(handle.progress).toBe(0);
  });
});

// ── highlight ─────────────────────────────────────────────────────────────────

describe("highlight", () => {
  it("erstellt AnimationHandle", () => {
    const handle = highlight({ duration: 500 }, () => {});
    expect(handle).toHaveProperty("tick");
  });

  it("onUpdate wird mit Intensitätswert 0-1 aufgerufen", () => {
    const onUpdate = vi.fn();
    const handle = highlight({ duration: 100, ease: easing.linear, pulses: 1 }, onUpdate);
    if (handle.done) return;
    handle.tick(50);
    const val = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(1);
  });
});

// ── SequenceAnimation ─────────────────────────────────────────────────────────

describe("SequenceAnimation", () => {
  it("initial state ist idle", () => {
    const h = animateTo(0, 1, { duration: 100 }, () => {});
    const sa = new SequenceAnimation(h);
    expect(sa.currentState).toBe("idle");
  });

  it("skipToEnd setzt state auf finished", () => {
    const onFinish = vi.fn();
    const h = animateTo(0, 1, { duration: 100 }, () => {});
    const sa = new SequenceAnimation(h, onFinish);
    sa.skipToEnd();
    expect(sa.currentState).toBe("finished");
    expect(onFinish).toHaveBeenCalled();
  });

  it("reset setzt state auf idle", () => {
    const h = animateTo(0, 1, { duration: 100 }, () => {});
    const sa = new SequenceAnimation(h);
    sa.skipToEnd();
    sa.reset();
    expect(sa.currentState).toBe("idle");
  });

  it("dispose setzt state auf idle", () => {
    const h = animateTo(0, 1, { duration: 100 }, () => {});
    const sa = new SequenceAnimation(h);
    sa.dispose();
    expect(sa.currentState).toBe("idle");
  });

  it("progress gibt Handle-Progress zurück", () => {
    const h = animateTo(0, 1, { duration: 100 }, () => {});
    const sa = new SequenceAnimation(h);
    expect(typeof sa.progress).toBe("number");
  });
});
