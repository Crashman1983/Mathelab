/**
 * Daten und Zufall V2 — animated wheel spin & dice roll.
 * Explore-type module.
 *
 * Wheel: colored sectors, easeOutExpo spin (2.5–3.5s).
 * Dice: rounded rect with pips, easeOutBounce value flash (500ms).
 * Bar chart at bottom showing cumulative results.
 */

import { defineModule } from "@app/module-framework";
import type { SceneContext, ModuleContext, TutorialStep } from "@app/module-framework";
import { easeOutExpo, easeOutBounce } from "@core/utils";
import { vstack, hstack } from "@canvas/nodes/container";
import { text } from "@canvas/nodes/text";
import { button } from "@canvas/nodes/button";
import { custom } from "@canvas/nodes/custom";
import type { CanvasNode } from "@canvas/nodes/types";
import { getPalette } from "@core/design";
import { prefersReducedMotion } from "@canvas/scene";
import {
  EXPERIMENTS,
  emptyCounts,
  addResults,
  runExperiment,
  getLeaderIndex,
  theoreticalShare,
  actualShare,
  computeWheelTargetAngle,
  type ExperimentId,
  type ExperimentDef,
} from "./logic";

// ─── State ──────────────────────────────────────────────────────────────────

interface ChanceTask {
  experimentId: ExperimentId;
  experiment: ExperimentDef;
}

interface ChanceState {
  counts: number[];
  total: number;
  lastResult: number | null;
  spinning: boolean;
  spinAngle: number;
  diceValue: number;
  diceAnimating: boolean;
  animStartTime: number;
  // Batch mode (×100)
  batchResults: number[];
  batchIndex: number;
  batchRunning: boolean;
}

type Ctx = SceneContext<ChanceTask, ChanceState>;

// ─── Mutable refs for callbacks & animation ─────────────────────────────────

let moduleCtx: ModuleContext<ChanceTask, ChanceState> | null = null;
let animFrame = 0;
let animTargetAngle = 0;
let animTargetResult = 0;
let animDuration = 0;
let batchFrameId = 0;

// ─── Animation loop ─────────────────────────────────────────────────────────

function startAnimLoop(): void {
  cancelAnimationFrame(animFrame);
  const loop = () => {
    moduleCtx?.invalidate();
    const state = moduleCtx?.state;
    if (state && (state.spinning || state.diceAnimating || state.batchRunning)) {
      animFrame = requestAnimationFrame(loop);
    }
  };
  animFrame = requestAnimationFrame(loop);
}

function triggerAction(): void {
  if (!moduleCtx) return;
  const { task, state } = moduleCtx;
  if (state.batchRunning) return; // blocked during batch
  const exp = task.experiment;
  const isDice = task.experimentId === "dice";

  // Run the experiment to get result
  const results = runExperiment(exp, 1);
  const resultIdx = results[0];
  animTargetResult = resultIdx;

  if (prefersReducedMotion()) {
    // Skip animation — show result immediately
    const newCounts = addResults([...state.counts], [resultIdx]);
    moduleCtx.updateState((s) => ({
      ...s,
      counts: newCounts,
      total: s.total + 1,
      lastResult: resultIdx,
      spinning: false,
      diceAnimating: false,
      diceValue: isDice ? resultIdx + 1 : s.diceValue,
    }));
    return;
  }

  if (isDice) {
    // Dice animation: 500ms bounce
    animDuration = 500;
    moduleCtx.updateState((s) => ({
      ...s,
      diceAnimating: true,
      animStartTime: performance.now(),
      diceValue: resultIdx + 1,
    }));
  } else {
    // Wheel animation: 2.5–3.5s spin
    animDuration = 2500 + Math.random() * 1000;
    const currentAngle = state.spinAngle;
    animTargetAngle = computeWheelTargetAngle(
      currentAngle,
      resultIdx,
      exp.weights,
      5,
    );
    moduleCtx.updateState((s) => ({
      ...s,
      spinning: true,
      animStartTime: performance.now(),
    }));
  }

  startAnimLoop();
}

// ─── Batch mode (×100) ─────────────────────────────────────────────────────

const BATCH_COUNT = 100;
const BATCH_DURATION_MS = 10_000; // ~10 seconds total

