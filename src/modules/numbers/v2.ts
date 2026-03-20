/**
 * Zahlenlabor V2 — with interactive place values, compare buttons, and numpad.
 *
 * Place mode: Numpad to enter the full number for place-value decomposition.
 * Compare mode: Buttons for <, =, > to compare numbers.
 * Jump mode: Numpad to enter target on number line.
 */

import { defineModule, DIFFICULTIES } from "@app/module-framework";
import type { SceneContext, TutorialStep } from "@app/module-framework";
import { vstack, hstack } from "@canvas/nodes/container";
import { text } from "@canvas/nodes/text";
import { button } from "@canvas/nodes/button";
import { custom } from "@canvas/nodes/custom";
import { panel } from "@canvas/nodes/panel";
import type { CanvasNode } from "@canvas/nodes/types";
import { getPalette } from "@core/design";
import {
  generatePlaceTask,
  generateCompareTask,
  generateJumpTask,
  getPlaceValues,
  placeValueName,
  checkCompare,
  computeNumberLineRange,
} from "./logic";
import type { NumbersTask } from "./types";

// ─── State ───────────────────────────────────────────────────────────────────

interface NumbersState2 {
  value: number;
  compareAnswer: "<" | "=" | ">" | null;
}

type Ctx = SceneContext<NumbersTask, NumbersState2>;

// Mutable refs for button callbacks
let compareCallback: ((op: "<" | "=" | ">") => void) | null = null;

// ─── Hints ───────────────────────────────────────────────────────────────────

function getHints(task: NumbersTask): string[] {
  switch (task.type) {
    case "place": {
      const pv = getPlaceValues(task.target);
      return [
        `Zerlege ${task.target.toLocaleString("de-DE")} in Stellenwerte.`,
        `${placeValueName("thousands")}: ${pv.thousands}, ${placeValueName("hundreds")}: ${pv.hundreds}`,
        `${task.target.toLocaleString("de-DE")} = ${(() => { const p: string[] = []; if (pv.hundredThousands > 0) p.push(pv.hundredThousands + " HT"); if (pv.tenThousands > 0 || pv.hundredThousands > 0) p.push(pv.tenThousands + " ZT"); if (task.target >= 1000 || pv.thousands > 0) p.push(pv.thousands + " T"); p.push(pv.hundreds + " H", pv.tens + " Z", pv.ones + " E"); return p.join(" + "); })()}`,
        `Tippe die Ziffern der Reihe nach ein: ${String(task.target).split("").join(", ")}.`,
      ];
    }
    case "compare":
      return [
        `Vergleiche die beiden Zahlen.`,
        `Schau zuerst auf die größte Stelle.`,
        `Die Antwort findest du am Stellenwert.`,
        `Tippe auf „${(task.value ?? 0) < task.target ? "<" : (task.value ?? 0) > task.target ? ">" : "="}" — das ist das richtige Zeichen.`,
      ];
    case "jump": {
      const dir = (task.direction ?? 1) > 0 ? "vorwärts" : "rückwärts";
      return [
        `Zähle die Sprünge auf dem Zahlenstrahl (${dir}).`,
        `Jeder Sprung ist ${task.stepSize?.toLocaleString("de-DE")} breit.`,
        `Von ${task.start?.toLocaleString("de-DE")} bis ${task.target.toLocaleString("de-DE")} sind es ${task.steps} Sprünge.`,
        `Gib ${task.steps} ein — so viele Sprünge sind es.`,
      ];
    }
  }
}

// ─── Scene Builders ──────────────────────────────────────────────────────────

// ─── Bündelungs-Zeichner ─────────────────────────────────────────────────────

// ─── Dienes-Material (Schulübliche Stellenwert-Blöcke) ──────────────────────

/** Tausenderwürfel — 10×10×10 Kubus mit 3D-Andeutung */
function drawTausender(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const palette = getPalette();
  const half = s * 0.4;
  const depth = s * 0.12;
  c.save();
  // Front face
  c.fillStyle = palette.accent;
  c.globalAlpha = 0.5;
  c.fillRect(x - half, y - half + depth, half * 2, half * 2);
  c.globalAlpha = 1;
  c.strokeStyle = palette.accent;
  c.lineWidth = 1.5;
  c.strokeRect(x - half, y - half + depth, half * 2, half * 2);
  // Top face (parallelogram)
  c.fillStyle = palette.accent;
  c.globalAlpha = 0.35;
  c.beginPath();
  c.moveTo(x - half, y - half + depth);
  c.lineTo(x - half + depth, y - half);
  c.lineTo(x + half + depth, y - half);
  c.lineTo(x + half, y - half + depth);
  c.closePath();
  c.fill();
  c.globalAlpha = 1;
  c.stroke();
  // Right face
  c.fillStyle = palette.accent;
  c.globalAlpha = 0.25;
  c.beginPath();
  c.moveTo(x + half, y - half + depth);
  c.lineTo(x + half + depth, y - half);
  c.lineTo(x + half + depth, y + half);
  c.lineTo(x + half, y + half + depth);
  c.closePath();
  c.fill();
  c.globalAlpha = 1;
  c.stroke();
  // Grid lines on front face (3×3)
  c.globalAlpha = 0.3;
  const step = half * 2 / 3;
  for (let i = 1; i < 3; i++) {
    c.beginPath(); c.moveTo(x - half + i * step, y - half + depth); c.lineTo(x - half + i * step, y + half + depth); c.stroke();
    c.beginPath(); c.moveTo(x - half, y - half + depth + i * step); c.lineTo(x + half, y - half + depth + i * step); c.stroke();
  }
  c.globalAlpha = 1;
  c.restore();
}

