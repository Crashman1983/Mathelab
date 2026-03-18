/**
 * Einmaleins V2 — Multiplication module with interactivity.
 *
 * Task types: dot (Punktfeld), jumps (Zahlenstrahl), divide (Division)
 * Interactivity: ButtonNode to flip dot field, numpad for answers.
 */

import { defineModule, DIFFICULTIES } from "@app/module-framework";
import type { SceneContext, TutorialStep } from "@app/module-framework";
import { vstack, hstack } from "@canvas/nodes/container";
import { text } from "@canvas/nodes/text";
import { button } from "@canvas/nodes/button";
import { custom } from "@canvas/nodes/custom";
import type { CanvasNode } from "@canvas/nodes/types";
import { getPalette } from "@core/design";
import { prefersReducedMotion } from "@core/utils";
import {
  generateTask,
  getProduct,
  checkAnswer,
  checkDivisionAnswer,
  getJumpPositions,
  getNumberLineRange,
  getDividend,
  type MultiMode,
  type MultiTask,
} from "./logic";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MultiState {
  flipped: boolean;
}

type Ctx = SceneContext<MultiTask, MultiState>;

// Mutable callback ref — set by onActivate, used by buildScene button onTap
let flipCallback: (() => void) | null = null;

// ─── Module-level Dot-Stagger Animation ─────────────────────────────────────

const DOT_STAGGER_DURATION = 600; // ms für alle Punkte
let dotAnimProgress = 0;
let dotAnimRafId = 0;
let dotPrevPhase: "present" | "interact" = "present";
let dotLastTime: number | null = null;

// ─── Swap (Tauschen) Animation ──────────────────────────────────────────────
// Dots slide from old grid position to transposed position over 500ms.
// During animation, `swapAnimProgress` goes from 0 → 1.
// At progress=0 dots are at old positions, at progress=1 at new positions.
const SWAP_ANIM_DURATION = 500; // ms
let swapAnimProgress = 1;       // 1 = no swap animation active
let swapFromRows = 0;           // rows BEFORE swap
let swapFromCols = 0;           // cols BEFORE swap
let swapToRows = 0;             // rows AFTER swap
let swapToCols = 0;             // cols AFTER swap

// ─── Jump Replay Animation ──────────────────────────────────────────────────
// After correct answer, arcs replay one-by-one with a bouncing ball.
// jumpReplayProgress goes from 0 → task.a (one unit per jump).
const JUMP_REPLAY_SPEED = 400; // ms per jump
let jumpReplayProgress = -1; // -1 = inactive
let jumpReplayStarted = false;

// ─── Hints ───────────────────────────────────────────────────────────────────

function getHints(task: MultiTask): string[] {
  switch (task.mode) {
    case "dot":
      return [
        `Zähle die Punkte: ${task.a} Reihen mit je ${task.b} Punkten.`,
        `${task.a} × ${task.b} – du kannst die Reihen einzeln zählen.`,
        `Die Antwort ist ${getProduct(task)}.`,
        `${task.a} × ${task.b} = ? Rechne: ${getProduct(task) - task.b} + ${task.b} = ...`,
      ];
    case "jumps":
      return [
        `Springe ${task.a}-mal um ${task.b} weiter.`,
        `Starte bei 0 und addiere ${task.b} insgesamt ${task.a}-mal.`,
        `Das Ergebnis ist ${getProduct(task)}.`,
        `Nach ${task.a - 1} Sprüngen bist du bei ${getProduct(task) - task.b}. Noch ein Sprung: ${getProduct(task) - task.b} + ${task.b} = ...`,
      ];
    case "divide":
      return [
        `Teile ${getDividend(task)} gleichmäßig in ${task.a} Gruppen.`,
        `Wie oft passt ${task.a} in ${getDividend(task)}?`,
        `${getDividend(task)} ÷ ${task.a} = ${task.b}.`,
        `${task.a} × ? = ${getDividend(task)}. Die Zahl ist einstellig und liegt nahe bei ${task.b}.`,
      ];
  }
}

// ─── Scene Builders ──────────────────────────────────────────────────────────

