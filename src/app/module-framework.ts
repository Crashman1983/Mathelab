/**
 * Module DSL Framework (Baustein 2).
 *
 * `defineModule()` takes a declarative ModuleDefinition and produces
 * a LernModul-compatible object with:
 * - Auto Canvas setup + DPI handling via CanvasScene
 * - Teacher control bar (Hinweis/Lösung/Nächste)
 * - Task-type chips for switching task variants
 * - Optional numpad for numeric input
 * - Session tracking + sound feedback
 * - Keyboard shortcuts (Space=next, H=hint, L=solution)
 * - ARIA labels + Canvas label updates
 */

// Extend Window for debug overlay (DEV only)
declare global {
  interface Window {
    __mathelaborDebug?: {
      module: string;
      hitAreas: Array<{ x: number; y: number; w: number; h: number; id: string; enabled: boolean }>;
      infoAreas: Array<{ x: number; y: number; w: number; h: number; id: string }>;
      violations: Array<{ type: string; areas: string[]; detail: string }>;
      canvasW: number;
      canvasH: number;
    };
  }
}

import type { LernModul, ModuleRegistration } from "@core/types";
import { createScene, type CanvasScene } from "@canvas/scene";
import type { CanvasNode, ScenePointerEvent } from "@canvas/nodes/types";
import { playRandomCorrectSound, playWrongSound, playClickSound } from "@core/sounds";
import { speakIfEnabled, isTTSEnabled } from "@core/tts";
import { prefersReducedMotion } from "@core/utils";
import { appState } from "@core/state";
import { appEvents } from "@core/events";
import { navigateHome } from "@app/router";

// ─── Module Definition (declarative DSL) ─────────────────────────────────────

export interface CheckResult {
  correct: boolean;
  /** Feedback message shown to student */
  feedback?: string;
  /** Partial credit (0-1) for partial answers */
  partial?: number;
  /** If true, the answer step was accepted but the task continues (e.g. multi-step input).
   *  Framework clears input, shows feedback, but does NOT play sounds or auto-advance. */
  continueInput?: boolean;
}

export interface SolutionDisplay {
  /** Text explanation of the solution */
  text: string;
  /** Optional scene tree for visual solution */
  scene?: CanvasNode;
}

export interface TaskTypeDefinition {
  /** Unique type id (e.g. "core", "swap", "division") */
  id: string;
  /** Display label for task-type chips */
  label: string;
  /** Icon for task-type chip */
  icon?: string;
}

export interface DifficultyDefinition {
  /** Numeric level (1 = Junior, 2 = Checker, 3 = BossBaby) */
  level: number;
  /** Display label */
  label: string;
  /** Icon */
  icon?: string;
  /** Short description of the number range */
  desc?: string;
}

/** Standard difficulty presets — tied to grade-level number ranges.
 *  Junior  (1./2. Klasse): ZR 100
 *  Checker (3. Klasse):    ZR 1.000  — DEFAULT
 *  BossBaby (4. Klasse):   ZR 1.000.000 */
export const DIFFICULTIES: DifficultyDefinition[] = [
  { level: 1, label: "Junior", icon: "🐣", desc: "Zahlenraum bis 100" },
  { level: 2, label: "Checker", icon: "🌟", desc: "Zahlenraum bis 1.000" },
  { level: 3, label: "BossBaby", icon: "🚀", desc: "Zahlenraum bis 1.000.000" },
];

// ─── Tutorial System ───────────────────────────────────────────────────────

export interface TutorialStep {
  /** Step title, e.g. "So geht's" */
  title: string;
  /** Explanation text */
  text: string;
  /** Mathematical background (optional, shown in smaller text) */
  mathBackground?: string;
  /** Optional draw function for animated illustration on a mini-canvas.
   *  `progress` goes from 0→1 over `duration` ms. */
  draw?: (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    progress: number,
  ) => void;
  /** Animation duration in ms (default 2000) */
  duration?: number;
}

export interface ModuleDefinition<TTask = unknown, TState = unknown> {
  // ─── Identity ────────────────────────────────────────────────────────────
  id: string;
  label: string;
  icon: string;
  description: string;

  // ─── Flow ────────────────────────────────────────────────────────────────
  /** "task" = structured generate→check flow, "explore" = open-ended */
  flowType: "task" | "explore";

  // ─── Task Types ──────────────────────────────────────────────────────────
  taskTypes?: TaskTypeDefinition[];

  // ─── Difficulty ──────────────────────────────────────────────────────────
  difficulties?: DifficultyDefinition[];

  // ─── Celebration ───────────────────────────────────────────────────────
  /** Celebration intensity after correct answer.
   *  "full" (default): all animations + long celebratory sounds.
   *  "subtle": quick check animation + short sounds only. */
  celebrationIntensity?: "full" | "subtle";

  /** Auto-advance delay in ms after correct answer (default 5000).
   *  Set to 0 to disable auto-advance entirely. */
  autoAdvanceMs?: number;

  // ─── Tutorial ──────────────────────────────────────────────────────────

  /** Tutorial steps shown at module/mode start. Can be static or per-taskType. */
  tutorial?: TutorialStep[] | ((taskType: string) => TutorialStep[]);

  // ─── Pure Functions ──────────────────────────────────────────────────────

  /** Generate a new task. Must be pure (no side effects). */
  generate(ctx: GenerateContext): TTask;

  /** Check student's answer. Must be pure. */
  check?(task: TTask, answer: unknown): CheckResult;

  /** Get hints for current task (min 2 required by framework). */
  hints?(task: TTask): string[];

  /** Get solution display. */
  getSolution?(task: TTask): SolutionDisplay;

  // ─── Scene Building ──────────────────────────────────────────────────────

  /** Build the Canvas scene tree for a given task and state. */
  buildScene(ctx: SceneContext<TTask, TState>): CanvasNode;

  // ─── State ───────────────────────────────────────────────────────────────

  /** Initial module state (beyond the current task). */
  initialState?(): TState;

  // ─── Input ───────────────────────────────────────────────────────────────

  /** Input mode for the module. Can be a function for per-task-type modes. */
  input?: "numberPad" | "canvas" | "dom" | ((taskType: string) => "numberPad" | "canvas" | "dom");

  // ─── Explanation Animation ───────────────────────────────────────────────

  /** Optional explanation animation (Baustein 15). */
  explain?(ctx: ExplainContext<TTask>): void;

  /** Optional: human-readable task label for TTS (called at interact-start).
   *  Returns the text to speak when the task starts.
   *  Falls back to first hint if not provided. */
  taskLabel?(task: TTask): string;

  /** Optional: restrict visible numpad digits based on expected answer range.
   *  Returns max possible answer value — digits above it are dimmed. */
  answerRange?(task: TTask): number | undefined;

  // ─── Pointer Hooks ─────────────────────────────────────────────────────

  /** Called on pointer down */
  onPointerDown?(ctx: PointerContext<TTask, TState>): void;
  /** Called on pointer move */
  onPointerMove?(ctx: PointerContext<TTask, TState>): void;
  /** Called on pointer up */
  onPointerUp?(ctx: PointerContext<TTask, TState>): void;

