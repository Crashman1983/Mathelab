/**
 * Palm Rejection Utility (Decision E9).
 *
 * When a stylus/pen is active, touch events are suppressed.
 * Also filters non-primary pointers (multi-touch ghosts).
 */

export interface PalmRejection {
  /** Returns true if this pointer event should be ignored */
  shouldIgnore(e: PointerEvent): boolean;
  /** Clear active stylus state (call on module deactivate) */
  reset(): void;
}

export function createPalmRejection(): PalmRejection {
  let activeStylusId: number | null = null;

  return {
    shouldIgnore(e: PointerEvent): boolean {
      // Always filter non-primary pointers (multi-touch ghosts)
      if (!e.isPrimary) return true;

      if (e.type === "pointerdown") {
        if (e.pointerType === "pen") {
          activeStylusId = e.pointerId;
        }
        // Ignore touch when a stylus is active (palm on screen)
        if (e.pointerType === "touch" && activeStylusId !== null) {
          return true;
        }
      }

      if (e.type === "pointerup" || e.type === "pointercancel") {
        if (e.pointerType === "pen" && e.pointerId === activeStylusId) {
          activeStylusId = null;
        }
      }

      // Ignore touch events while stylus is active
      if (e.pointerType === "touch" && activeStylusId !== null) {
        return true;
      }

      return false;
    },

    reset(): void {
      activeStylusId = null;
    },
  };
}
