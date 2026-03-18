/**
 * Tests fuer den generischen Drag Tracker.
 */
import { describe, it, expect, vi } from "vitest";
import { createDragTracker } from "./drag";

describe("createDragTracker()", () => {
  it("Initial State ist inaktiv", () => {
    const tracker = createDragTracker({});
    const state = tracker.getState();
    expect(state.active).toBe(false);
    expect(state.pointerId).toBe(-1);
  });

  it("handleDown setzt startX/startY", () => {
    const tracker = createDragTracker({});
    tracker.handleDown(100, 200, 1);
    const state = tracker.getState();
    expect(state.startX).toBe(100);
    expect(state.startY).toBe(200);
    expect(state.pointerId).toBe(1);
  });

  it("handleMove unter Threshold aktiviert Drag nicht", () => {
    const onStart = vi.fn();
    const tracker = createDragTracker({ onStart, threshold: 10 });
    tracker.handleDown(50, 50, 1);
    tracker.handleMove(52, 52); // distance ~2.8, under threshold 10
    expect(tracker.getState().active).toBe(false);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("handleMove ueber Threshold aktiviert Drag und ruft onStart", () => {
    const onStart = vi.fn();
    const tracker = createDragTracker({ onStart, threshold: 4 });
    tracker.handleDown(50, 50, 1);
    tracker.handleMove(60, 50); // distance 10, over threshold 4
    expect(tracker.getState().active).toBe(true);
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("handleMove nach Aktivierung ruft onMove", () => {
    const onMove = vi.fn();
    const tracker = createDragTracker({ onMove, threshold: 4 });
    tracker.handleDown(50, 50, 1);
    tracker.handleMove(60, 50); // activates
    tracker.handleMove(70, 50); // should call onMove
    expect(onMove).toHaveBeenCalledOnce();
  });

  it("handleUp bei aktivem Drag ruft onEnd", () => {
    const onEnd = vi.fn();
    const tracker = createDragTracker({ onEnd, threshold: 4 });
    tracker.handleDown(50, 50, 1);
    tracker.handleMove(60, 50); // activate
    tracker.handleUp();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("handleUp ohne Drag ruft onEnd nicht", () => {
    const onEnd = vi.fn();
    const tracker = createDragTracker({ onEnd });
    tracker.handleDown(50, 50, 1);
    tracker.handleUp(); // no move, no activation
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("handleCancel ruft onCancel bei aktivem Drag", () => {
    const onCancel = vi.fn();
    const tracker = createDragTracker({ onCancel, threshold: 4 });
    tracker.handleDown(50, 50, 1);
    tracker.handleMove(60, 50); // activate
    tracker.handleCancel();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("handleCancel ruft onCancel bei pending (unter Threshold)", () => {
    const onCancel = vi.fn();
    const tracker = createDragTracker({ onCancel, threshold: 100 });
    tracker.handleDown(50, 50, 1);
    // no move yet — still pending
    tracker.handleCancel();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("Nach handleUp ist State zurueckgesetzt", () => {
    const tracker = createDragTracker({ threshold: 4 });
    tracker.handleDown(50, 50, 1);
    tracker.handleMove(60, 50); // activate
    tracker.handleUp();
    const state = tracker.getState();
    expect(state.active).toBe(false);
    expect(state.pointerId).toBe(-1);
  });

  it("dx/dy werden korrekt berechnet", () => {
    const tracker = createDragTracker({ threshold: 4 });
    tracker.handleDown(100, 100, 1);
    tracker.handleMove(120, 130);
    const state = tracker.getState();
    expect(state.dx).toBe(20);
    expect(state.dy).toBe(30);
  });

  it("Threshold Default ist 4", () => {
    const onStart = vi.fn();
    const tracker = createDragTracker({ onStart });
    tracker.handleDown(0, 0, 1);
    tracker.handleMove(3, 0); // distance 3, under default 4
    expect(onStart).not.toHaveBeenCalled();
    tracker.handleMove(5, 0); // distance 5, over default 4
    expect(onStart).toHaveBeenCalledOnce();
  });
});