/** Hunderterplatte — flaches 10×10 Quadrat */
function drawHunderter(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const palette = getPalette();
  const half = s * 0.38;
  c.save();
  c.fillStyle = palette.ok;
  c.globalAlpha = 0.45;
  c.fillRect(x - half, y - half, half * 2, half * 2);
  c.globalAlpha = 1;
  c.strokeStyle = palette.ok;
  c.lineWidth = 1.5;
  c.strokeRect(x - half, y - half, half * 2, half * 2);
  // Grid 5×5 (simplified)
  c.globalAlpha = 0.3;
  const step = half * 2 / 5;
  for (let i = 1; i < 5; i++) {
    c.beginPath(); c.moveTo(x - half + i * step, y - half); c.lineTo(x - half + i * step, y + half); c.stroke();
    c.beginPath(); c.moveTo(x - half, y - half + i * step); c.lineTo(x + half, y - half + i * step); c.stroke();
  }
  c.globalAlpha = 1;
  c.restore();
}

/** Zehnerstange — schmaler hoher Balken mit 10 Abschnitten */
function drawZehner(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const palette = getPalette();
  const w = s * 0.12;
  const h = s * 0.75;
  c.save();
  c.fillStyle = palette.warn;
  c.globalAlpha = 0.5;
  c.fillRect(x - w / 2, y - h / 2, w, h);
  c.globalAlpha = 1;
  c.strokeStyle = palette.warn;
  c.lineWidth = 1.5;
  c.strokeRect(x - w / 2, y - h / 2, w, h);
  // 10 segments
  c.globalAlpha = 0.35;
  const step = h / 10;
  for (let i = 1; i < 10; i++) {
    c.beginPath(); c.moveTo(x - w / 2, y - h / 2 + i * step); c.lineTo(x + w / 2, y - h / 2 + i * step); c.stroke();
  }
  c.globalAlpha = 1;
  c.restore();
}

/** Einerwürfel — kleiner einzelner Würfel */
function drawEiner(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const palette = getPalette();
  const half = s * 0.12;
  c.save();
  c.fillStyle = palette.bad;
  c.globalAlpha = 0.5;
  c.fillRect(x - half, y - half, half * 2, half * 2);
  c.globalAlpha = 1;
  c.strokeStyle = palette.bad;
  c.lineWidth = 1.5;
  c.strokeRect(x - half, y - half, half * 2, half * 2);
  c.restore();
}

