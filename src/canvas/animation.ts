/**
 * Animation Engine (Baustein 15 — Infrastructure).
 *
 * 6 animation primitives + easing library + SequenceAnimation.
 * All animations respect prefers-reduced-motion (Decision E4):
 * → reduced-motion fallback: opacity fade 150ms.
 */

import { clamp, lerp } from "@core/utils";
import { prefersReducedMotion } from "./scene";

// ─── Easing ──────────────────────────────────────────────────────────────────

export type EasingFn = (t: number) => number;

export const easing = {
  linear: (t: number) => t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeIn: (t: number) => t * t * t,
  easeInOut: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  spring: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  bounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
} as const;

// ─── Animation Types ─────────────────────────────────────────────────────────

export interface AnimationHandle {
  /** Current progress 0→1 */
  progress: number;
  /** Whether animation is complete */
  done: boolean;
  /** Advance by dt milliseconds, returns new progress */
  tick(dt: number): number;
  /** Skip to end */
  skipToEnd(): void;
  /** Reset to start */
  reset(): void;
}

interface AnimationOptions {
  duration: number;
  ease?: EasingFn;
  delay?: number;
}

// ─── Core: animateTo ─────────────────────────────────────────────────────────

/**
 * Animate a value from `from` to `to` over `duration` ms.
 * Returns an AnimationHandle; call `tick(dt)` each frame.
 * With reduced-motion: completes instantly (progress=1).
 */
export function animateTo(
  from: number,
  to: number,
  opts: AnimationOptions,
  onUpdate: (value: number) => void,
): AnimationHandle {
  const reduced = prefersReducedMotion();
  const ease = opts.ease ?? easing.easeOut;
  const delay = opts.delay ?? 0;
  let elapsed = 0;
  const duration = reduced ? 0 : opts.duration;

  const handle: AnimationHandle = {
    progress: 0,
    done: reduced,
    tick(dt: number) {
      if (handle.done) return 1;
      elapsed += dt;
      if (elapsed < delay) return 0;
      const raw = clamp((elapsed - delay) / Math.max(duration, 1), 0, 1);
      handle.progress = raw;
      const eased = ease(raw);
      onUpdate(lerp(from, to, eased));
      if (raw >= 1) handle.done = true;
      return raw;
    },
    skipToEnd() {
      handle.progress = 1;
      handle.done = true;
      onUpdate(to);
    },
    reset() {
      elapsed = 0;
      handle.progress = 0;
      handle.done = false;
      onUpdate(from);
    },
  };

  if (reduced) onUpdate(to);
  return handle;
}

// ─── Primitive 1: stagger ────────────────────────────────────────────────────

/**
 * Run multiple animations with staggered start times.
 * Returns a composite handle.
 */
export function stagger(
  items: AnimationHandle[],
  staggerMs: number,
): AnimationHandle {
  const totalItems = items.length;
  if (totalItems === 0) {
    return { progress: 1, done: true, tick: () => 1, skipToEnd: () => {}, reset: () => {} };
  }

  let elapsed = 0;

  return {
    progress: 0,
    done: false,
    tick(dt: number) {
      elapsed += dt;
      let allDone = true;
      for (let i = 0; i < totalItems; i++) {
        const itemStart = i * staggerMs;
        if (elapsed >= itemStart) {
          items[i].tick(dt);
        }
        if (!items[i].done) allDone = false;
      }
      this.done = allDone;
      this.progress = allDone ? 1 : elapsed / (totalItems * staggerMs);
      return this.progress;
    },
    skipToEnd() {
      for (const item of items) item.skipToEnd();
      this.done = true;
      this.progress = 1;
    },
    reset() {
      elapsed = 0;
      for (const item of items) item.reset();
      this.done = false;
      this.progress = 0;
    },
  };
}

// ─── Primitive 2: arcMoveTo ──────────────────────────────────────────────────

/**
 * Animate position along an arc (via control point).
 */
export function arcMoveTo(
  from: { x: number; y: number },
  to: { x: number; y: number },
  control: { x: number; y: number },
  opts: AnimationOptions,
  onUpdate: (x: number, y: number) => void,
): AnimationHandle {
  return animateTo(0, 1, opts, (t) => {
    // Quadratic bezier
    const inv = 1 - t;
    const x = inv * inv * from.x + 2 * inv * t * control.x + t * t * to.x;
    const y = inv * inv * from.y + 2 * inv * t * control.y + t * t * to.y;
    onUpdate(x, y);
  });
}

