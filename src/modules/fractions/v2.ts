/**
 * Bruchlabor V2 — interactive module using defineModule() DSL.
 *
 * Circle/Bar mode: Student enters numerator via numpad, denominator shown.
 * Compare mode: Buttons for <, =, > to compare two fractions.
 * Numberline mode: Student taps on number line to place the fraction.
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
  generateCircleTask,
  generateCompareTask,
  generateNumberLineTask,
  generateProceduralFraction,
  generateProceduralComparison,
  compareResult,
  checkCompareAnswer,
  checkNumberLineAnswer,
  fractionValue,
  formatFraction,
  fractionName,
  type Fraction,
  type CircleTask,
  type CompareTask,
  type NumberLineTask,
} from "./logic";

type FractionTask =
  | { mode: "circle"; data: CircleTask }
  | { mode: "bar"; data: CircleTask }
  | { mode: "compare"; data: CompareTask }
  | { mode: "numberline"; data: NumberLineTask };

interface FractionState {
  compareAnswer: "<" | "=" | ">" | null;
  nlTappedPos: number | null;
  /** Advanced circle/bar: two-step input phase */
  inputPhase: "numerator" | "denominator";
  /** Stored numerator from first step (advanced mode) */
  enteredNum: number | null;
}

type Ctx = SceneContext<FractionTask, FractionState>;

// Mutable refs for button callbacks
let compareCallback: ((op: "<" | "=" | ">") => void) | null = null;
let nlSubmitCallback: (() => void) | null = null;
/** Current difficulty level (captured in onActivate) */
let currentDifficulty = 1;
/** Module state updater (captured in onActivate for use in check()) */
let stateUpdater: ((fn: (s: FractionState) => FractionState) => void) | null = null;
/** Advanced mode: tracks two-step input phase at module level (check() has no state access) */
let advancedInputPhase: "numerator" | "denominator" = "numerator";

// ─── Module-level Sektor-Animations-State ────────────────────────────────────

const SECTOR_ANIM_DURATION = 800; // ms für alle Sektoren
let sectorAnimProgress = 0;
let sectorAnimRafId = 0;
let sectorPrevPhase: "present" | "interact" = "present";
let sectorLastTime: number | null = null;

// ─── Number line geometry (shared between draw + pointer) ────────────────────

function getNumberLineGeometry(r: { x: number; y: number; w: number; h: number }, max: number) {
  const lineY = r.y + r.h * 0.5;
  const lx0 = r.x + r.w * 0.08;
  const lx1 = r.x + r.w * 0.92;
  const lw = lx1 - lx0;
  return { lineY, lx0, lx1, lw, max };
}

// ─── Hints ───────────────────────────────────────────────────────────────────

function getHints(task: FractionTask): string[] {
  switch (task.mode) {
    case "circle":
    case "bar": {
      const isAdv = currentDifficulty >= 2;
      if (isAdv && advancedInputPhase === "denominator") {
        return [
          `Zähle alle Teile — auch die nicht gefärbten.`,
          `Das Ganze ist in ${task.data.fraction.den} gleiche Teile geteilt.`,
          `Der Nenner ist ${task.data.fraction.den}.`,
          `Gib ${task.data.fraction.den} ein — das ist die Zahl unter dem Bruchstrich.`,
        ];
      }
      return [
        `Schau dir die eingefärbten Teile genau an.`,
        isAdv
          ? `Zähle die gefärbten Teile – das ist der Zähler.`
          : `${fractionName(task.data.fraction)} – wie viele Teile sind eingefärbt?`,
        `Der Bruch ist ${formatFraction(task.data.fraction)}.`,
        `Es sind genau ${task.data.fraction.num} Teile eingefärbt. Gib ${task.data.fraction.num} ein.`,
      ];
    }
    case "compare":
      return [
        `Vergleiche ${formatFraction(task.data.a)} und ${formatFraction(task.data.b)}.`,
        `Bringe beide auf den gleichen Nenner.`,
        `${formatFraction(task.data.a)} ${task.data.correct} ${formatFraction(task.data.b)}.`,
        `Das richtige Zeichen ist „${task.data.correct}". Tippe auf ${task.data.correct}.`,
      ];
    case "numberline":
      return [
        `Finde ${formatFraction(task.data.fraction)} auf dem Zahlenstrahl.`,
        `Teile den Abschnitt in ${task.data.fraction.den} gleiche Teile.`,
        `${formatFraction(task.data.fraction)} liegt bei ${fractionValue(task.data.fraction).toFixed(2)}.`,
        `Tippe auf den Zahlenstrahl bei ungefähr ${fractionValue(task.data.fraction).toFixed(1)}.`,
      ];
  }
}

