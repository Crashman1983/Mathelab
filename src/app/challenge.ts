/**
 * Challenge Mode — State Machine + Timer.
 *
 * Two modes:
 * - Sprint: Solve as many tasks as possible in 2/5/10 minutes within one TaskType
 * - Rally: One task per TaskType across all modules, timed + error count
 *
 * Uses the existing event bus (task:completed / task:failed) to track results
 * without any module code changes.
 */

import { appEvents } from "@core/events";
import { appState } from "@core/state";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChallengeMode = "sprint" | "rally";
export type ChallengePhase = "idle" | "configuring" | "countdown" | "running" | "paused" | "finished";

export interface ChallengeConfig {
  mode: ChallengeMode;
  timeLimitSec: number;    // 120, 300, or 600
  moduleId?: string;       // Sprint: which module
  taskType?: string;       // Sprint: which task type
}

export interface ChallengeState {
  phase: ChallengePhase;
  config: ChallengeConfig | null;
  correct: number;
  errors: number;
  total: number;
  startTime: number;       // performance.now() when running started
  elapsed: number;         // seconds elapsed
  remaining: number;       // seconds remaining
  countdownValue: number;  // 3, 2, 1, 0
}

export interface ChallengeResult {
  date: string;
  mode: ChallengeMode;
  moduleId?: string;
  taskType?: string;
  timeLimit: number;
  correct: number;
  total: number;
  errors: number;
  elapsed: number;
}

export type ChallengeListener = (state: ChallengeState) => void;

// ─── Challenge Controller ────────────────────────────────────────────────────

let _state: ChallengeState = createIdleState();
let _listeners: ChallengeListener[] = [];
let _timerRAF = 0;
let _countdownTimer = 0;
let _taskCompletedCleanup: (() => void) | null = null;
let _taskFailedCleanup: (() => void) | null = null;

function createIdleState(): ChallengeState {
  return {
    phase: "idle",
    config: null,
    correct: 0,
    errors: 0,
    total: 0,
    startTime: 0,
    elapsed: 0,
    remaining: 0,
    countdownValue: 0,
  };
}

function emit(): void {
  for (const fn of _listeners) fn(_state);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Subscribe to challenge state changes */
export function onChallengeStateChange(fn: ChallengeListener): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter(l => l !== fn);
  };
}

/** Get current challenge state */
export function getChallengeState(): Readonly<ChallengeState> {
  return _state;
}

/** Is a challenge currently running (or paused)? */
export function isChallengeActive(): boolean {
  return _state.phase === "running" || _state.phase === "countdown" || _state.phase === "paused";
}

// Expose on window for synchronous checks from module-framework (avoids async import)
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__challengeActive = isChallengeActive;
}

/** Start configuring a challenge (show time selection) */
export function startChallenge(config: Omit<ChallengeConfig, "timeLimitSec">): void {
  _state = {
    ...createIdleState(),
    phase: "configuring",
    config: { ...config, timeLimitSec: 300 } as ChallengeConfig, // default 5 min
  };
  emit();
}

/** User selected a time limit — begin countdown */
export function confirmTimeLimit(seconds: number): void {
  if (!_state.config || _state.phase !== "configuring") return;
  _state.config.timeLimitSec = seconds;
  _state.phase = "countdown";
  _state.countdownValue = 3;
  _state.remaining = seconds;
  emit();

  // 3-2-1-Los! countdown
  let count = 3;
  _countdownTimer = window.setInterval(() => {
    count--;
    _state.countdownValue = count;
    emit();
    if (count <= 0) {
      clearInterval(_countdownTimer);
      beginRunning();
    }
  }, 1000);
}

/** Internal: (re)start the RAF timer tick loop */
function startTimerTick(): void {
  const tick = (): void => {
    if (_state.phase !== "running") return;
    const now = performance.now();
    _state.elapsed = (now - _state.startTime) / 1000;
    _state.remaining = Math.max(0, _state.config!.timeLimitSec - _state.elapsed);

    if (_state.remaining <= 0) {
      finishChallenge();
      return;
    }

    emit();
    _timerRAF = requestAnimationFrame(tick);
  };
  _timerRAF = requestAnimationFrame(tick);
}

/** Internal: start the actual challenge run */
function beginRunning(): void {
  _state.phase = "running";
  _state.startTime = performance.now();
  _state.correct = 0;
  _state.errors = 0;
  _state.total = 0;
  emit();

  // Subscribe to task events
  _taskCompletedCleanup = appEvents.on("task:completed", () => {
    if (_state.phase !== "running") return;
    _state.correct++;
    _state.total++;
    emit();
  });

  _taskFailedCleanup = appEvents.on("task:failed", () => {
    if (_state.phase !== "running") return;
    _state.errors++;
    _state.total++;
    emit();
  });

  startTimerTick();
}

/** End the challenge (timer expired or manual stop) */
export function finishChallenge(): void {
  if (_state.phase !== "running") return;

  cancelAnimationFrame(_timerRAF);
  _taskCompletedCleanup?.();
  _taskFailedCleanup?.();
  _taskCompletedCleanup = null;
  _taskFailedCleanup = null;

  _state.phase = "finished";
  _state.elapsed = Math.round(_state.elapsed);
  _state.remaining = 0;
  emit();

  // Save result
  const result: ChallengeResult = {
    date: new Date().toISOString(),
    mode: _state.config!.mode,
    moduleId: _state.config!.moduleId,
    taskType: _state.config!.taskType,
    timeLimit: _state.config!.timeLimitSec,
    correct: _state.correct,
    total: _state.total,
    errors: _state.errors,
    elapsed: _state.elapsed,
  };
  appState.saveChallengeResult(result);
}

/** Pause the running challenge — timer freezes, score is preserved */
export function pauseChallenge(): void {
  if (_state.phase !== "running") return;
  // RAF tick stops naturally on next frame (checks phase === "running")
  _state.phase = "paused";
  emit();
}

/** Resume a paused challenge — recalculates startTime to account for pause duration */
export function resumeChallenge(): void {
  if (_state.phase !== "paused") return;
  // Shift startTime forward so elapsed continues from where it was frozen
  _state.startTime = performance.now() - _state.elapsed * 1000;
  _state.phase = "running";
  emit();
  startTimerTick();
}

/** Cancel / dismiss an active challenge */
export function cancelChallenge(): void {
  clearInterval(_countdownTimer);
  cancelAnimationFrame(_timerRAF);
  _taskCompletedCleanup?.();
  _taskFailedCleanup?.();
  _taskCompletedCleanup = null;
  _taskFailedCleanup = null;
  _state = createIdleState();
  emit();
}

/** Get best result for a specific challenge config */
export function getBestResult(
  mode: ChallengeMode,
  timeLimitSec: number,
  moduleId?: string,
  taskType?: string,
): ChallengeResult | null {
  const history = appState.getChallengeHistory();
  const matching = history.filter(r =>
    r.mode === mode &&
    r.timeLimit === timeLimitSec &&
    r.moduleId === moduleId &&
    r.taskType === taskType
  );
  if (matching.length === 0) return null;
  // Best = most correct (sprint) or fewest errors + fastest time (rally)
  if (mode === "sprint") {
    return matching.reduce((best, r) => r.correct > best.correct ? r : best);
  } else {
    return matching.reduce((best, r) => {
      if (r.errors < best.errors) return r;
      if (r.errors === best.errors && r.elapsed < best.elapsed) return r;
      return best;
    });
  }
}

/** Format seconds as M:SS */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
