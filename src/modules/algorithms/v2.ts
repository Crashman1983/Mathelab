/**
 * Schriftliches Rechnen V2 — with column-tap and numpad interactivity.
 *
 * Student taps a column to focus it, then enters digits via numpad.
 * Carry-over is shown as the student fills in digits correctly.
 */

import { defineModule, DIFFICULTIES } from "@app/module-framework";
import type { SceneContext, TutorialStep } from "@app/module-framework";
import { vstack } from "@canvas/nodes/container";
import { text } from "@canvas/nodes/text";
import { custom } from "@canvas/nodes/custom";
import { panel } from "@canvas/nodes/panel";
import type { CanvasNode } from "@canvas/nodes/types";
import { getPalette } from "@core/design";
import { drawLinedPaper } from "@canvas/illustrations/notebook";
import { prefersReducedMotion } from "@core/utils";
import {
  generateTask,
  checkAnswer,
  operatorLabel,
  computeAdditionSteps,
  computeSubtractionSteps,
  computeMultiplicationSteps,
  computeDivisionSteps,
  getDigits,
  numPlaces,
  type AlgoMode,
  type AlgoTask,
  type ColumnStep,
  type DivisionStep,
} from "./logic";

// ─── State ───────────────────────────────────────────────────────────────────

interface AlgoState {
  /** Digits entered by the student (index = column from right, 0 = ones) */
  enteredDigits: Record<number, number>;
  /** Currently focused column (index from right) */
  focusCol: number;
}

type Ctx = SceneContext<AlgoTask, AlgoState>;

// ─── Module-level Carry Animation ────────────────────────────────────────────

const CARRY_ANIM_DURATION = 400; // ms per carry digit slide-in
let carryAnimProgress = 0;
let carryAnimRafId = 0;
let carryLastEnteredCount = 0;
let carryLastTime: number | null = null;

// V1: Column feedback animation — flash green/orange on digit entry
const COLUMN_FLASH_DURATION = 500; // ms
let columnFlashCol = -1;        // which column is flashing
let columnFlashCorrect = false;  // true=green, false=orange
let columnFlashProgress = 1;     // 0→1 (1 = no flash active)

// V3: Focus column pulse animation
let focusPulseTime = 0;          // accumulator for sine wave

// Mutable refs for pointer interaction
let tapColumnCallback: ((col: number) => void) | null = null;

// Module-level geometry — set during draw, read during pointer events
let algoGeo: {
  startX: number;
  cellW: number;
  places: number;
  resultY: number;
  cellH: number;
} | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSteps(task: AlgoTask): ColumnStep[] {
  switch (task.mode) {
    case "addition": return computeAdditionSteps(task.a, task.b);
    case "subtraction": return computeSubtractionSteps(task.a, task.b);
    case "multiplication": return computeMultiplicationSteps(task.a, task.b);
    case "division": return []; // Division uses DivisionStep[], not ColumnStep[]
  }
}

function getDivSteps(task: AlgoTask): DivisionStep[] {
  return computeDivisionSteps(task.a, task.b);
}

function getHints(task: AlgoTask): string[] {
  if (task.mode === "division") {
    const divSteps = getDivSteps(task);
    const firstStep = divSteps[0];
    const restText = task.remainder ? ` Rest ${task.remainder}` : "";
    return [
      `Teile ${task.a} : ${task.b} schriftlich.`,
      firstStep ? `Wie oft passt ${task.b} in ${firstStep.currentValue}? → ${firstStep.quotientDigit}` : `Beginne mit der ersten Ziffer.`,
      `Das Ergebnis ist ${task.answer}${restText}.`,
      `Gib die Ziffern von links nach rechts ein: ${String(task.answer).split("").join(", ")}${task.remainder ? ` (Rest ${task.remainder})` : ""}.`,
    ];
  }
  const op = operatorLabel(task.mode);
  return [
    `Rechne ${task.a} ${op} ${task.b} schriftlich.`,
    `Beginne bei den Einern und arbeite nach links.`,
    `Das Ergebnis ist ${task.answer}.`,
    `Gib die Ziffern von rechts nach links ein: ${String(task.answer).split("").reverse().join(", ")}.`,
  ];
}

// ─── Division Scene ──────────────────────────────────────────────────────────

// Module-level geometry for division pointer events
let divGeo: {
  startX: number;
  cellW: number;
  quotientY: number;
  cellH: number;
  quotientDigitCount: number;
} | null = null;

