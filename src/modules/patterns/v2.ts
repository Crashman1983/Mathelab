/**
 * Muster & Strukturen V2 — with numpad interactivity.
 *
 * Student uses numpad to enter missing values in sequences,
 * function machines, and figure patterns.
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
  generateSequenceTask,
  generateMachineTask,
  generateFigureTask,
  checkSequenceAnswer,
  checkMachineAnswer,
  checkFigureAnswer,
  getRuleLabel,
  getFigurePoints,
  type SequenceTask,
  type MachineTask,
  type FigureTask,
} from "./logic";

type PatternTask =
  | { mode: "sequence"; data: SequenceTask }
  | { mode: "machine"; data: MachineTask }
  | { mode: "figuren"; data: FigureTask };

type Ctx = SceneContext<PatternTask, Record<string, never>>;

// ─── Module-level Stagger Animation ─────────────────────────────────────────

const BOX_STAGGER_DURATION = 700; // ms für alle Boxen
let boxAnimProgress = 0;
let boxAnimRafId = 0;
let boxPrevPhase: "present" | "interact" = "present";
let boxLastTime: number | null = null;

// ─── Solution reveal animation (Figurenmuster) ─────────────────────────────
const SOLUTION_ANIM_DURATION = 800; // ms for dot scale-in
let solutionAnimProgress = 0;
let solutionAnimStarted = false;

function getHints(task: PatternTask): string[] {
  switch (task.mode) {
    case "sequence":
      return [
        `Schau dir die Zahlenfolge genau an. Was passiert von Zahl zu Zahl?`,
        `Die Regel ist: ${task.data.ruleLabel}. Welche Zahl fehlt an Stelle ${task.data.hiddenIndex + 1}?`,
        `Die Antwort ist ${task.data.answer}.`,
        `Gib ${task.data.answer} ein — die fehlende Zahl in der Folge.`,
      ];
    case "machine":
      return [
        `Was macht die Maschine? Schau dir die Beispiele an.`,
        `Die Regel ist: ${getRuleLabel(task.data.rule, task.data.ruleValue)}.`,
        `${task.data.hiddenInput} → ${task.data.answer}.`,
        `Rechne: ${task.data.hiddenInput} ${task.data.rule === "add" ? "+" : task.data.rule === "sub" ? "−" : "×"} ${task.data.ruleValue} = ... Gib das Ergebnis ein.`,
      ];
    case "figuren":
      return [
        `Wie viele Punkte hat Schritt ${task.data.nextStep}?`,
        `Zähle die Punkte bei jedem Schritt: ${task.data.counts.join(", ")}, ?`,
        `Die Antwort ist ${task.data.answer}.`,
        `Beim nächsten Schritt sind es ${task.data.answer} Punkte. Gib ${task.data.answer} ein.`,
      ];
  }
}

function buildSequenceScene(ctx: Ctx): CanvasNode {
  const task = ctx.task as { mode: "sequence"; data: SequenceTask };
  const { input, result } = ctx;
  const answered = result?.correct === true;

  return vstack([
    text("Finde die fehlende Zahl", { fontSize: "xl", bold: true }),
    // Regel nur nach Beantworten zeigen — im interact-Modus soll das Kind sie selbst entdecken
    ...(answered
      ? [text(`Regel: ${task.data.ruleLabel}`, { fontSize: "sm", color: "canvasTextDim" })]
      : [text("Erkennst du die Regel?", { fontSize: "sm", color: "canvasTextDim" })]),
    custom({
      id: "sequence",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();
        const count = task.data.display.length;
        const boxW = Math.min(r.w * 0.15, 80);
        const gap = Math.min(r.w * 0.03, 16);
        const totalW = count * boxW + (count - 1) * gap;
        const startX = r.x + (r.w - totalW) / 2;
        const cy = r.y + r.h / 2;

        for (let i = 0; i < count; i++) {
          // Stagger animation: each box appears left-to-right
          const boxThreshold = count > 1 ? i / (count - 1) : 0;
          const boxAlpha = Math.max(0, Math.min(1, (boxAnimProgress - boxThreshold * 0.6) / 0.4));

          if (boxAlpha <= 0) continue;

          const x = startX + i * (boxW + gap);
          const isHidden = task.data.display[i] === -1;

          // Scale-in effect: box grows from 80% to 100%
          const scale = 0.8 + boxAlpha * 0.2;
          const scaledW = boxW * scale;
          const scaledX = x + (boxW - scaledW) / 2;
          const scaledY = cy - scaledW / 2;

          c.save();
          c.globalAlpha = boxAlpha;
          c.fillStyle = isHidden ? palette.accentSubtle : palette.panelSoft;
          c.strokeStyle = isHidden ? palette.accent : palette.line;
          c.lineWidth = isHidden ? 3 : 1.5;
          if (typeof c.roundRect === "function") {
            c.beginPath();
            c.roundRect(scaledX, scaledY, scaledW, scaledW, 8);
            c.fill();
            c.stroke();
          } else {
            c.fillRect(scaledX, scaledY, scaledW, scaledW);
            c.strokeRect(scaledX, scaledY, scaledW, scaledW);
          }

          c.font = `700 ${Math.max(14, scaledW * 0.35)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          c.fillStyle = isHidden ? palette.accent : palette.canvasText;
          c.textAlign = "center";
          c.textBaseline = "middle";

          if (isHidden) {
            const displayVal = answered ? `${task.data.answer}` : (input || "?");
            c.fillText(displayVal, x + boxW / 2, cy);
          } else {
            c.fillText(`${task.data.display[i]}`, x + boxW / 2, cy);
          }
          c.restore();
        }
      },
    }),
  ], { gap: 12, padding: 16, align: "center" });
}

function buildMachineScene(ctx: Ctx): CanvasNode {
  const task = ctx.task as { mode: "machine"; data: MachineTask };
  const { input, result } = ctx;
  const answered = result?.correct === true;

  return vstack([
    text("Funktionsmaschine", { fontSize: "xl", bold: true }),
    // Regel nur nach Beantworten zeigen — im interact-Modus entdeckendes Lernen
    ...(answered
      ? [text(`Regel: ${getRuleLabel(task.data.rule, task.data.ruleValue)}`, { fontSize: "sm", color: "canvasTextDim" })]
      : [text("Was macht die Maschine?", { fontSize: "sm", color: "canvasTextDim" })]),
    custom({
      id: "machine",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();
        const examples = task.data.examples;
        const rowH = Math.min(r.h / (examples.length + 2), 50);
        const startY = r.y + (r.h - (examples.length + 1) * rowH) / 2;
        const font = `600 ${Math.max(14, rowH * 0.5)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        c.font = font;
        c.textAlign = "center";
        c.textBaseline = "middle";

        for (let i = 0; i < examples.length; i++) {
          const y = startY + i * rowH;
          c.fillStyle = palette.canvasText;
          c.fillText(`${examples[i]!.input}`, r.x + r.w * 0.25, y);
          c.fillStyle = palette.canvasTextDim;
          c.fillText("→", r.x + r.w * 0.5, y);
          c.fillStyle = palette.canvasText;
          c.fillText(`${examples[i]!.output}`, r.x + r.w * 0.75, y);
        }

        // Hidden input — show input or answer
        const y = startY + examples.length * rowH + rowH * 0.5;
        c.fillStyle = palette.accent;
        c.fillText(`${task.data.hiddenInput}`, r.x + r.w * 0.25, y);
        c.fillStyle = palette.canvasTextDim;
        c.fillText("→", r.x + r.w * 0.5, y);
        c.fillStyle = palette.accent;
        c.font = `700 ${Math.max(14, rowH * 0.55)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        c.fillText(answered ? `${task.data.answer}` : (input || "?"), r.x + r.w * 0.75, y);
      },
    }),
  ], { gap: 12, padding: 16, align: "center" });
}

function buildFiguresScene(ctx: Ctx): CanvasNode {
  const task = ctx.task as { mode: "figuren"; data: FigureTask };
  const { input, result } = ctx;
  const answered = result?.correct === true;

  // Trigger solution reveal animation when answer becomes correct
  if (answered && !solutionAnimStarted) {
    solutionAnimStarted = true;
    solutionAnimProgress = prefersReducedMotion() ? 1 : 0;
  }

  return vstack([
    text(`Wie viele Punkte hat Schritt ${task.data.nextStep}?`, { fontSize: "xl", bold: true }),
    custom({
      id: "figures",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();
        const steps = task.data.shownSteps;
        const cols = steps + 1;
        const colW = r.w / cols;
        const dotR = Math.min(colW * 0.08, r.h * 0.04, 8);
        const spacing = dotR * 3;
        const gridCy = r.y + r.h * 0.5;
        const labelFont = `600 ${Math.max(10, dotR * 2)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;

        for (let s = 0; s < steps; s++) {
          // Stagger: each step column appears left to right
          const stepThreshold = steps > 1 ? s / (steps - 1) : 0;
          const stepAlpha = Math.max(0, Math.min(1, (boxAnimProgress - stepThreshold * 0.6) / 0.4));

          if (stepAlpha <= 0) continue;

          const pts = getFigurePoints(task.data.pattern, s + 1);
          const cx = r.x + (s + 0.5) * colW;

          c.save();
          c.globalAlpha = stepAlpha;
          c.font = labelFont;
          c.fillStyle = palette.canvasTextDim;
          c.textAlign = "center";
          c.fillText(`Schritt ${s + 1}`, cx, r.y + r.h * 0.1);

          const dotScale = 0.5 + stepAlpha * 0.5;
          for (const pt of pts) {
            const px = cx + pt.col * spacing;
            const py = gridCy + pt.row * spacing;
            c.beginPath();
            c.arc(px, py, dotR * dotScale, 0, Math.PI * 2);
            c.fillStyle = palette.canvasPrimary;
            c.fill();
          }

          c.fillStyle = palette.canvasText;
          c.fillText(`${task.data.counts[s]}`, cx, r.y + r.h * 0.88);
          c.restore();
        }

        // Next step column: question mark, input, or full solution with dots
        const cx = r.x + (steps + 0.5) * colW;
        c.textAlign = "center";

        // Step label
        c.font = labelFont;
        c.fillStyle = answered ? palette.ok : palette.accent;
        c.fillText(`Schritt ${task.data.nextStep}`, cx, r.y + r.h * 0.1);

        if (answered) {
          // Draw full dot pattern for the solution step
          const allPts = getFigurePoints(task.data.pattern, task.data.nextStep);
          const prevPts = getFigurePoints(task.data.pattern, task.data.nextStep - 1);
          const prevSet = new Set(prevPts.map(p => `${p.row},${p.col}`));
          const solScale = 0.5 + Math.min(solutionAnimProgress, 1) * 0.5;

          for (const pt of allPts) {
            const px = cx + pt.col * spacing;
            const py = gridCy + pt.row * spacing;
            const isNew = !prevSet.has(`${pt.row},${pt.col}`);

            c.beginPath();
            c.arc(px, py, dotR * solScale, 0, Math.PI * 2);
            // Existing dots in blue, newly added dots in green to highlight the growth
            c.fillStyle = isNew ? palette.ok : palette.canvasPrimary;
            c.globalAlpha = isNew ? Math.min(solutionAnimProgress * 1.5, 1) : 1;
            c.fill();
            c.globalAlpha = 1;
          }

          // Count label below
          c.fillStyle = palette.ok;
          c.font = `700 ${Math.max(10, dotR * 2)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          const labelAlpha = Math.max(0, solutionAnimProgress * 2 - 0.5);
          if (labelAlpha > 0) {
            c.globalAlpha = labelAlpha;
            c.fillText(`${task.data.answer}`, cx, r.y + r.h * 0.88);
            c.globalAlpha = 1;
          }
        } else {
          // Question mark or input
          c.font = `700 ${Math.max(20, r.h * 0.1)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          c.fillStyle = palette.accent;
          c.fillText(input || "?", cx, r.y + r.h * 0.5);
        }
      },
    }),
  ], { gap: 12, padding: 16, align: "center" });
}

export const patternsV2Registration = defineModule<PatternTask, Record<string, never>>({
  id: "patterns",
  label: "Muster & Strukturen",
  icon: "🔣",
  description: "Zahlenfolgen, Funktionsmaschinen und Figurenmuster entdecken.",

  flowType: "task",
  input: "numberPad",

  taskTypes: [
    { id: "sequence", label: "Zahlenfolge", icon: "📊" },
    { id: "machine", label: "Maschine", icon: "⚙️" },
    { id: "figuren", label: "Figuren", icon: "🔵" },
  ],

  difficulties: DIFFICULTIES,

  taskLabel(task) {
    switch (task.mode) {
      case "sequence": return `Finde die fehlende Zahl in der Zahlenfolge.`;
      case "machine": return `Was kommt aus der Funktionsmaschine heraus?`;
      case "figuren": return `Wie viele Punkte hat Schritt ${task.data.nextStep}?`;
    }
  },

  tutorial: (taskType: string): TutorialStep[] => {
    const palette = getPalette();
    const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

    if (taskType === "machine") {
      return [
        {
          title: "So geht's",
          text: "Finde die Regel der Maschine und berechne den fehlenden Ausgabewert.",
          mathBackground: "Eine Funktionsmaschine wendet eine Regel an: z.B. ×3 bedeutet, jede Eingabe wird verdreifacht.",
          draw(ctx, w, h, p) {
            ctx.font = `700 ${h * 0.11}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = palette.canvasText;
            ctx.fillText("Funktionsmaschine: × 3", w / 2, h * 0.12);

            const rows = [
              { input: 2, output: 6 },
              { input: 5, output: 15 },
              { input: 4, output: "?" },
            ];
            const rowH = h * 0.18;
            const startY = h * 0.3;

            for (let i = 0; i < rows.length; i++) {
              const threshold = i / 3;
              if (p <= threshold) continue;
              const alpha = Math.min(1, (p - threshold) / 0.25);
              const y = startY + i * rowH;

              ctx.globalAlpha = alpha;
              ctx.font = `600 ${h * 0.09}px ${FONT}`;
              ctx.fillStyle = palette.canvasText;
              ctx.textAlign = "center";
              ctx.fillText(`${rows[i]!.input}`, w * 0.3, y);
              ctx.fillStyle = palette.canvasTextDim;
              ctx.fillText("→", w * 0.5, y);
              ctx.fillStyle = i === 2 ? palette.accent : palette.canvasText;
              ctx.fillText(`${rows[i]!.output}`, w * 0.7, y);
              ctx.globalAlpha = 1;
            }

            if (p > 0.85) {
              ctx.font = `700 ${h * 0.12}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.textAlign = "center";
              ctx.fillText("4 × 3 = 12 ✓", w / 2, h * 0.9);
            }
          },
          duration: 2500,
        },
      ];
    }

    if (taskType === "figuren") {
      return [
        {
          title: "So geht's",
          text: "Zähle die Punkte bei jedem Schritt und finde das Muster.",
          mathBackground: "Figurenmuster wachsen nach einer Regel. Zähle die Punkte und finde heraus, wie viele es beim nächsten Schritt sind.",
          draw(ctx, w, h, p) {
            ctx.font = `700 ${h * 0.1}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = palette.canvasText;
            ctx.fillText("Dreieckszahlen", w / 2, h * 0.1);

            // Steps: 1, 3, 6, ?
            const counts = [1, 3, 6];
            const dotR = Math.min(w * 0.02, h * 0.025);
            const colW = w / 4;

            for (let s = 0; s < 3; s++) {
              const threshold = s / 3;
              if (p <= threshold) continue;
              const alpha = Math.min(1, (p - threshold) / 0.25);
              const cx = (s + 0.5) * colW;

              ctx.globalAlpha = alpha;
              ctx.font = `600 ${h * 0.06}px ${FONT}`;
              ctx.fillStyle = palette.canvasTextDim;
              ctx.fillText(`Schritt ${s + 1}`, cx, h * 0.25);

              // Draw triangle dots
              let dotIdx = 0;
              for (let row = 0; row <= s; row++) {
                for (let col = 0; col <= row; col++) {
                  if (dotIdx >= counts[s]!) break;
                  const dx = cx + (col - row / 2) * dotR * 3;
                  const dy = h * 0.45 + row * dotR * 3;
                  ctx.beginPath();
                  ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
                  ctx.fillStyle = palette.canvasPrimary;
                  ctx.fill();
                  dotIdx++;
                }
              }

              ctx.font = `700 ${h * 0.07}px ${FONT}`;
              ctx.fillStyle = palette.canvasText;
              ctx.fillText(`${counts[s]}`, cx, h * 0.72);
              ctx.globalAlpha = 1;
            }

            // Question mark for step 4
            if (p > 0.5) {
              const cx = 3.5 * colW;
              ctx.font = `700 ${h * 0.12}px ${FONT}`;
              ctx.fillStyle = palette.accent;
              ctx.fillText("?", cx, h * 0.5);
              ctx.font = `600 ${h * 0.06}px ${FONT}`;
              ctx.fillText("Schritt 4", cx, h * 0.25);
            }

            if (p > 0.85) {
              ctx.font = `700 ${h * 0.1}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.textAlign = "center";
              ctx.fillText("= 10 ✓", w / 2, h * 0.9);
            }
          },
          duration: 2500,
        },
      ];
    }

    // Default: sequence
    return [
      {
        title: "So geht's",
        text: "Finde die Regel der Zahlenfolge und setze die fehlende Zahl ein.",
        mathBackground: "Zahlenfolgen haben eine Regel. Finde die Regel und setze fort. Beispiel: 2, 4, 6, ? → Regel: +2.",
        draw(ctx, w, h, p) {
          ctx.font = `700 ${h * 0.11}px ${FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = palette.canvasText;
          ctx.fillText("Finde die Regel!", w / 2, h * 0.12);

          const nums = [2, 4, 6, -1, 10];
          const boxW = w * 0.14;
          const gap = w * 0.03;
          const totalW = nums.length * boxW + (nums.length - 1) * gap;
          const startX = (w - totalW) / 2;
          const cy = h * 0.45;

          for (let i = 0; i < nums.length; i++) {
            const threshold = i / nums.length;
            if (p <= threshold) continue;
            const alpha = Math.min(1, (p - threshold) / 0.15);
            const bx = startX + i * (boxW + gap);
            const isHidden = nums[i] === -1;

            ctx.globalAlpha = alpha;
            ctx.fillStyle = isHidden ? palette.accentSubtle : palette.panelSoft;
            ctx.strokeStyle = isHidden ? palette.accent : palette.line;
            ctx.lineWidth = isHidden ? 3 : 1.5;
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") ctx.roundRect(bx, cy - boxW / 2, boxW, boxW, 8);
            else ctx.rect(bx, cy - boxW / 2, boxW, boxW);
            ctx.fill();
            ctx.stroke();

            ctx.font = `700 ${h * 0.1}px ${FONT}`;
            ctx.fillStyle = isHidden ? palette.accent : palette.canvasText;
            ctx.fillText(isHidden ? "?" : `${nums[i]}`, bx + boxW / 2, cy);
            ctx.globalAlpha = 1;
          }

          // Show +2 rule
          if (p > 0.4) {
            ctx.font = `600 ${h * 0.07}px ${FONT}`;
            ctx.fillStyle = palette.accent;
            for (let i = 0; i < 4; i++) {
              const x = startX + i * (boxW + gap) + boxW + gap / 2;
              ctx.fillText("+2", x, cy - boxW / 2 - h * 0.06);
            }
          }

          if (p > 0.85) {
            ctx.font = `700 ${h * 0.12}px ${FONT}`;
            ctx.fillStyle = palette.ok;
            ctx.textAlign = "center";
            ctx.fillText("? = 8 ✓", w / 2, h * 0.88);
          }
        },
        duration: 2500,
      },
    ];
  },

  generate(ctx) {
    const prev = ctx.previous as PatternTask | undefined;
    const diff = ctx.difficulty;
    switch (ctx.taskType) {
      case "sequence": return { mode: "sequence" as const, data: generateSequenceTask(prev?.mode === "sequence" ? prev.data as SequenceTask : undefined, diff) };
      case "machine": return { mode: "machine" as const, data: generateMachineTask(prev?.mode === "machine" ? prev.data as MachineTask : undefined, diff) };
      case "figuren": return { mode: "figuren" as const, data: generateFigureTask() };
      default: return { mode: "sequence" as const, data: generateSequenceTask(undefined, diff) };
    }
  },

  check(task, answer) {
    const num = typeof answer === "number" ? answer : Number(answer);
    switch (task.mode) {
      case "sequence": return { correct: checkSequenceAnswer(task.data, num), feedback: checkSequenceAnswer(task.data, num) ? "Richtig! Muster erkannt!" : "Fast! Schau dir die Regel nochmal an." };
      case "machine": return { correct: checkMachineAnswer(task.data, num), feedback: checkMachineAnswer(task.data, num) ? "Richtig! Maschine verstanden!" : "Probier nochmal – was passiert mit den Zahlen?" };
      case "figuren": return { correct: checkFigureAnswer(task.data, num), feedback: checkFigureAnswer(task.data, num) ? "Richtig! Gut gezählt!" : "Zähle nochmal – schau dir das Muster an." };
    }
  },

  hints: getHints,

  getSolution(task) {
    return { text: `Die Antwort ist ${task.mode === "sequence" ? task.data.answer : task.mode === "machine" ? task.data.answer : task.data.answer}.` };
  },

  initialState: () => ({}),

  onActivate(ctx) {
    // Reset solution animation for new task
    solutionAnimProgress = 0;
    solutionAnimStarted = false;

    // Box stagger animation RAF loop
    boxAnimProgress = prefersReducedMotion() ? 1 : 0;
    boxPrevPhase = ctx.phase;
    boxLastTime = null;

    if (prefersReducedMotion()) { boxAnimRafId = 0; return; } // Skip animation entirely

    const loop = (now: number) => {
      const dt = boxLastTime !== null ? now - boxLastTime : 0;
      boxLastTime = now;

      const phase = ctx.phase;
      if (phase === "interact" && boxPrevPhase !== "interact") {
        boxAnimProgress = 0;
        boxLastTime = now;
      }
      boxPrevPhase = phase;

      let needsRedraw = false;

      if (phase === "interact" && boxAnimProgress < 1) {
        boxAnimProgress = Math.min(1, boxAnimProgress + dt / BOX_STAGGER_DURATION);
        needsRedraw = true;
      }

      // Solution reveal animation for Figurenmuster — driven by solutionAnimStarted flag
      if (solutionAnimStarted && solutionAnimProgress < 1) {
        solutionAnimProgress = Math.min(1, solutionAnimProgress + dt / SOLUTION_ANIM_DURATION);
        needsRedraw = true;
      }

      if (needsRedraw) ctx.invalidate();
      boxAnimRafId = requestAnimationFrame(loop);
    };
    boxAnimRafId = requestAnimationFrame(loop);
  },

  onDeactivate() {
    cancelAnimationFrame(boxAnimRafId);
    boxAnimProgress = 0;
    boxLastTime = null;
    solutionAnimProgress = 0;
    solutionAnimStarted = false;
  },

  buildScene(ctx) {
    switch (ctx.task.mode) {
      case "sequence": return buildSequenceScene(ctx);
      case "machine": return buildMachineScene(ctx);
      case "figuren": return buildFiguresScene(ctx);
    }
  },
});