// ─── Primitive 3: morphNumber ────────────────────────────────────────────────

/**
 * Animate a displayed number from→to (e.g. score counter).
 * Calls onUpdate with rounded integer values.
 */
export function morphNumber(
  from: number,
  to: number,
  opts: AnimationOptions,
  onUpdate: (value: number) => void,
): AnimationHandle {
  return animateTo(from, to, opts, (v) => onUpdate(Math.round(v)));
}

// ─── Primitive 4: drawLine ───────────────────────────────────────────────────

/**
 * Progressively reveal a line from start to end.
 * Returns handle; use `progress` to draw partial line in draw().
 */
export function drawLine(
  opts: AnimationOptions,
): AnimationHandle {
  let currentProgress = 0;
  return animateTo(0, 1, opts, (v) => {
    currentProgress = v;
  });
}

// ─── Primitive 5: sequence ───────────────────────────────────────────────────

/**
 * Run animations in sequence, one after another.
 */
export function sequence(steps: AnimationHandle[]): AnimationHandle {
  let currentIndex = 0;

  const handle: AnimationHandle = {
    progress: 0,
    done: steps.length === 0,
    tick(dt: number) {
      if (handle.done) return 1;
      while (currentIndex < steps.length) {
        steps[currentIndex].tick(dt);
        if (steps[currentIndex].done) {
          currentIndex++;
          // Remaining dt goes to next step (approximate)
          continue;
        }
        break;
      }
      handle.progress = steps.length > 0 ? currentIndex / steps.length : 1;
      if (currentIndex >= steps.length) {
        handle.done = true;
        handle.progress = 1;
      }
      return handle.progress;
    },
    skipToEnd() {
      for (const step of steps) step.skipToEnd();
      currentIndex = steps.length;
      handle.done = true;
      handle.progress = 1;
    },
    reset() {
      for (const step of steps) step.reset();
      currentIndex = 0;
      handle.done = false;
      handle.progress = 0;
    },
  };

  return handle;
}

// ─── Primitive 6: highlight ──────────────────────────────────────────────────

/**
 * Pulse highlight effect (opacity 0→1→0 or scale pulse).
 * Useful for drawing attention to an element.
 */
export function highlight(
  opts: AnimationOptions & { pulses?: number },
  onUpdate: (intensity: number) => void,
): AnimationHandle {
  const pulses = opts.pulses ?? 1;
  return animateTo(0, pulses, opts, (v) => {
    // Convert linear progress to sine pulse
    const phase = (v % 1) * Math.PI;
    onUpdate(Math.sin(phase));
  });
}

// ─── SequenceAnimation (high-level controller) ───────────────────────────────

export type AnimationState = "idle" | "playing" | "paused" | "finished";

/**
 * High-level animation controller with play/pause/reset/skipToEnd.
 * Wraps an AnimationHandle and drives it via requestAnimationFrame.
 */
export class SequenceAnimation {
  private handle: AnimationHandle;
  private state: AnimationState = "idle";
  private rafId = 0;
  private lastTime = 0;
  private onFinish?: () => void;

  constructor(handle: AnimationHandle, onFinish?: () => void) {
    this.handle = handle;
    this.onFinish = onFinish;
  }

  get currentState(): AnimationState {
    return this.state;
  }

  get progress(): number {
    return this.handle.progress;
  }

  play(): void {
    if (this.state === "playing") return;
    if (this.state === "finished") this.handle.reset();
    this.state = "playing";
    this.lastTime = performance.now();
    this.loop();
  }

  pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    cancelAnimationFrame(this.rafId);
  }

  reset(): void {
    this.state = "idle";
    cancelAnimationFrame(this.rafId);
    this.handle.reset();
  }

  skipToEnd(): void {
    cancelAnimationFrame(this.rafId);
    this.handle.skipToEnd();
    this.state = "finished";
    this.onFinish?.();
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.state = "idle";
  }

  private loop = (): void => {
    if (this.state !== "playing") return;
    const now = performance.now();
    const dt = now - this.lastTime;
    this.lastTime = now;

    this.handle.tick(dt);

    if (this.handle.done) {
      this.state = "finished";
      this.onFinish?.();
      return;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}
