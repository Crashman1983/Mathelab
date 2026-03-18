/**
 * Tests für Barrierefreiheits-Konstanten und ButtonNode-Verhalten.
 * Prüft MIN_TOUCH_TARGET, Mindestgrößen, enabled/disabled-Logik.
 */
import { describe, it, expect } from "vitest";
import { MIN_TOUCH_TARGET } from "@canvas/nodes/types";
import { ButtonNode } from "@canvas/nodes/button";
import { mockCtx } from "@test/test-helpers";

describe("Barrierefreiheit — Touch-Targets", () => {
  it("MIN_TOUCH_TARGET ist mindestens 44", () => {
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(44);
  });

  it("MIN_TOUCH_TARGET Wert ist genau 44", () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
  });

  it("ButtonNode measure erzwingt Mindesthöhe >= MIN_TOUCH_TARGET", () => {
    const btn = new ButtonNode("X");
    const ctx = mockCtx();
    const measured = btn.measure(ctx, { w: 800, h: 600 });

    expect(measured.minH).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it("ButtonNode measure erzwingt Mindestbreite >= MIN_TOUCH_TARGET", () => {
    const btn = new ButtonNode("X");
    const ctx = mockCtx();
    const measured = btn.measure(ctx, { w: 800, h: 600 });

    expect(measured.minW).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it("ButtonNode toHitArea.enabled respektiert enabled prop", () => {
    const btn = new ButtonNode("Aktiv", { enabled: true });
    const ctx = mockCtx();
    btn.measure(ctx, { w: 800, h: 600 });
    btn.layout({ x: 0, y: 0, w: 100, h: 50 });

    const hitArea = btn.toHitArea();
    expect(hitArea.enabled).toBe(true);
  });

  it("ButtonNode toHitArea.enabled ist false wenn disabled", () => {
    const btn = new ButtonNode("Inaktiv", { enabled: false });
    const ctx = mockCtx();
    btn.measure(ctx, { w: 800, h: 600 });
    btn.layout({ x: 0, y: 0, w: 100, h: 50 });

    const hitArea = btn.toHitArea();
    expect(hitArea.enabled).toBe(false);
  });

  it("Disabled ButtonNode hat onTap-Funktion in HitArea wenn gesetzt", () => {
    const tap = () => {};
    const btn = new ButtonNode("Inaktiv", { enabled: false, onTap: tap });
    const ctx = mockCtx();
    btn.measure(ctx, { w: 800, h: 600 });
    btn.layout({ x: 0, y: 0, w: 100, h: 50 });

    const hitArea = btn.toHitArea();
    // onTap wird durchgereicht, enabled steuert ob Scene ihn aufruft
    expect(hitArea.onTap).toBe(tap);
  });

  it("ButtonNode mit minHeight > MIN_TOUCH_TARGET verwendet minHeight", () => {
    const customHeight = 64;
    const btn = new ButtonNode("Groß", { minHeight: customHeight });
    const ctx = mockCtx();
    const measured = btn.measure(ctx, { w: 800, h: 600 });

    expect(measured.minH).toBeGreaterThanOrEqual(customHeight);
  });
});
