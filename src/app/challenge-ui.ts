/**
 * Challenge Mode UI — Timer bar, countdown overlay, and result screen.
 *
 * Renders into a container element (typically the module view).
 * Subscribes to challenge state changes and updates DOM reactively.
 */

import {
  type ChallengeState,
  onChallengeStateChange,
  startChallenge,
  confirmTimeLimit,
  cancelChallenge,
  getBestResult,
  formatTime,
} from "./challenge";
import { playClickSound } from "@core/sounds";
import { appState } from "@core/state";

// ─── DOM Elements (created once, updated reactively) ─────────────────────────

let timerBarEl: HTMLElement | null = null;
let countdownOverlayEl: HTMLElement | null = null;
let resultOverlayEl: HTMLElement | null = null;
let configOverlayEl: HTMLElement | null = null;
let containerEl: HTMLElement | null = null;
let cleanupFn: (() => void) | null = null;

// ─── Public API ──────────────────────────────────────────────────────────────

/** Start the challenge UI for a sprint in the given container */
export function showChallengeConfig(
  container: HTMLElement,
  moduleId: string,
  taskType: string,
): void {
  containerEl = container;

  // Subscribe to state changes
  cleanupFn?.();
  cleanupFn = onChallengeStateChange(handleStateChange);

  // Start configuring
  startChallenge({ mode: "sprint", moduleId, taskType });
}

/** Attach challenge UI (timer bar + result) to a container without showing config.
 *  Used by Rally mode which has its own config UI. */
export function attachChallengeUI(container: HTMLElement): void {
  containerEl = container;
  cleanupFn?.();
  cleanupFn = onChallengeStateChange(handleStateChange);
}

/** Update the container for the timer bar (e.g. when switching modules in rally) */
export function updateChallengeContainer(container: HTMLElement): void {
  // Move timer bar to new container
  if (timerBarEl) {
    const canvasCol = container.querySelector(".v2-canvas-col");
    if (canvasCol) {
      canvasCol.insertBefore(timerBarEl, canvasCol.firstChild);
    }
  }
  containerEl = container;
}

/** Clean up all challenge UI elements */
export function dismissChallengeUI(): void {
  timerBarEl?.remove();
  countdownOverlayEl?.remove();
  resultOverlayEl?.remove();
  configOverlayEl?.remove();
  timerBarEl = null;
  countdownOverlayEl = null;
  resultOverlayEl = null;
  configOverlayEl = null;
  cleanupFn?.();
  cleanupFn = null;
}

// ─── State Change Handler ────────────────────────────────────────────────────

function handleStateChange(state: ChallengeState): void {
  switch (state.phase) {
    case "configuring":
      showConfigUI(state);
      break;
    case "countdown":
      hideConfigUI();
      showCountdown(state);
      break;
    case "running":
      hideCountdown();
      showTimerBar(state);
      break;
    case "finished":
      hideTimerBar();
      showResult(state);
      break;
    case "idle":
      dismissChallengeUI();
      break;
  }
}

// ─── Config UI (Time Selection) ──────────────────────────────────────────────

function showConfigUI(_state: ChallengeState): void {
  if (configOverlayEl) return;

  const overlay = document.createElement("div");
  overlay.className = "challenge-config-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Challenge konfigurieren");

  const card = document.createElement("div");
  card.className = "challenge-config-card";
  card.innerHTML = `
    <h2 style="margin:0 0 var(--space-md);font-size:var(--font-lead);text-align:center;">⏱ Sprint-Challenge</h2>
    <p style="margin:0 0 var(--space-lg);text-align:center;color:var(--text-dim);font-size:var(--font-small);">
      Wie viele Aufgaben schaffst du?
    </p>
    <div class="challenge-time-buttons">
      <button type="button" class="challenge-time-btn" data-seconds="120">2 min</button>
      <button type="button" class="challenge-time-btn challenge-time-btn--default" data-seconds="300">5 min</button>
      <button type="button" class="challenge-time-btn" data-seconds="600">10 min</button>
    </div>
    <button type="button" class="challenge-cancel-btn">Abbrechen</button>
  `;

  // Time selection
  for (const btn of card.querySelectorAll(".challenge-time-btn")) {
    btn.addEventListener("click", () => {
      const sec = Number((btn as HTMLElement).dataset.seconds);
      playClickSound();
      confirmTimeLimit(sec);
    });
  }

  // Cancel
  card.querySelector(".challenge-cancel-btn")?.addEventListener("click", () => {
    cancelChallenge();
    playClickSound();
  });

  overlay.appendChild(card);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) cancelChallenge();
  });

  containerEl?.appendChild(overlay);
  configOverlayEl = overlay;
}

function hideConfigUI(): void {
  configOverlayEl?.remove();
  configOverlayEl = null;
}

// ─── Countdown (3-2-1-Los!) ──────────────────────────────────────────────────

function showCountdown(state: ChallengeState): void {
  if (!countdownOverlayEl) {
    const overlay = document.createElement("div");
    overlay.className = "challenge-countdown-overlay";
    overlay.innerHTML = `<span class="challenge-countdown-number">${state.countdownValue || "Los!"}</span>`;
    containerEl?.appendChild(overlay);
    countdownOverlayEl = overlay;
  }

  const numEl = countdownOverlayEl.querySelector(".challenge-countdown-number");
  if (numEl) {
    numEl.textContent = state.countdownValue > 0 ? String(state.countdownValue) : "Los!";
    numEl.classList.remove("challenge-countdown-pop");
    // Force reflow for animation restart
    void (numEl as HTMLElement).offsetWidth;
    numEl.classList.add("challenge-countdown-pop");
  }
}

