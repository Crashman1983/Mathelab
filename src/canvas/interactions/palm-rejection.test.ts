/**
 * Tests für Palm Rejection (Stift-/Touch-Filterung).
 */
import { describe, it, expect } from "vitest";
import { createPalmRejection } from "./palm-rejection";

function mockPointerEvent(overrides: Partial<PointerEvent>): PointerEvent {
  return {
    isPrimary: true,
    pointerType: "touch",
    pointerId: 1,
    type: "pointerdown",
    ...overrides,
  } as unknown as PointerEvent;
}

describe("PalmRejection", () => {
  it("primärer Touch wird nicht ignoriert", () => {
    const pr = createPalmRejection();
    const e = mockPointerEvent({ isPrimary: true, pointerType: "touch" });
    expect(pr.shouldIgnore(e)).toBe(false);
  });

  it("nicht-primärer Pointer wird immer ignoriert", () => {
    const pr = createPalmRejection();
    const e = mockPointerEvent({ isPrimary: false, pointerType: "touch" });
    expect(pr.shouldIgnore(e)).toBe(true);
  });

  it("Pen-Pointer wird nicht ignoriert", () => {
    const pr = createPalmRejection();
    const e = mockPointerEvent({ isPrimary: true, pointerType: "pen", pointerId: 10 });
    expect(pr.shouldIgnore(e)).toBe(false);
  });

  it("Touch wird ignoriert wenn Stift aktiv ist", () => {
    const pr = createPalmRejection();
    // Stift startet
    pr.shouldIgnore(mockPointerEvent({ isPrimary: true, pointerType: "pen", pointerId: 10, type: "pointerdown" }));
    // Touch kommt → sollte ignoriert werden (Handfläche)
    const touch = mockPointerEvent({ isPrimary: true, pointerType: "touch", pointerId: 2, type: "pointerdown" });
    expect(pr.shouldIgnore(touch)).toBe(true);
  });

  it("Touch wird nach Pen-Up wieder akzeptiert", () => {
    const pr = createPalmRejection();
    // Stift startet
    pr.shouldIgnore(mockPointerEvent({ isPrimary: true, pointerType: "pen", pointerId: 10, type: "pointerdown" }));
    // Stift endet
    pr.shouldIgnore(mockPointerEvent({ isPrimary: true, pointerType: "pen", pointerId: 10, type: "pointerup" }));
    // Touch → sollte akzeptiert werden
    const touch = mockPointerEvent({ isPrimary: true, pointerType: "touch", pointerId: 3, type: "pointerdown" });
    expect(pr.shouldIgnore(touch)).toBe(false);
  });

  it("Touch wird nach pointercancel des Stifts wieder akzeptiert", () => {
    const pr = createPalmRejection();
    pr.shouldIgnore(mockPointerEvent({ isPrimary: true, pointerType: "pen", pointerId: 10, type: "pointerdown" }));
    pr.shouldIgnore(mockPointerEvent({ isPrimary: true, pointerType: "pen", pointerId: 10, type: "pointercancel" }));
    const touch = mockPointerEvent({ isPrimary: true, pointerType: "touch", pointerId: 4, type: "pointerdown" });
    expect(pr.shouldIgnore(touch)).toBe(false);
  });

  it("reset() setzt aktiven Stift zurück", () => {
    const pr = createPalmRejection();
    pr.shouldIgnore(mockPointerEvent({ isPrimary: true, pointerType: "pen", pointerId: 10, type: "pointerdown" }));
    pr.reset();
    const touch = mockPointerEvent({ isPrimary: true, pointerType: "touch", pointerId: 5, type: "pointerdown" });
    expect(pr.shouldIgnore(touch)).toBe(false);
  });

  it("Mouse-Pointer wird nicht ignoriert", () => {
    const pr = createPalmRejection();
    const e = mockPointerEvent({ isPrimary: true, pointerType: "mouse", type: "pointerdown" });
    expect(pr.shouldIgnore(e)).toBe(false);
  });

  it("Touch-Move wird ignoriert wenn Stift aktiv", () => {
    const pr = createPalmRejection();
    pr.shouldIgnore(mockPointerEvent({ isPrimary: true, pointerType: "pen", pointerId: 10, type: "pointerdown" }));
    const touchMove = mockPointerEvent({ isPrimary: true, pointerType: "touch", pointerId: 2, type: "pointermove" });
    expect(pr.shouldIgnore(touchMove)).toBe(true);
  });
});
