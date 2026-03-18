/**
 * Radial Drag — clock-style circular control.
 *
 * Converts drag movement into angle + zone information.
 * Supports dead zone, named zones by distance, and angle snapping.
 */

export interface RadialZone {
  /** Fraction of radius (0–1) for inner boundary */
  minR: number;
  /** Fraction of radius (0–1) for outer boundary */
  maxR: number;
  /** Zone identifier */
  id: string;
}

export interface RadialDragConfig {
  /** Center X in CSS pixels */
  cx: number;
  /** Center Y in CSS pixels */
  cy: number;
  /** Radius in CSS pixels */
  radius: number;
  /** Fraction of radius below which input is ignored (default: 0.25) */
  deadZone?: number;
  /** Named zones by distance from center */
  zones?: RadialZone[];
  /** Snap angle in degrees (e.g. 30 for hours, 6 for 5-min) */
  snapDegrees?: number;
  /** Called on every angle change during drag */
  onAngleChange?: (angleDeg: number, zone: string | null) => void;
  /** Called when drag ends */
  onEnd?: (angleDeg: number, zone: string | null) => void;
}

export interface RadialDragTracker {
  handleDown(x: number, y: number): boolean; // returns true if within radius
  handleMove(x: number, y: number): void;
  handleUp(): void;
}

export function createRadialDrag(config: RadialDragConfig): RadialDragTracker {
  const deadZone = config.deadZone ?? 0.25;
  let active = false;
  let lastZone: string | null = null;

  function getAngleAndZone(x: number, y: number): { angle: number; zone: string | null } | null {
    const dx = x - config.cx;
    const dy = y - config.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const frac = dist / config.radius;

    // Dead zone check
    if (frac < deadZone) return null;

    // Angle: 0° = 12 o'clock (top), clockwise positive
    let angleDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (angleDeg < 0) angleDeg += 360;

    // Snap
    if (config.snapDegrees) {
      angleDeg = Math.round(angleDeg / config.snapDegrees) * config.snapDegrees;
      if (angleDeg >= 360) angleDeg -= 360;
    }

    // Zone detection
    let zone: string | null = null;
    if (config.zones) {
      for (const z of config.zones) {
        if (frac >= z.minR && frac <= z.maxR) {
          zone = z.id;
          break;
        }
      }
    }

    return { angle: angleDeg, zone };
  }

  return {
    handleDown(x: number, y: number): boolean {
      const result = getAngleAndZone(x, y);
      if (!result) return false;
      active = true;
      lastZone = result.zone;
      config.onAngleChange?.(result.angle, result.zone);
      return true;
    },

    handleMove(x: number, y: number): void {
      if (!active) return;
      const result = getAngleAndZone(x, y);
      if (!result) return;
      lastZone = result.zone;
      config.onAngleChange?.(result.angle, result.zone);
    },

    handleUp(): void {
      if (!active) return;
      active = false;
      // Fire onEnd with last known values if needed
      // (modules track the latest angle via onAngleChange)
    },
  };
}
