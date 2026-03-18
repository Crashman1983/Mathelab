/**
 * Scene Animation Helpers — higher-level animation abstractions
 * built on top of src/canvas/animation.ts primitives.
 *
 * Used by module v2.ts files to create richer visual scenes.
 */

import { animateTo, highlight, stagger, easing, type AnimationHandle } from "@canvas/animation";

// ─── Cell Fill Animation ──────────────────────────────────────────────────────

/**
 * Creates a staggered cell-fill animation where cells fill one after another.
 * Returns a composite AnimationHandle.
 *
 * @param cellCount - number of cells to fill
 * @param onCellUpdate - called with (cellIndex, fillProgress 0–1)
 * @param perCellDuration - ms per cell (default 200)
 * @param staggerMs - delay between cell starts (default 50)
 */
export function createCellFillAnimation(
  cellCount: number,
  onCellUpdate: (cellIndex: number, progress: number) => void,
  perCellDuration = 200,
  staggerMs = 50,
): AnimationHandle {
  const items: AnimationHandle[] = [];
  for (let i = 0; i < cellCount; i++) {
    items.push(
      animateTo(0, 1, { duration: perCellDuration, ease: easing.easeOut }, (v) => {
        onCellUpdate(i, v);
      }),
    );
  }
  return stagger(items, staggerMs);
}

// ─── Bounce Drop Animation ──────────────────────────────────────────────────

/**
 * Object drops from a start Y to end Y with a bounce easing.
 * Calls onUpdate(currentY) each tick.
 */
export function createBounceDropAnimation(
  fromY: number,
  toY: number,
  duration = 600,
  onUpdate: (y: number) => void,
): AnimationHandle {
  return animateTo(fromY, toY, { duration, ease: easing.bounce }, onUpdate);
}

// ─── Smooth Rotation ─────────────────────────────────────────────────────────

/**
 * Smoothly rotate from one angle to another (in radians).
 * Calls onUpdate(currentAngle) each tick.
 */
export function createSmoothRotation(
  fromAngle: number,
  toAngle: number,
  duration = 800,
  onUpdate: (angle: number) => void,
): AnimationHandle {
  return animateTo(fromAngle, toAngle, { duration, ease: easing.easeInOut }, onUpdate);
}

// ─── Trail Animation ─────────────────────────────────────────────────────────

/**
 * Progressively draws a trail (0→1 progress).
 * Calls onUpdate(revealProgress 0–1) — use to clip/draw partial paths.
 */
export function createTrailAnimation(
  duration = 600,
  onUpdate: (progress: number) => void,
): AnimationHandle {
  return animateTo(0, 1, { duration, ease: easing.easeOut }, onUpdate);
}

// ─── Glow / Pulse Highlight ──────────────────────────────────────────────────

/**
 * Creates a glow/pulse effect (intensity 0→1→0).
 * @param pulses - number of pulse cycles
 * @param duration - total duration across all pulses
 * @param onUpdate - called with intensity 0–1
 */
export function createGlowPulse(
  pulses = 2,
  duration = 800,
  onUpdate: (intensity: number) => void,
): AnimationHandle {
  return highlight({ duration, pulses }, onUpdate);
}

// ─── Scale In (Spring) ──────────────────────────────────────────────────────

/**
 * Scale from 0 to 1 with spring easing.
 * Calls onUpdate(scale) each tick.
 */
export function createSpringScaleIn(
  duration = 400,
  onUpdate: (scale: number) => void,
): AnimationHandle {
  return animateTo(0, 1, { duration, ease: easing.spring }, onUpdate);
}

// ─── Fade In ────────────────────────────────────────────────────────────────

/**
 * Simple opacity fade from 0 to 1.
 */
export function createFadeIn(
  duration = 300,
  onUpdate: (opacity: number) => void,
): AnimationHandle {
  return animateTo(0, 1, { duration, ease: easing.easeOut }, onUpdate);
}

// ─── Number Counter ─────────────────────────────────────────────────────────

/**
 * Animate a number counting from `from` to `to`.
 * Calls onUpdate with rounded integers.
 */
export function createNumberCounter(
  from: number,
  to: number,
  duration = 500,
  onUpdate: (value: number) => void,
): AnimationHandle {
  return animateTo(from, to, { duration, ease: easing.easeOut }, (v) =>
    onUpdate(Math.round(v)),
  );
}