function triggerBatch(): void {
  if (!moduleCtx) return;
  const { task, state } = moduleCtx;
  const exp = task.experiment;

  // Pre-generate all 100 results
  const results = runExperiment(exp, BATCH_COUNT);

  if (prefersReducedMotion()) {
    // Skip animation — apply all results immediately
    const newCounts = addResults([...state.counts], results);
    moduleCtx.updateState((s) => ({
      ...s,
      counts: newCounts,
      total: s.total + BATCH_COUNT,
      lastResult: results[results.length - 1],
      diceValue: task.experimentId === "dice" ? results[results.length - 1] + 1 : s.diceValue,
    }));
    return;
  }

  // Store results and start batch
  moduleCtx.updateState((s) => ({
    ...s,
    batchResults: results,
    batchIndex: 0,
    batchRunning: true,
  }));

  // Reveal results progressively via requestAnimationFrame
  const intervalMs = BATCH_DURATION_MS / BATCH_COUNT; // ~100ms per result
  let idx = 0;
  let lastRevealTime = 0;

  cancelAnimationFrame(batchFrameId);
  function batchStep(timestamp: number): void {
    if (!moduleCtx || idx >= results.length) {
      moduleCtx?.updateState((s) => ({
        ...s,
        batchRunning: false,
        batchIndex: BATCH_COUNT,
      }));
      batchFrameId = 0;
      return;
    }

    if (!lastRevealTime) lastRevealTime = timestamp;

    // Reveal all results whose time has come
    while (idx < results.length && timestamp - lastRevealTime >= intervalMs) {
      lastRevealTime += intervalMs;
      const resultIdx = results[idx];
      const isDice = task.experimentId === "dice";
      idx++;

      moduleCtx.updateState((s) => ({
        ...s,
        counts: addResults([...s.counts], [resultIdx]),
        total: s.total + 1,
        lastResult: resultIdx,
        batchIndex: idx,
        diceValue: isDice ? resultIdx + 1 : s.diceValue,
        spinAngle: isDice ? s.spinAngle : s.spinAngle + (Math.PI * 2) / 12 + Math.random() * 0.3,
      }));
    }
    moduleCtx.invalidate();
    batchFrameId = requestAnimationFrame(batchStep);
  }
  batchFrameId = requestAnimationFrame(batchStep);

  // Also start an animation frame loop for smooth dice/wheel visual
  startAnimLoop();
}

// ─── Hints ──────────────────────────────────────────────────────────────────

function getHints(task: ChanceTask): string[] {
  const shares = task.experiment.outcomes.map(
    (o, i) =>
      `${o.label}: ${Math.round(theoreticalShare(task.experiment.weights, i) * 100)}%`,
  );
  return [
    `${task.experiment.description}`,
    `Wirf mehrmals und beobachte die Häufigkeiten.`,
    `Je \u00F6fter du w\u00FCrfelst, desto gleichm\u00E4\u00DFiger werden die Ergebnisse.`,
    `Theoretische Verteilung: ${shares.join(", ")}. Drücke „×100" um es zu sehen.`,
  ];
}

// ─── Drawing helpers ────────────────────────────────────────────────────────

const FONT_FAMILY = "'Atkinson Hyperlegible', system-ui, sans-serif";

/**
 * Draw a die face with pips inside the given rect.
 */
