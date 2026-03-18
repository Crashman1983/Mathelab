/**
 * Addition V2 — Frosch springt auf dem Zahlenstrahl.
 *
 * Thema: Frosch springt über einen Teich (Addition als Bewegung nach vorne).
 * Modi: numberline (Zahlenstrahl), decompose (Zerlegung), written (schriftlich)
 *
 * Didaktisches Konzept:
 *   Situation: Frosch sitzt bei Zahl a.
 *   Handlung: Frosch macht b Schritte nach vorne.
 *   Veränderung: Frosch landet bei a + b.
 *   Erkenntnis: a + b = Summe.
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
  getSum,
  checkAnswer,
  getJumpPositions,
  getNumberLineRange,
  getHints,
  type AddMode,
  type AddTask,
} from "./logic";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AddState {
  // Animation wird auf Modul-Ebene via RAF verwaltet
}

type Ctx = SceneContext<AddTask, AddState>;

// ─── Module-level Animation (Sprungbögen + Frosch-Position) ─────────────────

const JUMP_ANIM_DURATION = 1200; // ms für alle Sprünge
let addAnimProgress = 0;
let addAnimRafId = 0;
let addPrevPhase: "present" | "interact" = "present";
let addLastTime: number | null = null;

// ─── Frog Drawing Helper ──────────────────────────────────────────────────────

function drawFrog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  palette: ReturnType<typeof getPalette>
): void {
  const r = size * 0.5;

  // Körper
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.8, 0, 0, 2 * Math.PI);
  ctx.fillStyle = palette.frogBody;
  ctx.fill();
  ctx.strokeStyle = palette.frogDark;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.stroke();

  // Augen
  const eyeR = r * 0.28;
  const eyeOffX = r * 0.4;
  const eyeOffY = -r * 0.55;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * eyeOffX, y + eyeOffY, eyeR, eyeR * 1.1, 0, 0, 2 * Math.PI);
    ctx.fillStyle = palette.textOnAccent;
    ctx.fill();
    ctx.strokeStyle = palette.frogDark;
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + side * eyeOffX, y + eyeOffY, eyeR * 0.5, 0, 2 * Math.PI);
    ctx.fillStyle = palette.canvasText;
    ctx.fill();
  }

  // Mund (Lächeln)
  ctx.beginPath();
  ctx.arc(x, y + r * 0.1, r * 0.35, 0.2, Math.PI - 0.2);
  ctx.strokeStyle = palette.frogDark;
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.stroke();

  ctx.restore();
}

// ─── Number Line Scene ────────────────────────────────────────────────────────

function buildNumberLineScene(ctx: Ctx): CanvasNode {
  const { task, input, result } = ctx;
  const positions = getJumpPositions(task);
  const { min, max } = getNumberLineRange(task);
  const answered = result?.correct === true;
  const sum = getSum(task);

  const questionText = answered
    ? `${task.a} + ${task.b} = ${sum} ✓`
    : `${task.a} + ${task.b} = ${input || "?"}`;

  return vstack([
    // Kontext-Zeile: Thema des Moduls
    text("🐸 Frosch springt auf dem Zahlenstrahl", {
      fontSize: "sm",
      color: "canvasTextDim",
    }),
    text(questionText, { fontSize: "xl", bold: true }),
    text(
      positions.length - 1 > 1
        ? `Frosch startet bei ${task.a} und macht 2 Sprünge: erst +${task.step1}, dann +${task.step2}.`
        : `Frosch startet bei ${task.a} und macht einen Sprung von +${task.b}.`,
      { fontSize: "sm", color: "canvasTextDim" }
    ),
    custom({
      id: "number-line-addition",
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

        // Pfeilspitze
        const aw = Math.max(8, lw * 0.02);
        c.beginPath();
        c.moveTo(lx1, lineY);
        c.lineTo(lx1 - aw, lineY - aw * 0.5);
        c.lineTo(lx1 - aw, lineY + aw * 0.5);
        c.closePath();
        c.fillStyle = palette.line;
        c.fill();

        // ── Sprung-Bögen ──
        const arcColors = [palette.frogBody, palette.frogDark, palette.frogDark];
        for (let i = 0; i < positions.length - 1; i++) {
          const x0 = toX(positions[i]!);
          const x1 = toX(positions[i + 1]!);
          const midX = (x0 + x1) / 2;
          // Cap arc height so it doesn't collide with text above
          const arcH = Math.min((x1 - x0) * 0.5, (lineY - r.y) * 0.55);

          // Bogen-Animation: progress 0→1
          const segCount = positions.length - 1;
          const segStart = i / segCount;
          const segEnd = (i + 1) / segCount;
          const segProgress = Math.max(
            0,
            Math.min(1, (addAnimProgress - segStart) / (segEnd - segStart))
          );

          if (segProgress > 0) {
            c.save();
            c.beginPath();
            // Partiellen Bogen zeichnen via bezierCurveTo mit t-Clipping
            const steps = 30;
            let started = false;
            for (let s = 0; s <= steps * segProgress; s++) {
              const t = s / steps;
              // Quadratische Bezier-Kurve: P(t) = (1-t)²P0 + 2t(1-t)Pm + t²P1
              const bx = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * midX + t * t * x1;
              const by = (1 - t) * (1 - t) * lineY + 2 * t * (1 - t) * (lineY - arcH) + t * t * lineY;
              if (!started) { c.moveTo(bx, by); started = true; }
              else c.lineTo(bx, by);
            }
            c.strokeStyle = arcColors[i % arcColors.length]!;
            c.lineWidth = Math.max(3, lw * 0.014);
            c.globalAlpha = 0.88;
            c.stroke();
            c.globalAlpha = 1;
            c.restore();

            // Schrittweite-Label — positioned well above the arc peak
            const midSegX = toX((positions[i]! + positions[i + 1]!) / 2);
            const stepFontSize = Math.max(14, Math.min(r.w * 0.028, 24));
            c.font = `700 ${stepFontSize}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
            c.fillStyle = arcColors[i % arcColors.length]!;
            c.textAlign = "center";
            c.textBaseline = "bottom";
            c.globalAlpha = segProgress;
            c.fillText(`+${positions[i + 1]! - positions[i]!}`, midSegX, lineY - arcH - r.h * 0.06 - stepFontSize * 0.5);
            c.globalAlpha = 1;
          }
        }

        // ── Tick-Marks & Labels ──
        const tickPositions = new Set<number>();
        for (const p of positions) tickPositions.add(p);
        // Ein paar Zwischenticks
        const step = Math.ceil((max - min) / 10);
        for (let v = min; v <= max; v += step) tickPositions.add(v);

        // Sort ticks and compute label x-positions for collision detection
        const sortedTicks = Array.from(tickPositions).filter(v => v >= min && v <= max).sort((a, b) => a - b);
        const labelFontSize = Math.max(11, r.w * 0.022);
        const minLabelGap = labelFontSize * 2.5; // Minimum px between label centers

        // Determine which key ticks get labels (skip colliding ones, always keep start + endpoint)
        const keyLabelXs: { val: number; x: number }[] = [];
        for (const val of sortedTicks) {
          if (!positions.includes(val)) continue;
          keyLabelXs.push({ val, x: toX(val) });
        }
        const drawnLabels = new Set<number>();
        // Always draw first and last key positions
        if (keyLabelXs.length > 0) drawnLabels.add(keyLabelXs[0]!.val);
        if (keyLabelXs.length > 1) drawnLabels.add(keyLabelXs[keyLabelXs.length - 1]!.val);
        // Add intermediate labels only if they don't collide
        for (let k = 1; k < keyLabelXs.length - 1; k++) {
          const prev = keyLabelXs[k - 1]!;
          const curr = keyLabelXs[k]!;
          const next = keyLabelXs[k + 1]!;
          if (curr.x - prev.x >= minLabelGap && next.x - curr.x >= minLabelGap) {
            drawnLabels.add(curr.val);
          }
        }

        for (const val of sortedTicks) {
          const tx = toX(val);
          const isKey = positions.includes(val);
          const tickH = isKey ? r.h * 0.08 : r.h * 0.04;

          c.beginPath();
          c.moveTo(tx, lineY - tickH);
          c.lineTo(tx, lineY + tickH);
          c.strokeStyle = isKey ? palette.canvasText : palette.gridLine;
          c.lineWidth = isKey ? 2.5 : 1.5;
          c.stroke();

          if (isKey && drawnLabels.has(val)) {
            // Hide the endpoint (answer) until solved — only show start + intermediate positions
            const isEndpoint = val === sum;
            const showLabel = !isEndpoint || answered;
            if (showLabel) {
              c.font = `700 ${labelFontSize}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
              c.fillStyle = palette.canvasText;
              c.textAlign = "center";
              c.textBaseline = "top";
              c.fillText(`${val}`, tx, lineY + tickH + r.h * 0.015);
            } else {
              // Show "?" at the endpoint position before answer
              c.font = `700 ${labelFontSize}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
              c.fillStyle = palette.accent;
              c.textAlign = "center";
              c.textBaseline = "top";
              c.fillText("?", tx, lineY + tickH + r.h * 0.015);
            }
          }
        }

        // ── Frosch (folgt dem Bogen während Animation) ──
        const frogSize = Math.min(r.h * 0.28, r.w * 0.06);
        const defaultFrogY = lineY - frogSize * 0.6;

        if (!answered && addAnimProgress > 0 && addAnimProgress < 1) {
          // Frosch springt entlang des aktuellen Bogens
          const totalSegs = positions.length - 1;
          const segFloat = addAnimProgress * totalSegs;
          const segIdx = Math.min(Math.floor(segFloat), totalSegs - 1);
          const segFrac = segFloat - segIdx;

          const sx0 = toX(positions[segIdx]!);
          const sx1 = toX(positions[segIdx + 1]!);
          const sMidX = (sx0 + sx1) / 2;
          const sArcH = (sx1 - sx0) * 0.5;

          const t = segFrac;
          const frogBx = (1 - t) * (1 - t) * sx0 + 2 * t * (1 - t) * sMidX + t * t * sx1;
          const frogBy = (1 - t) * (1 - t) * lineY + 2 * t * (1 - t) * (lineY - sArcH) + t * t * lineY;
          drawFrog(c, frogBx, frogBy - frogSize * 0.3, frogSize, palette);
        } else {
          drawFrog(c, toX(answered ? sum : (addAnimProgress >= 1 ? positions[positions.length - 1]! : task.a)), defaultFrogY, frogSize, palette);
        }

        // Wenn beantwortet: Frosch am Ziel zeigen
        if (answered) {
          // Landepunkt-Markierung
          const ex = toX(sum);
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
  const sum = getSum(task);

  return vstack([
    text("🧩 Zerlege und addiere", { fontSize: "sm", color: "canvasTextDim" }),
    text(`${task.a} + ${task.b} = ${answered ? sum : (input || "?")}`, { fontSize: "xl", bold: true }),
    custom({
      id: "decompose-visual",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();
        const cx = r.x + r.w / 2;
        const midY = r.y + r.h * 0.4;

        // Summanden-Boxen
        const boxW = Math.min(r.w * 0.28, 150);
        const boxH = Math.min(r.h * 0.22, 80);
        const gap = r.w * 0.06;

        // Box A
        const ax = cx - gap / 2 - boxW;
        c.save();
        c.fillStyle = palette.accentSubtle;
        c.strokeStyle = palette.accentBorder;
        c.lineWidth = 2;
        c.beginPath();
        if (typeof c.roundRect === "function") c.roundRect(ax, midY - boxH / 2, boxW, boxH, 12);
        else c.rect(ax, midY - boxH / 2, boxW, boxH);
        c.fill(); c.stroke();
        c.fillStyle = palette.canvasText;
        c.font = `700 ${Math.max(18, boxH * 0.42)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(`${task.a}`, ax + boxW / 2, midY);
        c.restore();

        // Plus-Symbol
        c.save();
        c.fillStyle = palette.canvasText;
        c.font = `700 ${Math.max(18, boxH * 0.4)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("+", cx, midY);
        c.restore();

        // Box B (Zerlegung)
        const bx = cx + gap / 2;
        const step1 = task.step1 ?? task.b;
        const step2 = task.step2 ?? 0;

        if (step2 > 0 && step1 > 0) {
          // Zwei Teil-Boxen für Zerlegung
          const halfW = (boxW - 4) / 2;
          for (let i = 0; i < 2; i++) {
            const val = i === 0 ? step1 : step2;
            const bxi = bx + i * (halfW + 4);
            c.save();
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
            c.restore();
          }
          // "= b"-Label darunter
          c.save();
          c.fillStyle = palette.canvasTextDim;
          c.font = `${Math.max(12, boxH * 0.28)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "top";
          c.fillText(`${step1} + ${step2} = ${task.b}`, bx + boxW / 2, midY + boxH / 2 + 6);
          c.restore();
        } else {
          c.save();
          c.fillStyle = palette.warnSubtle;
          c.strokeStyle = palette.warn;
          c.lineWidth = 2;
          c.beginPath();
          if (typeof c.roundRect === "function") c.roundRect(bx, midY - boxH / 2, boxW, boxH, 12);
          else c.rect(bx, midY - boxH / 2, boxW, boxH);
          c.fill(); c.stroke();
          c.fillStyle = palette.canvasText;
          c.font = `700 ${Math.max(18, boxH * 0.42)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(`${task.b}`, bx + boxW / 2, midY);
          c.restore();
        }

        // Ergebnis-Box (wenn beantwortet)
        if (answered) {
          const resY = midY + boxH + r.h * 0.12;
          const resW = boxW * 1.1;
          const resH = boxH * 1.1;
          c.save();
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
          c.fillText(`${sum}`, cx, resY);
          c.restore();
        }
      },
    }),
  ], { gap: 8, padding: 16, align: "center" });
}

// ─── Module Definition ───────────────────────────────────────────────────────

export const additionV2Registration = defineModule<AddTask, AddState>({
  id: "addition",
  label: "Addition",
  icon: "🐸",
  description:
    "Addition auf dem Zahlenstrahl: Der Frosch springt nach vorne und findet die Summe.",

  flowType: "task",
  input: "numberPad",

  taskTypes: [
    { id: "numberline", label: "Zahlenstrahl", icon: "↗" },
    { id: "decompose", label: "Zerlegung", icon: "🧩" },
  ],

  difficulties: DIFFICULTIES,

  tutorial: (taskType: string): TutorialStep[] => {
    const palette = getPalette();
    const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

    if (taskType === "decompose") {
      return [
        {
          title: "So geht's",
          text: "Zerlege eine der Zahlen in Teile, die einfacher zu rechnen sind.",
          mathBackground: "Beispiel: 27 + 38 → 27 + 30 + 8 = 65. Man zerlegt die zweite Zahl in Zehner und Einer.",
          draw(ctx, w, h, p) {
            ctx.font = `700 ${h * 0.12}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = palette.canvasText;
            // Show the task
            ctx.fillText("27 + 38 = ?", w / 2, h * 0.2);
            // Animated decomposition
            if (p > 0.3) {
              ctx.font = `600 ${h * 0.09}px ${FONT}`;
              ctx.fillStyle = palette.accent;
              ctx.fillText("38 = 30 + 8", w / 2, h * 0.45);
            }
            if (p > 0.6) {
              ctx.fillStyle = palette.ok;
              ctx.fillText("27 + 30 = 57", w / 2, h * 0.65);
            }
            if (p > 0.85) {
              ctx.font = `700 ${h * 0.12}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.fillText("57 + 8 = 65 ✓", w / 2, h * 0.85);
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
        text: "Der Frosch springt auf dem Zahlenstrahl. Finde heraus, wo er landet!",
        mathBackground: "Bei der Addition zählen wir vorwärts. a + b bedeutet: Starte bei a und gehe b Schritte nach rechts.",
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
          ctx.fillText("3 + 4 = ?", w / 2, h * 0.18);

          // Animated frog jump: 3 → 7
          const startX = margin + (3 / 10) * lineW;
          const endX = margin + (7 / 10) * lineW;
          const jumpProgress = Math.min(p / 0.7, 1);
          const frogX = startX + (endX - startX) * jumpProgress;
          const frogY = y0 - 10 - Math.sin(jumpProgress * Math.PI) * h * 0.25;

          // Frog emoji
          ctx.font = `${h * 0.15}px ${FONT}`;
          ctx.textBaseline = "middle";
          ctx.fillText("🐸", frogX - h * 0.075, frogY);

          // Result
          if (p > 0.8) {
            ctx.font = `700 ${h * 0.12}px ${FONT}`;
            ctx.textBaseline = "bottom";
            ctx.fillStyle = palette.ok;
            ctx.textAlign = "center";
            ctx.fillText("= 7 ✓", w / 2, h * 0.95);
          }
        },
        duration: 2500,
      },
    ];
  },

  taskLabel(task) {
    return `Rechne ${task.a} plus ${task.b}.`;
  },

  answerRange(task) {
    return getSum(task);
  },

  generate(ctx) {
    const modeMap: Record<string, AddMode> = {
      numberline: "numberline",
      decompose: "decompose",
    };
    const mode = modeMap[ctx.taskType] ?? "numberline";
    return generateTask(mode, ctx.difficulty ?? 2, ctx.previous as AddTask | undefined);
  },

  check(task, answer) {
    const numAnswer = typeof answer === "number" ? answer : Number(answer);
    const correct = checkAnswer(task, numAnswer);
    const isDecompose = task.mode === "decompose";
    return {
      correct,
      feedback: correct
        ? isDecompose ? "Richtig! Gut zerlegt und addiert!" : "Super! Der Frosch hat die richtige Stelle gefunden!"
        : isDecompose ? "Probier nochmal – rechne Schritt für Schritt." : "Probier nochmal – zähle die Sprünge nochmal durch.",
    };
  },

  hints: getHints,

  getSolution(task) {
    return { text: `${task.a} + ${task.b} = ${getSum(task)}` };
  },

  initialState: () => ({}),

  onActivate(ctx) {
    // Interact-Phase: Animation von 0→1 abspielen
    addAnimProgress = prefersReducedMotion() ? 1 : 0;
    addPrevPhase = ctx.phase;
    addLastTime = null;

    if (prefersReducedMotion()) { addAnimRafId = 0; return; } // Skip animation entirely

    const loop = (now: number) => {
      const dt = addLastTime !== null ? now - addLastTime : 0;
      addLastTime = now;

      const phase = ctx.phase;

      // Bei Phasenwechsel: present→interact startet Animation, interact→present zeigt sofort
      if (phase !== addPrevPhase) {
        if (phase === "interact") {
          addAnimProgress = 0;
          addLastTime = now;
        } else {
          // present-Phase: Bögen sofort vollständig
          addAnimProgress = 1;
          ctx.invalidate();
        }
      }
      addPrevPhase = phase;

      // Sprunganimation abspielen (nur in interact-Phase)
      if (phase === "interact" && addAnimProgress < 1) {
        addAnimProgress = Math.min(1, addAnimProgress + dt / JUMP_ANIM_DURATION);
        ctx.invalidate();
      }

      addAnimRafId = requestAnimationFrame(loop);
    };
    addAnimRafId = requestAnimationFrame(loop);
  },

  onDeactivate() {
    cancelAnimationFrame(addAnimRafId);
    addAnimProgress = 0;
    addLastTime = null;
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
