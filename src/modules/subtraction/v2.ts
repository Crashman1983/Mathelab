/**
 * Subtraktion V2 — Taucher schwimmt auf dem Zahlenstrahl zurück.
 *
 * Thema: Ein Taucher schwimmt im Aquarium nach links (Subtraktion als Rückwärtsbewegung).
 * Modi: numberline (Zahlenstrahl), decompose (Zerlegung)
 *
 * Didaktisches Konzept:
 *   Situation: Taucher ist bei Zahl a.
 *   Handlung: Taucher macht b Schritte zurück.
 *   Veränderung: Taucher landet bei a − b.
 *   Erkenntnis: a − b = Differenz.
 */

import { defineModule, DIFFICULTIES } from "@app/module-framework";
import type { SceneContext, TutorialStep } from "@app/module-framework";
import { vstack } from "@canvas/nodes/container";
import { text } from "@canvas/nodes/text";
import { custom } from "@canvas/nodes/custom";
import type { CanvasNode } from "@canvas/nodes/types";
import { getPalette } from "@core/design";
import { prefersReducedMotion } from "@core/utils";
import {
  generateTask,
  getDifference,
  checkAnswer,
  getJumpPositions,
  getNumberLineRange,
  getHints,
  type SubMode,
  type SubTask,
} from "./logic";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubState {
  // Animation wird auf Modul-Ebene via RAF verwaltet
}

type Ctx = SceneContext<SubTask, SubState>;

// ─── Module-level Animation (Rückwärts-Sprungbögen + Taucher-Position) ──────

const SUB_ANIM_DURATION = 1200;
let subAnimProgress = 0;
let subAnimRafId = 0;
let subPrevPhase: "present" | "interact" = "present";
let subLastTime: number | null = null;

// ─── Diver Drawing Helper ─────────────────────────────────────────────────────

