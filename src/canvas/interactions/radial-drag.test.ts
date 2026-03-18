/**
 * Tests für Radial Drag Tracker (clock-style Kreissteuerung).
 */
import { describe, it, expect, vi } from "vitest";
import { createRadialDrag } from "./radial-drag";

describe("RadialDrag", () => {
  const baseConfig = {
    cx: 100,
    cy: 100,
    radius: 80,
  };

  it("handleDown innerhalb Radius gibt true zurück", () => {
    const tracker = createRadialDrag(baseConfig);
    // Point at 3 o'clock position (100+60, 100) → within radius
    expect(tracker.handleDown(160, 100)).toBe(true);
  });

  it("handleDown in Dead Zone gibt false zurück", () => {
    const tracker = createRadialDrag({ ...baseConfig, deadZone: 0.25 });
    // Point very close to center (102, 100) → dist=2, frac=0.025 < 0.25
    expect(tracker.handleDown(102, 100)).toBe(false);
  });

  it("handleDown ruft onAngleChange auf", () => {
    const onAngleChange = vi.fn();
    const tracker = createRadialDrag({ ...baseConfig, onAngleChange });
    tracker.handleDown(160, 100); // 3 o'clock → ~90°
    expect(onAngleChange).toHaveBeenCalledTimes(1);
    const angle = onAngleChange.mock.calls[0][0];
    expect(angle).toBeCloseTo(90, 0);
  });

  it("handleMove nach handleDown ruft onAngleChange auf", () => {
    const onAngleChange = vi.fn();
    const tracker = createRadialDrag({ ...baseConfig, onAngleChange });
    tracker.handleDown(160, 100);
    tracker.handleMove(100, 40); // 12 o'clock → ~0°
    expect(onAngleChange).toHaveBeenCalledTimes(2);
    const angle = onAngleChange.mock.calls[1][0];
    expect(angle).toBeCloseTo(0, 0);
  });

  it("handleMove ohne handleDown tut nichts", () => {
    const onAngleChange = vi.fn();
    const tracker = createRadialDrag({ ...baseConfig, onAngleChange });
    tracker.handleMove(160, 100);
    expect(onAngleChange).not.toHaveBeenCalled();
  });

  it("Winkel 12 Uhr ist 0°", () => {
    const onAngleChange = vi.fn();
    const tracker = createRadialDrag({ ...baseConfig, onAngleChange });
    tracker.handleDown(100, 20); // direkt oben
    const angle = onAngleChange.mock.calls[0][0];
    expect(angle).toBeCloseTo(0, 0);
  });

  it("Winkel 6 Uhr ist 180°", () => {
    const onAngleChange = vi.fn();
    const tracker = createRadialDrag({ ...baseConfig, onAngleChange });
    tracker.handleDown(100, 180); // direkt unten
    const angle = onAngleChange.mock.calls[0][0];
    expect(angle).toBeCloseTo(180, 0);
  });

  it("snapDegrees rundet Winkel", () => {
    const onAngleChange = vi.fn();
    const tracker = createRadialDrag({ ...baseConfig, snapDegrees: 30, onAngleChange });
    // Point at ~85° → should snap to 90°
    tracker.handleDown(179, 107);
    const angle = onAngleChange.mock.calls[0][0];
    expect(angle % 30).toBe(0);
  });

  it("Zonen werden korrekt erkannt", () => {
    const onAngleChange = vi.fn();
    const tracker = createRadialDrag({
      ...baseConfig,
      zones: [
        { minR: 0.3, maxR: 0.6, id: "hour" },
        { minR: 0.6, maxR: 1.0, id: "minute" },
      ],
      onAngleChange,
    });
    // Point at dist ~60px from center → frac=0.75 → "minute" zone
    tracker.handleDown(160, 100);
    const zone = onAngleChange.mock.calls[0][1];
    expect(zone).toBe("minute");
  });

  it("handleUp deaktiviert Drag", () => {
    const onAngleChange = vi.fn();
    const tracker = createRadialDrag({ ...baseConfig, onAngleChange });
    tracker.handleDown(160, 100);
    tracker.handleUp();
    tracker.handleMove(100, 40);
    // Only 1 call from handleDown, none from handleMove after handleUp
    expect(onAngleChange).toHaveBeenCalledTimes(1);
  });
});
