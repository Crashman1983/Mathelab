/**
 * Generic Drag Tracker.
 *
 * Tracks pointer drag with configurable threshold.
 * Used as base for radial-drag and 3D rotation.
 */

export interface DragState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  /** Delta from start position */
  dx: number;
  dy: number;
  pointerId: number;
}

export interface DragConfig {
  /** Minimum pixels before drag activates (default: 4) */
  threshold?: number;
  onStart?: (state: DragState) => void;
  onMove?: (state: DragState) => void;
  onEnd?: (state: DragState) => void;
  onCancel?: () => void;
}

export interface DragTracker {
  handleDown(x: number, y: number, pointerId: number): void;
  handleMove(x: number, y: number): void;
  handleUp(): void;
  handleCancel(): void;
  getState(): DragState;
}

const EMPTY_STATE: DragState = {
  active: false,
  startX: 0, startY: 0,
  currentX: 0, currentY: 0,
  dx: 0, dy: 0,
  pointerId: -1,
};

export function createDragTracker(config: DragConfig): DragTracker {
  const threshold = config.threshold ?? 4;
  let state: DragState = { ...EMPTY_STATE };
  let pending = false; // waiting for threshold

  return {
    handleDown(x: number, y: number, pointerId: number): void {
      state = {
        active: false,
        startX: x, startY: y,
        currentX: x, currentY: y,
        dx: 0, dy: 0,
        pointerId,
      };
      pending = true;
    },

    handleMove(x: number, y: number): void {
      if (!pending && !state.active) return;

      state.currentX = x;
      state.currentY = y;
      state.dx = x - state.startX;
      state.dy = y - state.startY;

      if (pending) {
        const dist = Math.sqrt(state.dx * state.dx + state.dy * state.dy);
        if (dist >= threshold) {
          pending = false;
          state.active = true;
          config.onStart?.(state);
        }
        return;
      }

      if (state.active) {
        config.onMove?.(state);
      }
    },

    handleUp(): void {
      if (state.active) {
        config.onEnd?.(state);
      }
      state = { ...EMPTY_STATE };
      pending = false;
    },

    handleCancel(): void {
      if (state.active || pending) {
        config.onCancel?.();
      }
      state = { ...EMPTY_STATE };
      pending = false;
    },

    getState(): DragState {
      return state;
    },
  };
}