function drawDiver(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  const p = getPalette();
  const r = size * 0.45;
  ctx.save();

  // Taucheranzug (Körper)
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.85, 0, 0, 2 * Math.PI);
  ctx.fillStyle = p.diverSuit;
  ctx.fill();
  ctx.strokeStyle = p.diverDark;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.stroke();

  // Tauchermaske
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.35, r * 0.55, r * 0.38, 0, 0, 2 * Math.PI);
  ctx.fillStyle = p.diverMask;
  ctx.globalAlpha = 0.8;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = p.diverDark;
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.stroke();

  // Augen hinter Maske
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + side * r * 0.22, y - r * 0.35, r * 0.12, 0, 2 * Math.PI);
    ctx.fillStyle = p.canvasText;
    ctx.fill();
  }

  // Sauerstoffflasche (rechts)
  ctx.beginPath();
  ctx.roundRect(x + r * 0.7, y - r * 0.4, r * 0.28, r * 0.8, r * 0.1);
  ctx.fillStyle = p.coinSilver;
  ctx.fill();
  ctx.strokeStyle = p.coinSilverRim;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Blasen (links, wegen Rückwärtsbewegung nach rechts)
  for (let i = 0; i < 3; i++) {
    const bx = x + r * (0.7 + i * 0.3);
    const by = y - r * (0.6 + i * 0.25);
    ctx.beginPath();
    ctx.arc(bx, by, Math.max(2, r * 0.07), 0, 2 * Math.PI);
    ctx.strokeStyle = p.diverMask;
    ctx.globalAlpha = 0.6 - i * 0.15;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ─── Number Line Scene ────────────────────────────────────────────────────────

function buildNumberLineScene(ctx: Ctx): CanvasNode {
  const { task, input, result } = ctx;
  const positions = getJumpPositions(task);
  const { min, max } = getNumberLineRange(task);
  const answered = result?.correct === true;
  const diff = getDifference(task);

  const questionText = answered
    ? `${task.a} − ${task.b} = ${diff} ✓`
    : `${task.a} − ${task.b} = ${input || "?"}`;

  return vstack([
    text("🤿 Taucher schwimmt auf dem Zahlenstrahl zurück", {
      fontSize: "sm",
      color: "canvasTextDim",
    }),
    text(questionText, { fontSize: "xl", bold: true }),
    text(
      positions.length - 1 > 1
        ? `Taucher startet bei ${task.a} und schwimmt zurück: erst −${task.step1}, dann −${task.step2}.`
        : `Taucher startet bei ${task.a} und schwimmt ${task.b} Schritte zurück.`,
      { fontSize: "sm", color: "canvasTextDim" }
    ),
    custom({
      id: "number-line-subtraction",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();
        const lineY = r.y + r.h * 0.60;
        const lx0 = r.x + r.w * 0.07;
        const lx1 = r.x + r.w * 0.93;
        const lw = lx1 - lx0;

        function toX(val: number): number {
          return lx0 + ((val - min) / (max - min)) * lw;
        }

        // ── Zahlenstrahl ──
        c.save();
        c.strokeStyle = palette.line;
        c.lineWidth = Math.max(3, lw * 0.006);
        c.beginPath();
        c.moveTo(lx0, lineY);
        c.lineTo(lx1, lineY);
        c.stroke();

        // Pfeilspitze rechts
        const aw = Math.max(8, lw * 0.02);
        c.beginPath();
        c.moveTo(lx1, lineY);
        c.lineTo(lx1 - aw, lineY - aw * 0.5);
        c.lineTo(lx1 - aw, lineY + aw * 0.5);
        c.closePath();
        c.fillStyle = palette.line;
        c.fill();

        // ── Rückwärts-Bögen (links-gerichtet) ──
        const arcColors = [palette.diverSuit, palette.diverDark];
        for (let i = 0; i < positions.length - 1; i++) {
          const x0 = toX(positions[i]!);
          const x1 = toX(positions[i + 1]!); // x1 < x0 (Rückwärts!)
          const midX = (x0 + x1) / 2;
          const arcH = (x0 - x1) * 0.5; // Positiv weil x0 > x1

          const segCount = positions.length - 1;
          const segProgress = Math.max(
            0,
            Math.min(1, (subAnimProgress - i / segCount) / (1 / segCount))
          );

          if (segProgress > 0) {
            c.beginPath();
            const steps = 30;
            for (let s = 0; s <= Math.floor(steps * segProgress); s++) {
              const t = s / steps;
              const bx = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * midX + t * t * x1;
              const by = (1 - t) * (1 - t) * lineY + 2 * t * (1 - t) * (lineY - arcH) + t * t * lineY;
              if (s === 0) c.moveTo(bx, by);
              else c.lineTo(bx, by);
            }
            c.strokeStyle = arcColors[i % arcColors.length]!;
            c.lineWidth = Math.max(3, lw * 0.014);
            c.globalAlpha = 0.88;
            c.stroke();
            c.globalAlpha = 1;

            // Schrittweite-Label — larger font, more clearance above arc
            const labelX = toX((positions[i]! + positions[i + 1]!) / 2);
            const stepFontSize = Math.max(14, Math.min(r.w * 0.028, 24));
            c.font = `700 ${stepFontSize}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
            c.fillStyle = arcColors[i % arcColors.length]!;
            c.textAlign = "center";
            c.textBaseline = "bottom";
            c.globalAlpha = segProgress;
            c.fillText(`−${positions[i]! - positions[i + 1]!}`, labelX, lineY - arcH - r.h * 0.06 - stepFontSize * 0.5);
            c.globalAlpha = 1;
          }
        }

        // ── Schlüssel-Ticks ──
        for (const val of [task.a, diff]) {
          const tx = toX(val);
          c.beginPath();
          c.moveTo(tx, lineY - r.h * 0.07);
          c.lineTo(tx, lineY + r.h * 0.07);
          c.strokeStyle = palette.canvasText;
          c.lineWidth = 2.5;
          c.stroke();
          c.font = `700 ${Math.max(11, r.w * 0.022)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "top";

          // Hide endpoint (answer) until solved — show "?" instead
          const isEndpoint = val === diff;
          const showLabel = !isEndpoint || answered;
          if (showLabel) {
            c.fillStyle = palette.canvasText;
            c.fillText(`${val}`, tx, lineY + r.h * 0.08);
          } else {
            c.fillStyle = palette.accent;
            c.fillText("?", tx, lineY + r.h * 0.08);
          }
        }

        // ── Taucher (folgt dem Rückwärts-Bogen während Animation) ──
        const diverSize = Math.min(r.h * 0.28, r.w * 0.06);
        const defaultDiverY = lineY - diverSize * 0.7;

        if (!answered && subAnimProgress > 0 && subAnimProgress < 1) {
          const totalSegs = positions.length - 1;
          const segFloat = subAnimProgress * totalSegs;
          const segIdx = Math.min(Math.floor(segFloat), totalSegs - 1);
          const segFrac = segFloat - segIdx;

          const sx0 = toX(positions[segIdx]!);
          const sx1 = toX(positions[segIdx + 1]!);
          const sMidX = (sx0 + sx1) / 2;
          const sArcH = (sx0 - sx1) * 0.5; // Positiv da Rückwärts

          const t = segFrac;
          const diverBx = (1 - t) * (1 - t) * sx0 + 2 * t * (1 - t) * sMidX + t * t * sx1;
          const diverBy = (1 - t) * (1 - t) * lineY + 2 * t * (1 - t) * (lineY - sArcH) + t * t * lineY;
          drawDiver(c, diverBx, diverBy - diverSize * 0.3, diverSize);
        } else {
          drawDiver(c, toX(answered ? diff : (subAnimProgress >= 1 ? positions[positions.length - 1]! : task.a)), defaultDiverY, diverSize);
        }

        // Zielpunkt-Markierung
        if (answered) {
          const ex = toX(diff);
          c.beginPath();
          c.arc(ex, lineY, Math.max(6, r.h * 0.045), 0, 2 * Math.PI);
          c.fillStyle = palette.ok;
          c.globalAlpha = 0.3;
          c.fill();
          c.globalAlpha = 1;
          c.strokeStyle = palette.ok;
          c.lineWidth = 2;
          c.stroke();
        }

        c.restore();
      },
    }),
  ], { gap: 8, padding: 16, align: "center" });
}

// ─── Decompose Scene ──────────────────────────────────────────────────────────

function buildDecomposeScene(ctx: Ctx): CanvasNode {
  const { task, input, result } = ctx;
  const answered = result?.correct === true;
  const diff = getDifference(task);

  return vstack([
    text("🧩 Zerlege und subtrahiere", { fontSize: "sm", color: "canvasTextDim" }),
    text(`${task.a} − ${task.b} = ${answered ? diff : (input || "?")}`, { fontSize: "xl", bold: true }),
    custom({
      id: "decompose-visual-sub",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();
        const cx = r.x + r.w / 2;
        const midY = r.y + r.h * 0.4;
        const boxW = Math.min(r.w * 0.28, 140);
        const boxH = 60;
        const gap = r.w * 0.06;

        // Box A (Minuend)
        c.save();
        c.fillStyle = palette.accentSubtle;
        c.strokeStyle = palette.accentBorder;
        c.lineWidth = 2;
        c.beginPath();
        if (typeof c.roundRect === "function") c.roundRect(cx - gap / 2 - boxW, midY - boxH / 2, boxW, boxH, 12);
        else c.rect(cx - gap / 2 - boxW, midY - boxH / 2, boxW, boxH);
        c.fill(); c.stroke();
        c.fillStyle = palette.canvasText;
        c.font = `700 ${Math.max(18, boxH * 0.42)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(`${task.a}`, cx - gap / 2 - boxW / 2, midY);

        // Minus-Symbol
        c.fillStyle = palette.canvasText;
        c.font = `700 ${Math.max(18, boxH * 0.4)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("−", cx, midY);

        // Box B (Subtrahend, zerlegbar)
        const step1 = task.step1 ?? task.b;
        const step2 = task.step2 ?? 0;

        if (step2 > 0) {
          const halfW = (boxW - 4) / 2;
          for (let i = 0; i < 2; i++) {
            const val = i === 0 ? step1 : step2;
            const bxi = cx + gap / 2 + i * (halfW + 4);
            c.fillStyle = i === 0 ? palette.warnSubtle : palette.accentSubtle;
            c.strokeStyle = i === 0 ? palette.warn : palette.accentBorder;
            c.lineWidth = 2;
            c.beginPath();
            if (typeof c.roundRect === "function") c.roundRect(bxi, midY - boxH / 2, halfW, boxH, 8);
            else c.rect(bxi, midY - boxH / 2, halfW, boxH);
            c.fill(); c.stroke();
            c.fillStyle = palette.canvasText;
            c.font = `700 ${Math.max(14, boxH * 0.35)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText(`${val}`, bxi + halfW / 2, midY);
          }
          c.fillStyle = palette.canvasTextDim;
          c.font = `${Math.max(12, boxH * 0.28)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "top";
          c.fillText(`${step1} + ${step2} = ${task.b}`, cx + gap / 2 + boxW / 2, midY + boxH / 2 + 6);
        } else {
          c.fillStyle = palette.warnSubtle;
          c.strokeStyle = palette.warn;
          c.lineWidth = 2;
          c.beginPath();
          if (typeof c.roundRect === "function") c.roundRect(cx + gap / 2, midY - boxH / 2, boxW, boxH, 12);
          else c.rect(cx + gap / 2, midY - boxH / 2, boxW, boxH);
          c.fill(); c.stroke();
          c.fillStyle = palette.canvasText;
          c.font = `700 ${Math.max(18, boxH * 0.42)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(`${task.b}`, cx + gap / 2 + boxW / 2, midY);
        }

        // Ergebnis-Box
        if (answered) {
          const resY = midY + boxH + r.h * 0.12;
          const resW = boxW * 1.1;
          const resH = boxH * 1.1;
          c.fillStyle = palette.okSubtle;
          c.strokeStyle = palette.ok;
          c.lineWidth = 3;
          c.beginPath();
          if (typeof c.roundRect === "function") c.roundRect(cx - resW / 2, resY - resH / 2, resW, resH, 12);
          else c.rect(cx - resW / 2, resY - resH / 2, resW, resH);
          c.fill(); c.stroke();
          c.fillStyle = palette.ok;
          c.font = `700 ${Math.max(20, resH * 0.45)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(`${diff}`, cx, resY);
        }
        c.restore();
      },
    }),
  ], { gap: 8, padding: 16, align: "center" });
}

// ─── Module Definition ───────────────────────────────────────────────────────

export const subtractionV2Registration = defineModule<SubTask, SubState>({
  id: "subtraction",
  label: "Subtraktion",
  icon: "🤿",
  description:
    "Subtraktion auf dem Zahlenstrahl: Der Taucher schwimmt zurück und findet die Differenz.",

  flowType: "task",
  input: "numberPad",

  taskTypes: [
    { id: "numberline", label: "Zahlenstrahl", icon: "↙" },
    { id: "decompose", label: "Zerlegung", icon: "🧩" },
  ],

  difficulties: DIFFICULTIES,

  taskLabel(task) {
    return `Rechne ${task.a} minus ${task.b}.`;
  },

  answerRange(task) {
    return task.a; // answer is always ≤ task.a
  },

  tutorial: (taskType: string): TutorialStep[] => {
    const palette = getPalette();
    const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

    if (taskType === "decompose") {
      return [
        {
          title: "So geht's",
          text: "Zerlege den Subtrahenden in Teile, die einfacher abzuziehen sind.",
          mathBackground: "Beispiel: 53 − 27 → 53 − 20 − 7 = 26. Man zerlegt die zweite Zahl in Zehner und Einer.",
          draw(ctx, w, h, p) {
            ctx.font = `700 ${h * 0.12}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = palette.canvasText;
            ctx.fillText("53 − 27 = ?", w / 2, h * 0.2);

            if (p > 0.3) {
              ctx.font = `600 ${h * 0.09}px ${FONT}`;
              ctx.fillStyle = palette.accent;
              ctx.fillText("27 = 20 + 7", w / 2, h * 0.45);
            }
            if (p > 0.6) {
              ctx.fillStyle = palette.ok;
              ctx.fillText("53 − 20 = 33", w / 2, h * 0.65);
            }
            if (p > 0.85) {
              ctx.font = `700 ${h * 0.12}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.fillText("33 − 7 = 26 ✓", w / 2, h * 0.85);
            }
          },
          duration: 3000,
        },
      ];
    }

    // Default: numberline
    return [
      {
        title: "So geht's",
        text: "Der Taucher schwimmt auf dem Zahlenstrahl zurück. Finde heraus, wo er landet!",
        mathBackground: "Subtraktion ist die Umkehrung der Addition. a − b bedeutet: Starte bei a und gehe b Schritte zurück.",
        draw(ctx, w, h, p) {
          const y0 = h * 0.55;
          const margin = w * 0.1;
          const lineW = w - 2 * margin;

          // Number line
          ctx.strokeStyle = palette.canvasText;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(margin, y0);
          ctx.lineTo(margin + lineW, y0);
          ctx.stroke();

          // Ticks 0-10
          ctx.font = `600 ${h * 0.08}px ${FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = palette.canvasText;
          for (let i = 0; i <= 10; i++) {
            const x = margin + (i / 10) * lineW;
            ctx.beginPath();
            ctx.moveTo(x, y0 - 5);
            ctx.lineTo(x, y0 + 5);
            ctx.stroke();
            ctx.fillText(`${i}`, x, y0 + 8);
          }

          // Task label
          ctx.font = `700 ${h * 0.11}px ${FONT}`;
          ctx.textBaseline = "bottom";
          ctx.fillStyle = palette.canvasText;
          ctx.fillText("8 − 5 = ?", w / 2, h * 0.18);

          // Animated diver jump backwards: 8 → 3
          const startX = margin + (8 / 10) * lineW;
          const endX = margin + (3 / 10) * lineW;
          const jumpProgress = Math.min(p / 0.7, 1);
          const diverX = startX + (endX - startX) * jumpProgress;
          const diverY = y0 - 10 - Math.sin(jumpProgress * Math.PI) * h * 0.25;

          // Diver emoji
          ctx.font = `${h * 0.15}px ${FONT}`;
          ctx.textBaseline = "middle";
          ctx.fillText("🤿", diverX - h * 0.075, diverY);

          // Result
          if (p > 0.8) {
            ctx.font = `700 ${h * 0.12}px ${FONT}`;
            ctx.textBaseline = "bottom";
            ctx.fillStyle = palette.ok;
            ctx.textAlign = "center";
            ctx.fillText("= 3 ✓", w / 2, h * 0.95);
          }
        },
        duration: 2500,
      },
    ];
  },

  generate(ctx) {
    const modeMap: Record<string, SubMode> = {
      numberline: "numberline",
      decompose: "decompose",
    };
    const mode = modeMap[ctx.taskType] ?? "numberline";
    return generateTask(mode, ctx.difficulty ?? 2, ctx.previous as SubTask | undefined);
  },

  check(task, answer) {
    const numAnswer = typeof answer === "number" ? answer : Number(answer);
    const correct = checkAnswer(task, numAnswer);
    const isDecompose = task.mode === "decompose";
    return {
      correct,
      feedback: correct
        ? isDecompose ? "Richtig! Gut zerlegt und subtrahiert!" : "Richtig! Der Taucher hat die richtige Stelle gefunden!"
        : isDecompose ? "Probier nochmal – rechne Schritt für Schritt." : "Probier nochmal – zähle die Schritte zurück.",
    };
  },

  hints: getHints,

  getSolution(task) {
    return { text: `${task.a} − ${task.b} = ${getDifference(task)}` };
  },

  initialState: () => ({}),

  onActivate(ctx) {
    subAnimProgress = prefersReducedMotion() ? 1 : 0;
    subPrevPhase = ctx.phase;
    subLastTime = null;

    if (prefersReducedMotion()) { subAnimRafId = 0; return; } // Skip animation entirely

    const loop = (now: number) => {
      const dt = subLastTime !== null ? now - subLastTime : 0;
      subLastTime = now;

      const phase = ctx.phase;
      if (phase === "interact" && subPrevPhase !== "interact") {
        subAnimProgress = 0;
        subLastTime = now;
      }
      subPrevPhase = phase;

      if (phase === "interact" && subAnimProgress < 1) {
        subAnimProgress = Math.min(1, subAnimProgress + dt / SUB_ANIM_DURATION);
        ctx.invalidate();
      }

      subAnimRafId = requestAnimationFrame(loop);
    };
    subAnimRafId = requestAnimationFrame(loop);
  },

  onDeactivate() {
    cancelAnimationFrame(subAnimRafId);
    subAnimProgress = 0;
    subLastTime = null;
  },

  buildScene(ctx: Ctx): CanvasNode {
    const { task } = ctx;
    switch (task.mode) {
      case "numberline":
        return buildNumberLineScene(ctx);
      case "decompose":
        return buildDecomposeScene(ctx);
      default:
        return buildNumberLineScene(ctx);
    }
  },
});