function hideCountdown(): void {
  countdownOverlayEl?.remove();
  countdownOverlayEl = null;
}

// ─── Timer Bar (during challenge) ────────────────────────────────────────────

function showTimerBar(state: ChallengeState): void {
  if (!timerBarEl) {
    const bar = document.createElement("div");
    bar.className = "challenge-timer-bar";
    bar.innerHTML = `
      <div class="challenge-timer-fill"></div>
      <div class="challenge-timer-content">
        <span class="challenge-timer-clock">0:00</span>
        <span class="challenge-timer-score">0 ✅</span>
      </div>
    `;
    // Insert at top of canvas column
    const canvasCol = containerEl?.querySelector(".v2-canvas-col");
    if (canvasCol) {
      canvasCol.insertBefore(bar, canvasCol.firstChild);
    } else {
      containerEl?.prepend(bar);
    }
    timerBarEl = bar;
  }

  // Update timer
  const fill = timerBarEl.querySelector<HTMLElement>(".challenge-timer-fill");
  const clock = timerBarEl.querySelector(".challenge-timer-clock");
  const score = timerBarEl.querySelector(".challenge-timer-score");
  const timeLimitSec = state.config?.timeLimitSec ?? 300;
  const progress = 1 - state.remaining / timeLimitSec;

  if (fill) fill.style.width = `${progress * 100}%`;
  if (clock) clock.textContent = formatTime(state.remaining);
  if (score) score.textContent = `${state.correct} ✅`;

  // Urgent mode: last 30 seconds
  timerBarEl.classList.toggle("challenge-timer-bar--urgent", state.remaining <= 30);
}

function hideTimerBar(): void {
  timerBarEl?.remove();
  timerBarEl = null;
}

// ─── Result Screen ───────────────────────────────────────────────────────────

function showResult(state: ChallengeState): void {
  if (resultOverlayEl) return;

  const config = state.config!;
  const best = getBestResult(config.mode, config.timeLimitSec, config.moduleId, config.taskType);
  const isNewRecord = !best || state.correct > best.correct;
  const prevBest = best?.correct ?? 0;

  const overlay = document.createElement("div");
  overlay.className = "challenge-result-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Challenge-Ergebnis");

  const card = document.createElement("div");
  card.className = "challenge-result-card";

  // Build sparkline from history
  const history = appState.getChallengeHistory()
    .filter(r =>
      r.mode === config.mode &&
      r.timeLimit === config.timeLimitSec &&
      r.moduleId === config.moduleId &&
      r.taskType === config.taskType
    )
    .slice(-10)
    .map(r => r.correct);

  const sparklineHTML = history.length >= 2
    ? `<div class="challenge-sparkline">${buildSparklineSVG(history)}</div>`
    : "";

  card.innerHTML = `
    <div class="challenge-result-emoji">${isNewRecord ? "🏆" : "⭐"}</div>
    <h2 class="challenge-result-title">${state.correct} richtige Aufgaben!</h2>
    <p class="challenge-result-subtitle">
      in ${formatTime(config.timeLimitSec)} · ${state.errors} Fehler
    </p>
    ${isNewRecord && prevBest > 0
      ? `<p class="challenge-result-record">Neuer Rekord! Vorher: ${prevBest}</p>`
      : isNewRecord
        ? `<p class="challenge-result-record">Dein erster Rekord!</p>`
        : `<p class="challenge-result-compare">Dein Rekord: ${prevBest} — ${prevBest - state.correct <= 3 ? "Fast dran!" : "Weiter üben!"}</p>`
    }
    ${sparklineHTML}
    <div class="challenge-result-buttons">
      <button type="button" class="challenge-result-btn challenge-result-btn--primary">Nochmal</button>
      <button type="button" class="challenge-result-btn challenge-result-btn--secondary">Zurück</button>
    </div>
  `;

  // Nochmal
  card.querySelector(".challenge-result-btn--primary")?.addEventListener("click", () => {
    resultOverlayEl?.remove();
    resultOverlayEl = null;
    playClickSound();
    startChallenge({ mode: config.mode, moduleId: config.moduleId, taskType: config.taskType });
  });

  // Zurück
  card.querySelector(".challenge-result-btn--secondary")?.addEventListener("click", () => {
    cancelChallenge();
    playClickSound();
  });

  overlay.appendChild(card);
  containerEl?.appendChild(overlay);
  resultOverlayEl = overlay;
}

// ─── Sparkline SVG ───────────────────────────────────────────────────────────

function buildSparklineSVG(values: number[]): string {
  if (values.length < 2) return "";
  const w = 200;
  const h = 40;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return `<svg viewBox="0 0 ${w} ${h}" class="challenge-sparkline-svg">
    <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${(w).toFixed(1)}" cy="${(h - ((values[values.length - 1]! - min) / range) * (h - 8) - 4).toFixed(1)}" r="3" fill="var(--accent)"/>
  </svg>`;
}