/** Smooth ease-in-out for swap animation */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function buildDotScene(ctx: Ctx): CanvasNode {
  const { task, state, input, result } = ctx;
  const flipped = state.flipped;
  const rows = flipped ? task.b : task.a;
  const cols = flipped ? task.a : task.b;
  const answered = result?.correct === true;

  const questionLabel = flipped
    ? `${task.b} × ${task.a} = ${answered ? getProduct(task) : (input || "?")}`
    : `${task.a} × ${task.b} = ${answered ? getProduct(task) : (input || "?")}`;

  // Is swap animation in progress?
  const isSwapping = swapAnimProgress < 1;

  return vstack([
    text(questionLabel, { fontSize: "xl", bold: true }),
    custom({
      id: "dot-field",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();

        if (isSwapping) {
          // ── Swap Animation: interpolate between old and new grid positions ──
          const t = easeInOutCubic(swapAnimProgress);
          const fRows = swapFromRows;
          const fCols = swapFromCols;
          const tRows = swapToRows;
          const tCols = swapToCols;

          // Compute geometry for BOTH grids (from and to)
          const fromDotR = Math.min(Math.min(r.w / (fCols * 2.8), r.h / (fRows * 2.8)), r.w * 0.028);
          const toDotR = Math.min(Math.min(r.w / (tCols * 2.8), r.h / (tRows * 2.8)), r.w * 0.028);
          const dotR = fromDotR + (toDotR - fromDotR) * t;

          const fromCellW = fromDotR * 2.6;
          const fromCellH = fromDotR * 2.6;
          const fromFieldW = fCols * fromCellW;
          const fromFieldH = fRows * fromCellH;
          const fromFx = r.x + (r.w - fromFieldW) / 2;
          const fromFy = r.y + (r.h - fromFieldH) / 2;

          const toCellW = toDotR * 2.6;
          const toCellH = toDotR * 2.6;
          const toFieldW = tCols * toCellW;
          const toFieldH = tRows * toCellH;
          const toFx = r.x + (r.w - toFieldW) / 2;
          const toFy = r.y + (r.h - toFieldH) / 2;

          // ── Connection lines: show path from origin → destination ──
          // Draw faint lines first (below dots) so dots render on top
          c.save();
          c.lineWidth = Math.max(1, dotR * 0.3);
          c.strokeStyle = palette.canvasTextDim;
          c.globalAlpha = 0.15 * (1 - t); // Fade out as animation completes
          for (let fRow = 0; fRow < fRows; fRow++) {
            for (let fCol = 0; fCol < fCols; fCol++) {
              const oldX = fromFx + fCol * fromCellW + fromCellW / 2;
              const oldY = fromFy + fRow * fromCellH + fromCellH / 2;
              const newX = toFx + fRow * toCellW + toCellW / 2;
              const newY = toFy + fCol * toCellH + toCellH / 2;
              // Only draw if dot actually moves (skip stationary dots on the diagonal)
              const dx = newX - oldX;
              const dy = newY - oldY;
              if (dx * dx + dy * dy < 4) continue;
              c.beginPath();
              c.moveTo(oldX, oldY);
              // Slight curve for visual clarity
              const midX = (oldX + newX) / 2;
              const midY = (oldY + newY) / 2;
              const perpX = -(newY - oldY) * 0.12;
              const perpY = (newX - oldX) * 0.12;
              c.quadraticCurveTo(midX + perpX, midY + perpY, newX, newY);
              c.stroke();
            }
          }
          c.restore();

          // ── Dots: interpolate between old and new grid positions ──
          // A dot at (row, col) in AxB grid maps to (col, row) in BxA grid (transpose)
          for (let fRow = 0; fRow < fRows; fRow++) {
            for (let fCol = 0; fCol < fCols; fCol++) {
              const oldX = fromFx + fCol * fromCellW + fromCellW / 2;
              const oldY = fromFy + fRow * fromCellH + fromCellH / 2;
              const newX = toFx + fRow * toCellW + toCellW / 2;
              const newY = toFy + fCol * toCellH + toCellH / 2;

              const cx = oldX + (newX - oldX) * t;
              const cy = oldY + (newY - oldY) * t;

              c.beginPath();
              c.arc(cx, cy, dotR, 0, 2 * Math.PI);
              c.fillStyle = palette.canvasPrimary;
              c.globalAlpha = 0.9;
              c.fill();
              c.globalAlpha = 1;
            }
          }

          // Row labels fade out during swap, fade in at end
          const labelAlpha = t > 0.7 ? (t - 0.7) / 0.3 : (1 - t / 0.3);
          if (labelAlpha > 0 && tRows > 1) {
            const labelRows = t > 0.5 ? tRows : fRows;
            const labelCols = t > 0.5 ? tCols : fCols;
            const lDotR = t > 0.5 ? toDotR : fromDotR;
            const lCellH = lDotR * 2.6;
            const lFieldH = labelRows * lCellH;
            const lFy = r.y + (r.h - lFieldH) / 2;
            const lFieldW = labelCols * (lDotR * 2.6);
            const lFx = r.x + (r.w - lFieldW) / 2;

            c.save();
            c.globalAlpha = Math.max(0, labelAlpha);
            c.font = `600 ${Math.max(10, lDotR * 1.8)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
            c.fillStyle = palette.canvasTextDim;
            c.textAlign = "right";
            c.textBaseline = "middle";
            for (let row = 0; row < labelRows; row++) {
              const cy = lFy + row * lCellH + lCellH / 2;
              c.fillText(`${labelCols}`, lFx - lDotR, cy);
            }
            c.restore();
          }
        } else {
          // ── Normal rendering (no swap in progress) ──
          const maxDotR = Math.min(r.w / (cols * 2.8), r.h / (rows * 2.8));
          const dotR = Math.min(maxDotR, r.w * 0.028);
          const cellW = dotR * 2.6;
          const cellH = dotR * 2.6;
          const fieldW = cols * cellW;
          const fieldH = rows * cellH;
          const fx = r.x + (r.w - fieldW) / 2;
          const fy = r.y + (r.h - fieldH) / 2;

          const totalDots = rows * cols;
          for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
              const dotIdx = row * cols + col;
              // Stagger: jeder Punkt hat eigenen Schwellenwert
              const dotThreshold = totalDots > 1 ? dotIdx / (totalDots - 1) : 0;
              const dotAlpha = Math.max(0, Math.min(1, (dotAnimProgress - dotThreshold * 0.7) / 0.3));

              if (dotAlpha <= 0) continue;

              const cx = fx + col * cellW + cellW / 2;
              const cy = fy + row * cellH + cellH / 2;
              const scale = 0.5 + dotAlpha * 0.5; // Scale-In: 50% → 100%
              c.beginPath();
              c.arc(cx, cy, dotR * scale, 0, 2 * Math.PI);
              c.fillStyle = palette.canvasPrimary;
              c.globalAlpha = 0.9 * dotAlpha;
              c.fill();
              c.globalAlpha = 1;
            }
          }

          // Zeilen-Gruppierung: Reihen-Labels wenn sichtbar
          if (dotAnimProgress >= 0.8 && rows > 1) {
            const labelAlpha = Math.min(1, (dotAnimProgress - 0.8) / 0.2);
            c.save();
            c.globalAlpha = labelAlpha;
            c.font = `600 ${Math.max(10, dotR * 1.8)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
            c.fillStyle = palette.canvasTextDim;
            c.textAlign = "right";
            c.textBaseline = "middle";
            for (let row = 0; row < rows; row++) {
              const cy = fy + row * cellH + cellH / 2;
              c.fillText(`${cols}`, fx - dotR, cy);
            }
            c.restore();
          }
        }
      },
    }),
    hstack([
      button("↻ Tauschen", {
        id: "flip-btn",
        variant: "ghost",
        onTap: () => flipCallback?.(),
      }),
    ], { gap: 8, align: "center" }),
    text(
      flipped
        ? `(${task.b} Zeilen × ${task.a} Spalten)`
        : `(${task.a} Zeilen × ${task.b} Spalten)`,
      { fontSize: "sm", color: "canvasTextDim" },
    ),
  ], { gap: 8, padding: 16, align: "center" });
}