function buildPlaceScene(ctx: Ctx): CanvasNode {
  const { task, input, result } = ctx;
  const pv = getPlaceValues(task.target);
  const answered = result?.correct === true;
  const wrong = result !== null && !result.correct;

  // Nur die Stellen anzeigen, die die Zahl tatsächlich hat (Anzahl Ziffern).
  // 56 → Z + E (2 Spalten), 456 → H + Z + E, 1456 → T + H + Z + E usw.
  const numDigits = String(task.target).length;
  const places: [string, string, number][] = [];
  if (numDigits >= 6) places.push(["HT", "Hunderttausender", pv.hundredThousands]);
  if (numDigits >= 5) places.push(["ZT", "Zehntausender",    pv.tenThousands]);
  if (numDigits >= 4) places.push(["T",  "Tausender",        pv.thousands]);
  if (numDigits >= 3) places.push(["H",  "Hunderter",        pv.hundreds]);
  if (numDigits >= 2) places.push(["Z",  "Zehner",           pv.tens]);
  places.push(["E", "Einer", pv.ones]);

  // Map typed input digits to place-value positions (left-to-right).
  // The student types the full number, and we show each digit in its
  // corresponding place-value box so the connection is visually clear.
  const inputDigits: (string | null)[] = places.map(() => null);
  if (answered) {
    // Show correct digits
    for (let i = 0; i < places.length; i++) inputDigits[i] = String(places[i]![2]);
  } else if (input.length > 0) {
    // Pad input from the right so digits align with place values.
    // E.g. target=3456 (places: T H Z E), input="34" → [3, 4, null, null]
    // We fill from the left (highest place value first).
    for (let i = 0; i < input.length && i < places.length; i++) {
      inputDigits[i] = input[i]!;
    }
  }

  // The active position is the next unfilled slot (where the next typed digit will go)
  const activeIndex = answered ? -1 : Math.min(input.length, places.length - 1);

  // Full place-value names for the label row
  const placeLabels: Record<string, string> = {
    HT: "Hundert-\ntausender",
    ZT: "Zehn-\ntausender",
    T: "Tausender",
    H: "Hunderter",
    Z: "Zehner",
    E: "Einer",
  };

  return vstack([
    text("Wie viele stecken in jeder Stelle?", { fontSize: "sm", color: "canvasTextDim" }),
    text(`Zerlege: ${task.target.toLocaleString("de-DE")}`, { fontSize: "xl", bold: true }),
    panel(
      { id: "place-panel", bg: "panelSoft", radius: 12, padding: 6 },
      custom({
        id: "place-values",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();
        const cols = places.length;
        const colW = r.w / (cols + 0.5);
        const iconH = Math.min(r.h * 0.45, colW * 0.85);
        const boxW = Math.min(colW * 0.85, 72);
        const boxH = boxW * 1.25;
        const startX = r.x + colW * 0.6;
        const iconY = r.y + r.h * 0.22;
        const nameY = r.y + r.h * 0.46;
        const digitY = r.y + r.h * 0.72;

        for (let i = 0; i < cols; i++) {
          const [abbr] = places[i]!;
          const cx = startX + i * colW;
          const isActive = i === activeIndex && !answered;
          const isFilled = inputDigits[i] !== null;

          // ── Active column highlight ──
          if (isActive) {
            c.save();
            c.globalAlpha = 0.08;
            c.fillStyle = palette.accent;
            const colLeft = cx - colW * 0.45;
            c.beginPath();
            if (typeof c.roundRect === "function") {
              c.roundRect(colLeft, r.y + 4, colW * 0.9, r.h - 8, 10);
            } else {
              c.rect(colLeft, r.y + 4, colW * 0.9, r.h - 8);
            }
            c.fill();
            c.restore();
          }

          // ── Dienes-Block ──
          if (abbr === "T" || abbr === "ZT" || abbr === "HT") {
            drawTausender(c, cx, iconY, iconH * 0.7);
          } else if (abbr === "H") {
            drawHunderter(c, cx, iconY, iconH * 0.65);
          } else if (abbr === "Z") {
            drawZehner(c, cx, iconY, iconH * 0.8);
          } else {
            drawEiner(c, cx, iconY, iconH * 0.6);
          }

          // ── Full place-value name label ──
          const nameLabel = placeLabels[abbr] ?? abbr;
          // Mindest 14px — bei 4 Spalten skaliert boxW auf ~72px → 14px, bei 2 Spalten → größer
          const nameFontSize = Math.max(14, boxW * 0.22);
          c.font = `600 ${nameFontSize}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          c.fillStyle = isActive ? palette.accent : palette.canvasTextDim;
          c.textAlign = "center";
          c.textBaseline = "middle";
          // Handle multi-line labels (split on \n)
          const nameLines = nameLabel.split("\n");
          const lineHeight = nameFontSize * 1.3;
          const nameStartY = nameY - ((nameLines.length - 1) * lineHeight) / 2;
          for (let li = 0; li < nameLines.length; li++) {
            c.fillText(nameLines[li]!, cx, nameStartY + li * lineHeight);
          }

          // ── Antwort-Box ──
          const bx = cx - boxW / 2;
          const by = digitY - boxH / 2;

          if (answered) {
            // Correct: green tint
            c.fillStyle = palette.canvasSuccess + "22";
            c.strokeStyle = palette.canvasSuccess;
            c.lineWidth = 2.5;
          } else if (isActive) {
            // Active slot: accent highlight with thicker border
            c.fillStyle = palette.accentSubtle;
            c.strokeStyle = palette.accent;
            c.lineWidth = 3;
          } else if (isFilled) {
            // Already filled: subtle accent
            c.fillStyle = palette.accentSubtle;
            c.strokeStyle = palette.accent;
            c.lineWidth = 1.5;
          } else if (wrong && input.length >= places.length) {
            // Wrong answer, all filled: red tint
            c.fillStyle = palette.canvasError + "18";
            c.strokeStyle = palette.canvasError;
            c.lineWidth = 2;
          } else {
            // Empty, waiting
            c.fillStyle = palette.panelSoft;
            c.strokeStyle = palette.line;
            c.lineWidth = 1;
          }

          if (typeof c.roundRect === "function") {
            c.beginPath(); c.roundRect(bx, by, boxW, boxH, 8); c.fill(); c.stroke();
          } else {
            c.fillRect(bx, by, boxW, boxH); c.strokeRect(bx, by, boxW, boxH);
          }

          // ── Active indicator: small triangle/arrow above box ──
          if (isActive) {
            const triSize = Math.max(6, boxW * 0.12);
            c.fillStyle = palette.accent;
            c.beginPath();
            c.moveTo(cx - triSize, by - triSize * 0.6);
            c.lineTo(cx + triSize, by - triSize * 0.6);
            c.lineTo(cx, by - 1);
            c.closePath();
            c.fill();
          }

          // ── Digit display ──
          c.font = `700 ${Math.max(16, boxW * 0.45)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "middle";

          if (isFilled) {
            c.fillStyle = answered ? palette.canvasSuccess : palette.canvasText;
            c.fillText(inputDigits[i]!, cx, digitY);
          } else if (isActive) {
            // Blinking cursor placeholder
            c.fillStyle = palette.accent;
            c.fillText("_", cx, digitY);
          } else {
            c.fillStyle = palette.canvasTextDim;
            c.fillText("·", cx, digitY);
          }

          // ── Abbreviation below box ──
          const abbrY = digitY + boxH / 2 + Math.max(8, boxW * 0.15);
          c.font = `700 ${Math.max(13, boxW * 0.25)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          c.fillStyle = isActive ? palette.accent : palette.canvasTextDim;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(abbr, cx, abbrY);
        }
      },
    }),
    ),
    text(
      answered
        ? `${task.target.toLocaleString("de-DE")} = ${places.map(([a, , d]) => `${d} ${a}`).filter((_, i) => places[i]![2] > 0 || places[i]![0] === "E").join(" + ")}`
        : input.length === 0
          ? "Tippe die Ziffern der Reihe nach ein (Zahlentasten oder Numpad)"
          : input.length < places.length
            ? `${input} … noch ${places.length - input.length} ${places.length - input.length === 1 ? "Stelle" : "Stellen"}`
            : `Eingabe: ${input} — drücke ↵ zum Prüfen`,
      { fontSize: "md", color: answered ? "canvasSuccess" : "canvasText" },
    ),
  ], { gap: 10, padding: 16, align: "center" });
}

function buildCompareScene(ctx: Ctx): CanvasNode {
  const { task, state, result } = ctx;
  const answered = result?.correct === true;
  // task.value is the left-hand number (stored in task since generateCompareTask())
  const leftVal = task.value ?? 0;
  // Title keeps "○" until the correct answer is confirmed — the buttons below already
  // highlight the student's current selection, so duplicating it in the title would
  // make a wrong answer look correct (e.g. "35.815 < 35.815" after a bad tap).
  const correctSymbol = leftVal < task.target ? "<" : leftVal > task.target ? ">" : "=";

  return vstack([
    text(
      `${leftVal.toLocaleString("de-DE")}  ${answered ? correctSymbol : "○"}  ${task.target.toLocaleString("de-DE")}`,
      { fontSize: "xl", bold: true },
    ),
    text("Welches Zeichen gehört in den Kreis?", { fontSize: "sm", color: "canvasTextDim" }),
    custom({
      id: "compare-line",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();
        const range = computeNumberLineRange([leftVal, task.target]);
        const lineY = r.y + r.h * 0.5;
        const lx0 = r.x + r.w * 0.08;
        const lx1 = r.x + r.w * 0.92;
        const lw = lx1 - lx0;

        c.strokeStyle = palette.line;
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(lx0, lineY);
        c.lineTo(lx1, lineY);
        c.stroke();

        const pos = (v: number) => lx0 + ((v - range.min) / (range.max - range.min)) * lw;

        c.beginPath();
        c.arc(pos(leftVal), lineY, 10, 0, Math.PI * 2);
        c.fillStyle = palette.canvasPrimary;
        c.fill();

        c.beginPath();
        c.arc(pos(task.target), lineY, 10, 0, Math.PI * 2);
        c.fillStyle = palette.accent;
        c.fill();

        c.font = `600 ${Math.max(12, r.w * 0.022)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        c.textAlign = "center";
        c.fillStyle = palette.canvasText;
        c.fillText(leftVal.toLocaleString("de-DE"), pos(leftVal), lineY - 20);
        c.fillText(task.target.toLocaleString("de-DE"), pos(task.target), lineY - 20);
      },
    }),
    // Compare buttons (<, =, >)
    hstack([
      button("<", {
        id: "cmp-lt",
        variant: state.compareAnswer === "<" ? "primary" : "secondary",
        minWidth: 64,
        onTap: () => compareCallback?.("<"),
      }),
      button("=", {
        id: "cmp-eq",
        variant: state.compareAnswer === "=" ? "primary" : "secondary",
        minWidth: 64,
        onTap: () => compareCallback?.("="),
      }),
      button(">", {
        id: "cmp-gt",
        variant: state.compareAnswer === ">" ? "primary" : "secondary",
        minWidth: 64,
        onTap: () => compareCallback?.(">" ),
      }),
    ], { gap: 16, align: "center" }),
  ], { gap: 12, padding: 16, align: "center" });
}

// Track jump animation state
let jumpAnimStart = 0;
let jumpAnimActive = false;
let jumpAnimScene: { invalidate(): void } | null = null;
let jumpAnimRafId = 0;

/** Drive the jump animation via a separate RAF loop so invalidate() is called
 *  OUTSIDE the draw() call, preventing needsRender from being reset immediately. */
function startJumpAnimation(steps: number): void {
  cancelAnimationFrame(jumpAnimRafId);
  jumpAnimStart = performance.now();
  jumpAnimActive = true;
  const totalDuration = steps * 0.18 + 1.0; // seconds — enough for all arcs + buffer
  const tick = (): void => {
    const elapsed = (performance.now() - jumpAnimStart) / 1000;
    if (jumpAnimActive && elapsed < totalDuration) {
      jumpAnimScene?.invalidate();
      jumpAnimRafId = requestAnimationFrame(tick);
    } else {
      jumpAnimActive = false;
    }
  };
  jumpAnimRafId = requestAnimationFrame(tick);
}

function buildJumpScene(ctx: Ctx): CanvasNode {
  const { task, input, result } = ctx;
  const answered = result?.correct === true;
  const start = task.start ?? 0;
  const stepSize = task.stepSize ?? 1;
  const steps = task.steps ?? 1;
  const dir = task.direction ?? 1;
  const dirLabel = dir > 0 ? "vorwärts" : "rückwärts";

  // Start animation on correct answer (via RAF loop, not from within draw)
  if (answered && !jumpAnimActive) {
    startJumpAnimation(steps);
  }
  if (!answered) {
    jumpAnimActive = false;
    cancelAnimationFrame(jumpAnimRafId);
    jumpAnimRafId = 0;
  }

  return vstack([
    text(`Wie viele Sprünge? (${dirLabel})`, { fontSize: "xl", bold: true }),
    text(
      `Von ${start.toLocaleString("de-DE")} nach ${task.target.toLocaleString("de-DE")} — Schrittweite: ${stepSize.toLocaleString("de-DE")}`,
      { fontSize: "sm", color: "canvasTextDim" },
    ),
    custom({
      id: "jump-line",
      flex: 1,
      h: 180,
      draw(c, r) {
        const palette = getPalette();
        const range = computeNumberLineRange([start, task.target], 10, stepSize);
        const lineY = r.y + r.h * 0.65;
        const lx0 = r.x + r.w * 0.06;
        const lx1 = r.x + r.w * 0.94;
        const lw = lx1 - lx0;

        const pos = (v: number) => lx0 + ((v - range.min) / (range.max - range.min)) * lw;

        // ─── Number line ─────────────────────────────────
        c.strokeStyle = palette.line;
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(lx0, lineY);
        c.lineTo(lx1, lineY);
        c.stroke();

        // Responsive sizes
        const tickFontSize = Math.max(13, r.w * 0.025);
        const markerRadius = Math.max(10, r.w * 0.018);

        // Tick marks + labels
        c.textAlign = "center";
        c.textBaseline = "top";
        c.font = `600 ${tickFontSize}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        for (let v = range.min; v <= range.max; v += range.step) {
          const tx = pos(v);
          const isEndpoint = v === start || v === task.target;
          const tickH = isEndpoint ? markerRadius * 0.8 : markerRadius * 0.5;
          c.beginPath();
          c.moveTo(tx, lineY - tickH);
          c.lineTo(tx, lineY + tickH);
          c.strokeStyle = isEndpoint ? palette.canvasPrimary : palette.line;
          c.lineWidth = isEndpoint ? 2.5 : 1.5;
          c.stroke();
          // Label
          c.fillStyle = isEndpoint ? palette.canvasPrimary : palette.canvasTextDim;
          c.fillText(v.toLocaleString("de-DE"), tx, lineY + tickH + 4);
        }

        // ─── Start marker (filled circle) ─────────────────
        c.beginPath();
        c.arc(pos(start), lineY, markerRadius, 0, Math.PI * 2);
        c.fillStyle = palette.canvasPrimary;
        c.fill();

        // ─── Target marker (ring) ─────────────────────────
        c.beginPath();
        c.arc(pos(task.target), lineY, markerRadius, 0, Math.PI * 2);
        c.strokeStyle = palette.canvasSuccess;
        c.lineWidth = 3;
        c.stroke();
        if (answered) {
          c.fillStyle = palette.canvasSuccess;
          c.fill();
        }

        // ─── Jump arcs ───────────────────────────────────
        const elapsed = jumpAnimActive ? (performance.now() - jumpAnimStart) / 1000 : 0;
        const showArcs = answered ? steps : 0;
        const arcH = Math.min(r.h * 0.35, 60); // arc height

        for (let i = 0; i < showArcs; i++) {
          const fromVal = start + i * dir * stepSize;
          const toVal = start + (i + 1) * dir * stepSize;
          const x0 = pos(fromVal);
          const x1 = pos(toVal);
          const cx = (x0 + x1) / 2;

          // Animation: each arc appears with delay
          const arcDelay = i * 0.18;
          const arcProgress = Math.min(1, Math.max(0, (elapsed - arcDelay) / 0.35));
          if (arcProgress <= 0) continue;

          // Eased progress
          const t = 1 - Math.pow(1 - arcProgress, 3);

          c.save();
          c.globalAlpha = t;
          c.strokeStyle = palette.canvasPrimary;
          c.lineWidth = 3;
          c.setLineDash([]);

          // Draw arc (partial based on animation progress)
          c.beginPath();
          const arcStartAngle = Math.PI;
          const arcEndAngle = Math.PI + Math.PI * t;
          c.ellipse(cx, lineY, Math.abs(x1 - x0) / 2, arcH, 0, arcStartAngle, arcEndAngle);
          c.stroke();

          // Arrowhead at the end (only when fully drawn)
          if (t > 0.9) {
            const arrowX = x1;
            const arrowY = lineY;
            const arrowDir = dir;
            c.fillStyle = palette.canvasPrimary;
            c.beginPath();
            c.moveTo(arrowX, arrowY - 6);
            c.lineTo(arrowX + arrowDir * 8, arrowY);
            c.lineTo(arrowX, arrowY + 6);
            c.closePath();
            c.fill();
          }

          // Step number label above arc
          if (t > 0.5) {
            c.globalAlpha = Math.min(1, (t - 0.5) * 4);
            c.fillStyle = palette.canvasPrimary;
            c.font = `700 ${tickFontSize}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
            c.textAlign = "center";
            c.textBaseline = "bottom";
            c.fillText(`${i + 1}`, cx, lineY - arcH - 4);
          }

          c.restore();
        }

        // Redraws are driven by the RAF loop in startJumpAnimation() — no invalidate() here
      },
    }),
    text(
      answered
        ? `✓ ${steps} Sprünge à ${stepSize.toLocaleString("de-DE")}`
        : input
          ? `Deine Antwort: ${input} Sprünge`
          : `Wie viele Sprünge? Tippe die Anzahl ein.`,
      { fontSize: "md", color: answered ? "canvasSuccess" : "canvasText" },
    ),
  ], { gap: 12, padding: 16, align: "center" });
}

// ─── Module Definition ───────────────────────────────────────────────────────

export const numbersV2Registration = defineModule<NumbersTask, NumbersState2>({
  id: "numbers",
  label: "Zahlenlabor",
  icon: "🔢",
  description: "Stellenwerte, Zahlenvergleich und Zahlensprünge (bis 1.000 oder 1.000.000).",

  taskLabel(task) {
    switch (task.type) {
      case "place": return `Zerlege ${task.target.toLocaleString("de-DE")} in Stellenwerte.`;
      case "compare": return `Vergleiche die beiden Zahlen.`;
      case "jump": return `Zähle die Sprünge auf dem Zahlenstrahl.`;
    }
  },

  flowType: "task",
  input: (taskType) => taskType === "compare" ? "canvas" : "numberPad",

  taskTypes: [
    { id: "place", label: "Stellenwerte", icon: "🏗" },
    { id: "compare", label: "Vergleichen", icon: "⚖" },
    { id: "jump", label: "Sprünge", icon: "↗" },
  ],

  difficulties: DIFFICULTIES,

  tutorial: (taskType: string): TutorialStep[] => {
    const palette = getPalette();
    const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

    if (taskType === "compare") {
      return [
        {
          title: "So geht's",
          text: "Vergleiche zwei Zahlen und wähle das richtige Zeichen: <, = oder >.",
          mathBackground: "Vergleiche Stelle für Stelle von links nach rechts. Die erste unterschiedliche Stelle entscheidet.",
          draw(ctx, w, h, p) {
            ctx.font = `700 ${h * 0.13}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = palette.canvasText;
            ctx.fillText("356  ○  289", w / 2, h * 0.25);

            if (p > 0.3) {
              ctx.font = `600 ${h * 0.09}px ${FONT}`;
              ctx.fillStyle = palette.accent;
              ctx.fillText("Hunderter: 3 > 2", w / 2, h * 0.5);
            }
            if (p > 0.6) {
              ctx.font = `700 ${h * 0.14}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.fillText("356  >  289 ✓", w / 2, h * 0.75);
            }
          },
          duration: 2500,
        },
      ];
    }

    if (taskType === "jump") {
      return [
        {
          title: "So geht's",
          text: "Zähle die Sprünge auf dem Zahlenstrahl von Start bis Ziel.",
          mathBackground: "Sprünge auf dem Zahlenstrahl helfen beim Zählen in Schritten. Von 0 nach 30 in 10er-Schritten = 3 Sprünge.",
          draw(ctx, w, h, p) {
            const y0 = h * 0.6;
            const margin = w * 0.1;
            const lineW = w - 2 * margin;

            ctx.strokeStyle = palette.canvasText;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(margin, y0);
            ctx.lineTo(margin + lineW, y0);
            ctx.stroke();

            ctx.font = `600 ${h * 0.07}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = palette.canvasText;
            for (let i = 0; i <= 3; i++) {
              const x = margin + (i / 3) * lineW;
              ctx.beginPath();
              ctx.moveTo(x, y0 - 5);
              ctx.lineTo(x, y0 + 5);
              ctx.stroke();
              ctx.fillText(`${i * 10}`, x, y0 + 8);
            }

            ctx.font = `700 ${h * 0.1}px ${FONT}`;
            ctx.textBaseline = "bottom";
            ctx.fillStyle = palette.canvasText;
            ctx.fillText("0 → 30, Schrittweite 10", w / 2, h * 0.18);

            // Animated arcs
            for (let i = 0; i < 3; i++) {
              const threshold = i / 3;
              if (p <= threshold) continue;
              const segP = Math.min(1, (p - threshold) / 0.3);
              const x0 = margin + (i / 3) * lineW;
              const x1 = margin + ((i + 1) / 3) * lineW;
              const midX = (x0 + x1) / 2;
              ctx.beginPath();
              ctx.strokeStyle = palette.accent;
              ctx.lineWidth = 3;
              ctx.globalAlpha = segP;
              ctx.moveTo(x0, y0);
              ctx.quadraticCurveTo(midX, y0 - h * 0.18, x1, y0);
              ctx.stroke();
              ctx.globalAlpha = 1;

              if (segP > 0.5) {
                ctx.font = `700 ${h * 0.07}px ${FONT}`;
                ctx.fillStyle = palette.accent;
                ctx.fillText(`${i + 1}`, midX, y0 - h * 0.2);
              }
            }

            if (p > 0.85) {
              ctx.font = `700 ${h * 0.12}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.textAlign = "center";
              ctx.textBaseline = "bottom";
              ctx.fillText("= 3 Sprünge ✓", w / 2, h * 0.95);
            }
          },
          duration: 2500,
        },
      ];
    }

    // Default: place
    return [
      {
        title: "So geht's",
        text: "Zerlege die Zahl in ihre Stellenwerte: Tausender, Hunderter, Zehner, Einer.",
        mathBackground: "Jede Stelle einer Zahl hat einen Wert. 3.456 = 3 Tausender + 4 Hunderter + 5 Zehner + 6 Einer.",
        draw(ctx, w, h, p) {
          ctx.font = `700 ${h * 0.12}px ${FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = palette.canvasText;
          ctx.fillText("3.456", w / 2, h * 0.15);

          const labels = ["T", "H", "Z", "E"];
          const digits = [3, 4, 5, 6];
          const boxW = w * 0.16;
          const gap = w * 0.04;
          const startX = w / 2 - (4 * boxW + 3 * gap) / 2;
          const boxY = h * 0.35;
          const boxH = h * 0.35;

          for (let i = 0; i < 4; i++) {
            const threshold = i / 4;
            if (p <= threshold) continue;
            const alpha = Math.min(1, (p - threshold) / 0.2);
            const bx = startX + i * (boxW + gap);

            ctx.globalAlpha = alpha;
            ctx.fillStyle = palette.accentSubtle;
            ctx.strokeStyle = palette.accent;
            ctx.lineWidth = 2;
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") ctx.roundRect(bx, boxY, boxW, boxH, 8);
            else ctx.rect(bx, boxY, boxW, boxH);
            ctx.fill();
            ctx.stroke();

            ctx.font = `700 ${h * 0.14}px ${FONT}`;
            ctx.fillStyle = palette.canvasText;
            ctx.textAlign = "center";
            ctx.fillText(`${digits[i]}`, bx + boxW / 2, boxY + boxH * 0.45);

            ctx.font = `600 ${h * 0.07}px ${FONT}`;
            ctx.fillStyle = palette.canvasTextDim;
            ctx.fillText(labels[i]!, bx + boxW / 2, boxY + boxH * 0.85);
            ctx.globalAlpha = 1;
          }

          if (p > 0.85) {
            ctx.font = `700 ${h * 0.09}px ${FONT}`;
            ctx.fillStyle = palette.ok;
            ctx.textAlign = "center";
            ctx.fillText("3T + 4H + 5Z + 6E ✓", w / 2, h * 0.9);
          }
        },
        duration: 2500,
      },
    ];
  },

  generate(ctx) {
    const d = ctx.difficulty;
    switch (ctx.taskType) {
      case "place": return generatePlaceTask(d);
      case "compare": return generateCompareTask(d);
      case "jump": return generateJumpTask(d);
      default: return generatePlaceTask(d);
    }
  },

  check(task, answer) {
    if (task.type === "compare") {
      const ans = answer as "<" | "=" | ">";
      // task.value is the left-hand number stored in the task (see generateCompareTask)
      const correct = checkCompare(ans, task.value ?? 0, task.target);
      return { correct, feedback: correct ? "Richtig verglichen!" : "Schau nochmal genau hin." };
    }
    const num = typeof answer === "number" ? answer : Number(answer);
    if (task.type === "jump") {
      // Answer is the number of steps
      const correct = num === task.steps;
      return { correct, feedback: correct ? "Richtig gezählt!" : "Zähle die Sprünge nochmal." };
    }
    const correct = num === task.target;
    return { correct, feedback: correct ? "Richtig!" : "Probier nochmal!" };
  },

  hints: getHints,

  getSolution(task) {
    if (task.type === "place") {
      const pv = getPlaceValues(task.target);
      // Only show place values relevant to the number size (avoid confusing HT/ZT for small numbers)
      const parts: string[] = [];
      if (pv.hundredThousands > 0) parts.push(`${pv.hundredThousands}HT`);
      if (pv.tenThousands > 0 || pv.hundredThousands > 0) parts.push(`${pv.tenThousands}ZT`);
      if (task.target >= 1000 || pv.thousands > 0) parts.push(`${pv.thousands}T`);
      parts.push(`${pv.hundreds}H`, `${pv.tens}Z`, `${pv.ones}E`);
      return { text: `${task.target.toLocaleString("de-DE")} = ${parts.join(" + ")}` };
    }
    if (task.type === "compare") {
      const lv = task.value ?? 0;
      const sym = lv < task.target ? "<" : lv > task.target ? ">" : "=";
      return { text: `${lv.toLocaleString("de-DE")} ${sym} ${task.target.toLocaleString("de-DE")}` };
    }
    return { text: `${task.steps} Sprünge à ${task.stepSize?.toLocaleString("de-DE")} von ${task.start?.toLocaleString("de-DE")} nach ${task.target.toLocaleString("de-DE")}` };
  },

  initialState: () => ({ value: 0, compareAnswer: null }),

  onKeyDown(key, ctx) {
    // Compare mode: allow keyboard selection of <, =, > via keys or digits 1/2/3
    if (ctx.task.type === "compare") {
      let op: "<" | "=" | ">" | null = null;
      if (key === "<" || key === "1" || key === "ArrowLeft") op = "<";
      else if (key === "=" || key === "2") op = "=";
      else if (key === ">" || key === "3" || key === "ArrowRight") op = ">";
      if (op) {
        compareCallback?.(op);
        return true; // consume — prevent default numpad handling
      }
      // Block digit keys in compare mode (they'd go to numpad otherwise)
      if (/^[0-9]$/.test(key)) return true;
      return false;
    }
    return false;
  },

  onActivate(ctx) {
    compareCallback = (op: "<" | "=" | ">") => {
      ctx.updateState(s => ({ ...s, compareAnswer: op }));
      ctx.submitAnswer(op);
    };
    jumpAnimScene = ctx.scene;
  },

  onDeactivate() {
    compareCallback = null;
    jumpAnimScene = null;
    jumpAnimActive = false;
    cancelAnimationFrame(jumpAnimRafId);
    jumpAnimRafId = 0;
  },

  buildScene(ctx) {
    const { task } = ctx;
    switch (task.type) {
      case "place": return buildPlaceScene(ctx);
      case "compare": return buildCompareScene(ctx);
      case "jump": return buildJumpScene(ctx);
    }
  },
});