  /** Called on keyboard key press. Return true to consume the event (prevent default numpad handling). */
  onKeyDown?(key: string, ctx: ModuleContext<TTask, TState>): boolean;

  // ─── Lifecycle Hooks ─────────────────────────────────────────────────────

  onActivate?(ctx: ModuleContext<TTask, TState>): void;
  onDeactivate?(ctx: ModuleContext<TTask, TState>): void;
  /** Called when a hint is shown (teacher click or auto). hintIndex is 0-based. */
  onHint?(hintIndex: number, ctx: ModuleContext<TTask, TState>): void;
}

// ─── Context Types ───────────────────────────────────────────────────────────

export interface GenerateContext {
  taskType: string;
  difficulty: number;
  /** Previous task (to avoid repeats) */
  previous?: unknown;
}

export interface SceneContext<TTask, TState> {
  task: TTask;
  state: TState;
  canvasWidth: number;
  canvasHeight: number;
  input: string;
  result: CheckResult | null;
  attemptCount: number;
  phase: "interact";
  /** True after a wrong answer — modules can render a comparison overlay */
  showComparison: boolean;
}

export interface ExplainContext<TTask> {
  task: TTask;
  scene: CanvasScene;
}

export interface ModuleContext<TTask, TState> {
  task: TTask;
  state: TState;
  scene: CanvasScene;
  /** Current phase */
  phase: "interact";
  /** Generate and display a new task */
  nextTask(): void;
  /** Update module state */
  setState(partial: Partial<TState>): void;
  /** Functional state update */
  updateState(fn: (s: TState) => TState): void;
  /** Mark scene as needing re-render without full rebuild */
  invalidate(): void;
  /** Submit an answer for checking */
  submitAnswer(answer: unknown): CheckResult | undefined;
  /** Rebuild the scene tree from current state */
  rebuildScene(): void;
}

/** Pointer event context — extends ModuleContext with pointer info */
export interface PointerContext<TTask, TState> extends ModuleContext<TTask, TState> {
  /** X position in CSS pixels relative to canvas */
  x: number;
  /** Y position in CSS pixels relative to canvas */
  y: number;
  pointerId: number;
  pointerType: "mouse" | "touch" | "pen";
  /** Hit-tested target (ButtonNode or null) */
  target: ScenePointerEvent["target"];
}

// ─── Runtime Implementation ──────────────────────────────────────────────────

interface RuntimeState<TTask, TState> {
  task: TTask;
  moduleState: TState;
  taskType: string;
  difficulty: number;
  input: string;
  result: CheckResult | null;
  attemptCount: number;
  hintIndex: number;
  sessionCorrect: number;
  sessionTotal: number;
  phase: "interact";
  /** Module crashed — error boundary active */
  crashed: boolean;
  /** Show comparison overlay after wrong answer */
  showComparison: boolean;
}

/**
 * Create a LernModul from a declarative ModuleDefinition.
 * This is the primary V2 API for building modules.
 */
