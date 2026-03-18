/**
 * Sound-Effekte via Web Audio API.
 *
 * Kein externes Asset nötig – alle Töne werden synthetisiert.
 * Respektiert globale Mute-Einstellung (localStorage).
 */

import { safeGetLocalStorage, safeSetLocalStorage } from "@core/utils";

const STORAGE_KEY = "mathelabor_muted";

let audioCtx: AudioContext | null = null;
let muted = safeGetLocalStorage(STORAGE_KEY) === "1";

// ─── Public API ──────────────────────────────────────────────────────────────

/** Initialise AudioContext lazily (must be called from a user gesture). */
function ensureCtx(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    audioCtx = new AudioContext();
    return audioCtx;
  } catch {
    return null;
  }
}

export function setMuted(m: boolean): void {
  muted = m;
  safeSetLocalStorage(STORAGE_KEY, m ? "1" : "0");
}

export function isMuted(): boolean {
  return muted;
}

// ─── Sound primitives ────────────────────────────────────────────────────────

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.12,
): void {
  if (muted) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  // Resume suspended context (browser policy)
  if (ctx.state === "suspended") void ctx.resume();

  const osc = ctx.createOscillator();
  const vol = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  vol.gain.value = gain;

  // Smooth fade-out to avoid click
  vol.gain.setValueAtTime(gain, ctx.currentTime);
  vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(vol);
  vol.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/** Helper: play a note at a given offset from "now". */
function scheduleNote(
  ctx: AudioContext,
  freq: number,
  offset: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.10,
): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + offset;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

// ─── Correct-Answer Sounds (5 Varianten) ────────────────────────────────────

/** 1) Aufsteigende Terz — C5→E5 */
function playCorrect1(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  scheduleNote(ctx, 523, 0, 0.15);       // C5
  scheduleNote(ctx, 659, 0.08, 0.15);    // E5
}

/** 2) Aufsteigende Quinte — C5→G5 (offener, heller) */
function playCorrect2(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  scheduleNote(ctx, 523, 0, 0.15);       // C5
  scheduleNote(ctx, 784, 0.08, 0.15);    // G5
}

/** 3) Dur-Dreiklang Arpeggio — C5→E5→G5 schnell nacheinander */
function playCorrect3(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  scheduleNote(ctx, 523, 0, 0.14);       // C5
  scheduleNote(ctx, 659, 0.06, 0.14);    // E5
  scheduleNote(ctx, 784, 0.12, 0.18);    // G5 (etwas länger)
}

/** 4) Glockenspiel-Ping — hoher Triangle-Wave mit Oberton */
function playCorrect4(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  scheduleNote(ctx, 1047, 0, 0.20, "triangle", 0.08);   // C6
  scheduleNote(ctx, 2093, 0, 0.12, "triangle", 0.04);   // C7 (Oberton, leise)
}

/** 5) Doppel-Pling — zwei identische hohe Töne (wie Münze) */
function playCorrect5(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  scheduleNote(ctx, 880, 0, 0.10);       // A5
  scheduleNote(ctx, 880, 0.07, 0.10);    // A5 repeat
}

/** 6) Fanfare — aufsteigende Dur-Tonfolge mit Trompeten-Charakter (~1.2s) */
function playCorrect6(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  // C5 → E5 → G5 → C6 als "Fanfare"
  scheduleNote(ctx, 523, 0,    0.25, "square", 0.06);   // C5
  scheduleNote(ctx, 659, 0.20, 0.25, "square", 0.06);   // E5
  scheduleNote(ctx, 784, 0.40, 0.25, "square", 0.06);   // G5
  scheduleNote(ctx, 1047, 0.60, 0.50, "square", 0.08);  // C6 (lang, laut)
}

/** 7) Harfen-Arpeggio — schnelle aufsteigende C-Dur-Tonleiter mit Obertönen (~1.5s) */
function playCorrect7(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const notes = [523, 587, 659, 698, 784, 880, 988, 1047]; // C5-Dur-Tonleiter → C6
  for (let i = 0; i < notes.length; i++) {
    scheduleNote(ctx, notes[i], i * 0.10, 0.40, "triangle", 0.07);
  }
  // Oberton-Shimmer
  scheduleNote(ctx, 2093, 0.80, 0.60, "sine", 0.03); // C7 leise
}

/** 8) Jubel-Akkordfolge — I→IV→V→I Kadenz (~1.8s) */
function playCorrect8(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  // I: C-Dur (C-E-G)
  scheduleNote(ctx, 523, 0,    0.35, "sine", 0.06);
  scheduleNote(ctx, 659, 0,    0.35, "sine", 0.05);
  scheduleNote(ctx, 784, 0,    0.35, "sine", 0.05);
  // IV: F-Dur (F-A-C)
  scheduleNote(ctx, 698, 0.40, 0.35, "sine", 0.06);
  scheduleNote(ctx, 880, 0.40, 0.35, "sine", 0.05);
  scheduleNote(ctx, 1047, 0.40, 0.35, "sine", 0.05);
  // V: G-Dur (G-B-D)
  scheduleNote(ctx, 784, 0.80, 0.35, "sine", 0.06);
  scheduleNote(ctx, 988, 0.80, 0.35, "sine", 0.05);
  scheduleNote(ctx, 1175, 0.80, 0.35, "sine", 0.05);
  // I: C-Dur hoch (C-E-G) — triumphaler Abschluss
  scheduleNote(ctx, 1047, 1.20, 0.55, "sine", 0.07);
  scheduleNote(ctx, 1319, 1.20, 0.55, "sine", 0.06);
  scheduleNote(ctx, 1568, 1.20, 0.55, "sine", 0.06);
}

/** 9) Xylophon-Cascade — absteigende+aufsteigende Welle (~1.4s) */
function playCorrect9(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const up   = [523, 659, 784, 1047, 1319];  // C5 E5 G5 C6 E6
  const down = [1047, 784, 659, 523];         // C6 G5 E5 C5
  for (let i = 0; i < up.length; i++) {
    scheduleNote(ctx, up[i], i * 0.08, 0.20, "triangle", 0.08);
  }
  for (let i = 0; i < down.length; i++) {
    scheduleNote(ctx, down[i], 0.50 + i * 0.08, 0.20, "triangle", 0.07);
  }
  // Finaler Shimmer-Akkord
  scheduleNote(ctx, 1047, 0.90, 0.45, "sine", 0.05);
  scheduleNote(ctx, 1319, 0.90, 0.45, "sine", 0.04);
}

/** 10) Sieges-Glocken — tiefe + hohe Glocken abwechselnd (~1.6s) */
function playCorrect10(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  // Tiefe Glocke + Oberton
  scheduleNote(ctx, 523, 0,    0.50, "triangle", 0.08);  // C5
  scheduleNote(ctx, 1047, 0,   0.30, "triangle", 0.03);  // C6 Oberton
  // Hohe Glocke
  scheduleNote(ctx, 784, 0.30, 0.50, "triangle", 0.08);  // G5
  scheduleNote(ctx, 1568, 0.30, 0.30, "triangle", 0.03); // G6 Oberton
  // Finale Glocke — Oktave
  scheduleNote(ctx, 1047, 0.65, 0.80, "triangle", 0.09); // C6
  scheduleNote(ctx, 2093, 0.65, 0.50, "triangle", 0.03); // C7 Oberton
}

const correctSounds = [
  playCorrect1, playCorrect2, playCorrect3, playCorrect4, playCorrect5,
  playCorrect6, playCorrect7, playCorrect8, playCorrect9, playCorrect10,
];

/** Short sounds only (index 0-4, ~0.2s each) */
const shortCorrectSounds = correctSounds.slice(0, 5);

/** Spielt zufällig einen Erfolgs-Sound.
 *  @param mode "full" = alle 10 (inkl. lange), "subtle" = nur kurze Sounds */
export function playRandomCorrectSound(mode: "full" | "subtle" = "full"): void {
  if (muted) return;
  const pool = mode === "subtle" ? shortCorrectSounds : correctSounds;
  pool[Math.floor(Math.random() * pool.length)]();
}

/** Original aufsteigende Terz (Abwärtskompatibilität). */
export function playCorrectSound(): void {
  if (muted) return;
  playCorrect1();
}

// ─── Other Effect functions ─────────────────────────────────────────────────

/** Sanfter tiefer Ton – nicht bestrafend. */
export function playWrongSound(): void {
  playTone(280, 0.18, "sine", 0.08);
}

/** Kurzer Klick-Ton für Button-Taps. */
export function playClickSound(): void {
  playTone(880, 0.04, "sine", 0.05);
}

/** Dur-Akkord für Celebration / Level-Abschluss. */
export function playCompletionSound(): void {
  if (muted) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const freqs = [523, 659, 784]; // C5–E5–G5 major triad
  for (const freq of freqs) {
    scheduleNote(ctx, freq, 0, 0.35, "sine", 0.07);
  }
}
