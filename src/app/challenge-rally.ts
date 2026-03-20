/**
 * Challenge Rally Mode — Cross-module timed challenge.
 *
 * One task per TaskType across all modules. Measures total time + error count.
 * Uses the Sprint challenge infrastructure for timer, events, and result storage.
 */

import type { AppShell } from "./shell";
import type { ModuleRegistration } from "@core/types";
import {
  startChallenge,
  confirmTimeLimit,
  cancelChallenge,
  finishChallenge,
  onChallengeStateChange,
  getChallengeState,
  formatTime,
  getBestResult,
} from "./challenge";
import { appEvents } from "@core/events";
import { playClickSound } from "@core/sounds";
import { attachChallengeUI, updateChallengeContainer, dismissChallengeUI } from "./challenge-ui";

// ─── Rally Sequence ──────────────────────────────────────────────────────────

interface RallyStep {
  moduleId: string;
  moduleLabel: string;
  moduleIcon: string;
  taskTypeId?: string; // first taskType (or undefined for single-type modules)
}

let rallySequence: RallyStep[] = [];
let rallyIndex = 0;
let rallyShell: AppShell | null = null;
let rallyErrors = 0;
let rallyCleanup: (() => void) | null = null;

/** Build the rally sequence: one step per module (first taskType) */
function buildSequence(registrations: ModuleRegistration[]): RallyStep[] {
  return registrations
    .filter(r => r.id !== "chance") // Skip explore-type modules
    .map(r => ({
      moduleId: r.id,
      moduleLabel: r.label,
      moduleIcon: r.icon,
    }));
}

/** Start rally from the home page */
export function startRallyFromHome(
  shell: AppShell,
  registrations: ModuleRegistration[],
): void {
  rallyShell = shell;
  rallySequence = buildSequence(registrations);
  rallyIndex = 0;
  rallyErrors = 0;

  // Show time config overlay on home
  showRallyConfig();
}

// ─── Rally Config UI ─────────────────────────────────────────────────────────

function showRallyConfig(): void {
  const container = document.getElementById("view-home");
  if (!container) return;

  const overlay = document.createElement("div");
  overlay.className = "challenge-config-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Rally konfigurieren");

  const card = document.createElement("div");
  card.className = "challenge-config-card";
  card.innerHTML = `
    <h2 style="margin:0 0 var(--space-md);font-size:var(--font-lead);text-align:center;">🏁 Modul-Rallye</h2>
    <p style="margin:0 0 var(--space-sm);text-align:center;color:var(--text-dim);font-size:var(--font-small);">
      Eine Aufgabe pro Modul — wie schnell schaffst du alle?
    </p>
    <p style="margin:0 0 var(--space-lg);text-align:center;color:var(--text-dim);font-size:var(--font-micro);">
      ${rallySequence.length} Module · Fehler werden gezählt
    </p>
    <div class="challenge-time-buttons">
      <button type="button" class="challenge-time-btn" data-seconds="300">5 min</button>
      <button type="button" class="challenge-time-btn challenge-time-btn--default" data-seconds="600">10 min</button>
      <button type="button" class="challenge-time-btn" data-seconds="0">Ohne Limit</button>
    </div>
    <button type="button" class="challenge-cancel-btn">Abbrechen</button>
  `;

  for (const btn of card.querySelectorAll(".challenge-time-btn")) {
    btn.addEventListener("click", () => {
      const sec = Number((btn as HTMLElement).dataset.seconds);
      overlay.remove();
      playClickSound();
      beginRally(sec);
    });
  }

  card.querySelector(".challenge-cancel-btn")?.addEventListener("click", () => {
    overlay.remove();
  });

  overlay.appendChild(card);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) { overlay.remove(); }
  });

  container.style.position = "relative";
  container.appendChild(overlay);
}

// ─── Rally Execution ─────────────────────────────────────────────────────────