export function defineModule<TTask, TState>(
  def: ModuleDefinition<TTask, TState>,
): ModuleRegistration {
  // Validate hints requirement
  // Recommended 4-tier hint structure:
  //   [0] strategisch — strategic approach hint
  //   [1] visuell — visual/concrete hint
  //   [2] Teilschritt — partial step / scaffolding
  //   [3] (solution via getSolution)
  const validateHints = (task: TTask): void => {
    if (def.flowType === "task" && def.hints) {
      const hints = def.hints(task);
      if (hints.length < 2) {
        console.warn(
          `[${def.id}] Task must define at least 2 hints, got ${hints.length}`,
        );
      } else if (hints.length < 4) {
        console.info(
          `[${def.id}] Empfehlung: 4 Hints (strategisch → visuell → Teilschritt), aktuell ${hints.length}`,
        );
      }
    }
  };

  const factory = (): LernModul => {
    let scene: CanvasScene | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let container: HTMLElement | null = null;
    let statusEl: HTMLElement | null = null;
    let chipsEl: HTMLElement | null = null;
    let sessionCounterEl: HTMLElement | null = null;
    let inputDisplayEl: HTMLElement | null = null;
    let keyboardHandler: ((e: KeyboardEvent) => void) | null = null;
    let hintDotsEl: HTMLElement | null = null;
    let numpadButtons: HTMLButtonElement[] = [];
    let numpadPanelEl: HTMLElement | null = null;
    let flyDigitEl: HTMLElement | null = null;

    // ── Error Boundary ─────────────────────────────────────────────────────
    let errorOverlayEl: HTMLElement | null = null;

    /** Wrap a module callback in try/catch. On crash, show error overlay. */
    function wrapSafe<T>(fn: () => T, label: string): T | undefined {
      try {
        return fn();
      } catch (err) {
        console.error(`[${def.id}] Crash in ${label}:`, err);
        state.crashed = true;
        showModuleError(err);
        return undefined;
      }
    }

    function showModuleError(_err: unknown): void {
      if (errorOverlayEl || !container) return;
      const overlay = document.createElement("div");
      overlay.className = "module-error-overlay";
      overlay.style.cssText = [
        "position:absolute;inset:0;z-index:8",
        "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px",
        "background:var(--panel);border-radius:var(--radius-lg)",
        "padding:var(--space-lg);text-align:center",
      ].join(";");
      overlay.innerHTML = `
        <span style="font-size:48px">⚠️</span>
        <strong style="font-size:var(--font-lead);color:var(--bad)">Modul-Fehler</strong>
        <p style="font-size:var(--font-small);color:var(--text);max-width:400px;margin:0">
          Etwas ist schiefgelaufen. Du kannst es nochmal versuchen oder zur Startseite gehen.
        </p>
        <div style="display:flex;gap:var(--space-sm)">
          <button class="module-error-retry" style="padding:var(--space-sm) var(--space-lg);border-radius:var(--radius-md);background:var(--accent);color:var(--text-on-accent);font-weight:600;min-height:48px;min-width:120px;cursor:pointer;font-size:var(--font-small)">Nochmal</button>
          <button class="module-error-home" style="padding:var(--space-sm) var(--space-lg);border-radius:var(--radius-md);background:var(--panel-soft);color:var(--text);font-weight:600;min-height:48px;min-width:120px;cursor:pointer;font-size:var(--font-small)">Startseite</button>
        </div>
      `;
      overlay.querySelector(".module-error-retry")?.addEventListener("click", () => {
        dismissModuleError();
        state.crashed = false;
        generateNewTask();
      });
      overlay.querySelector(".module-error-home")?.addEventListener("click", () => {
        dismissModuleError();
        navigateHome();
      });
      // Ensure container is positioned for the absolute overlay
      if (container.style.position !== "relative") {
        container.style.position = "relative";
      }
      container.appendChild(overlay);
      errorOverlayEl = overlay;
    }

    function dismissModuleError(): void {
      errorOverlayEl?.remove();
      errorOverlayEl = null;
    }

    // ── Auto-advance countdown ──────────────────────────────────────────────
    let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
    let autoAdvanceRAF: number | null = null;
    let autoAdvanceBarEl: HTMLElement | null = null;
    let autoAdvanceStartTime = 0;
    let autoAdvancePending = false; // Guard: prevents stale rAF from adding listener after cancel
    const AUTO_ADVANCE_MS = def.autoAdvanceMs ?? 5000;

    /** Resolve the current input mode (may depend on active task type). */
    const resolveInputMode = (): "numberPad" | "canvas" | "dom" | undefined => {
      if (typeof def.input === "function") return def.input(state.taskType);
      return def.input;
    };

    /** Show/hide numpad panel based on current input mode. */
    const syncNumpadVisibility = (): void => {
      if (!numpadPanelEl) return;
      const mode = resolveInputMode();
      const wantNumpad = mode === "numberPad";
      numpadPanelEl.style.display = wantNumpad ? "" : "none";
    };

    /** Global click listener to cancel auto-advance from anywhere */
    const onGlobalClickCancel = (): void => {
      cancelAutoAdvance();
    };

    const cancelAutoAdvance = (): void => {
      autoAdvancePending = false; // Prevent any queued rAF from adding the listener
      if (autoAdvanceTimer !== null) {
        clearTimeout(autoAdvanceTimer);
        autoAdvanceTimer = null;
      }
      if (autoAdvanceRAF !== null) {
        cancelAnimationFrame(autoAdvanceRAF);
        autoAdvanceRAF = null;
      }
      if (autoAdvanceBarEl) {
        autoAdvanceBarEl.remove();
        autoAdvanceBarEl = null;
      }
      // Remove global click listener
      document.removeEventListener("click", onGlobalClickCancel, true);
    };

    const startAutoAdvance = (): void => {
      cancelAutoAdvance();
      if (!statusEl || AUTO_ADVANCE_MS <= 0) return;

      // Create the countdown bar container
      const bar = document.createElement("div");
      bar.className = "auto-advance-bar";
      bar.setAttribute("role", "timer");
      const totalSec = Math.ceil(AUTO_ADVANCE_MS / 1000);
      bar.setAttribute("aria-label", `Nächste Aufgabe in ${totalSec} Sekunden`);
      const fill = document.createElement("div");
      fill.className = "auto-advance-bar__fill";
      bar.appendChild(fill);

      // Cancel label
      const cancelLabel = document.createElement("span");
      cancelLabel.className = "auto-advance-bar__label";
      cancelLabel.textContent = `Nächste in ${totalSec}s — klick zum Abbrechen`;
      bar.appendChild(cancelLabel);

      // Click to cancel — both on bar itself and anywhere on the page
      bar.addEventListener("click", (e) => {
        e.stopPropagation();
        cancelAutoAdvance();
      });
      // Delay adding global listener by one frame so the current click event
      // (that triggered the correct answer) doesn't immediately cancel.
      // Guard: only add listener if this auto-advance is still active (not cancelled).
      autoAdvancePending = true;
      requestAnimationFrame(() => {
        if (autoAdvancePending) {
          document.addEventListener("click", onGlobalClickCancel, true);
        }
      });

      statusEl.insertAdjacentElement("afterend", bar);
      autoAdvanceBarEl = bar;

      // Animate progress
      autoAdvanceStartTime = performance.now();
      const animate = (): void => {
        const elapsed = performance.now() - autoAdvanceStartTime;
        const progress = Math.min(elapsed / AUTO_ADVANCE_MS, 1);
        fill.style.width = `${progress * 100}%`;
        const remaining = Math.ceil((AUTO_ADVANCE_MS - elapsed) / 1000);
        cancelLabel.textContent = `Nächste in ${remaining}s — klick zum Abbrechen`;
        if (progress < 1) {
          autoAdvanceRAF = requestAnimationFrame(animate);
        }
      };
      if (!prefersReducedMotion()) {
        autoAdvanceRAF = requestAnimationFrame(animate);
      } else {
        // Reduced motion: just show static bar, no animation
        fill.style.width = "100%";
        fill.style.transition = `width ${AUTO_ADVANCE_MS}ms linear`;
        requestAnimationFrame(() => { fill.style.width = "0%"; });
      }

      // Auto-advance after 5s
      autoAdvanceTimer = setTimeout(() => {
        cancelAutoAdvance();
        if (!container || state.crashed) return; // guard: module may be deactivated
        generateNewTask();
      }, AUTO_ADVANCE_MS);
    };

    const defaultTaskType = def.taskTypes?.[0]?.id ?? "default";
    const storedDifficulty = appState.get("difficulty");
    const defaultDifficulty = storedDifficulty ?? def.difficulties?.[0]?.level ?? 1;

    let state: RuntimeState<TTask, TState> = {
      task: undefined as unknown as TTask,
      moduleState: (def.initialState?.() ?? {}) as TState,
      taskType: defaultTaskType,
      difficulty: defaultDifficulty,
      input: "",
      result: null,
      attemptCount: 0,
      hintIndex: 0,
      sessionCorrect: 0,
      sessionTotal: 0,
      phase: "interact",
      crashed: false,
      showComparison: false,
    };

    const generateNewTask = (): void => {
      // Cancel any pending auto-advance
      cancelAutoAdvance();

      // Sanfter Aufgabenwechsel-Fade (V2: Orientierung beibehalten)
      if (canvas) {
        canvas.style.transition = "opacity 150ms ease";
        canvas.style.opacity = "0.15";
      }

      const previous = state.task;
      const generated = wrapSafe(
        () => def.generate({ taskType: state.taskType, difficulty: state.difficulty, previous }),
        "generate",
      );
      if (generated === undefined) return; // crash handled by error boundary
      state.task = generated;
      state.input = "";
      state.result = null;
      state.showComparison = false;
      state.attemptCount = 0;
      state.hintIndex = 0;
      // Reset module-specific state for fresh task (e.g. Symmetrie answer grid)
      if (def.initialState) {
        state.moduleState = def.initialState() as TState;
      }
      // After auto-advance, skip present phase → go directly to interact
      state.phase = "interact";
      validateHints(state.task);
      rebuildScene();
      updateStatus();
      updateSessionCounter();
      updateHintDots();
      updateNumpadDimming();
      if (inputDisplayEl) inputDisplayEl.textContent = "";

      // Fade-In nach kurzem Delay (Canvas muss erst gerendert sein)
      requestAnimationFrame(() => {
        if (canvas) canvas.style.opacity = "1";
      });
    };

    const rebuildScene = (): void => {
      if (!scene || !canvas) return;
      if (state.crashed) return; // error boundary active — skip rendering
      const rect = canvas.getBoundingClientRect();
      const root = wrapSafe(() => def.buildScene({
        task: state.task,
        state: state.moduleState,
        canvasWidth: rect.width,
        canvasHeight: rect.height,
        input: state.input,
        result: state.result,
        attemptCount: state.attemptCount,
        phase: state.phase,
        showComparison: state.showComparison,
      }), "buildScene");
      if (!root) return; // crash handled
      scene.setRoot(root);
      scene.render();

      // DEV: Bridge draw violations to __mathelaborDebug
      if (import.meta.env.DEV) {
        const drawViolations = scene.getDrawViolations();
        if (drawViolations.length > 0) {
          const existing = window.__mathelaborDebug;
          const violations = drawViolations.flatMap(dv =>
            dv.overlaps.map(o => ({
              type: "custom-draw-overlap" as const,
              areas: [o.regionA, o.regionB],
              detail: o.detail,
            })),
          );
          if (existing) {
            existing.violations = [...existing.violations, ...violations];
          } else {
            window.__mathelaborDebug = {
              module: def.id,
              hitAreas: scene.getHitAreasSummary().map(a => ({
                ...a.rect,
                id: a.id,
                enabled: a.enabled,
              })),
              infoAreas: [],
              violations,
              canvasW: rect.width,
              canvasH: rect.height,
            };
          }
        }
      }

      // Update canvas aria-label with task context (Baustein 14)
      const taskLabel = def.hints?.(state.task)?.[0] ?? def.label;
      canvas.setAttribute("aria-label", `${def.label}: ${taskLabel}`);
    };

    let submitting = false;
    const submitAnswer = (answer: unknown): CheckResult | undefined => {
      if (!def.check || submitting) return undefined;
      submitting = true;
      state.showComparison = false;
      state.attemptCount++;
      const result = wrapSafe(() => def.check!(state.task, answer), "check");
      if (!result) return undefined; // crash handled
      state.result = result;

      // continueInput: step accepted but task not done yet — clear input, no sounds, no advance
      if (result.continueInput) {
        state.input = "";
        if (inputDisplayEl) inputDisplayEl.textContent = "\u00A0";
        rebuildScene();
        updateStatus();
        return result;
      }

      state.sessionTotal++;
      appState.recordStat(def.id, state.taskType, result.correct);
      appEvents.emit({
        type: result.correct ? "task:completed" : "task:failed",
        payload: { correct: state.sessionCorrect, attempts: state.sessionTotal },
      });
      if (result.correct) {
        state.sessionCorrect++;
        const intensity = def.celebrationIntensity ?? "full";
        playRandomCorrectSound(intensity);
        // Subtle: always use checkmark (variant 0), full: random variant
        scene?.triggerCelebration(intensity === "subtle" ? 0 : undefined);
        // Start auto-advance countdown (5s → next task)
        startAutoAdvance();
      } else {
        playWrongSound();
        state.showComparison = true;

        // V2: Auto-Hint Escalation — 4-tier progressive scaffolding
        // Attempt 2→Hint1 (strategisch), 4→Hint2 (visuell), 6→Hint3 (Teilschritt), 8→Lösung
        if (def.hints) {
          const hints = def.hints(state.task);
          if (state.attemptCount === 2 && state.hintIndex < 1 && hints.length >= 1) {
            setTimeout(() => showHint(true), 600);
          } else if (state.attemptCount === 4 && state.hintIndex < 2 && hints.length >= 2) {
            setTimeout(() => showHint(true), 600);
          } else if (state.attemptCount === 6 && state.hintIndex < 3 && hints.length >= 3) {
            setTimeout(() => showHint(true), 600);
          } else if (state.attemptCount === 8 && def.getSolution) {
            setTimeout(() => showSolution(), 600);
          }
        }
      }
      rebuildScene();
      updateStatus();
      updateSessionCounter();
      submitting = false;
      return result;
    };

    const updateStatus = (): void => {
      if (!statusEl) return;
      if (state.result?.correct) {
        statusEl.textContent = state.result.feedback ?? "Richtig!";
        statusEl.className = "status-box status-box--ok";
      } else if (state.result?.continueInput) {
        // Multi-step input accepted — show encouraging feedback (ok style)
        statusEl.textContent = state.result.feedback ?? "Weiter…";
        statusEl.className = "status-box status-box--ok";
      } else if (state.result && !state.result.correct) {
        statusEl.textContent = state.result.feedback ?? "Probier nochmal!";
        statusEl.className = "status-box status-box--hint";
      } else {
        statusEl.textContent = "";
        statusEl.className = "status-box";
      }
    };

    const updateSessionCounter = (): void => {
      if (!sessionCounterEl) return;
      const total = appState.getModuleStats(def.id);
      const pct = total.attempts > 0 ? Math.round(total.correct / total.attempts * 100) : 0;
      // Compact format: "3/5 ✅" — full stats in title attribute
      if (state.sessionTotal > 0) {
        sessionCounterEl.textContent = `${state.sessionCorrect}/${state.sessionTotal} ✅`;
      } else {
        sessionCounterEl.textContent = "";
      }
      sessionCounterEl.setAttribute("title",
        total.attempts > 0
          ? `${state.sessionTotal} Aufgaben · ${state.sessionCorrect} richtig · Gesamt: ${total.correct}/${total.attempts} (${pct}%)`
          : `${state.sessionTotal} Aufgaben · ${state.sessionCorrect} richtig`
      );
    };


    const updateHintDots = (): void => {
      if (!hintDotsEl || !def.hints) return;
      const hints = def.hints(state.task);
      const total = hints.length;
      const filled = Math.min(state.hintIndex, total);
      hintDotsEl.innerHTML = "";
      for (let i = 0; i < total; i++) {
        const dot = document.createElement("span");
        dot.className = `hint-dot${i < filled ? " hint-dot--filled" : ""}`;
        hintDotsEl.appendChild(dot);
      }
    };

    const updateNumpadDimming = (): void => {
      if (!def.answerRange || numpadButtons.length === 0) return;
      const maxVal = def.answerRange(state.task);
      if (maxVal === undefined) {
        // No range restriction — all enabled
        for (const btn of numpadButtons) btn.classList.remove("numpad-dimmed");
        return;
      }
      // Determine max useful digit count
      const maxDigits = String(maxVal).length;
      const currentLen = state.input.length;
      for (const btn of numpadButtons) {
        const digit = btn.dataset.digit;
        if (digit === undefined) continue;
        // Dim digits that would make the number exceed the range
        const wouldBe = Number(state.input + digit);
        const tooLong = currentLen + 1 > maxDigits;
        const tooLarge = wouldBe > maxVal && currentLen + 1 >= maxDigits;
        btn.classList.toggle("numpad-dimmed", tooLong || tooLarge);
      }
    };

    const triggerFlyAnimation = (digitText: string, sourceBtn: HTMLButtonElement | null): void => {
      if (prefersReducedMotion() || !sourceBtn || !canvas || !flyDigitEl) return;
      const srcRect = sourceBtn.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const targetX = canvasRect.left + canvasRect.width / 2;
      const targetY = canvasRect.top + canvasRect.height * 0.6;

      flyDigitEl.textContent = digitText;
      flyDigitEl.style.left = `${srcRect.left + srcRect.width / 2}px`;
      flyDigitEl.style.top = `${srcRect.top + srcRect.height / 2}px`;
      flyDigitEl.style.opacity = "1";
      flyDigitEl.style.transform = "translate(-50%, -50%) scale(1)";
      flyDigitEl.classList.remove("fly-digit--active");

      // Force reflow to restart animation
      void flyDigitEl.offsetWidth;

      flyDigitEl.style.left = `${targetX}px`;
      flyDigitEl.style.top = `${targetY}px`;
      flyDigitEl.style.opacity = "0";
      flyDigitEl.style.transform = "translate(-50%, -50%) scale(0.5)";
      flyDigitEl.classList.add("fly-digit--active");
    };

    // ─── Tutorial Overlay ─────────────────────────────────────────────────

    let tutorialOverlayEl: HTMLElement | null = null;
    let tutorialAnimFrame = 0;

    /** @param onDone receives the taskType id of the active tab when tutorial closes */
    const showTutorial = (onDone: (selectedTaskType: string) => void): void => {
      if (!def.tutorial || !container) { onDone(state.taskType); return; }

      // ─── Build tab data: collect tutorial steps for each taskType ─────────
      interface TabData { id: string; label: string; icon?: string; steps: TutorialStep[] }
      const tabs: TabData[] = [];

      if (typeof def.tutorial === "function" && def.taskTypes && def.taskTypes.length > 1) {
        for (const tt of def.taskTypes) {
          const s = (def.tutorial as (t: string) => TutorialStep[])(tt.id);
          if (s && s.length > 0) tabs.push({ id: tt.id, label: tt.label, icon: tt.icon, steps: s });
        }
      } else {
        // Static steps or single taskType — single tab (no tab bar shown)
        const s = typeof def.tutorial === "function"
          ? def.tutorial(state.taskType)
          : def.tutorial;
        if (s && s.length > 0) tabs.push({ id: state.taskType, label: "", steps: s });
      }

      if (tabs.length === 0) { onDone(state.taskType); return; }

      // Start on the tab matching current taskType, or first
      let activeTabIdx = Math.max(0, tabs.findIndex(t => t.id === state.taskType));
      let currentStep = 0;

      // Remove previous tutorial if any
      tutorialOverlayEl?.remove();
      cancelAnimationFrame(tutorialAnimFrame);

      const overlay = document.createElement("div");
      overlay.className = "tutorial-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "Tutorial");

      const card = document.createElement("div");
      card.className = "tutorial-card";

      // ─── Tab bar (only if multiple tabs) ─────────────────────────────────
      let tabBarEl: HTMLElement | null = null;
      if (tabs.length > 1) {
        tabBarEl = document.createElement("div");
        tabBarEl.className = "tutorial-tabs";
        tabBarEl.setAttribute("role", "tablist");
        card.appendChild(tabBarEl);
      }

      // Mini-canvas for animated illustration
      const miniCanvas = document.createElement("canvas");
      miniCanvas.className = "tutorial-canvas";
      miniCanvas.width = 400;
      miniCanvas.height = 220;
      card.appendChild(miniCanvas);

      // Text container
      const textWrap = document.createElement("div");
      textWrap.className = "tutorial-text";
      card.appendChild(textWrap);

      // Dots
      const dotsWrap = document.createElement("div");
      dotsWrap.className = "tutorial-dots";
      card.appendChild(dotsWrap);

      // Nav buttons
      const navWrap = document.createElement("div");
      navWrap.className = "tutorial-nav";

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "control-bar-btn tutorial-next";
      nextBtn.style.cssText = "background:var(--accent);color:var(--text-on-accent);font-weight:600;";

      navWrap.appendChild(nextBtn);
      card.appendChild(navWrap);

      overlay.appendChild(card);

      // "Nicht mehr anzeigen" dismiss link
      const dismissWrap = document.createElement("div");
      dismissWrap.style.cssText = "text-align:center;margin-top:var(--space-xs);";
      const dismissLink = document.createElement("button");
      dismissLink.type = "button";
      dismissLink.style.cssText = "background:none;border:none;color:var(--text-dim);font-size:var(--font-micro);cursor:pointer;padding:var(--space-xs);text-decoration:underline;";
      dismissLink.textContent = "Tutorial nicht mehr anzeigen";
      dismissLink.addEventListener("click", () => {
        const key = `${def.id}/${tabs[activeTabIdx].id}`;
        appState.dismissTutorial(key);
        closeTutorial();
      });
      dismissWrap.appendChild(dismissLink);
      card.appendChild(dismissWrap);

      const closeTutorial = () => {
        cancelAnimationFrame(tutorialAnimFrame);
        overlay.classList.add("tutorial-overlay--closing");
        const selectedType = tabs[activeTabIdx].id;
        setTimeout(() => { overlay.remove(); tutorialOverlayEl = null; }, 300);
        onDone(selectedType);
      };

      // ─── Render tab bar ──────────────────────────────────────────────────
      const renderTabs = () => {
        if (!tabBarEl) return;
        tabBarEl.innerHTML = "";
        for (let i = 0; i < tabs.length; i++) {
          const tab = tabs[i];
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `tutorial-tab${i === activeTabIdx ? " tutorial-tab--active" : ""}`;
          btn.setAttribute("role", "tab");
          btn.setAttribute("aria-selected", String(i === activeTabIdx));
          btn.textContent = `${tab.icon ? tab.icon + " " : ""}${tab.label}`;
          btn.addEventListener("click", () => {
            if (i === activeTabIdx) return;
            playClickSound();
            activeTabIdx = i;
            currentStep = 0;
            renderTabs();
            renderStep();
          });
          tabBarEl.appendChild(btn);
        }
      };

      // ─── Animate mini-canvas ─────────────────────────────────────────────
      const animateCanvas = (step: TutorialStep) => {
        cancelAnimationFrame(tutorialAnimFrame);
        if (step.draw) {
          const ctx2d = miniCanvas.getContext("2d");
          if (ctx2d) {
            const dpr = window.devicePixelRatio || 1;
            miniCanvas.width = Math.round(miniCanvas.clientWidth * dpr);
            miniCanvas.height = Math.round(miniCanvas.clientHeight * dpr);
            ctx2d.scale(dpr, dpr);
            const w = miniCanvas.clientWidth;
            const h = miniCanvas.clientHeight;
            const duration = step.duration ?? 2000;
            const startTime = performance.now();
            const drawFn = step.draw;

            const loop = () => {
              const elapsed = performance.now() - startTime;
              const progress = Math.min(elapsed / duration, 1);
              ctx2d.clearRect(0, 0, w, h);
              drawFn(ctx2d, w, h, progress);
              if (progress < 1) {
                tutorialAnimFrame = requestAnimationFrame(loop);
              }
            };
            tutorialAnimFrame = requestAnimationFrame(loop);
          }
        } else {
          const ctx2d = miniCanvas.getContext("2d");
          if (ctx2d) ctx2d.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
        }
      };

      const renderStep = () => {
        const steps = tabs[activeTabIdx].steps;
        const step = steps[currentStep];
        const isLast = currentStep === steps.length - 1;

        // Title + text
        textWrap.innerHTML = `
          <h3 class="tutorial-title">${step.title}</h3>
          <p class="tutorial-desc">${step.text}</p>
          ${step.mathBackground ? `<p class="tutorial-math">📐 ${step.mathBackground}</p>` : ""}
        `;

        // Dots (only if multiple steps in current tab)
        if (steps.length > 1) {
          dotsWrap.style.display = "";
          dotsWrap.innerHTML = steps.map((_, i) =>
            `<span class="tutorial-dot${i === currentStep ? " tutorial-dot--active" : ""}"></span>`
          ).join("");
        } else {
          dotsWrap.style.display = "none";
        }

        // Button label
        nextBtn.textContent = isLast ? "Los geht's!" : "Weiter →";

        // Animate mini-canvas
        animateCanvas(step);

        // TTS
        speakIfEnabled(`${step.title}. ${step.text}${step.mathBackground ? ". " + step.mathBackground : ""}`);
      };

      nextBtn.addEventListener("click", () => {
        playClickSound();
        const steps = tabs[activeTabIdx].steps;
        if (currentStep < steps.length - 1) {
          currentStep++;
          renderStep();
        } else {
          closeTutorial();
        }
      });

      // ESC to close
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") { closeTutorial(); document.removeEventListener("keydown", onKeyDown); }
      };
      document.addEventListener("keydown", onKeyDown);

      container.style.position = "relative";
      container.appendChild(overlay);
      tutorialOverlayEl = overlay;

      renderTabs();
      renderStep();
    };


    const showHint = (autoTriggered = false): void => {
      if (!def.hints || !statusEl) return;
      const hints = def.hints(state.task);
      if (hints.length === 0) return;
      const idx = state.hintIndex;
      const hint = hints[Math.min(idx, hints.length - 1)];
      state.hintIndex++;
      statusEl.textContent = `💡 ${hint}`;
      statusEl.className = "status-box status-box--task";
      if (!autoTriggered) playClickSound();
      updateHintDots();
      // TTS: speak hint
      speakIfEnabled(hint);
      // Notify module (e.g. for visual hint animations)
      def.onHint?.(idx, moduleContext);
    };

    const showSolution = (): void => {
      if (!def.getSolution || !statusEl) return;
      const sol = def.getSolution(state.task);
      statusEl.textContent = `📖 ${sol.text}`;
      statusEl.className = "status-box status-box--warn";
      playClickSound();
      speakIfEnabled(sol.text);
    };

    const handleNumpadKey = (digit: string, sourceBtn?: HTMLButtonElement): void => {
      if (state.result?.correct) return;
      if (digit === "clear") {
        state.input = "";
      } else if (digit === "back") {
        state.input = state.input.slice(0, -1);
      } else if (digit === "enter") {
        if (state.input.length > 0) {
          submitAnswer(Number(state.input));
        }
        return;
      } else {
        if (state.input.length < 6) {
          state.input += digit;
          // V8: Fly animation — digit flies from numpad to canvas
          if (sourceBtn) triggerFlyAnimation(digit, sourceBtn);
        }
      }
      if (inputDisplayEl) inputDisplayEl.textContent = state.input || "\u00A0";
      updateNumpadDimming();
      rebuildScene();
      playClickSound();
    };

    const renderChips = (): void => {
      if (!chipsEl) return;
      chipsEl.innerHTML = "";

      // Task-type chips
      if (def.taskTypes && def.taskTypes.length > 1) {
        for (const tt of def.taskTypes) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = `task-chip${tt.id === state.taskType ? " active" : ""}`;
          chip.textContent = `${tt.icon ? tt.icon + " " : ""}${tt.label}`;
          chip.addEventListener("click", () => {
            state.taskType = tt.id;
            renderChips();
            syncNumpadVisibility();
            generateNewTask();
            playClickSound();
            // Show tutorial on mode switch (unless user dismissed it)
            showTutorialIfNeeded();
          });
          chipsEl.appendChild(chip);
        }
      }

      // Difficulty chips removed from topbar — now controlled via
      // home page selector + topbar badge (shell.ts)
    };

    const hasChips = def.taskTypes && def.taskTypes.length > 1;

    const buildDOM = (el: HTMLElement): void => {
      // Build numpad if ANY task type could need it (static or dynamic)
      const hasNumpad = typeof def.input === "function"
        ? (def.taskTypes ?? []).some(tt => (def.input as (t: string) => string)(tt.id) === "numberPad")
        : def.input === "numberPad";

      // Main wrapper
      const wrapper = document.createElement("div");
      wrapper.className = "v2-module";
      wrapper.style.cssText = "display:flex;flex-direction:column;height:100%;min-width:0;overflow:hidden;";

      // Task/difficulty chips — render into topbar slot
      if (hasChips) {
        const topbarChips = document.getElementById("topbar-chips");
        if (topbarChips) {
          topbarChips.removeAttribute("hidden");
          chipsEl = topbarChips;
        }
      }

      // Middle area: canvas + optional numpad side panel
      const middle = document.createElement("div");
      middle.className = "v2-middle";

      // Canvas column (takes remaining space)
      const canvasCol = document.createElement("div");
      canvasCol.className = "v2-canvas-col";

      const canvasWrap = document.createElement("div");
      canvasWrap.className = "canvas-container";
      canvasWrap.style.cssText = "flex:1;min-height:0;";
      const cvs = document.createElement("canvas");
      cvs.id = `${def.id}-canvas`;
      cvs.setAttribute("role", "img");
      cvs.setAttribute("aria-label", def.label);
      canvasWrap.appendChild(cvs);
      canvasCol.appendChild(canvasWrap);

      // Status box
      const status = document.createElement("div");
      status.id = `${def.id}-status`;
      status.className = "status-box status-box--module-margin";
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      canvasCol.appendChild(status);

      middle.appendChild(canvasCol);

      // Numpad panel (right side, calculator-style 3×4 grid)
      if (hasNumpad) {
        const numpadPanel = document.createElement("div");
        numpadPanel.className = "v2-numpad";

        // Input display
        const inputDisp = document.createElement("div");
        inputDisp.className = "v2-numpad__display";
        inputDisp.textContent = "\u00A0";
        numpadPanel.appendChild(inputDisp);
        inputDisplayEl = inputDisp;

        // Numpad grid (calculator layout: 7-8-9 / 4-5-6 / 1-2-3 / ⌫-0-OK)
        const grid = document.createElement("div");
        grid.className = "v2-numpad__grid";
        numpadButtons = [];
        const keys = ["1","2","3","4","5","6","7","8","9","⌫","0","↵"];
        for (const k of keys) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "v2-numpad__btn";
          if (k === "⌫") {
            btn.classList.add("v2-numpad__btn--back");
            btn.textContent = "⌫";
            btn.setAttribute("aria-label", "Löschen");
          } else if (k === "↵") {
            btn.classList.add("v2-numpad__btn--enter");
            btn.textContent = "OK";
            btn.setAttribute("aria-label", "Bestätigen");
          } else {
            btn.textContent = k;
            btn.dataset.digit = k;
            numpadButtons.push(btn);
          }
          btn.addEventListener("click", () => {
            if (k === "⌫") {
              // Let module handle backspace if it has onKeyDown
              if (!def.onKeyDown?.("Backspace", moduleContext)) handleNumpadKey("back");
              else { rebuildScene(); playClickSound(); }
            } else if (k === "↵") {
              if (!def.onKeyDown?.("Enter", moduleContext)) handleNumpadKey("enter");
              else { rebuildScene(); playClickSound(); }
            } else {
              // Let module handle digit if it has onKeyDown (e.g. column entry in algorithms)
              if (!def.onKeyDown?.(k, moduleContext)) handleNumpadKey(k, btn);
              else { rebuildScene(); playClickSound(); }
            }
          });
          grid.appendChild(btn);
        }
        numpadPanel.appendChild(grid);
        middle.appendChild(numpadPanel);
        numpadPanelEl = numpadPanel;

        // Initially sync visibility (may be hidden for current task type)
        syncNumpadVisibility();
      }

      wrapper.appendChild(middle);

      // ── Action Row (inside canvasCol, close to content) ──
      const bar = document.createElement("div");
      bar.className = "control-bar";

      const hintWrap = document.createElement("div");
      hintWrap.className = "hint-btn-wrap";

      const hintBtn = document.createElement("button");
      hintBtn.type = "button";
      hintBtn.className = "control-bar-btn";
      hintBtn.textContent = "💡 Hinweis";
      hintBtn.addEventListener("click", () => showHint());

      const dots = document.createElement("div");
      dots.className = "hint-dots";
      hintDotsEl = dots;

      hintWrap.appendChild(hintBtn);
      hintWrap.appendChild(dots);

      const solBtn = document.createElement("button");
      solBtn.type = "button";
      solBtn.className = "control-bar-btn";
      solBtn.textContent = "📖 Lösung";
      solBtn.addEventListener("click", showSolution);

      // Compact session counter: "3/5 ✅"
      const counter = document.createElement("span");
      counter.style.cssText =
        "font-size:var(--font-small);color:var(--text-dim);white-space:nowrap;";
      counter.textContent = "";
      counter.setAttribute("title", "0 Aufgaben · 0 richtig");
      sessionCounterEl = counter;

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "control-bar-btn";
      nextBtn.style.cssText = "background:var(--accent);color:var(--text-on-accent);";
      nextBtn.textContent = "→ Nächste";
      nextBtn.addEventListener("click", () => {
        generateNewTask();
        playClickSound();
      });

      // Left group: Hinweis + Lösung
      const barLeft = document.createElement("div");
      barLeft.className = "control-bar__group control-bar__left";

      barLeft.appendChild(hintWrap);
      if (def.getSolution) barLeft.appendChild(solBtn);

      // Tutorial recall button (❓) — opens tutorial on demand
      if (def.tutorial) {
        const tutBtn = document.createElement("button");
        tutBtn.type = "button";
        tutBtn.className = "control-bar-btn";
        tutBtn.textContent = "❓";
        tutBtn.setAttribute("title", "Tutorial anzeigen");
        tutBtn.setAttribute("aria-label", "Tutorial anzeigen");
        tutBtn.addEventListener("click", () => {
          // Reset dismiss for current taskType so tutorial shows
          const key = `${def.id}/${state.taskType}`;
          appState.resetTutorialDismiss(key);
          showTutorialIfNeeded();
          playClickSound();
        });
        barLeft.appendChild(tutBtn);
      }

      // Challenge button (⏱) — starts sprint challenge for current task type
      if (def.flowType === "task" && def.check) {
        const challengeBtn = document.createElement("button");
        challengeBtn.type = "button";
        challengeBtn.className = "control-bar-btn";
        challengeBtn.textContent = "⏱";
        challengeBtn.setAttribute("title", "Sprint-Challenge starten");
        challengeBtn.setAttribute("aria-label", "Sprint-Challenge starten");
        challengeBtn.addEventListener("click", () => {
          import("./challenge-ui").then(({ showChallengeConfig }) => {
            if (container) {
              showChallengeConfig(container, def.id, state.taskType);
            }
          });
          playClickSound();
        });
        barLeft.appendChild(challengeBtn);
      }

      // Center group: compact counter
      const barCenter = document.createElement("div");
      barCenter.className = "control-bar__group control-bar__center";
      barCenter.appendChild(counter);

      // Right group: Nächste
      const barRight = document.createElement("div");
      barRight.className = "control-bar__group control-bar__right";
      barRight.appendChild(nextBtn);

      bar.appendChild(barLeft);
      bar.appendChild(barCenter);
      bar.appendChild(barRight);

      // Append action row inside canvasCol (after status-box, close to content)
      wrapper.appendChild(bar);


      // V8: Fly-digit element (fixed-positioned ghost digit for animation)
      const flyEl = document.createElement("div");
      flyEl.className = "fly-digit";
      flyEl.setAttribute("aria-hidden", "true");
      el.appendChild(flyEl);
      flyDigitEl = flyEl;

      el.appendChild(wrapper);

      canvas = cvs;
      statusEl = status;
    };

    // Show tutorial if not dismissed by user (stored per module+taskType)
    const showTutorialIfNeeded = (): void => {
      if (!def.tutorial || !container) return;
      // Skip tutorials during challenge mode
      if (window.__challengeActive?.()) return;
      const key = `${def.id}/${state.taskType}`;
      if (appState.isTutorialDismissed(key)) return;

      showTutorial((selectedType) => {
        if (selectedType !== state.taskType) {
          state.taskType = selectedType;
          renderChips();
          syncNumpadVisibility();
          generateNewTask();
        }
        rebuildScene();
      });
    };

    const moduleContext: ModuleContext<TTask, TState> = {
      get task() { return state.task; },
      get state() { return state.moduleState; },
      get scene() { return scene!; },
      get phase() { return state.phase; },
      nextTask: generateNewTask,
      setState(partial: Partial<TState>) {
        state.moduleState = { ...state.moduleState, ...partial };
        rebuildScene();
      },
      updateState(fn: (s: TState) => TState) {
        state.moduleState = fn(state.moduleState);
        rebuildScene();
      },
      invalidate() {
        scene?.invalidate();
      },
      submitAnswer,
      rebuildScene,
    };

    return {
      id: def.id,
      label: def.label,
      icon: def.icon,
      description: def.description,

      mount(el: HTMLElement): void {
        container = el;
        buildDOM(el);
        scene = createScene(canvas!);
        scene.attachPointerEvents();
        renderChips();
        generateNewTask();
      },

      activate(): void {
        // Sync difficulty from appState (may have changed via badge/overlay)
        const currentDifficulty = appState.get("difficulty") ?? def.difficulties?.[0]?.level ?? 1;
        if (state.difficulty !== currentDifficulty) {
          state.difficulty = currentDifficulty;
          generateNewTask();
        }

        // Restore topbar chips (deactivate clears them)
        if (hasChips) {
          const topbarChips = document.getElementById("topbar-chips");
          if (topbarChips) {
            topbarChips.removeAttribute("hidden");
            chipsEl = topbarChips;
          }
          renderChips();
        }

        if (scene) {
          scene.render();
          scene.startLoop();

          // Wire pointer event handlers → module hooks
          const makePointerCtx = (e: ScenePointerEvent): PointerContext<TTask, TState> => ({
            ...moduleContext,
            x: e.x,
            y: e.y,
            pointerId: e.pointerId,
            pointerType: e.pointerType,
            target: e.target,
          });

          scene.setEventHandlers({
            onPointerDown(e) {
              if (state.crashed) return;
              wrapSafe(() => def.onPointerDown?.(makePointerCtx(e)), "onPointerDown");
            },
            onPointerMove(e) {
              if (state.crashed) return;
              wrapSafe(() => def.onPointerMove?.(makePointerCtx(e)), "onPointerMove");
            },
            onPointerUp(e) {
              if (state.crashed) return;
              wrapSafe(() => def.onPointerUp?.(makePointerCtx(e)), "onPointerUp");
            },
          });
        }
        // Focus management (Baustein 14)
        if (canvas) {
          canvas.tabIndex = 0;
          canvas.focus({ preventScroll: true });
        }
        // Keyboard shortcuts
        keyboardHandler = (e: KeyboardEvent) => {
          // Don't capture when typing in an input
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

          switch (e.key) {
            case " ":
              e.preventDefault();
              generateNewTask();
              playClickSound();
              break;
            case "h":
            case "H":
              if (!e.ctrlKey && !e.metaKey) showHint();
              break;
            case "l":
            case "L":
              if (!e.ctrlKey && !e.metaKey) showSolution();
              break;
            default:
              // Module-level keyboard hook — if it returns true, skip default handling
              if (def.onKeyDown?.(e.key, moduleContext)) {
                e.preventDefault();
                break;
              }
              // Digit keys for numpad
              if (resolveInputMode() === "numberPad" && /^[0-9]$/.test(e.key)) {
                handleNumpadKey(e.key);
              } else if (resolveInputMode() === "numberPad" && e.key === "Backspace") {
                handleNumpadKey("back");
              } else if (resolveInputMode() === "numberPad" && e.key === "Enter") {
                handleNumpadKey("enter");
              }
          }
        };
        document.addEventListener("keydown", keyboardHandler);

        // ── Dev-Mode Test API ──────────────────────────────────────────────
        // Exposes a programmatic interface for automation tools (Claude, Playwright).
        // Bypasses DOM pointer events + palm rejection entirely.
        // Tree-shaken in production builds via `import.meta.env.DEV` guard.
        // IMPORTANT: Must be set up BEFORE onActivate so modules can attach extensions.
        if (import.meta.env.DEV && scene) {
          const currentScene = scene;

          window.__moduleTestAPI = {
            // State
            getModuleState: () => state.moduleState,
            getPhase: () => state.phase,
            getTask: () => {
              // Serialize task (Sets → arrays for JSON-friendliness)
              const t = state.task as Record<string, unknown>;
              const result: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(t)) {
                result[k] = v instanceof Set ? [...v] : v;
              }
              return result;
            },

            // Actions
            updateState: (fn: (s: unknown) => unknown) => {
              state.moduleState = fn(state.moduleState) as TState;
              rebuildScene();
            },
            rebuildScene,
            submitAnswer,

            // Pointer simulation
            simulatePointerDown: (x: number, y: number) => {
              wrapSafe(() => def.onPointerDown?.({
                ...moduleContext,
                x, y,
                pointerId: 1,
                pointerType: "mouse",
                target: currentScene.hitTest(x, y),
              } as PointerContext<TTask, TState>), "onPointerDown");
            },
            simulatePointerMove: (x: number, y: number) => {
              wrapSafe(() => def.onPointerMove?.({
                ...moduleContext,
                x, y,
                pointerId: 1,
                pointerType: "mouse",
                target: null,
              } as PointerContext<TTask, TState>), "onPointerMove");
            },
            simulatePointerUp: (x: number, y: number) => {
              wrapSafe(() => def.onPointerUp?.({
                ...moduleContext,
                x, y,
                pointerId: 1,
                pointerType: "mouse",
                target: currentScene.hitTest(x, y),
              } as PointerContext<TTask, TState>), "onPointerUp");
            },
            simulateTap: (x: number, y: number) => {
              const api = window.__moduleTestAPI;
              api?.simulatePointerDown(x, y);
              api?.simulatePointerUp(x, y);
            },

            // Scene graph queries
            getHitAreas: () => currentScene.getHitAreasSummary(),
            tapButton: (id: string) => {
              const area = currentScene.findHitArea(id);
              if (!area?.onTap) return false;
              const r = area.rect;
              area.onTap(r.x + r.w / 2, r.y + r.h / 2);
              return true;
            },
          };
        }

        // onActivate is called AFTER Test API setup so modules can attach extensions
        // (e.g. api.grid = {...}) and find window.__moduleTestAPI already set.
        def.onActivate?.(moduleContext);

        // Show tutorial (unless user dismissed it for this task type)
        showTutorialIfNeeded();

        // V4: Initial hint dots
        updateHintDots();

        // V7: TTS Auto-Read on activate
        if (isTTSEnabled()) {
          const label = def.taskLabel?.(state.task)
            ?? def.hints?.(state.task)?.[0]
            ?? def.label;
          speakIfEnabled(label);
        }
      },

      deactivate(): void {
        cancelAutoAdvance();
        dismissModuleError();
        // Cancel sprint challenges when leaving module (rally challenges persist across modules)
        import("./challenge").then(({ cancelChallenge, getChallengeState }) => {
          const s = getChallengeState();
          if (s.phase !== "idle" && s.config?.mode === "sprint") {
            cancelChallenge();
            import("./challenge-ui").then(({ dismissChallengeUI }) => dismissChallengeUI()).catch(() => {});
          }
        }).catch(() => {});
        scene?.stopLoop();
        state.crashed = false;
        submitting = false;
        if (keyboardHandler) {
          document.removeEventListener("keydown", keyboardHandler);
          keyboardHandler = null;
        }
        // Clean topbar chips
        const topbarChips = document.getElementById("topbar-chips");
        if (topbarChips) {
          topbarChips.innerHTML = "";
          topbarChips.setAttribute("hidden", "");
        }
        def.onDeactivate?.(moduleContext);
        // Clean up test API
        if (import.meta.env.DEV) {
          delete window.__moduleTestAPI;
        }
      },

      resize(): void {
        rebuildScene();
      },

      destroy(): void {
        cancelAutoAdvance();
        scene?.destroy();
        if (keyboardHandler) {
          document.removeEventListener("keydown", keyboardHandler);
          keyboardHandler = null;
        }
        scene = null;
        canvas = null;
        container = null;
        statusEl = null;
        chipsEl = null;
        sessionCounterEl = null;
        inputDisplayEl = null;
        hintDotsEl = null;
        flyDigitEl = null;
        numpadButtons = [];
        numpadPanelEl = null;
      },
    };
  };

  return {
    id: def.id,
    label: def.label,
    icon: def.icon,
    description: def.description,
    factory,
  };
}