function drawDice(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  value: number,
  palette: ReturnType<typeof getPalette>,
): void {
  const half = size / 2;
  const r = size * 0.15; // corner radius

  // Die body — rounded rectangle
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - half, cy - half, size, size, r);
  ctx.fillStyle = palette.panel;
  ctx.fill();
  ctx.strokeStyle = palette.canvasText;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Pips
  const pipR = size * 0.07;
  ctx.fillStyle = palette.canvasText;

  // Pip positions relative to center, normalized to [-0.3, 0.3]
  const d = size * 0.28;
  const positions: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-d, -d], [d, d]],
    3: [[-d, -d], [0, 0], [d, d]],
    4: [[-d, -d], [d, -d], [-d, d], [d, d]],
    5: [[-d, -d], [d, -d], [0, 0], [-d, d], [d, d]],
    6: [[-d, -d], [d, -d], [-d, 0], [d, 0], [-d, d], [d, d]],
  };

  const pips = positions[value] ?? positions[1];
  for (const [px, py] of pips) {
    ctx.beginPath();
    ctx.arc(cx + px, cy + py, pipR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw the wheel with colored sectors, rotated by angle.
 */
function drawWheel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  outcomes: ExperimentDef["outcomes"],
  weights: number[],
  angle: number,
  palette: ReturnType<typeof getPalette>,
): void {
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  let startAngle = 0;
  for (let i = 0; i < outcomes.length; i++) {
    const sliceAngle = (weights[i] / totalWeight) * Math.PI * 2;

    // Sector fill
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = outcomes[i].color;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Sector border
    ctx.strokeStyle = palette.panel;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    const midAngle = startAngle + sliceAngle / 2;
    const labelR = radius * 0.65;
    const lx = Math.cos(midAngle) * labelR;
    const ly = Math.sin(midAngle) * labelR;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.font = `600 ${Math.max(12, radius * 0.14)}px ${FONT_FAMILY}`;
    ctx.fillStyle = palette.panel;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(outcomes[i].label, 0, 0);
    ctx.restore();

    startAngle += sliceAngle;
  }

  // Center circle
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = palette.panel;
  ctx.fill();
  ctx.strokeStyle = palette.canvasText;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();

  // Pointer (triangle at top, outside rotation)
  const pSize = radius * 0.12;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius - pSize * 0.3);
  ctx.lineTo(cx - pSize, cy - radius - pSize * 1.8);
  ctx.lineTo(cx + pSize, cy - radius - pSize * 1.8);
  ctx.closePath();
  ctx.fillStyle = palette.bad;
  ctx.fill();
  ctx.strokeStyle = palette.canvasText;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw horizontal bar chart at bottom of the custom area.
 */
function drawBarChart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  outcomes: ExperimentDef["outcomes"],
  weights: number[],
  counts: number[],
  total: number,
  palette: ReturnType<typeof getPalette>,
): void {
  const barCount = outcomes.length;
  const barGap = Math.max(12, w * 0.02);
  const barAreaW = w * 0.9;
  const barW = (barAreaW - (barCount - 1) * barGap) / barCount;
  const barMaxH = h * 0.65;
  const startX = x + (w - barAreaW) / 2;
  const baseY = y + h * 0.82;
  const maxCount = Math.max(...counts, 1);

  for (let i = 0; i < barCount; i++) {
    const bx = startX + i * (barW + barGap);
    const count = counts[i] ?? 0;
    const barH = (count / maxCount) * barMaxH;

    // Bar
    ctx.fillStyle = outcomes[i].color;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.roundRect(bx, baseY - barH, barW, barH, 4);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Border
    ctx.strokeStyle = outcomes[i].color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, baseY - barH, barW, barH, 4);
    ctx.stroke();

    // Label below bar
    const labelSize = Math.max(13, Math.min(barW * 0.35, 18));
    ctx.font = `700 ${labelSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = palette.canvasText;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(outcomes[i].label, bx + barW / 2, baseY + 6);

    // Count above bar
    if (count > 0) {
      ctx.font = `700 ${Math.max(14, Math.min(barW * 0.3, 18))}px ${FONT_FAMILY}`;
      ctx.textBaseline = "bottom";
      ctx.fillText(`${count}`, bx + barW / 2, baseY - barH - 6);
    }

    // Percentage below count label (if total > 0)
    if (total > 0 && count > 0) {
      const pct = Math.round(actualShare(counts, i) * 100);
      ctx.font = `500 ${Math.max(11, Math.min(barW * 0.22, 14))}px ${FONT_FAMILY}`;
      ctx.fillStyle = palette.canvasTextDim;
      ctx.textBaseline = "bottom";
      ctx.fillText(`${pct}%`, bx + barW / 2, baseY - barH - 6 - labelSize);
    }

    // Theoretical line (dashed)
    if (total > 0) {
      const share = theoreticalShare(weights, i);
      const theorH = share * maxCount * (barMaxH / maxCount);
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(bx, baseY - theorH);
      ctx.lineTo(bx + barW, baseY - theorH);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

// ─── Scene builder ──────────────────────────────────────────────────────────

function buildScene(ctx: Ctx): CanvasNode {
  const { task, state } = ctx;
  const exp = task.experiment;
  const isDice = task.experimentId === "dice";
  const isAnimating = state.spinning || state.diceAnimating;
  const isBusy = isAnimating || state.batchRunning;

  // Stats text
  const statsText = state.batchRunning
    ? `⏳ ${state.batchIndex}/${BATCH_COUNT} — ${state.total} gesamt`
    : `${state.total} ${isDice ? "Würfe" : "Drehungen"}`;

  // ── Left column: visualization + buttons ──
  const leftCol = vstack([
    // Title
    text(`${exp.icon} ${exp.label}`, { fontSize: "lg", bold: true }),

    // Main visualization (wheel or dice)
    custom({
      id: "chance-main",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();
        const now = performance.now();

        if (isDice) {
          // ── Dice visualization ──
          const diceSize = Math.min(r.w * 0.45, r.h * 0.45, 160);
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h * 0.42;

          let displayValue = state.diceValue || 1;

          if (state.batchRunning) {
            displayValue = Math.floor(Math.random() * 6) + 1;
            const shake = Math.sin(now * 0.03) * 3;
            c.save();
            c.translate(cx + shake, cy);
            c.rotate(Math.sin(now * 0.01) * 0.08);
            drawDice(c, 0, 0, diceSize, displayValue, palette);
            c.restore();
          } else if (state.diceAnimating) {
            const elapsed = now - state.animStartTime;
            const progress = Math.min(elapsed / animDuration, 1);
            const easedProgress = easeOutBounce(progress);

            if (progress < 0.7) {
              displayValue = Math.floor(Math.random() * 6) + 1;
            } else {
              displayValue = state.diceValue;
            }

            const bounceOffset = (1 - easedProgress) * -diceSize * 0.5;
            const rotAngle = (1 - easedProgress) * Math.PI * 3;
            const scalePulse = 1 + Math.sin(progress * Math.PI) * 0.15;

            c.save();
            c.translate(cx, cy + bounceOffset);
            c.rotate(rotAngle);
            c.scale(scalePulse, scalePulse);
            drawDice(c, 0, 0, diceSize, displayValue, palette);
            c.restore();

            if (progress >= 1) {
              moduleCtx?.updateState((s) => {
                const newCounts = addResults([...s.counts], [animTargetResult]);
                return {
                  ...s,
                  counts: newCounts,
                  total: s.total + 1,
                  lastResult: animTargetResult,
                  diceAnimating: false,
                  diceValue: animTargetResult + 1,
                };
              });
            }
          } else {
            drawDice(c, cx, cy, diceSize, displayValue, palette);
          }

          // Result label below dice
          if (state.lastResult !== null && !state.diceAnimating && !state.batchRunning) {
            c.font = `700 ${Math.max(16, diceSize * 0.22)}px ${FONT_FAMILY}`;
            c.fillStyle = palette.canvasText;
            c.textAlign = "center";
            c.textBaseline = "top";
            c.fillText(
              `Ergebnis: ${exp.outcomes[state.lastResult]?.label ?? "?"}`,
              cx,
              cy + diceSize / 2 + 12,
            );
          }
        } else {
          // ── Wheel visualization ──
          // Reserve space: ~30px top (pointer triangle), ~40px bottom (result text)
          const availH = r.h - 70;
          const maxRadius = Math.min(r.w / 2 - 20, availH / 2, 220);
          const radius = Math.max(maxRadius, 60);
          const cx = r.x + r.w / 2;
          const cy = r.y + 30 + availH / 2; // offset for pointer triangle

          let currentAngle = state.spinAngle;

          if (state.spinning) {
            const elapsed = now - state.animStartTime;
            const progress = Math.min(elapsed / animDuration, 1);
            const easedProgress = easeOutExpo(progress);

            currentAngle =
              state.spinAngle +
              (animTargetAngle - state.spinAngle) * easedProgress;

            if (progress >= 1) {
              moduleCtx?.updateState((s) => {
                const newCounts = addResults([...s.counts], [animTargetResult]);
                return {
                  ...s,
                  counts: newCounts,
                  total: s.total + 1,
                  lastResult: animTargetResult,
                  spinning: false,
                  spinAngle: animTargetAngle,
                };
              });
            }
          }

          drawWheel(c, cx, cy, radius, exp.outcomes, exp.weights, currentAngle, palette);

          // Result label below wheel
          if (state.lastResult !== null && !state.spinning && !state.batchRunning) {
            c.font = `700 ${Math.max(14, radius * 0.18)}px ${FONT_FAMILY}`;
            c.fillStyle = palette.canvasText;
            c.textAlign = "center";
            c.textBaseline = "top";
            c.fillText(
              `Ergebnis: ${exp.outcomes[state.lastResult]?.label ?? "?"}`,
              cx,
              cy + radius + 20,
            );
          }
        }
      },
    }),

    // Buttons + stats in one compact row
    hstack([
      button(isDice ? "🎲 Würfeln" : "🎡 Drehen", {
        id: "chance-action",
        variant: "primary",
        minWidth: 120,
        enabled: !isBusy,
        onTap: () => triggerAction(),
      }),
      button(isDice ? "🎲 ×100" : "🎡 ×100", {
        id: "chance-batch",
        variant: "secondary",
        minWidth: 80,
        enabled: !isBusy,
        onTap: () => triggerBatch(),
      }),
    ], { gap: 8, align: "center" }),

    text(statsText, {
      fontSize: "xs",
      color: state.batchRunning ? "accent" : "canvasTextDim",
    }),
  ], { gap: 6, padding: 0, align: "center" });
  leftCol.flex = 1;

  // ── Right column: bar chart ──
  const rightCol = custom({
    id: "chance-bars",
    flex: 1,
    draw(c, r) {
      const palette = getPalette();
      drawBarChart(
        c,
        r.x,
        r.y,
        r.w,
        r.h,
        exp.outcomes,
        exp.weights,
        state.counts,
        state.total,
        palette,
      );
    },
  });

  // Two-column layout: viz left, chart right
  return hstack([leftCol, rightCol], { gap: 8, padding: 16 });
}

// ─── Module Registration ────────────────────────────────────────────────────

export const chanceV2Registration = defineModule<ChanceTask, ChanceState>({
  id: "chance",
  label: "Daten & Zufall",
  icon: "🎲",
  description:
    "Würfel und Glücksräder: Wahrscheinlichkeiten durch Experimente erleben.",

  taskLabel(task) {
    return `Führe das Experiment „${task.experiment.label}" durch und beobachte die Ergebnisse.`;
  },

  flowType: "explore",

  taskTypes: [
    { id: "dice", label: "Würfel", icon: "🎲" },
    { id: "wheel-a", label: "Rad A (fair)", icon: "🎡" },
    { id: "wheel-b", label: "Rad B (unfair)", icon: "🎡" },
  ],

  tutorial: (taskType: string): TutorialStep[] => {
    const palette = getPalette();
    const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

    if (taskType === "wheel-a" || taskType === "wheel-b") {
      const isFair = taskType === "wheel-a";
      return [
        {
          title: "So geht's",
          text: isFair
            ? "Drehe das faire Glücksrad und beobachte, wie oft jede Farbe kommt."
            : "Dieses Rad ist unfair — manche Felder sind größer. Beobachte den Unterschied!",
          mathBackground: "Wahrscheinlichkeit = Anzahl günstige Ergebnisse ÷ Anzahl mögliche Ergebnisse. Bei einem fairen Rad sind alle Felder gleich groß.",
          draw(ctx, w, h, p) {
            const cx = w / 2;
            const cy = h * 0.45;
            const radius = Math.min(w * 0.25, h * 0.3);

            // Animated wheel spin
            const angle = p * Math.PI * 6; // 3 full rotations

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);

            const sectors = isFair ? 4 : 4;
            const weights = isFair ? [1, 1, 1, 1] : [3, 1, 1, 1];
            const totalW = weights.reduce((a, b) => a + b, 0);
            const colors = [palette.accent, palette.ok, palette.warn, palette.bad];

            let startAngle = 0;
            for (let i = 0; i < sectors; i++) {
              const sliceAngle = (weights[i] / totalW) * Math.PI * 2;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.arc(0, 0, radius, startAngle, startAngle + sliceAngle);
              ctx.closePath();
              ctx.fillStyle = colors[i];
              ctx.globalAlpha = 0.7;
              ctx.fill();
              ctx.globalAlpha = 1;
              ctx.strokeStyle = palette.panel;
              ctx.lineWidth = 2;
              ctx.stroke();
              startAngle += sliceAngle;
            }

            // Center
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.08, 0, Math.PI * 2);
            ctx.fillStyle = palette.panel;
            ctx.fill();
            ctx.restore();

            // Pointer
            const pSize = radius * 0.12;
            ctx.beginPath();
            ctx.moveTo(cx, cy - radius - pSize * 0.3);
            ctx.lineTo(cx - pSize, cy - radius - pSize * 1.5);
            ctx.lineTo(cx + pSize, cy - radius - pSize * 1.5);
            ctx.closePath();
            ctx.fillStyle = palette.bad;
            ctx.fill();

            // Label
            ctx.font = `600 ${h * 0.07}px ${FONT}`;
            ctx.fillStyle = palette.canvasText;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
              isFair ? "Alle Felder gleich groß" : "Blaues Feld ist größer!",
              cx, h * 0.88,
            );
          },
          duration: 3000,
        },
      ];
    }

    // Default: dice
    return [
      {
        title: "So geht's",
        text: "Würfle und beobachte, wie sich die Ergebnisse verteilen.",
        mathBackground: "Wahrscheinlichkeit = Anzahl günstige Ergebnisse ÷ Anzahl mögliche Ergebnisse. Ein fairer Würfel hat für jede Zahl die Chance 1/6.",
        draw(ctx, w, h, p) {
          const cx = w / 2;
          const cy = h * 0.4;
          const diceSize = Math.min(w * 0.3, h * 0.35);

          // Animated dice showing different values
          const value = Math.min(Math.floor(p * 7) + 1, 6);

          // Die body
          const half = diceSize / 2;
          const r = diceSize * 0.15;
          ctx.beginPath();
          ctx.roundRect(cx - half, cy - half, diceSize, diceSize, r);
          ctx.fillStyle = palette.panel;
          ctx.fill();
          ctx.strokeStyle = palette.canvasText;
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Pips
          const pipR = diceSize * 0.07;
          ctx.fillStyle = palette.canvasText;
          const d = diceSize * 0.28;
          const positions: Record<number, [number, number][]> = {
            1: [[0, 0]],
            2: [[-d, -d], [d, d]],
            3: [[-d, -d], [0, 0], [d, d]],
            4: [[-d, -d], [d, -d], [-d, d], [d, d]],
            5: [[-d, -d], [d, -d], [0, 0], [-d, d], [d, d]],
            6: [[-d, -d], [d, -d], [-d, 0], [d, 0], [-d, d], [d, d]],
          };

          const pips = positions[value] ?? positions[1];
          for (const [px, py] of pips) {
            ctx.beginPath();
            ctx.arc(cx + px, cy + py, pipR, 0, Math.PI * 2);
            ctx.fill();
          }

          // Probability label
          ctx.font = `600 ${h * 0.07}px ${FONT}`;
          ctx.fillStyle = palette.canvasText;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("Jede Zahl: Chance 1/6", cx, h * 0.82);
        },
        duration: 3000,
      },
    ];
  },

  generate(ctx) {
    const id = (ctx.taskType as ExperimentId) ?? "dice";
    const experiment = EXPERIMENTS[id] ?? EXPERIMENTS.dice;
    return { experimentId: id, experiment };
  },

  hints: getHints,

  getSolution(task) {
    const exp = task.experiment;
    const shares = exp.outcomes.map(
      (o, i) =>
        `${o.label}: ${Math.round(theoreticalShare(exp.weights, i) * 100)}%`,
    );
    return {
      text: `Theoretische Wahrscheinlichkeiten: ${shares.join(", ")}`,
    };
  },

  initialState: () => ({
    counts: [],
    total: 0,
    lastResult: null,
    spinning: false,
    spinAngle: 0,
    diceValue: 1,
    diceAnimating: false,
    animStartTime: 0,
    batchResults: [],
    batchIndex: 0,
    batchRunning: false,
  }),

  onActivate(ctx) {
    moduleCtx = ctx;
    // Initialize counts if empty
    if (ctx.state.counts.length === 0) {
      ctx.setState({
        counts: emptyCounts(ctx.task.experiment.outcomes.length),
      });
    }
  },

  onDeactivate() {
    cancelAnimationFrame(animFrame);
    cancelAnimationFrame(batchFrameId);
    animFrame = 0;
    batchFrameId = 0;
    animTargetAngle = 0;
    animTargetResult = 0;
    animDuration = 0;
    moduleCtx = null;
  },

  buildScene(ctx) {
    // Re-initialize counts on task change
    if (ctx.state.counts.length === 0) {
      ctx.state.counts = emptyCounts(ctx.task.experiment.outcomes.length);
    }
    return buildScene(ctx);
  },
});