function buildJumpsScene(ctx: Ctx): CanvasNode {
  const { task, input, result } = ctx;
  const positions = getJumpPositions(task);
  const { max } = getNumberLineRange(task);
  const answered = result?.correct === true;

  // Trigger jump replay animation on first answered frame
  if (answered && !jumpReplayStarted) {
    jumpReplayStarted = true;
    jumpReplayProgress = prefersReducedMotion() ? task.a : 0;
  }

  const replaying = jumpReplayProgress >= 0 && jumpReplayProgress < task.a;

  return vstack([
    text(`${task.a} × ${task.b} = ${answered ? getProduct(task) : (input || "?")}`, { fontSize: "xl", bold: true }),
    text(`${task.a} Sprünge je +${task.b}`, { fontSize: "sm", color: "canvasTextDim" }),
    custom({
      id: "number-line",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();
        const lineY = r.y + r.h * 0.5;
        const lx0 = r.x + r.w * 0.07;
        const lx1 = r.x + r.w * 0.93;
        const lw = lx1 - lx0;

        c.save();
        c.strokeStyle = palette.line;
        c.lineWidth = Math.max(3, lw * 0.006);
        c.beginPath();
        c.moveTo(lx0, lineY);
        c.lineTo(lx1, lineY);
        c.stroke();

        // Jump arcs — during replay, show progressively
        const colors = palette.faceColors;
        const completedJumps = replaying ? Math.floor(jumpReplayProgress) : task.a;
        const currentJumpT = replaying ? jumpReplayProgress - completedJumps : 0;

        for (let i = 0; i < task.a; i++) {
          const x0 = lx0 + (positions[i]! / max) * lw;
          const x1 = lx0 + (positions[i + 1]! / max) * lw;
          const midX = (x0 + x1) / 2;
          const arcH = (x1 - x0) * 0.55;

          if (replaying && i > completedJumps) continue; // Not yet visible

          const arcColor = colors[i % colors.length]!;

          if (replaying && i === completedJumps) {
            // Current arc: draw partial arc up to currentJumpT
            // Approximate by drawing the quadratic bezier up to t
            const steps = 30;
            const maxStep = Math.round(steps * currentJumpT);
            if (maxStep > 0) {
              c.beginPath();
              c.moveTo(x0, lineY);
              for (let s = 1; s <= maxStep; s++) {
                const st = s / steps;
                // Quadratic bezier: P = (1-t)²·P0 + 2(1-t)t·Pc + t²·P1
                const bx = (1 - st) * (1 - st) * x0 + 2 * (1 - st) * st * midX + st * st * x1;
                const by = (1 - st) * (1 - st) * lineY + 2 * (1 - st) * st * (lineY - arcH) + st * st * lineY;
                c.lineTo(bx, by);
              }
              c.strokeStyle = arcColor;
              c.lineWidth = Math.max(2, lw * 0.012);
              c.globalAlpha = 0.85;
              c.stroke();
              c.globalAlpha = 1;
            }

            // Draw bouncing ball at current position on the arc
            const bt = currentJumpT;
            const ballX = (1 - bt) * (1 - bt) * x0 + 2 * (1 - bt) * bt * midX + bt * bt * x1;
            const ballY = (1 - bt) * (1 - bt) * lineY + 2 * (1 - bt) * bt * (lineY - arcH) + bt * bt * lineY;
            const ballR = Math.max(5, lw * 0.015);
            c.beginPath();
            c.arc(ballX, ballY, ballR, 0, 2 * Math.PI);
            c.fillStyle = arcColor;
            c.fill();
            c.strokeStyle = palette.canvasText;
            c.lineWidth = 1.5;
            c.stroke();
          } else {
            // Completed arc: draw fully
            c.beginPath();
            c.moveTo(x0, lineY);
            c.quadraticCurveTo(midX, lineY - arcH, x1, lineY);
            c.strokeStyle = arcColor;
            c.lineWidth = Math.max(2, lw * 0.012);
            c.globalAlpha = 0.85;
            c.stroke();
            c.globalAlpha = 1;
          }
        }

        // Tick marks
        for (let i = 0; i <= task.a; i++) {
          const tx = lx0 + (positions[i]! / max) * lw;
          c.beginPath();
          c.moveTo(tx, lineY - r.h * 0.06);
          c.lineTo(tx, lineY + r.h * 0.06);
          c.strokeStyle = palette.line;
          c.lineWidth = 2;
          c.stroke();

          // Show endpoint labels: during replay, show up to completed jumps
          const showLabel = i === 0 || (answered && (!replaying || i <= completedJumps));
          if (showLabel) {
            c.font = `700 ${Math.max(12, r.w * 0.025)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
            c.fillStyle = palette.canvasText;
            c.textAlign = "center";
            c.textBaseline = "top";
            c.fillText(`${positions[i]}`, tx, lineY + r.h * 0.08);
          }
        }
        c.restore();
      },
    }),
  ], { gap: 8, padding: 16, align: "center" });
}

function buildDivideScene(ctx: Ctx): CanvasNode {
  const { task, input, result } = ctx;
  const dividend = getDividend(task);
  const answered = result?.correct === true;

  return vstack([
    text(`${dividend} ÷ ${task.a} = ${answered ? task.b : (input || "?")}`, { fontSize: "xl", bold: true }),
    text(`Teile ${dividend} auf ${task.a} Gruppen auf`, {
      fontSize: "sm",
      color: "canvasTextDim",
    }),
    custom({
      id: "group-boxes",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();
        const groups = task.a;
        const perGroup = task.b;
        const maxCols = Math.min(groups, 6);
        const rowCount = Math.ceil(groups / maxCols);
        const gapPx = 8;
        const boxW = Math.min(
          (r.w * 0.9) / maxCols - gapPx,
          (r.h * 0.9) / rowCount - gapPx,
        );
        const boxH = boxW;
        const startX = r.x + (r.w - maxCols * (boxW + gapPx)) / 2;
        const startY = r.y + (r.h - rowCount * (boxH + gapPx)) / 2;

        for (let g = 0; g < groups; g++) {
          const col = g % maxCols;
          const row = Math.floor(g / maxCols);
          const bx = startX + col * (boxW + gapPx);
          const by = startY + row * (boxH + gapPx);

          c.save();
          c.fillStyle = palette.accentSubtle;
          c.strokeStyle = palette.accentBorder;
          c.lineWidth = 1.5;
          c.beginPath();
          if (typeof c.roundRect === "function") {
            c.roundRect(bx, by, boxW, boxH, 8);
          } else {
            c.rect(bx, by, boxW, boxH);
          }
          c.fill();
          c.stroke();
          c.restore();

          if (answered) {
            // Show dots after correct answer — solid, grouped
            const dotCols = Math.ceil(Math.sqrt(perGroup));
            const dotRows = Math.ceil(perGroup / dotCols);
            const dotR = Math.min(
              (boxW * 0.7) / (dotCols * 2.2),
              (boxH * 0.6) / (dotRows * 2.2),
            );
            for (let d = 0; d < perGroup; d++) {
              const dc = d % dotCols;
              const dr = Math.floor(d / dotCols);
              const dx = bx + boxW * 0.15 + dc * (boxW * 0.7 / dotCols) + dotR;
              const dy = by + boxH * 0.2 + dr * (boxH * 0.6 / dotRows) + dotR;
              c.beginPath();
              c.arc(dx, dy, dotR, 0, 2 * Math.PI);
              c.fillStyle = palette.canvasPrimary;
              c.fill();
            }
          } else {
            // Show "?" — child must figure out the per-group count
            c.font = `700 ${Math.max(16, boxW * 0.35)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
            c.fillStyle = palette.canvasTextDim;
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText("?", bx + boxW / 2, by + boxH / 2);
          }
        }
      },
    }),
  ], { gap: 8, padding: 16, align: "center" });
}