// ─── Draw helpers ────────────────────────────────────────────────────────────

function drawPizza(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, f: Fraction): void {
  const palette = getPalette();
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const radius = Math.min(r.w, r.h) * 0.38;
  const innerRadius = radius * 0.88; // Belag-Zone (ohne Kruste)

  // Pizza-Kruste (Außenring)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.fillStyle = palette.pizzaCrust;
  ctx.fill();
  ctx.restore();

  // Sektoren — animated stagger: each sector appears based on sectorAnimProgress
  for (let i = 0; i < f.den; i++) {
    // Stagger: each sector has own threshold within animation progress
    const sectorThreshold = f.den > 1 ? i / (f.den - 1) : 0;
    const sectorAlpha = Math.max(0, Math.min(1, (sectorAnimProgress - sectorThreshold * 0.6) / 0.4));

    if (sectorAlpha <= 0) continue;

    const startAngle = (i / f.den) * Math.PI * 2 - Math.PI / 2;
    const endAngle = ((i + 1) / f.den) * Math.PI * 2 - Math.PI / 2;
    const filled = i < f.num;

    // Scale-in: sector sweeps from center outward
    const sectorScale = 0.3 + sectorAlpha * 0.7;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, innerRadius * sectorScale, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = filled ? palette.pizzaFill : (palette.panelSoft);
    ctx.globalAlpha = (filled ? 0.92 : 0.45) * sectorAlpha;
    ctx.fill();
    ctx.globalAlpha = sectorAlpha;
    ctx.strokeStyle = palette.pizzaCrust;
    ctx.lineWidth = Math.max(2, radius * 0.03);
    ctx.stroke();

    // Toppings auf belegten Stücken (only when sector is fully visible)
    if (filled && sectorAlpha > 0.8) {
      const toppingAlpha = (sectorAlpha - 0.8) / 0.2;
      const midAngle = startAngle + (endAngle - startAngle) / 2;
      for (let t = 0; t < 2; t++) {
        const tAngle = midAngle + (t === 0 ? -0.15 : 0.15);
        const tr = innerRadius * sectorScale * (t === 0 ? 0.55 : 0.72);
        const tx = cx + Math.cos(tAngle) * tr;
        const ty = cy + Math.sin(tAngle) * tr;
        ctx.beginPath();
        ctx.arc(tx, ty, Math.max(3, radius * 0.055), 0, 2 * Math.PI);
        ctx.fillStyle = palette.pizzaTopping;
        ctx.globalAlpha = 0.85 * toppingAlpha;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Äußerer Krust-Rand
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = palette.pizzaCrustDark;
  ctx.lineWidth = Math.max(3, radius * 0.06);
  ctx.stroke();
  // Mittelpunkt
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(3, radius * 0.04), 0, 2 * Math.PI);
  ctx.fillStyle = palette.pizzaCrustDark;
  ctx.fill();
  ctx.restore();
}

// ─── Scene Builders ──────────────────────────────────────────────────────────

function buildCircleScene(ctx: Ctx): CanvasNode {
  const { task, input, result, phase, state } = ctx;
  const data = task.data as CircleTask;
  const f = data.fraction;
  const answered = result?.correct === true;
  const isAdvanced = currentDifficulty >= 2;
  const inputPhase = state.inputPhase;

  // Advanced mode: show fraction with active part highlighted
  const questionText = (() => {
    if (answered) return `Welcher Bruch? ${formatFraction(f)}`;
    if (!isAdvanced) return `Welcher Bruch? _/${f.den}`;
    if (inputPhase === "numerator") {
      return `Welcher Bruch? _/_`;
    }
    // Denominator phase: show entered numerator, highlight denominator slot
    return `Welcher Bruch? ${state.enteredNum}/_`;
  })();

  const promptText = (() => {
    if (answered) return formatFraction(f);
    if (phase !== "interact") return "Schau dir den Kreis genau an.";
    if (isAdvanced) {
      if (inputPhase === "numerator") {
        return `▶ Zähler eingeben (oben): ${input || "?"}`;
      }
      return `Zähler: ${state.enteredNum} ✓ — ▶ Nenner eingeben (unten): ${input || "?"}`;
    }
    return `Gib den Zähler ein: ${input || "?"}`;
  })();

  return vstack([
    text("🍕 Kinder teilen eine Pizza – wie viele Stücke sind belegt?", { fontSize: "sm", color: "canvasTextDim" }),
    text(questionText, { fontSize: "xl", bold: true }),
    custom({
      id: "circle",
      flex: 1,
      draw(c, r) { drawPizza(c, r, f); },
    }),
    text(promptText, { fontSize: "md", color: answered ? "canvasSuccess" : "canvasTextDim" }),
  ], { gap: 8, padding: 16, align: "center" });
}

function buildBarScene(ctx: Ctx): CanvasNode {
  const { task, input, result, phase, state } = ctx;
  const data = task.data as CircleTask;
  const f = data.fraction;
  const answered = result?.correct === true;
  const isAdvanced = currentDifficulty >= 2;
  const inputPhase = state.inputPhase;

  const questionText = (() => {
    if (answered) return `Welcher Bruch? ${formatFraction(f)}`;
    if (!isAdvanced) return `Welcher Bruch? _/${f.den}`;
    if (inputPhase === "numerator") {
      return `Welcher Bruch? _/_`;
    }
    return `Welcher Bruch? ${state.enteredNum}/_`;
  })();

  const promptText = (() => {
    if (answered) return formatFraction(f);
    if (phase !== "interact") return "Schau dir den Balken genau an.";
    if (isAdvanced) {
      if (inputPhase === "numerator") {
        return `▶ Zähler eingeben (oben): ${input || "?"}`;
      }
      return `Zähler: ${state.enteredNum} ✓ — ▶ Nenner eingeben (unten): ${input || "?"}`;
    }
    return `Gib den Zähler ein: ${input || "?"}`;
  })();

  return vstack([
    text(questionText, { fontSize: "xl", bold: true }),
    custom({
      id: "bar",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();
        const barH = Math.min(r.h * 0.3, 60);
        const barW = r.w * 0.8;
        const bx = r.x + (r.w - barW) / 2;
        const by = r.y + (r.h - barH) / 2;
        const cellW = barW / f.den;

        for (let i = 0; i < f.den; i++) {
          // Stagger animation: each cell appears left-to-right
          const cellThreshold = f.den > 1 ? i / (f.den - 1) : 0;
          const cellAlpha = Math.max(0, Math.min(1, (sectorAnimProgress - cellThreshold * 0.6) / 0.4));

          if (cellAlpha <= 0) continue;

          const fillH = barH * cellAlpha; // Cells "grow" upward
          const fillY = by + (barH - fillH);

          c.fillStyle = i < f.num ? palette.canvasPrimary : palette.panelSoft;
          c.globalAlpha = (i < f.num ? 0.85 : 0.3) * cellAlpha;
          c.fillRect(bx + i * cellW, fillY, cellW - 2, fillH);
          c.globalAlpha = cellAlpha;
          c.strokeStyle = palette.line;
          c.lineWidth = 1.5;
          c.strokeRect(bx + i * cellW, fillY, cellW - 2, fillH);
          c.globalAlpha = 1;
        }
      },
    }),
    text(promptText, { fontSize: "md", color: answered ? "canvasSuccess" : "canvasTextDim" }),
  ], { gap: 8, padding: 16, align: "center" });
}

function buildCompareScene(ctx: Ctx): CanvasNode {
  const { task, state, result, phase } = ctx;
  const data = task.data as CompareTask;
  const answered = result?.correct === true;
  // Title keeps "○" until the correct answer is confirmed — buttons already highlight the
  // current selection, so showing a wrong symbol in the title would be misleading.

  return vstack([
    text(
      `${formatFraction(data.a)}  ${answered ? data.correct : "○"}  ${formatFraction(data.b)}`,
      { fontSize: "xl", bold: true },
    ),
    text("Welches Zeichen gehört in den Kreis?", { fontSize: "sm", color: "canvasTextDim" }),
    custom({
      id: "compare-vis",
      flex: 1,
      draw(c, r) {
        const left = { x: r.x, y: r.y, w: r.w / 2 - 10, h: r.h };
        const right = { x: r.x + r.w / 2 + 10, y: r.y, w: r.w / 2 - 10, h: r.h };
        drawPizza(c, left, data.a);
        drawPizza(c, right, data.b);
      },
    }),
    // Compare buttons (only in interact phase, hidden once correct)
    ...(phase === "interact" && !answered
      ? [hstack([
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
        ], { gap: 16, align: "center" })]
      : []),
  ], { gap: 12, padding: 16, align: "center" });
}

function buildNumberLineScene(ctx: Ctx): CanvasNode {
  const { task, state, result, phase } = ctx;
  const data = task.data as NumberLineTask;
  const answered = result?.correct === true;
  const showTapped = state.nlTappedPos !== null;

  return vstack([
    text(
      `Finde ${formatFraction(data.fraction)} auf dem Zahlenstrahl`,
      { fontSize: "xl", bold: true },
    ),
    text(
      phase === "interact" && !answered
        ? "Tippe auf den Zahlenstrahl!"
        : "",
      { fontSize: "sm", color: "canvasTextDim" },
    ),
    custom({
      id: "numberline",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();
        const max = data.max;
        const { lineY, lx0, lx1, lw } = getNumberLineGeometry(r, max);

        // Main line
        c.strokeStyle = palette.line;
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(lx0, lineY);
        c.lineTo(lx1, lineY);
        c.stroke();

        // Ticks and labels
        const font = `600 ${Math.max(12, r.w * 0.025)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        c.font = font;
        c.textAlign = "center";
        c.fillStyle = palette.canvasText;

        for (let i = 0; i <= max; i++) {
          const tx = lx0 + (i / max) * lw;
          c.beginPath();
          c.moveTo(tx, lineY - 10);
          c.lineTo(tx, lineY + 10);
          c.stroke();
          c.fillText(`${i}`, tx, lineY + 28);
        }

        // Student's tapped marker (orange)
        if (showTapped && state.nlTappedPos !== null) {
          const tappedX = lx0 + state.nlTappedPos * lw;
          c.beginPath();
          c.arc(tappedX, lineY, 9, 0, Math.PI * 2);
          c.fillStyle = palette.warn;
          c.fill();
          c.strokeStyle = palette.canvasText;
          c.lineWidth = 2;
          c.stroke();
        }

        // Target marker (only after answered correctly)
        if (answered) {
          const val = fractionValue(data.fraction);
          const mx = lx0 + (val / max) * lw;
          c.beginPath();
          c.arc(mx, lineY, 8, 0, Math.PI * 2);
          c.fillStyle = palette.canvasSuccess;
          c.fill();
        }
      },
    }),
    // "Prüfen" button when student has tapped but not yet submitted
    ...(phase === "interact" && showTapped && !answered
      ? [button("Prüfen", {
          id: "nl-submit",
          variant: "primary",
          minWidth: 160,
          onTap: () => nlSubmitCallback?.(),
        })]
      : []),
  ], { gap: 8, padding: 16, align: "center" });
}

// ─── Module Definition ───────────────────────────────────────────────────────

export const fractionsV2Registration = defineModule<FractionTask, FractionState>({
  id: "fractions",
  label: "Bruchlabor",
  icon: "🍕",
  description: "Brüche darstellen, vergleichen und auf dem Zahlenstrahl finden.",

  flowType: "task",
  input: "numberPad",

  taskTypes: [
    { id: "circle", label: "🍕 Pizza", icon: "🍕" },
    { id: "bar", label: "Balken", icon: "▬" },
    { id: "compare", label: "Vergleichen", icon: "⚖" },
    { id: "numberline", label: "Zahlenstrahl", icon: "📏" },
  ],

  difficulties: DIFFICULTIES,

  tutorial: (taskType: string): TutorialStep[] => {
    const palette = getPalette();
    const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

    if (taskType === "compare") {
      return [
        {
          title: "So geht's",
          text: "Vergleiche zwei Brüche: Ist der erste kleiner, gleich oder größer?",
          mathBackground: "Brüche vergleichen: Bringe beide auf den gleichen Nenner oder vergleiche die Anteile visuell.",
          draw(ctx, w, h, p) {
            const cx1 = w * 0.3;
            const cx2 = w * 0.7;
            const cy = h * 0.5;
            const radius = Math.min(w * 0.18, h * 0.3);

            // Left pizza: 1/4
            ctx.beginPath();
            ctx.arc(cx1, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = palette.panelSoft;
            ctx.fill();
            ctx.strokeStyle = palette.line;
            ctx.lineWidth = 2;
            ctx.stroke();

            const sectors1 = Math.floor(p * 4);
            for (let i = 0; i < Math.min(sectors1, 1); i++) {
              const start = (i / 4) * Math.PI * 2 - Math.PI / 2;
              const end = ((i + 1) / 4) * Math.PI * 2 - Math.PI / 2;
              ctx.beginPath();
              ctx.moveTo(cx1, cy);
              ctx.arc(cx1, cy, radius * 0.9, start, end);
              ctx.closePath();
              ctx.fillStyle = palette.accent;
              ctx.globalAlpha = 0.7;
              ctx.fill();
              ctx.globalAlpha = 1;
            }

            // Right pizza: 3/4
            ctx.beginPath();
            ctx.arc(cx2, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = palette.panelSoft;
            ctx.fill();
            ctx.strokeStyle = palette.line;
            ctx.lineWidth = 2;
            ctx.stroke();

            const sectors2 = Math.floor(p * 4);
            for (let i = 0; i < Math.min(sectors2, 3); i++) {
              const start = (i / 4) * Math.PI * 2 - Math.PI / 2;
              const end = ((i + 1) / 4) * Math.PI * 2 - Math.PI / 2;
              ctx.beginPath();
              ctx.moveTo(cx2, cy);
              ctx.arc(cx2, cy, radius * 0.9, start, end);
              ctx.closePath();
              ctx.fillStyle = palette.accent;
              ctx.globalAlpha = 0.7;
              ctx.fill();
              ctx.globalAlpha = 1;
            }

            // Labels
            ctx.font = `700 ${h * 0.1}px ${FONT}`;
            ctx.fillStyle = palette.canvasText;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText("¼", cx1, cy + radius + 8);
            ctx.fillText("¾", cx2, cy + radius + 8);

            if (p > 0.8) {
              ctx.font = `700 ${h * 0.14}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.fillText("<", w / 2, cy - h * 0.05);
            }
          },
          duration: 3000,
        },
      ];
    }

    if (taskType === "numberline") {
      return [
        {
          title: "So geht's",
          text: "Finde den Bruch auf dem Zahlenstrahl und tippe auf die richtige Stelle.",
          mathBackground: "Ein Bruch wie ¾ liegt zwischen 0 und 1. Teile den Abschnitt in gleich große Teile.",
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

            // Ticks 0 and 1
            ctx.font = `600 ${h * 0.08}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = palette.canvasText;
            for (let i = 0; i <= 1; i++) {
              const x = margin + i * lineW;
              ctx.beginPath();
              ctx.moveTo(x, y0 - 6);
              ctx.lineTo(x, y0 + 6);
              ctx.stroke();
              ctx.fillText(`${i}`, x, y0 + 10);
            }

            // Quarter ticks appearing
            const quarters = Math.floor(p * 5);
            for (let i = 1; i <= Math.min(quarters, 4); i++) {
              const x = margin + (i / 4) * lineW;
              ctx.beginPath();
              ctx.moveTo(x, y0 - 4);
              ctx.lineTo(x, y0 + 4);
              ctx.strokeStyle = palette.accent;
              ctx.stroke();
            }

            // Animated dot at 3/4
            if (p > 0.5) {
              const dotX = margin + 0.75 * lineW;
              ctx.beginPath();
              ctx.arc(dotX, y0, 7, 0, Math.PI * 2);
              ctx.fillStyle = palette.ok;
              ctx.fill();
            }

            // Label
            ctx.font = `700 ${h * 0.12}px ${FONT}`;
            ctx.fillStyle = palette.canvasText;
            ctx.textBaseline = "bottom";
            ctx.textAlign = "center";
            ctx.fillText("Finde ¾", w / 2, h * 0.2);
          },
          duration: 3000,
        },
      ];
    }

    // Default: circle / bar
    return [
      {
        title: "So geht's",
        text: "Schau dir an, wie viele Teile eingefärbt sind, und gib den Zähler ein.",
        mathBackground: "Ein Bruch zeigt einen Teil eines Ganzen. Der Nenner sagt wie viele gleiche Teile, der Zähler wie viele davon.",
        draw(ctx, w, h, p) {
          const cx = w / 2;
          const cy = h * 0.5;
          const radius = Math.min(w * 0.25, h * 0.32);
          const den = 4;
          const num = 3;

          // Background circle
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fillStyle = palette.panelSoft;
          ctx.fill();
          ctx.strokeStyle = palette.line;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Sectors filling with progress
          const sectorsToShow = Math.floor(p * (den + 1));
          for (let i = 0; i < Math.min(sectorsToShow, den); i++) {
            const startAngle = (i / den) * Math.PI * 2 - Math.PI / 2;
            const endAngle = ((i + 1) / den) * Math.PI * 2 - Math.PI / 2;
            const filled = i < num;

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius * 0.9, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = filled ? palette.accent : palette.panelSoft;
            ctx.globalAlpha = filled ? 0.7 : 0.3;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = palette.line;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // Label
          ctx.font = `700 ${h * 0.12}px ${FONT}`;
          ctx.fillStyle = palette.canvasText;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          if (p > 0.8) {
            ctx.fillStyle = palette.ok;
            ctx.fillText("¾", cx, cy + radius + 10);
          } else {
            ctx.fillText("?/4", cx, cy + radius + 10);
          }
        },
        duration: 3000,
      },
    ];
  },

  taskLabel(task) {
    switch (task.mode) {
      case "circle":
      case "bar": {
        const den = task.data.fraction.den;
        return `Wie viele ${den === 4 ? "Viertel" : den === 3 ? "Drittel" : "Teile"} sind gefärbt?`;
      }
      case "compare":
        return `Welcher Bruch ist größer?`;
      case "numberline":
        return `Wo liegt der Bruch auf dem Zahlenstrahl?`;
    }
  },

  generate(ctx) {
    const prev = ctx.previous as FractionTask | undefined;
    const d = ctx.difficulty ?? 1;
    currentDifficulty = d; // Capture for scene builders + check()
    advancedInputPhase = "numerator"; // Reset two-step input for new task
    const useProcedural = Math.random() < 0.5;

    switch (ctx.taskType) {
      case "circle":
      case "bar": {
        const mode = ctx.taskType as "circle" | "bar";
        const prevFrac = prev?.mode === mode ? (prev.data as CircleTask).fraction : undefined;
        if (useProcedural) {
          let pf = generateProceduralFraction(d);
          // Avoid repeating the same fraction
          let retries = 0;
          while (prevFrac && pf.numerator === prevFrac.num && pf.denominator === prevFrac.den && retries < 5) {
            pf = generateProceduralFraction(d);
            retries++;
          }
          return { mode, data: { fraction: { num: pf.numerator, den: pf.denominator } } };
        }
        return { mode, data: generateCircleTask(prevFrac ? { fraction: prevFrac } : undefined, d) };
      }
      case "compare": {
        if (useProcedural) {
          const pc = generateProceduralComparison(d);
          const a: Fraction = { num: pc.left.num, den: pc.left.den };
          const b: Fraction = { num: pc.right.num, den: pc.right.den };
          return { mode: "compare", data: { a, b, correct: compareResult(a, b) } };
        }
        return { mode: "compare", data: generateCompareTask(prev?.mode === "compare" ? prev.data as CompareTask : undefined, d) };
      }
      case "numberline": return { mode: "numberline", data: generateNumberLineTask(prev?.mode === "numberline" ? prev.data as NumberLineTask : undefined, d) };
      default: return { mode: "circle", data: generateCircleTask(undefined, d) };
    }
  },

  check(task, answer) {
    if (task.mode === "compare") {
      const ans = answer as "<" | "=" | ">";
      const correct = checkCompareAnswer(task.data, ans);
      return { correct, feedback: correct ? "Richtig verglichen!" : "Schau nochmal genau hin." };
    }
    if (task.mode === "numberline") {
      const num = typeof answer === "number" ? answer : Number(answer);
      const correct = checkNumberLineAnswer(task.data, num);
      return { correct, feedback: correct ? "Genau richtig platziert!" : "Fast! Versuche es nochmal." };
    }
    // Circle/Bar: student enters fraction parts
    const num = typeof answer === "number" ? answer : Number(answer);
    const isAdvanced = currentDifficulty >= 2;

    if (isAdvanced) {
      // Two-step input: first numerator, then denominator
      if (advancedInputPhase === "numerator") {
        if (num === task.data.fraction.num) {
          // Numerator correct — advance to denominator phase
          advancedInputPhase = "denominator";
          stateUpdater?.(s => ({ ...s, inputPhase: "denominator", enteredNum: num }));
          return { correct: false, feedback: "Zähler richtig! Jetzt den Nenner eingeben.", continueInput: true };
        }
        return { correct: false, feedback: "Schau nochmal genau hin — wie viele Teile sind gefärbt?" };
      }
      // Denominator phase
      if (num === task.data.fraction.den) {
        // Both correct!
        advancedInputPhase = "numerator"; // Reset for next task
        stateUpdater?.(s => ({ ...s, inputPhase: "numerator", enteredNum: null }));
        return { correct: true, feedback: `Richtig! ${formatFraction(task.data.fraction)}` };
      }
      return { correct: false, feedback: "Schau nochmal genau hin — wie viele Teile hat das Ganze?" };
    }

    // Standard mode: only numerator
    const correct = num === task.data.fraction.num;
    return { correct, feedback: correct ? "Richtig erkannt!" : "Schau nochmal genau hin." };
  },

  hints: getHints,

  getSolution(task) {
    if (task.mode === "compare") {
      return { text: `${formatFraction(task.data.a)} ${task.data.correct} ${formatFraction(task.data.b)}` };
    }
    if (task.mode === "numberline") {
      return { text: `${formatFraction(task.data.fraction)} = ${fractionValue(task.data.fraction).toFixed(2)}` };
    }
    return { text: formatFraction((task.data as CircleTask).fraction) };
  },

  initialState: () => ({ compareAnswer: null, nlTappedPos: null, inputPhase: "numerator" as const, enteredNum: null }),

  onActivate(ctx) {
    // Capture state updater for use in check()
    stateUpdater = (fn) => ctx.updateState(fn);

    compareCallback = (op: "<" | "=" | ">") => {
      ctx.updateState(s => ({ ...s, compareAnswer: op }));
      ctx.submitAnswer(op);
    };

    nlSubmitCallback = () => {
      const s = ctx.state;
      if (s.nlTappedPos === null) return;
      const task = ctx.task;
      if (task.mode !== "numberline") return;
      const tappedValue = s.nlTappedPos * task.data.max;
      ctx.submitAnswer(tappedValue);
    };

    // Sector stagger animation RAF loop
    sectorAnimProgress = prefersReducedMotion() ? 1 : 0;
    sectorPrevPhase = ctx.phase;
    sectorLastTime = null;

    if (prefersReducedMotion()) { sectorAnimRafId = 0; return; } // Skip animation entirely

    const loop = (now: number) => {
      const dt = sectorLastTime !== null ? now - sectorLastTime : 0;
      sectorLastTime = now;

      const phase = ctx.phase;
      if (phase === "interact" && sectorPrevPhase !== "interact") {
        sectorAnimProgress = 0;
        sectorLastTime = now;
      }
      sectorPrevPhase = phase;

      if (phase === "interact" && sectorAnimProgress < 1) {
        sectorAnimProgress = Math.min(1, sectorAnimProgress + dt / SECTOR_ANIM_DURATION);
        ctx.invalidate();
      }

      sectorAnimRafId = requestAnimationFrame(loop);
    };
    sectorAnimRafId = requestAnimationFrame(loop);
  },

  onDeactivate() {
    compareCallback = null;
    nlSubmitCallback = null;
    stateUpdater = null;
    advancedInputPhase = "numerator";
    cancelAnimationFrame(sectorAnimRafId);
    sectorAnimProgress = 0;
    sectorLastTime = null;
  },

  onPointerDown(ctx) {
    const task = ctx.task;
    if (task.mode !== "numberline") return;
    // Don't allow tapping after correct answer
    if (ctx.state.nlTappedPos !== null) {
      // Allow re-tapping before submit, but not after correct
    }

    // We need to determine if the tap is on the number line area.
    // The custom node with id "numberline" occupies the flex area.
    // Use canvas dimensions to approximate the number line geometry.
    // Approximate the number line rect (the custom node takes the middle area)
    // The vstack has gap=8, padding=12, so the custom node starts after title+subtitle
    // We use a generous vertical hit zone around the line center
    const w = (ctx as any).scene?.canvas?.getBoundingClientRect?.()?.width ?? 800;
    const h = (ctx as any).scene?.canvas?.getBoundingClientRect?.()?.height ?? 400;

    // Number line geometry based on the full canvas (custom node is flex:1 within vstack)
    const nlRect = { x: 0, y: 0, w, h };
    const geo = getNumberLineGeometry(nlRect, task.data.max);

    // Check if tap is near the number line (within 40px vertically)
    if (Math.abs(ctx.y - geo.lineY) > 40) return;

    // Check if tap is within horizontal bounds
    if (ctx.x < geo.lx0 - 10 || ctx.x > geo.lx1 + 10) return;

    // Convert x to normalized position (0 to 1, where 1 = full line = max)
    const normalized = Math.max(0, Math.min(1, (ctx.x - geo.lx0) / geo.lw));

    ctx.updateState(s => ({ ...s, nlTappedPos: normalized }));
  },

  buildScene(ctx) {
    const { task } = ctx;
    switch (task.mode) {
      case "circle": return buildCircleScene(ctx);
      case "bar": return buildBarScene(ctx);
      case "compare": return buildCompareScene(ctx);
      case "numberline": return buildNumberLineScene(ctx);
    }
  },
});
