/**
 * Challenge Mode — Unit Tests.
 *
 * Tests the state machine, timer logic, result storage, and best-result comparison.
 * Uses fake timers to avoid real delays.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getChallengeState,
  startChallenge,
  confirmTimeLimit,
  finishChallenge,
  cancelChallenge,
  isChallengeActive,
  getBestResult,
  formatTime,
  onChallengeStateChange,
} from "./challenge";

// Mock appState and appEvents
vi.mock("@core/state", () => {
  const results: unknown[] = [];
  return {
    appState: {
      saveChallengeResult: vi.fn((r: unknown) => results.push(r)),
      getChallengeHistory: vi.fn(() => results),
    },
  };
});

vi.mock("@core/events", () => {
  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  return {
    appEvents: {
      on: vi.fn((type: string, fn: (e: unknown) => void) => {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(fn);
        return () => {
          listeners[type] = listeners[type]!.filter(l => l !== fn);
        };
      }),
      emit: vi.fn((event: { type: string }) => {
        for (const fn of listeners[event.type] || []) fn(event);
      }),
      // Expose for tests
      _listeners: listeners,
    },
  };
});

describe("Challenge State Machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cancelChallenge(); // clean state
  });

  afterEach(() => {
    cancelChallenge();
    vi.useRealTimers();
  });

  it("starts in idle phase", () => {
    expect(getChallengeState().phase).toBe("idle");
    expect(isChallengeActive()).toBe(false);
  });

  it("transitions to configuring on startChallenge", () => {
    startChallenge({ mode: "sprint", moduleId: "test", taskType: "basic" });
    expect(getChallengeState().phase).toBe("configuring");
    expect(isChallengeActive()).toBe(false);
  });

  it("transitions to countdown on confirmTimeLimit", () => {
    startChallenge({ mode: "sprint", moduleId: "test", taskType: "basic" });
    confirmTimeLimit(120);
    expect(getChallengeState().phase).toBe("countdown");
    expect(getChallengeState().countdownValue).toBe(3);
    expect(isChallengeActive()).toBe(true);
  });

  it("countdown ticks 3→2→1→running", () => {
    startChallenge({ mode: "sprint", moduleId: "test", taskType: "basic" });
    confirmTimeLimit(120);

    expect(getChallengeState().countdownValue).toBe(3);

    vi.advanceTimersByTime(1000);
    expect(getChallengeState().countdownValue).toBe(2);

    vi.advanceTimersByTime(1000);
    expect(getChallengeState().countdownValue).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(getChallengeState().phase).toBe("running");
    expect(getChallengeState().countdownValue).toBe(0);
  });

  it("cancelChallenge resets to idle from any phase", () => {
    startChallenge({ mode: "sprint", moduleId: "test", taskType: "basic" });
    confirmTimeLimit(120);
    vi.advanceTimersByTime(3000); // now running

    cancelChallenge();
    expect(getChallengeState().phase).toBe("idle");
    expect(isChallengeActive()).toBe(false);
  });

  it("cancelChallenge during countdown resets cleanly", () => {
    startChallenge({ mode: "sprint", moduleId: "test", taskType: "basic" });
    confirmTimeLimit(120);
    vi.advanceTimersByTime(1500); // mid-countdown

    cancelChallenge();
    expect(getChallengeState().phase).toBe("idle");
  });

  it("finishChallenge sets phase to finished", () => {
    startChallenge({ mode: "sprint", moduleId: "test", taskType: "basic" });
    confirmTimeLimit(120);
    vi.advanceTimersByTime(3000); // running

    finishChallenge();
    expect(getChallengeState().phase).toBe("finished");
  });

  it("finishChallenge is a no-op when not running", () => {
    startChallenge({ mode: "sprint", moduleId: "test", taskType: "basic" });
    finishChallenge(); // configuring phase
    expect(getChallengeState().phase).toBe("configuring");
  });
});

describe("Challenge State Change Listener", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cancelChallenge();
  });

  afterEach(() => {
    cancelChallenge();
    vi.useRealTimers();
  });

  it("emits state changes on phase transitions", () => {
    const states: string[] = [];
    const cleanup = onChallengeStateChange((s) => states.push(s.phase));

    startChallenge({ mode: "sprint", moduleId: "test", taskType: "basic" });
    confirmTimeLimit(120);
    vi.advanceTimersByTime(3000);
    cancelChallenge();

    cleanup();

    expect(states).toContain("configuring");
    expect(states).toContain("countdown");
    expect(states).toContain("running");
    expect(states).toContain("idle");
  });

  it("cleanup function stops notifications", () => {
    const states: string[] = [];
    const cleanup = onChallengeStateChange((s) => states.push(s.phase));
    cleanup();

    startChallenge({ mode: "sprint", moduleId: "test", taskType: "basic" });
    expect(states).toHaveLength(0);
  });
});

describe("Challenge Config", () => {
  beforeEach(() => {
    cancelChallenge();
  });

  it("stores moduleId and taskType", () => {
    startChallenge({ mode: "sprint", moduleId: "multiplication", taskType: "dot" });
    expect(getChallengeState().config?.moduleId).toBe("multiplication");
    expect(getChallengeState().config?.taskType).toBe("dot");
  });

  it("stores selected time limit", () => {
    startChallenge({ mode: "sprint", moduleId: "test", taskType: "basic" });
    confirmTimeLimit(600);
    expect(getChallengeState().config?.timeLimitSec).toBe(600);
  });
});

describe("formatTime", () => {
  it("formats seconds as M:SS", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(125)).toBe("2:05");
    expect(formatTime(300)).toBe("5:00");
    expect(formatTime(599)).toBe("9:59");
  });
});

describe("getBestResult", () => {
  // Access the mock directly via the mocked module
  let mockResults: unknown[];

  beforeEach(async () => {
    cancelChallenge();
    const { appState } = await import("@core/state");
    mockResults = appState.getChallengeHistory() as unknown[];
    mockResults.length = 0;
  });

  it("returns null when no history", () => {
    expect(getBestResult("sprint", 120, "test", "basic")).toBeNull();
  });

  it("returns best by correct count for sprint mode", () => {
    mockResults.push({
      date: "2025-01-01", mode: "sprint", moduleId: "m", taskType: "t",
      timeLimit: 120, correct: 5, total: 7, errors: 2, elapsed: 120,
    });
    mockResults.push({
      date: "2025-01-02", mode: "sprint", moduleId: "m", taskType: "t",
      timeLimit: 120, correct: 8, total: 10, errors: 2, elapsed: 120,
    });

    const best = getBestResult("sprint", 120, "m", "t");
    expect(best?.correct).toBe(8);
  });

  it("filters by mode, timeLimit, moduleId, taskType", () => {
    mockResults.push({
      date: "2025-01-01", mode: "sprint", moduleId: "m1", taskType: "t1",
      timeLimit: 120, correct: 10, total: 10, errors: 0, elapsed: 120,
    });

    // Different module — should not match
    expect(getBestResult("sprint", 120, "m2", "t1")).toBeNull();
    // Different time limit — should not match
    expect(getBestResult("sprint", 300, "m1", "t1")).toBeNull();
    // Correct match
    expect(getBestResult("sprint", 120, "m1", "t1")?.correct).toBe(10);
  });
});