function buildDivisionScene(ctx: Ctx): CanvasNode {
  const { task, state, result } = ctx;
  const divSteps = getDivSteps(task);
  const dividendStr = String(task.a);
  const quotientDigits = divSteps.map(s => s.quotientDigit);
  const answered = result?.correct === true;
  const entered = state.enteredDigits;
  // For division, focusCol indexes from LEFT (0 = first quotient digit)
  const focusCol = state.focusCol;

  return vstack([
    text(`${task.a} : ${task.b} = ?`, { fontSize: "xl", bold: true }),
    panel(
      { id: "division-notebook", bg: "panelSoft", radius: 12, padding: 4 },
      custom({
        id: "division-calc",
        flex: 1,
        draw(c, r) {
          const palette = getPalette();
          drawLinedPaper(c, r.x, r.y, r.w, r.h, palette, 28, 0.06);

        const cellW = Math.min(r.w * 0.1, 64);
        const cellH = cellW * 1.3;
        const font = `700 ${Math.max(18, cellW * 0.55)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        const smallFont = `600 ${Math.max(14, cellW * 0.4)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        const totalWidth = (dividendStr.length + 4) * cellW; // dividend + spacing + divisor
        const startX = r.x + (r.w - totalWidth) / 2;
        const topY = r.y + r.h * 0.12;

        c.textAlign = "center";
        c.textBaseline = "middle";

        // ─── Row 1: dividend : divisor = ___  ────────────────────────
        c.font = font;

        // Dividend digits
        for (let i = 0; i < dividendStr.length; i++) {
          c.fillStyle = palette.canvasText;
          c.fillText(dividendStr[i]!, startX + i * cellW + cellW / 2, topY);
        }

        // Colon operator
        const colonX = startX + dividendStr.length * cellW + cellW * 0.5;
        c.fillStyle = palette.canvasPrimary;
        c.fillText(":", colonX, topY);

        // Divisor
        const divisorX = colonX + cellW;
        c.fillStyle = palette.canvasText;
        c.fillText(String(task.b), divisorX, topY);

        // Equals sign
        const eqX = divisorX + cellW;
        c.fillStyle = palette.canvasPrimary;
        c.fillText("=", eqX, topY);

        // Quotient slots (right side)
        const quotientStartX = eqX + cellW * 0.7;
        const quotientY = topY;

        for (let i = 0; i < quotientDigits.length; i++) {
          const x = quotientStartX + i * cellW + cellW / 2;

          if (answered) {
            c.fillStyle = palette.canvasSuccess;
            c.fillText(`${quotientDigits[i]}`, x, quotientY);
          } else if (i in entered) {
            const isCorrect = entered[i] === quotientDigits[i];
            c.fillStyle = isCorrect ? palette.canvasSuccess : palette.canvasWarn;
            c.fillText(`${entered[i]}`, x, quotientY);

            // Column flash
            if (i === columnFlashCol && columnFlashProgress < 1) {
              const flashAlpha = (1 - columnFlashProgress) * 0.35;
              const glowR = cellW * 0.45;
              c.save();
              c.globalAlpha = flashAlpha;
              c.fillStyle = columnFlashCorrect ? palette.ok : palette.warn;
              c.beginPath();
              c.arc(x, quotientY, glowR, 0, Math.PI * 2);
              c.fill();
              c.restore();
            }
          } else {
            // Empty slot with focus pulse
            const isFocused = i === focusCol;
            const slotW = cellW * 0.7;
            const slotH = cellH * 0.5;
            const pulseAlpha = isFocused ? 0.8 + Math.sin(focusPulseTime * 3) * 0.2 : 1;
            c.save();
            c.globalAlpha = pulseAlpha;
            c.fillStyle = isFocused ? palette.accentSubtle : palette.panelSoft;
            c.strokeStyle = isFocused ? palette.accent : palette.line;
            c.lineWidth = isFocused ? 2.5 : 1;
            if (typeof c.roundRect === "function") {
              c.beginPath();
              c.roundRect(x - slotW / 2, quotientY - slotH / 2, slotW, slotH, 4);
              c.fill();
              c.stroke();
            } else {
              c.fillRect(x - slotW / 2, quotientY - slotH / 2, slotW, slotH);
              c.strokeRect(x - slotW / 2, quotientY - slotH / 2, slotW, slotH);
            }
            c.restore();
          }
        }

        // Show remainder after quotient if answered and remainder > 0
        if (answered && task.remainder && task.remainder > 0) {
          const remX = quotientStartX + quotientDigits.length * cellW + cellW / 2;
          c.font = font;
          c.fillStyle = palette.canvasSuccess;
          c.fillText(`R ${task.remainder}`, remX + cellW * 0.3, quotientY);
        }

        // ─── Intermediate steps (shown progressively as student enters digits) ──
        // German "Treppe" layout: each step shows subtraction below dividend
        let stepY = topY + cellH;
        const revealedSteps = answered ? divSteps.length : Object.keys(entered).length;

        for (let si = 0; si < revealedSteps && si < divSteps.length; si++) {
          const step = divSteps[si]!;

          // Line above subtraction
          c.strokeStyle = palette.line;
          c.lineWidth = 1.5;
          c.beginPath();
          const lineLeftX = startX + step.position * cellW - cellW * 0.3;
          const lineRightX = startX + (step.position + 1) * cellW + cellW * 0.3;
          c.moveTo(lineLeftX, stepY - cellH * 0.15);
          c.lineTo(lineRightX, stepY - cellH * 0.15);
          c.stroke();

          // Subtracted product (−product)
          c.font = smallFont;
          c.fillStyle = palette.accent;
          c.textAlign = "right";
          const prodStr = String(step.product);
          c.fillText(`−${prodStr}`, startX + (step.position + 1) * cellW + cellW * 0.2, stepY);
          c.textAlign = "center";

          // Remainder below
          stepY += cellH * 0.7;
          c.font = smallFont;
          c.fillStyle = palette.canvasTextDim;

          // Show remainder, and if next step exists, show next digit brought down
          const remStr = String(step.remainder);
          if (si < divSteps.length - 1) {
            // Show remainder with next digit appended (the "bringing down")
            const nextDigit = dividendStr[step.position + 1];
            c.fillText(`${remStr}${nextDigit}`, startX + (step.position + 1) * cellW + cellW * 0.2, stepY);
          } else {
            // Final remainder
            c.fillText(remStr, startX + step.position * cellW + cellW / 2, stepY);
          }

          stepY += cellH * 0.5;
        }

        // Store geometry for pointer interaction
        divGeo = {
          startX: quotientStartX,
          cellW,
          quotientY,
          cellH,
          quotientDigitCount: quotientDigits.length,
        };
      },
    }),
    ),
  ], { gap: 12, padding: 16, align: "center" });
}

// ─── Scene ───────────────────────────────────────────────────────────────────

function buildAlgoScene(ctx: Ctx): CanvasNode {
  // Division has its own scene due to fundamentally different layout
  if (ctx.task.mode === "division") return buildDivisionScene(ctx);

  const { task, state, result } = ctx;
  const op = operatorLabel(task.mode);
  const steps = getSteps(task);
  const places = Math.max(numPlaces(task.a), numPlaces(task.b), numPlaces(task.answer));
  const digitsA = getDigits(task.a, places);
  const digitsB = getDigits(task.b, places);
  const digitsR = getDigits(task.answer, places + 1);
  const answered = result?.correct === true;
  const entered = state.enteredDigits;
  const focusCol = state.focusCol;

  return vstack([
    text(`${task.a} ${op} ${task.b} = ?`, { fontSize: "xl", bold: true }),
    panel(
      { id: "column-notebook", bg: "panelSoft", radius: 12, padding: 4 },
      custom({
        id: "column-calc",
        flex: 1,
        draw(c, r) {
          const palette = getPalette();

          // Lined paper background (subtle)
          drawLinedPaper(c, r.x, r.y, r.w, r.h, palette, 28, 0.06);

        const cellW = Math.min(r.w * 0.16, 90);
        const cellH = cellW * 1.2;
        const startX = r.x + r.w / 2 + (places * cellW) / 2;
        const startY = r.y + r.h * 0.18;
        const font = `700 ${Math.max(20, cellW * 0.55)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;

        c.font = font;
        c.textAlign = "center";
        c.textBaseline = "middle";

        // Row A
        for (let i = 0; i < places; i++) {
          const x = startX - i * cellW;
          c.fillStyle = palette.canvasText;
          c.fillText(`${digitsA[i]}`, x, startY);
        }

        // Operator
        c.fillStyle = palette.canvasPrimary;
        c.fillText(op, startX - places * cellW, startY + cellH);

        // Row B
        for (let i = 0; i < places; i++) {
          const x = startX - i * cellW;
          c.fillStyle = palette.canvasText;
          c.fillText(`${digitsB[i]}`, x, startY + cellH);
        }

        // Line
        const lineY = startY + cellH * 1.5;
        c.strokeStyle = palette.line;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(startX - (places + 0.5) * cellW, lineY);
        c.lineTo(startX + cellW * 0.5, lineY);
        c.stroke();

        // Result row — entered digits or solution
        const resultY = lineY + cellH * 0.7;

        // Result glow when fully answered
        if (answered) {
          const glowX = startX - places * cellW - cellW * 0.3;
          const glowW = (places + 1) * cellW + cellW * 0.6;
          const glowH = cellH * 0.8;
          c.save();
          c.globalAlpha = 0.12;
          c.fillStyle = palette.ok;
          c.beginPath();
          if (typeof c.roundRect === "function") {
            c.roundRect(glowX, resultY - glowH / 2, glowW, glowH, 8);
          } else {
            c.rect(glowX, resultY - glowH / 2, glowW, glowH);
          }
          c.fill();
          c.restore();
        }

        for (let i = 0; i <= places; i++) {
          if (digitsR[i] === 0 && i === places) continue;
          const x = startX - i * cellW;

          if (answered) {
            // Show full solution
            c.fillStyle = palette.canvasSuccess;
            c.fillText(`${digitsR[i]}`, x, resultY);
          } else if (i in entered) {
            // Show entered digit
            const isCorrect = entered[i] === digitsR[i];
            // UX: Kein hartes Rot bei Fehlern (Kinder-UI) → Warn-Orange
            c.fillStyle = isCorrect ? palette.canvasSuccess : palette.canvasWarn;
            c.fillText(`${entered[i]}`, x, resultY);

            // V1: Column flash feedback — glow behind digit on recent entry
            if (i === columnFlashCol && columnFlashProgress < 1) {
              const flashAlpha = (1 - columnFlashProgress) * 0.35;
              const glowR = cellW * 0.45;
              c.save();
              c.globalAlpha = flashAlpha;
              c.fillStyle = columnFlashCorrect ? palette.ok : palette.warn;
              c.beginPath();
              c.arc(x, resultY, glowR, 0, Math.PI * 2);
              c.fill();
              c.restore();
            }
          } else {
            // Empty slot — highlight focused column with V3: pulse animation
            const isFocused = i === focusCol;
            const slotW = cellW * 0.7;
            const slotH = cellH * 0.6;

            // V3: Pulsating focus — sine wave on opacity (0.6↔1.0)
            const pulseAlpha = isFocused ? 0.8 + Math.sin(focusPulseTime * 3) * 0.2 : 1;

            c.save();
            c.globalAlpha = pulseAlpha;
            c.fillStyle = isFocused ? palette.accentSubtle : palette.panelSoft;
            c.strokeStyle = isFocused ? palette.accent : palette.line;
            c.lineWidth = isFocused ? 2.5 : 1;
            if (typeof c.roundRect === "function") {
              c.beginPath();
              c.roundRect(x - slotW / 2, resultY - slotH / 2, slotW, slotH, 4);
              c.fill();
              c.stroke();
            } else {
              c.fillRect(x - slotW / 2, resultY - slotH / 2, slotW, slotH);
              c.strokeRect(x - slotW / 2, resultY - slotH / 2, slotW, slotH);
            }
            c.restore();
          }
        }

        // Carries (shown for completed columns) — animated slide-in from below
        if (answered || Object.keys(entered).length > 0) {
          const carryFont = `600 ${Math.max(14, cellW * 0.35)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          c.font = carryFont;
          // Find highest entered column index to detect "newest" carry
          const enteredCols = Object.keys(entered).map(Number);
          const maxEnteredCol = enteredCols.length > 0 ? Math.max(...enteredCols) : -1;
          for (const step of steps) {
            if (step.carryOut > 0 && (answered || step.colIndex in entered)) {
              const x = startX - (step.colIndex + 1) * cellW + cellW * 0.3;
              const targetY = startY - cellH * 0.35;

              // Animate: carry arcs from result row to carry position
              const isNewest = step.colIndex === maxEnteredCol && !answered;
              const t = isNewest ? Math.min(1, carryAnimProgress) : 1;

              // Arc path: start at result digit position, curve up to carry position
              const fromX = startX - step.colIndex * cellW;
              const fromY = resultY;
              const toX = x;
              const toY = targetY;
              // Quadratic bezier — control point above midpoint
              const cpX = (fromX + toX) / 2;
              const cpY = Math.min(fromY, toY) - cellH * 0.8;
              const arcX = (1 - t) * (1 - t) * fromX + 2 * t * (1 - t) * cpX + t * t * toX;
              const arcY = (1 - t) * (1 - t) * fromY + 2 * t * (1 - t) * cpY + t * t * toY;

              // Eased alpha: fast fade-in
              const alpha = isNewest ? Math.min(1, t * 2) : 1;

              c.fillStyle = palette.accent;
              c.globalAlpha = 0.8 * alpha;
              c.fillText(`${step.carryOut}`, arcX, arcY);
              c.globalAlpha = 1;
            }
          }
        }

        // Store geometry for pointer hit-testing
        algoGeo = { startX, cellW, places, resultY, cellH };
      },
    }),
    ),
  ], { gap: 12, padding: 16, align: "center" });
}

// ─── Module Definition ───────────────────────────────────────────────────────

export const algorithmsV2Registration = defineModule<AlgoTask, AlgoState>({
  id: "algorithms",
  label: "Schriftliches Rechnen",
  icon: "📝",
  description: "Addition, Subtraktion, Multiplikation und Division schriftlich lösen.",

  flowType: "task",
  input: "numberPad",

  taskTypes: [
    { id: "addition", label: "Addition", icon: "+" },
    { id: "subtraction", label: "Subtraktion", icon: "−" },
    { id: "multiplication", label: "Multiplikation", icon: "×" },
    { id: "division", label: "Division", icon: "÷" },
  ],

  difficulties: DIFFICULTIES,

  taskLabel(task) {
    const op = operatorLabel(task.mode);
    return `Rechne ${task.a} ${op} ${task.b} schriftlich.`;
  },

  tutorial: (taskType: string): TutorialStep[] => {
    const palette = getPalette();
    const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

    if (taskType === "subtraction") {
      return [
        {
          title: "So geht's",
          text: "Schreibe die Zahlen untereinander und rechne von rechts nach links.",
          mathBackground: "Beim schriftlichen Subtrahieren arbeiten wir stellenweise von rechts nach links. Wenn nötig, leihen wir von der nächsten Stelle.",
          draw(ctx, w, h, p) {
            ctx.font = `700 ${h * 0.11}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = palette.canvasText;
            ctx.fillText("543 − 271 = ?", w / 2, h * 0.1);

            // Column layout
            const cellW = w * 0.12;
            const startX = w / 2 + cellW;
            const rowY = h * 0.32;
            const rowH = h * 0.13;

            ctx.font = `700 ${h * 0.1}px ${FONT}`;
            ctx.textAlign = "center";

            // Row A: 543
            const digitsA = [3, 4, 5];
            for (let i = 0; i < 3; i++) {
              ctx.fillStyle = palette.canvasText;
              ctx.fillText(`${digitsA[i]}`, startX - i * cellW, rowY);
            }

            // Operator
            ctx.fillStyle = palette.canvasPrimary;
            ctx.fillText("−", startX - 3 * cellW, rowY + rowH);

            // Row B: 271
            const digitsB = [1, 7, 2];
            for (let i = 0; i < 3; i++) {
              ctx.fillStyle = palette.canvasText;
              ctx.fillText(`${digitsB[i]}`, startX - i * cellW, rowY + rowH);
            }

            // Line
            ctx.strokeStyle = palette.line;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX - 3.5 * cellW, rowY + rowH * 1.5);
            ctx.lineTo(startX + cellW * 0.5, rowY + rowH * 1.5);
            ctx.stroke();

            // Animated result: 272
            const result = [2, 7, 2];
            for (let i = 0; i < 3; i++) {
              const threshold = i / 3;
              if (p <= threshold) continue;
              const alpha = Math.min(1, (p - threshold) / 0.25);
              ctx.globalAlpha = alpha;
              ctx.fillStyle = palette.ok;
              ctx.fillText(`${result[i]}`, startX - i * cellW, rowY + rowH * 2.2);
              ctx.globalAlpha = 1;
            }

            if (p > 0.85) {
              ctx.font = `700 ${h * 0.1}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.fillText("= 272 ✓", w / 2, h * 0.92);
            }
          },
          duration: 2500,
        },
      ];
    }

    if (taskType === "multiplication") {
      return [
        {
          title: "So geht's",
          text: "Multipliziere stellenweise und addiere die Teilergebnisse.",
          mathBackground: "Beim schriftlichen Multiplizieren rechnen wir jede Stelle einzeln und addieren die Ergebnisse.",
          draw(ctx, w, h, p) {
            ctx.font = `700 ${h * 0.11}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = palette.canvasText;
            ctx.fillText("23 × 4 = ?", w / 2, h * 0.1);

            if (p > 0.2) {
              ctx.font = `600 ${h * 0.09}px ${FONT}`;
              ctx.fillStyle = palette.accent;
              ctx.fillText("3 × 4 = 12 → schreibe 2, merke 1", w / 2, h * 0.35);
            }
            if (p > 0.5) {
              ctx.fillStyle = palette.accent;
              ctx.fillText("2 × 4 = 8, + 1 = 9", w / 2, h * 0.55);
            }
            if (p > 0.8) {
              ctx.font = `700 ${h * 0.12}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.fillText("= 92 ✓", w / 2, h * 0.8);
            }
          },
          duration: 2500,
        },
      ];
    }

    if (taskType === "division") {
      return [
        {
          title: "So geht's",
          text: "Teile Schritt für Schritt von links nach rechts. Wie oft passt der Divisor in die Zahl?",
          mathBackground: "Bei der schriftlichen Division arbeiten wir von links nach rechts. Wir fragen: Wie oft passt der Divisor hinein?",
          draw(ctx, w, h, p) {
            ctx.font = `700 ${h * 0.11}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = palette.canvasText;
            ctx.fillText("84 : 4 = ?", w / 2, h * 0.1);

            if (p > 0.15) {
              ctx.font = `600 ${h * 0.09}px ${FONT}`;
              ctx.fillStyle = palette.accent;
              ctx.fillText("8 : 4 = 2", w / 2, h * 0.35);
            }
            if (p > 0.45) {
              ctx.fillStyle = palette.accent;
              ctx.fillText("4 : 4 = 1", w / 2, h * 0.55);
            }
            if (p > 0.75) {
              ctx.font = `700 ${h * 0.12}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.fillText("= 21 ✓", w / 2, h * 0.8);
            }
          },
          duration: 2500,
        },
      ];
    }

    // Default: addition
    return [
      {
        title: "So geht's",
        text: "Schreibe die Zahlen untereinander und rechne von rechts nach links.",
        mathBackground: "Beim schriftlichen Rechnen arbeiten wir stellenweise von rechts nach links. Übertrag kommt zur nächsten Stelle.",
        draw(ctx, w, h, p) {
          ctx.font = `700 ${h * 0.11}px ${FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = palette.canvasText;
          ctx.fillText("347 + 286 = ?", w / 2, h * 0.1);

          // Column layout
          const cellW = w * 0.12;
          const startX = w / 2 + cellW;
          const rowY = h * 0.32;
          const rowH = h * 0.13;

          ctx.font = `700 ${h * 0.1}px ${FONT}`;
          ctx.textAlign = "center";

          // Row A: 347
          const digitsA = [7, 4, 3];
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = palette.canvasText;
            ctx.fillText(`${digitsA[i]}`, startX - i * cellW, rowY);
          }

          // Operator
          ctx.fillStyle = palette.canvasPrimary;
          ctx.fillText("+", startX - 3 * cellW, rowY + rowH);

          // Row B: 286
          const digitsB = [6, 8, 2];
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = palette.canvasText;
            ctx.fillText(`${digitsB[i]}`, startX - i * cellW, rowY + rowH);
          }

          // Line
          ctx.strokeStyle = palette.line;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(startX - 3.5 * cellW, rowY + rowH * 1.5);
          ctx.lineTo(startX + cellW * 0.5, rowY + rowH * 1.5);
          ctx.stroke();

          // Animated result: 633
          const result = [3, 3, 6];
          for (let i = 0; i < 3; i++) {
            const threshold = i / 3;
            if (p <= threshold) continue;
            const alpha = Math.min(1, (p - threshold) / 0.25);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = palette.ok;
            ctx.fillText(`${result[i]}`, startX - i * cellW, rowY + rowH * 2.2);
            ctx.globalAlpha = 1;
          }

          // Carry
          if (p > 0.2) {
            ctx.font = `600 ${h * 0.07}px ${FONT}`;
            ctx.fillStyle = palette.accent;
            ctx.globalAlpha = Math.min(1, (p - 0.2) / 0.2);
            ctx.fillText("1", startX - 1 * cellW + cellW * 0.3, rowY - rowH * 0.4);
            ctx.globalAlpha = 1;
          }
          if (p > 0.5) {
            ctx.font = `600 ${h * 0.07}px ${FONT}`;
            ctx.fillStyle = palette.accent;
            ctx.globalAlpha = Math.min(1, (p - 0.5) / 0.2);
            ctx.fillText("1", startX - 2 * cellW + cellW * 0.3, rowY - rowH * 0.4);
            ctx.globalAlpha = 1;
          }

          if (p > 0.85) {
            ctx.font = `700 ${h * 0.1}px ${FONT}`;
            ctx.fillStyle = palette.ok;
            ctx.fillText("= 633 ✓", w / 2, h * 0.92);
          }
        },
        duration: 2500,
      },
    ];
  },

  generate(ctx) {
    const mode = (ctx.taskType as AlgoMode) ?? "addition";
    return generateTask(mode, ctx.difficulty);
  },

  check(task, answer) {
    const num = typeof answer === "number" ? answer : Number(answer);
    const correct = checkAnswer(task, num);
    return {
      correct,
      feedback: correct
        ? "Richtig! Toll gerechnet!"
        : "Probier nochmal – rechne Schritt für Schritt.",
    };
  },

  hints: getHints,

  getSolution(task) {
    const op = operatorLabel(task.mode);
    if (task.mode === "division") {
      const restText = task.remainder ? ` Rest ${task.remainder}` : "";
      return { text: `${task.a} : ${task.b} = ${task.answer}${restText}` };
    }
    return { text: `${task.a} ${op} ${task.b} = ${task.answer}` };
  },

  initialState: () => ({ enteredDigits: {}, focusCol: 0 }),

  onActivate(ctx) {
    tapColumnCallback = (col: number) => {
      ctx.updateState(s => ({ ...s, focusCol: col }));
    };

    // Carry animation RAF loop — triggers on new digit entry
    carryAnimProgress = 1; // Start fully visible (no animation until entry)
    carryLastEnteredCount = 0;
    carryLastTime = null;
    columnFlashProgress = 1;
    columnFlashCol = -1;
    focusPulseTime = 0;

    if (prefersReducedMotion()) { carryAnimRafId = 0; return; } // Skip animation — carries appear instantly

    const loop = (now: number) => {
      const dt = carryLastTime !== null ? now - carryLastTime : 0;
      carryLastTime = now;
      const dtSec = dt / 1000;

      // Detect new digit entered → reset carry animation + trigger column flash
      const currentCount = Object.keys(ctx.state.enteredDigits).length;
      if (currentCount > carryLastEnteredCount) {
        carryAnimProgress = 0;

        // V1: Determine which column was just entered and if it's correct
        const enteredCols = Object.keys(ctx.state.enteredDigits).map(Number);
        const newestCol = Math.max(...enteredCols);
        const task = ctx.task;
        const places = Math.max(numPlaces(task.a), numPlaces(task.b), numPlaces(task.answer));
        const digitsR = getDigits(task.answer, places + 1);
        columnFlashCol = newestCol;
        columnFlashCorrect = ctx.state.enteredDigits[newestCol] === digitsR[newestCol];
        columnFlashProgress = 0;

        carryLastEnteredCount = currentCount;
      }

      let needsRedraw = false;

      if (carryAnimProgress < 1) {
        carryAnimProgress = Math.min(1, carryAnimProgress + dt / CARRY_ANIM_DURATION);
        needsRedraw = true;
      }

      // V1: Advance column flash
      if (columnFlashProgress < 1) {
        columnFlashProgress = Math.min(1, columnFlashProgress + dt / COLUMN_FLASH_DURATION);
        needsRedraw = true;
      }

      // V3: Advance focus pulse (always running for smooth sine wave)
      focusPulseTime += dtSec;
      needsRedraw = true; // Focus pulse always needs redraw while module is active

      if (needsRedraw) ctx.invalidate();

      carryAnimRafId = requestAnimationFrame(loop);
    };
    carryAnimRafId = requestAnimationFrame(loop);
  },

  onDeactivate() {
    tapColumnCallback = null;
    algoGeo = null;
    divGeo = null;
    cancelAnimationFrame(carryAnimRafId);
    carryAnimProgress = 1;
    carryLastTime = null;
    columnFlashProgress = 1;
    columnFlashCol = -1;
    focusPulseTime = 0;
  },

  onKeyDown(key, ctx) {
    const isDivision = ctx.task.mode === "division";

    // Direct keyboard digit entry into the focused column
    if (/^[0-9]$/.test(key)) {
      const digit = Number(key);
      const task = ctx.task;
      const col = ctx.state.focusCol;

      // Don't overwrite already entered digits
      if (col in ctx.state.enteredDigits) return true;

      if (isDivision) {
        // Division: left-to-right entry
        const divSteps = getDivSteps(task);
        const quotientDigits = divSteps.map(s => s.quotientDigit);
        const totalCols = quotientDigits.length;

        const newEntered = { ...ctx.state.enteredDigits, [col]: digit };

        // Auto-advance to next empty slot (left to right)
        let nextCol = col + 1;
        while (nextCol < totalCols && nextCol in newEntered) nextCol++;
        if (nextCol >= totalCols) nextCol = col;

        ctx.updateState(s => ({ ...s, enteredDigits: newEntered, focusCol: nextCol }));

        // Auto-submit when all quotient digits are filled
        const allFilled = Array.from({ length: totalCols }, (_, i) => i)
          .every(i => i in newEntered);
        if (allFilled) {
          // Reconstruct quotient from entered digits (left-to-right)
          let answer = 0;
          for (let i = 0; i < totalCols; i++) {
            answer = answer * 10 + (newEntered[i] ?? 0);
          }
          ctx.submitAnswer(answer);
        }
        return true;
      }

      // Add/Sub/Mult: right-to-left entry
      const places = Math.max(numPlaces(task.a), numPlaces(task.b), numPlaces(task.answer));
      const newEntered = { ...ctx.state.enteredDigits, [col]: digit };

      // Auto-advance focus to next empty column
      let nextCol = col + 1;
      while (nextCol <= places && nextCol in newEntered) nextCol++;
      if (nextCol > places) nextCol = col;

      ctx.updateState(s => ({ ...s, enteredDigits: newEntered, focusCol: nextCol }));
      return true;
    }

    // Arrow keys to navigate columns
    if (key === "ArrowLeft") {
      if (isDivision) {
        const newCol = Math.max(ctx.state.focusCol - 1, 0);
        ctx.updateState(s => ({ ...s, focusCol: newCol }));
      } else {
        const task = ctx.task;
        const places = Math.max(numPlaces(task.a), numPlaces(task.b), numPlaces(task.answer));
        const newCol = Math.min(ctx.state.focusCol + 1, places);
        ctx.updateState(s => ({ ...s, focusCol: newCol }));
      }
      return true;
    }
    if (key === "ArrowRight") {
      if (isDivision) {
        const divSteps = getDivSteps(ctx.task);
        const newCol = Math.min(ctx.state.focusCol + 1, divSteps.length - 1);
        ctx.updateState(s => ({ ...s, focusCol: newCol }));
      } else {
        const newCol = Math.max(ctx.state.focusCol - 1, 0);
        ctx.updateState(s => ({ ...s, focusCol: newCol }));
      }
      return true;
    }

    // Backspace to delete the last entered digit
    if (key === "Backspace") {
      const entered = ctx.state.enteredDigits;
      const cols = Object.keys(entered).map(Number);
      if (cols.length > 0) {
        const lastCol = Math.max(...cols);
        const newEntered = { ...entered };
        delete newEntered[lastCol];
        ctx.updateState(s => ({ ...s, enteredDigits: newEntered, focusCol: lastCol }));
      }
      return true;
    }

    return false;
  },

  onPointerDown(ctx) {
    if (ctx.task.mode === "division") {
      // Division: tap on quotient digit slots
      if (!divGeo) return;
      const { startX, cellW, quotientY, cellH, quotientDigitCount } = divGeo;
      if (Math.abs(ctx.y - quotientY) > cellH) return;
      const tappedCol = Math.floor((ctx.x - startX) / cellW);
      if (tappedCol >= 0 && tappedCol < quotientDigitCount) {
        tapColumnCallback?.(tappedCol);
      }
      return;
    }

    if (!algoGeo) return;
    const { startX, cellW, places, resultY, cellH } = algoGeo;

    // Only respond to taps near the result row
    if (Math.abs(ctx.y - resultY) > cellH) return;

    // Compute tapped column index from right (0 = ones) based on pointer position
    const tappedCol = Math.round((startX - ctx.x) / cellW);
    if (tappedCol >= 0 && tappedCol <= places) {
      tapColumnCallback?.(tappedCol);
    }
  },

  buildScene(ctx) {
    return buildAlgoScene(ctx);
  },
});