function beginRally(timeLimitSec: number): void {
  if (!rallyShell || rallySequence.length === 0) return;

  // Start challenge timer (mode: rally)
  startChallenge({ mode: "rally" });
  if (timeLimitSec > 0) {
    confirmTimeLimit(timeLimitSec);
  } else {
    // No time limit — start immediately (skip config, manual countdown)
    confirmTimeLimit(99999); // effectively unlimited
  }

  // Attach challenge UI to the home view initially (will be moved on module switch)
  const homeView = document.getElementById("view-home");
  if (homeView) attachChallengeUI(homeView);

  // Listen for challenge state to transition to running
  const stateCleanup = onChallengeStateChange((state) => {
    if (state.phase === "running" && rallyIndex === 0) {
      activateNextModule();
    }
    if (state.phase === "finished") {
      showRallyResult();
      cleanup();
    }
  });

  // Listen for task completions to advance (ignore events while paused)
  const taskCleanup = appEvents.on("task:completed", () => {
    if (getChallengeState().phase !== "running") return;
    rallyIndex++;
    if (rallyIndex >= rallySequence.length) {
      // All modules done!
      finishChallenge();
    } else {
      activateNextModule();
    }
  });

  const taskFailCleanup = appEvents.on("task:failed", () => {
    if (getChallengeState().phase !== "running") return;
    rallyErrors++;
    // On error: still advance to next module (rally is about coverage, not perfection)
    rallyIndex++;
    if (rallyIndex >= rallySequence.length) {
      finishChallenge();
    } else {
      setTimeout(() => activateNextModule(), 1000); // Brief pause to show feedback
    }
  });

  rallyCleanup = () => {
    stateCleanup();
    taskCleanup();
    taskFailCleanup();
  };
}

function activateNextModule(): void {
  if (!rallyShell || rallyIndex >= rallySequence.length) return;
  const step = rallySequence[rallyIndex]!;
  rallyShell.activateModule(step.moduleId);

  // Move timer bar to the new module's container
  const view = document.getElementById(`view-${step.moduleId}`);
  if (view) updateChallengeContainer(view);
}

function cleanup(): void {
  rallyCleanup?.();
  rallyCleanup = null;
  dismissChallengeUI();
}

// ─── Rally Result Screen ─────────────────────────────────────────────────────

function showRallyResult(): void {
  const state = getChallengeState();
  const container = document.querySelector(".view.active") ?? document.getElementById("view-home");
  if (!container) return;

  const elapsed = state.elapsed;
  const correct = rallySequence.length - rallyErrors;
  const total = rallySequence.length;

  // Check best
  const timeLimitSec = state.config?.timeLimitSec ?? 0;
  const best = getBestResult("rally", timeLimitSec);
  const isNewRecord = !best || elapsed < best.elapsed || (elapsed === best.elapsed && rallyErrors < best.errors);

  const overlay = document.createElement("div");
  overlay.className = "challenge-result-overlay";
  overlay.setAttribute("role", "dialog");

  const card = document.createElement("div");
  card.className = "challenge-result-card";
  card.innerHTML = `
    <div class="challenge-result-emoji">${isNewRecord ? "🏆" : "🏁"}</div>
    <h2 class="challenge-result-title">Rallye geschafft!</h2>
    <p class="challenge-result-subtitle">
      ${correct}/${total} Module · ${formatTime(elapsed)} · ${rallyErrors} Fehler
    </p>
    ${isNewRecord
      ? `<p class="challenge-result-record">${best ? `Neuer Rekord! Vorher: ${formatTime(best.elapsed)}` : "Dein erster Rekord!"}</p>`
      : `<p class="challenge-result-compare">Rekord: ${formatTime(best!.elapsed)} (${best!.errors} Fehler)</p>`
    }
    <div class="challenge-result-buttons">
      <button type="button" class="challenge-result-btn challenge-result-btn--primary">Nochmal</button>
      <button type="button" class="challenge-result-btn challenge-result-btn--secondary">Startseite</button>
    </div>
  `;

  card.querySelector(".challenge-result-btn--primary")?.addEventListener("click", () => {
    overlay.remove();
    cancelChallenge();
    if (rallyShell) {
      rallyShell.showHome();
      showRallyConfig();
    }
    playClickSound();
  });

  card.querySelector(".challenge-result-btn--secondary")?.addEventListener("click", () => {
    overlay.remove();
    cancelChallenge();
    rallyShell?.showHome();
    playClickSound();
  });

  overlay.appendChild(card);
  (container as HTMLElement).style.position = "relative";
  container.appendChild(overlay);
}