// ─── Module Definition ───────────────────────────────────────────────────────

export const multiplicationV2Registration = defineModule<MultiTask, MultiState>({
  id: "multiplication",
  label: "Einmaleins",
  icon: "✖️",
  description:
    "Multiplikation und Division mit Punktfeldern und Zahlensprüngen erleben.",

  flowType: "task",
  input: "numberPad",

  taskTypes: [
    { id: "dot", label: "Punktfeld", icon: "⬤" },
    { id: "jumps", label: "Sprünge", icon: "↗" },
    { id: "divide", label: "Division", icon: "÷" },
  ],

  difficulties: DIFFICULTIES,

  taskLabel(task) {
    return `Rechne ${task.a} mal ${task.b}.`;
  },

  answerRange(task) {
    return getProduct(task);
  },

  tutorial: (taskType: string): TutorialStep[] => {
    const palette = getPalette();
    const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

    if (taskType === "jumps") {
      return [
        {
          title: "So geht's",
          text: "Springe auf dem Zahlenstrahl immer gleich weit. Zähle die Sprünge!",
          mathBackground: "3 × 4 bedeutet: Springe 3-mal um 4 weiter. Start bei 0, dann 4, 8, 12.",
          draw(ctx, w, h, p) {
            const y0 = h * 0.6;
            const margin = w * 0.08;
            const lineW = w - 2 * margin;

            // Number line
            ctx.strokeStyle = palette.canvasText;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(margin, y0);
            ctx.lineTo(margin + lineW, y0);
            ctx.stroke();

            // Ticks 0-12
            ctx.font = `600 ${h * 0.07}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = palette.canvasText;
            for (let i = 0; i <= 12; i++) {
              const x = margin + (i / 12) * lineW;
              ctx.beginPath();
              ctx.moveTo(x, y0 - 4);
              ctx.lineTo(x, y0 + 4);
              ctx.stroke();
              if (i % 4 === 0) ctx.fillText(`${i}`, x, y0 + 6);
            }

            ctx.font = `700 ${h * 0.11}px ${FONT}`;
            ctx.textBaseline = "bottom";
            ctx.fillStyle = palette.canvasText;
            ctx.textAlign = "center";
            ctx.fillText("3 × 4 = ?", w / 2, h * 0.15);

            // Animated arcs
            const jumps = [0, 4, 8, 12];
            for (let i = 0; i < 3; i++) {
              const threshold = i / 3;
              if (p <= threshold) continue;
              const segP = Math.min(1, (p - threshold) / 0.3);
              const x0 = margin + (jumps[i]! / 12) * lineW;
              const x1 = margin + (jumps[i + 1]! / 12) * lineW;
              const midX = (x0 + x1) / 2;
              const arcH = h * 0.18;

              ctx.beginPath();
              ctx.strokeStyle = palette.accent;
              ctx.lineWidth = 3;
              ctx.globalAlpha = segP;
              ctx.moveTo(x0, y0);
              ctx.quadraticCurveTo(midX, y0 - arcH, x0 + (x1 - x0) * segP, y0 - arcH * Math.sin(segP * Math.PI));
              ctx.stroke();
              ctx.globalAlpha = 1;
            }

            if (p > 0.85) {
              ctx.font = `700 ${h * 0.12}px ${FONT}`;
              ctx.textBaseline = "bottom";
              ctx.fillStyle = palette.ok;
              ctx.textAlign = "center";
              ctx.fillText("= 12 ✓", w / 2, h * 0.95);
            }
          },
          duration: 2500,
        },
      ];
    }

    if (taskType === "divide") {
      return [
        {
          title: "So geht's",
          text: "Teile die Punkte gleichmäßig in Gruppen auf.",
          mathBackground: "12 ÷ 3 = 4 bedeutet: Verteile 12 Punkte auf 3 Gruppen. Jede Gruppe hat 4 Punkte.",
          draw(ctx, w, h, p) {
            ctx.font = `700 ${h * 0.11}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = palette.canvasText;
            ctx.fillText("12 ÷ 3 = ?", w / 2, h * 0.15);

            // 3 boxes with 4 dots each
            const boxW = w * 0.22;
            const boxH = h * 0.4;
            const gap = w * 0.06;
            const startX = w / 2 - (3 * boxW + 2 * gap) / 2;
            const boxY = h * 0.35;

            for (let g = 0; g < 3; g++) {
              const bx = startX + g * (boxW + gap);
              ctx.strokeStyle = palette.accentBorder;
              ctx.lineWidth = 2;
              ctx.beginPath();
              if (typeof ctx.roundRect === "function") ctx.roundRect(bx, boxY, boxW, boxH, 8);
              else ctx.rect(bx, boxY, boxW, boxH);
              ctx.stroke();

              // Fill dots animated
              const dotsToShow = Math.floor(p * 4);
              for (let d = 0; d < dotsToShow; d++) {
                const col = d % 2;
                const row = Math.floor(d / 2);
                const dx = bx + boxW * 0.3 + col * boxW * 0.4;
                const dy = boxY + boxH * 0.3 + row * boxH * 0.35;
                ctx.beginPath();
                ctx.arc(dx, dy, Math.min(boxW, boxH) * 0.08, 0, Math.PI * 2);
                ctx.fillStyle = palette.canvasPrimary;
                ctx.fill();
              }
            }

            if (p > 0.85) {
              ctx.font = `700 ${h * 0.12}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.textAlign = "center";
              ctx.fillText("= 4 ✓", w / 2, h * 0.9);
            }
          },
          duration: 2500,
        },
      ];
    }

    // Default: dot
    return [
      {
        title: "So geht's",
        text: "Zähle die Punkte im Punktfeld! Reihen × Spalten = Ergebnis.",
        mathBackground: "Multiplikation ist wiederholte Addition. 3 × 4 bedeutet: 3 Reihen mit je 4 Punkten.",
        draw(ctx, w, h, p) {
          ctx.font = `700 ${h * 0.11}px ${FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = palette.canvasText;
          ctx.fillText("3 × 4 = ?", w / 2, h * 0.12);

          // 3 rows × 4 cols dot grid, filling row by row
          const rows = 3;
          const cols = 4;
          const dotR = Math.min(w * 0.03, h * 0.04);
          const cellW = dotR * 3;
          const cellH = dotR * 3;
          const fieldW = cols * cellW;
          const fx = (w - fieldW) / 2;
          const fy = h * 0.3;

          const totalDots = rows * cols;
          const dotsToShow = Math.floor(p * totalDots);

          for (let i = 0; i < dotsToShow; i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const cx = fx + col * cellW + cellW / 2;
            const cy = fy + row * cellH + cellH / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
            ctx.fillStyle = palette.canvasPrimary;
            ctx.fill();
          }

          // Row labels
          if (p > 0.5) {
            ctx.font = `600 ${h * 0.07}px ${FONT}`;
            ctx.fillStyle = palette.canvasTextDim;
            ctx.textAlign = "right";
            for (let r = 0; r < rows; r++) {
              const cy = fy + r * cellH + cellH / 2;
              ctx.fillText("4", fx - dotR, cy);
            }
          }

          if (p > 0.85) {
            ctx.font = `700 ${h * 0.12}px ${FONT}`;
            ctx.fillStyle = palette.ok;
            ctx.textAlign = "center";
            ctx.fillText("= 12 ✓", w / 2, h * 0.9);
          }
        },
        duration: 2500,
      },
    ];
  },

  generate(ctx) {
    const modeMap: Record<string, MultiMode> = {
      dot: "dot",
      jumps: "jumps",
      divide: "divide",
    };
    const mode = modeMap[ctx.taskType] ?? "dot";
    return generateTask(mode, ctx.previous as MultiTask | undefined, ctx.difficulty);
  },

  check(task, answer) {
    const numAnswer = typeof answer === "number" ? answer : Number(answer);
    if (task.mode === "divide") {
      return {
        correct: checkDivisionAnswer(task, numAnswer),
        feedback: checkDivisionAnswer(task, numAnswer)
          ? "Richtig! Super geteilt!"
          : "Probier nochmal – teile gleichmäßig auf.",
      };
    }
    const wrongFeedback = task.mode === "jumps"
      ? "Fast! Zähle die Sprünge nochmal."
      : "Fast! Zähle die Punkte nochmal.";
    return {
      correct: checkAnswer(task, numAnswer),
      feedback: checkAnswer(task, numAnswer)
        ? "Richtig! Gut multipliziert!"
        : wrongFeedback,
    };
  },

  hints: getHints,

  getSolution(task) {
    if (task.mode === "divide") {
      return { text: `${getDividend(task)} ÷ ${task.a} = ${task.b}` };
    }
    // Show repeated addition to reinforce the concept
    const parts = Array(task.a).fill(String(task.b)).join(" + ");
    return { text: `${task.a} × ${task.b} = ${parts} = ${getProduct(task)}` };
  },

  initialState: () => ({ flipped: false }),

  onActivate(ctx) {
    flipCallback = () => {
      if (swapAnimProgress < 1) return; // Already animating — ignore

      const task = ctx.task;
      const wasFlipped = ctx.state.flipped;

      // Capture FROM geometry (before swap)
      swapFromRows = wasFlipped ? task.b : task.a;
      swapFromCols = wasFlipped ? task.a : task.b;
      // TO geometry (after swap)
      swapToRows = swapFromCols;  // rows↔cols
      swapToCols = swapFromRows;

      // Start animation
      swapAnimProgress = prefersReducedMotion() ? 1 : 0;

      // Toggle state (scene will rebuild with new flipped value)
      ctx.updateState(s => ({ ...s, flipped: !s.flipped }));
    };

    // Reset swap animation
    swapAnimProgress = 1;

    // Reset jump replay
    jumpReplayProgress = -1;
    jumpReplayStarted = false;

    // Dot-Stagger-Animation
    dotAnimProgress = prefersReducedMotion() ? 1 : 0;
    dotPrevPhase = ctx.phase;
    dotLastTime = null;

    if (prefersReducedMotion()) { dotAnimRafId = 0; return; } // Skip animation — dots appear instantly

    const loop = (now: number) => {
      const dt = dotLastTime !== null ? now - dotLastTime : 0;
      dotLastTime = now;

      const phase = ctx.phase;
      if (phase === "interact" && dotPrevPhase !== "interact") {
        dotAnimProgress = 0;
        dotLastTime = now;
      }
      dotPrevPhase = phase;

      let needsRedraw = false;

      if (phase === "interact" && dotAnimProgress < 1) {
        dotAnimProgress = Math.min(1, dotAnimProgress + dt / DOT_STAGGER_DURATION);
        needsRedraw = true;
      }

      // Drive swap animation
      if (swapAnimProgress < 1) {
        swapAnimProgress = Math.min(1, swapAnimProgress + dt / SWAP_ANIM_DURATION);
        needsRedraw = true;
      }

      // Drive jump replay animation
      if (jumpReplayProgress >= 0 && jumpReplayProgress < ctx.task.a) {
        jumpReplayProgress = Math.min(ctx.task.a, jumpReplayProgress + dt / JUMP_REPLAY_SPEED);
        needsRedraw = true;
      }

      if (needsRedraw) ctx.invalidate();

      dotAnimRafId = requestAnimationFrame(loop);
    };
    dotAnimRafId = requestAnimationFrame(loop);
  },

  onDeactivate() {
    flipCallback = null;
    cancelAnimationFrame(dotAnimRafId);
    dotAnimProgress = 0;
    dotLastTime = null;
    swapAnimProgress = 1;
    jumpReplayProgress = -1;
    jumpReplayStarted = false;
  },

  buildScene(ctx) {
    const { task } = ctx;
    switch (task.mode) {
      case "dot":
        return buildDotScene(ctx);
      case "jumps":
        return buildJumpsScene(ctx);
      case "divide":
        return buildDivideScene(ctx);
      default:
        return text("Unbekannter Modus", { fontSize: "lg" });
    }
  },
});
