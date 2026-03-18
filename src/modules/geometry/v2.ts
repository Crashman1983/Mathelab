/**
 * Geometrie V2 — interactive module using defineModule() DSL.
 *
 * Modes:
 * - shapes: Student classifies a displayed shape via button tap
 * - angles: Student classifies an angle type via button tap
 * - area:   Student enters the area value via numpad
 *
 */

import { defineModule, DIFFICULTIES, type SceneContext, type ModuleContext, type TutorialStep } from "@app/module-framework";
import { vstack, hstack } from "@canvas/nodes/container";
import { text } from "@canvas/nodes/text";
import { button } from "@canvas/nodes/button";
import { custom } from "@canvas/nodes/custom";
import type { CanvasNode } from "@canvas/nodes/types";
import { getPalette } from "@core/design";
import { prefersReducedMotion } from "@core/utils";
import type { CanvasScene } from "@canvas/scene";
import {
  getShapes,
  generateAngleQuestion,
  generateAreaTask,
  angleLabel,
  explainAngle,
  explainArea,
  type ShapeDef,
  type AngleQuestion,
  type AreaTask,
} from "./logic";

// ─── Types ───────────────────────────────────────────────────────────────────

type GeoTask =
  | { mode: "shapes"; shape: ShapeDef }
  | { mode: "angles"; question: AngleQuestion }
  | { mode: "area"; data: AreaTask };

interface GeoState {
  selectedShape: string | null;
  selectedAngle: string | null;
  /** Set of tapped cell indices in area mode (for interactive counting) */
  tappedCells: Set<number>;
}

// Area grid geometry — set during draw, read during pointer events
let areaGridGeo: {
  startX: number;
  startY: number;
  cellSize: number;
  gridW: number;
  gridH: number;
  shape: string;
} | null = null;

// ─── Mutable callback refs (stable references for button onTap) ─────────────

const onShapeTap: { current: ((id: string) => void) | null } = { current: null };
const onAngleTap: { current: ((type: string) => void) | null } = { current: null };

// ─── Animation refs ──────────────────────────────────────────────────────────

let geoScene: CanvasScene | null = null;
/** Angle arm opening animation: 0→1 during present phase */
let angleArmProgress = 1;
let angleArmRafId = 0;
/** Triangle hint animation: shows rectangle outline + diagonal + dimmed upper half */
let triangleHintProgress = 0; // 0 = hidden, 0→1 = animating
let triangleHintRafId = 0;

/** Area cell fill: per-cell progress map (cellIndex → 0–1) */
let areaCellFills: Map<number, number> = new Map();
let areaCellAnimRafId = 0;

// ─── Hints ───────────────────────────────────────────────────────────────────

function getHints(task: GeoTask): string[] {
  switch (task.mode) {
    case "shapes":
      return [
        `Schau dir die Form genau an.`,
        `Hat sie gleiche Seiten oder rechte Winkel?`,
        `Das ist ein ${task.shape.label}: ${task.shape.description}.`,
        `Tippe auf „${task.shape.label}".`,
      ];
    case "angles":
      return [
        `Ist der Winkel kleiner, gleich oder größer als 90°?`,
        `${task.question.degrees}° — vergleiche mit einem rechten Winkel.`,
        `${explainAngle(task.question.degrees, task.question.type)}.`,
        `Der Winkel misst genau ${task.question.degrees}°. Tippe auf „${angleLabel(task.question.type)}".`,
      ];
    case "area":
      return [
        `Zähle die Kästchen.`,
        `Fläche = ${task.data.shape === "triangle-right" ? "Breite × Höhe ÷ 2" : "Breite × Höhe"}.`,
        `${explainArea(task.data)}.`,
        `Die Fläche ist ${task.data.area} Kästchen². Gib ${task.data.area} ein.`,
      ];
  }
}

// ─── Shape button choices ────────────────────────────────────────────────────

/** Pick 4 shape labels including the correct one, shuffled. */
function getShapeChoices(correct: ShapeDef): ShapeDef[] {
  const all = getShapes();
  const others = all.filter((s) => s.id !== correct.id);
  // Shuffle others and pick 3
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j]!, others[i]!];
  }
  const choices = [correct, ...others.slice(0, 3)];
  // Shuffle choices
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j]!, choices[i]!];
  }
  return choices;
}

// Cache choices per task to avoid reshuffling on rebuild
let cachedShapeChoices: ShapeDef[] | null = null;
let cachedShapeTaskId: string | null = null;

function getStableShapeChoices(correct: ShapeDef): ShapeDef[] {
  const taskKey = correct.id;
  if (cachedShapeTaskId !== taskKey || !cachedShapeChoices) {
    cachedShapeChoices = getShapeChoices(correct);
    cachedShapeTaskId = taskKey;
  }
  return cachedShapeChoices;
}

// ─── Angle type choices ──────────────────────────────────────────────────────

const ANGLE_TYPES = [
  { id: "spitz", label: "Spitz" },
  { id: "rechts", label: "Recht" },
  { id: "stumpf", label: "Stumpf" },
  { id: "gestreckt", label: "Gestreckt" },
] as const;

// ─── Scene Builders ──────────────────────────────────────────────────────────

function buildShapesScene(
  task: GeoTask & { mode: "shapes" },
  ctx: SceneContext<GeoTask, GeoState>,
): CanvasNode {
  const answered = ctx.result !== null;
  const isCorrect = ctx.result?.correct === true;
  const choices = getStableShapeChoices(task.shape);

  const shapeDisplay = custom({
    id: "shape-display",
    flex: 1,
    draw(drawCtx, r) {
      const palette = getPalette();
      const shape = task.shape;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const scale = Math.min(r.w, r.h) * 0.3;

      drawCtx.beginPath();
      for (let i = 0; i < shape.vertices.length; i++) {
        const v = shape.vertices[i]!;
        const px = cx + v.x * scale;
        const py = cy + v.y * scale;
        if (i === 0) drawCtx.moveTo(px, py);
        else drawCtx.lineTo(px, py);
      }
      drawCtx.closePath();
      drawCtx.fillStyle = palette.canvasPrimary;
      drawCtx.globalAlpha = 0.3;
      drawCtx.fill();
      drawCtx.globalAlpha = 1;
      drawCtx.strokeStyle = palette.canvasPrimary;
      drawCtx.lineWidth = 3;
      drawCtx.stroke();
    },
  });

  // Answer buttons (only in interact phase)
  const buttons = ctx.phase === "interact"
    ? choices.map((s) => {
        const isSelected = ctx.state.selectedShape === s.id;
        const variant = answered
          ? (s.id === task.shape.id ? "ok" : (isSelected ? "bad" : "secondary"))
          : (isSelected ? "primary" : "secondary");
        return button(s.label, {
          id: `shape-${s.id}`,
          variant,
          enabled: !answered,
          onTap() { onShapeTap.current?.(s.id); },
        });
      })
    : [];

  const buttonRow = buttons.length > 0
    ? hstack(buttons, { gap: 8, padding: 4, align: "center" })
    : text("", { fontSize: "sm" });

  // Result label: only show after answer
  const resultLabel = answered
    ? text(
        `${task.shape.icon} ${task.shape.label}`,
        { fontSize: "lg", bold: true, color: isCorrect ? "canvasSuccess" : "canvasText" },
      )
    : text("Was ist das für eine Form?", { fontSize: "lg", bold: true });

  const descriptionLabel = answered
    ? text(task.shape.description, { fontSize: "sm", color: "canvasTextDim" })
    : text(
        "Tippe auf die richtige Antwort.",
        { fontSize: "sm", color: "canvasTextDim" },
      );

  return vstack([
    resultLabel,
    shapeDisplay,
    descriptionLabel,
    buttonRow,
  ], { gap: 8, padding: 16, align: "center" });
}

function buildAnglesScene(
  task: GeoTask & { mode: "angles" },
  ctx: SceneContext<GeoTask, GeoState>,
): CanvasNode {
  const answered = ctx.result !== null;
  const isCorrect = ctx.result?.correct === true;

  const angleDisplay = custom({
    id: "angle-display",
    flex: 1,
    draw(drawCtx, r) {
      const palette = getPalette();
      const cx = r.x + r.w * 0.3;
      const cy = r.y + r.h * 0.6;
      const armLen = Math.min(r.w, r.h) * 0.35;
      const fullRad = (task.question.degrees * Math.PI) / 180;
      // Animated: arm opens from 0° to target angle during present
      const t = angleArmProgress;
      const eased = 1 - Math.pow(1 - t, 3); // easeOut cubic
      const rad = fullRad * eased;

      // Subtle background: faint filled arc sector
      drawCtx.save();
      drawCtx.globalAlpha = 0.08;
      drawCtx.beginPath();
      drawCtx.moveTo(cx, cy);
      drawCtx.arc(cx, cy, armLen * 0.9, -rad, 0);
      drawCtx.closePath();
      drawCtx.fillStyle = palette.canvasPrimary;
      drawCtx.fill();
      drawCtx.restore();

      // First arm (horizontal)
      drawCtx.beginPath();
      drawCtx.moveTo(cx, cy);
      drawCtx.lineTo(cx + armLen, cy);
      drawCtx.strokeStyle = palette.canvasPrimary;
      drawCtx.lineWidth = 3;
      drawCtx.lineCap = "round";
      drawCtx.stroke();

      // Second arm (at animated angle)
      drawCtx.beginPath();
      drawCtx.moveTo(cx, cy);
      drawCtx.lineTo(cx + armLen * Math.cos(-rad), cy + armLen * Math.sin(-rad));
      drawCtx.stroke();

      // Arc
      const arcR = armLen * 0.25;
      drawCtx.beginPath();
      drawCtx.arc(cx, cy, arcR, -rad, 0);
      drawCtx.strokeStyle = palette.accent;
      drawCtx.lineWidth = 2;
      drawCtx.stroke();

      // Only show degree label after answer or when animation done
      if (answered || t >= 1) {
        drawCtx.font = `700 ${Math.max(14, r.w * 0.035)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        drawCtx.fillStyle = palette.canvasText;
        drawCtx.textAlign = "center";
        drawCtx.fillText(`${task.question.degrees}°`, cx + arcR * 1.8, cy - arcR * 0.5);
      }
    },
  });

  // Angle type buttons (only in interact phase)
  const buttons = ctx.phase === "interact"
    ? ANGLE_TYPES.map((at) => {
        const isSelected = ctx.state.selectedAngle === at.id;
        const variant = answered
          ? (at.id === task.question.type ? "ok" : (isSelected ? "bad" : "secondary"))
          : (isSelected ? "primary" : "secondary");
        return button(at.label, {
          id: `angle-${at.id}`,
          variant,
          enabled: !answered,
          onTap() { onAngleTap.current?.(at.id); },
        });
      })
    : [];

  const buttonRow = buttons.length > 0
    ? hstack(buttons, { gap: 8, padding: 4, align: "center" })
    : text("", { fontSize: "sm" });

  // Title: hide degree value and type until answered
  const titleText = answered
    ? `${task.question.degrees}° — ${angleLabel(task.question.type)}`
    : "Welcher Winkeltyp?";

  const titleColor = answered
    ? (isCorrect ? "canvasSuccess" : "canvasText")
    : "canvasText";

  return vstack([
    text(titleText, { fontSize: "xl", bold: true, color: titleColor }),
    angleDisplay,
    buttonRow,
  ], { gap: 8, padding: 16, align: "center" });
}

function buildAreaScene(
  task: GeoTask & { mode: "area" },
  ctx: SceneContext<GeoTask, GeoState>,
): CanvasNode {
  const answered = ctx.result !== null;
  const isCorrect = ctx.result?.correct === true;
  const tapped = ctx.state.tappedCells;

  const areaGrid = custom({
    id: "area-grid",
    flex: 1,
    draw(drawCtx, r) {
      const palette = getPalette();
      const { width: w, height: h, shape } = task.data;
      const cellSize = Math.min(r.w * 0.85 / w, r.h * 0.75 / h, 80);
      const startX = r.x + (r.w - w * cellSize) / 2;
      const startY = r.y + (r.h - h * cellSize) / 2;

      // Store geometry for pointer hit-testing
      areaGridGeo = { startX, startY, cellSize, gridW: w, gridH: h, shape };

      // Grid
      drawCtx.strokeStyle = palette.gridLine;
      drawCtx.lineWidth = 1;
      for (let i = 0; i <= w; i++) {
        drawCtx.beginPath();
        drawCtx.moveTo(startX + i * cellSize, startY);
        drawCtx.lineTo(startX + i * cellSize, startY + h * cellSize);
        drawCtx.stroke();
      }
      for (let j = 0; j <= h; j++) {
        drawCtx.beginPath();
        drawCtx.moveTo(startX, startY + j * cellSize);
        drawCtx.lineTo(startX + w * cellSize, startY + j * cellSize);
        drawCtx.stroke();
      }

      // Shape outline
      drawCtx.beginPath();
      if (shape === "triangle-right") {
        drawCtx.moveTo(startX, startY + h * cellSize);
        drawCtx.lineTo(startX + w * cellSize, startY + h * cellSize);
        drawCtx.lineTo(startX, startY);
      } else {
        drawCtx.rect(startX, startY, w * cellSize, h * cellSize);
      }
      drawCtx.closePath();
      drawCtx.fillStyle = palette.canvasPrimary;
      drawCtx.globalAlpha = 0.12;
      drawCtx.fill();
      drawCtx.globalAlpha = 1;
      drawCtx.strokeStyle = palette.canvasPrimary;
      drawCtx.lineWidth = 3;
      drawCtx.stroke();

      // Interactive tapped cells (student counting) — show before answer
      if (!answered && tapped.size > 0) {
        let idx = 0;
        for (let cy2 = 0; cy2 < h; cy2++) {
          for (let cx2 = 0; cx2 < w; cx2++) {
            if (tapped.has(idx)) {
              drawCtx.fillStyle = palette.accent;
              drawCtx.globalAlpha = 0.35;
              drawCtx.fillRect(
                startX + cx2 * cellSize + 2,
                startY + cy2 * cellSize + 2,
                cellSize - 4,
                cellSize - 4,
              );
              drawCtx.globalAlpha = 1;
              // Cell number label
              const cellNum = [...tapped].indexOf(idx) + 1;
              drawCtx.font = `700 ${Math.max(10, cellSize * 0.35)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
              drawCtx.fillStyle = palette.accent;
              drawCtx.textAlign = "center";
              drawCtx.textBaseline = "middle";
              drawCtx.fillText(
                `${cellNum}`,
                startX + cx2 * cellSize + cellSize / 2,
                startY + cy2 * cellSize + cellSize / 2,
              );
            }
            idx++;
          }
        }
      }

      // Staggered cell fill animation (after correct answer)
      if (areaCellFills.size > 0) {
        let idx = 0;
        for (let cy2 = 0; cy2 < h; cy2++) {
          for (let cx2 = 0; cx2 < w; cx2++) {
            // For triangle, only fill cells inside shape
            if (shape === "triangle-right" && cx2 > (h - 1 - cy2) * (w / h)) {
              idx++;
              continue;
            }
            const fill = areaCellFills.get(idx) ?? 0;
            if (fill > 0) {
              drawCtx.fillStyle = palette.canvasSuccess;
              drawCtx.globalAlpha = fill * 0.45;
              drawCtx.fillRect(
                startX + cx2 * cellSize + 2,
                startY + cy2 * cellSize + 2,
                cellSize - 4,
                cellSize - 4,
              );
              drawCtx.globalAlpha = 1;
            }
            idx++;
          }
        }
      }

      // ─── Triangle hint animation: rectangle + diagonal + dimmed upper half ───
      if (shape === "triangle-right" && triangleHintProgress > 0) {
        const p = triangleHintProgress;
        const sx = startX;
        const sy = startY;
        const sw = w * cellSize;
        const sh = h * cellSize;

        // Phase 1 (0–0.4): Draw full rectangle outline
        const rectP = Math.min(1, p / 0.4);
        drawCtx.save();
        drawCtx.strokeStyle = palette.warn;
        drawCtx.lineWidth = 3;
        drawCtx.setLineDash([8, 4]);
        drawCtx.globalAlpha = rectP * 0.8;
        drawCtx.strokeRect(sx, sy, sw, sh);
        drawCtx.setLineDash([]);

        // Phase 2 (0.3–0.7): Draw diagonal line
        if (p > 0.3) {
          const diagP = Math.min(1, (p - 0.3) / 0.4);
          drawCtx.beginPath();
          drawCtx.strokeStyle = palette.bad;
          drawCtx.lineWidth = 3;
          drawCtx.globalAlpha = diagP * 0.9;
          drawCtx.moveTo(sx, sy);
          drawCtx.lineTo(sx + sw * diagP, sy + sh * diagP);
          drawCtx.stroke();
        }

        // Phase 3 (0.6–1.0): Dim the upper-right triangle half
        if (p > 0.6) {
          const dimP = Math.min(1, (p - 0.6) / 0.4);
          drawCtx.beginPath();
          drawCtx.moveTo(sx, sy);
          drawCtx.lineTo(sx + sw, sy);
          drawCtx.lineTo(sx + sw, sy + sh);
          drawCtx.closePath();
          drawCtx.fillStyle = palette.canvasText;
          drawCtx.globalAlpha = dimP * 0.25;
          drawCtx.fill();

          // Label "½" in the dimmed area
          if (dimP > 0.5) {
            drawCtx.globalAlpha = (dimP - 0.5) * 2;
            drawCtx.font = `700 ${Math.max(16, cellSize * 0.6)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
            drawCtx.fillStyle = palette.bad;
            drawCtx.textAlign = "center";
            drawCtx.textBaseline = "middle";
            drawCtx.fillText("½", sx + sw * 0.7, sy + sh * 0.3);
          }
        }

        drawCtx.restore();
      }

      // Dimension labels
      const labelFontSize = Math.max(14, cellSize * 0.45);
      const labelOffset = Math.max(18, cellSize * 0.5);
      drawCtx.font = `600 ${labelFontSize}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
      drawCtx.fillStyle = palette.canvasText;
      drawCtx.textAlign = "center";
      drawCtx.fillText(`${w}`, startX + w * cellSize / 2, startY + h * cellSize + labelOffset);
      drawCtx.save();
      drawCtx.translate(startX - labelOffset, startY + h * cellSize / 2);
      drawCtx.rotate(-Math.PI / 2);
      drawCtx.fillText(`${h}`, 0, 0);
      drawCtx.restore();
    },
  });

  // Counter line: show tapped count when student is counting
  const countLabel = !answered && tapped.size > 0
    ? `${tapped.size} Kästchen markiert — tippe zum Zählen oder gib die Fläche ein`
    : null;

  // Show area result or prompt
  const areaLabel = answered
    ? text(
        `Fläche = ${task.data.area} Kästchen²`,
        { fontSize: "lg", bold: true, color: isCorrect ? "canvasSuccess" : "canvasText" },
      )
    : ctx.input.length > 0
      ? text(`Fläche = ${ctx.input} ?`, { fontSize: "lg", bold: true })
      : text("Fläche = ?", { fontSize: "lg", bold: true, color: "canvasTextDim" });

  return vstack([
    text("Zähle die Kästchen und berechne die Fläche", { fontSize: "xl", bold: true }),
    text(
      "Tippe Kästchen an zum Zählen, dann gib die Fläche ein.",
      { fontSize: "sm", color: "canvasTextDim" },
    ),
    areaGrid,
    ...(countLabel ? [text(countLabel, { fontSize: "sm", color: "accent" })] : []),
    areaLabel,
  ], { gap: 8, padding: 16, align: "center" });
}

// ─── Scene Dispatch ──────────────────────────────────────────────────────────

function buildScene(ctx: SceneContext<GeoTask, GeoState>): CanvasNode {
  const task = ctx.task;
  switch (task.mode) {
    case "shapes":
      return buildShapesScene(task as GeoTask & { mode: "shapes" }, ctx);
    case "angles":
      return buildAnglesScene(task as GeoTask & { mode: "angles" }, ctx);
    case "area":
      return buildAreaScene(task as GeoTask & { mode: "area" }, ctx);
  }
}

// ─── Module Registration ─────────────────────────────────────────────────────

export const geometryV2Registration = defineModule<GeoTask, GeoState>({
  id: "geometry",
  label: "Geometrie",
  icon: "📐",
  description: "Formen erkennen, Winkel bestimmen und Flächen berechnen.",

  taskLabel(task) {
    switch (task.mode) {
      case "shapes":
        return `Erkenne die Form: Was ist das für eine Figur?`;
      case "angles":
        return `Bestimme den Winkeltyp.`;
      case "area":
        return `Berechne die Fläche der Figur.`;
    }
  },

  flowType: "task",
  celebrationIntensity: "subtle",
  autoAdvanceMs: 8000,
  // Only area mode needs numpad — shapes and angles use canvas buttons
  input: (taskType: string) => taskType === "area" ? "numberPad" : "canvas",

  taskTypes: [
    { id: "shapes", label: "Formen", icon: "⬡" },
    { id: "angles", label: "Winkel", icon: "📏" },
    { id: "area", label: "Fläche", icon: "⬛" },
  ],

  difficulties: DIFFICULTIES,

  tutorial: (taskType: string): TutorialStep[] => {
    const palette = getPalette();
    const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

    if (taskType === "angles") {
      return [
        {
          title: "So geht's",
          text: "Bestimme den Winkeltyp: spitz, recht, stumpf oder gestreckt.",
          mathBackground: "Spitz: < 90°, Recht: = 90°, Stumpf: > 90° und < 180°, Gestreckt: = 180°.",
          draw(ctx, w, h, p) {
            const cx = w * 0.35;
            const cy = h * 0.6;
            const armLen = Math.min(w * 0.28, h * 0.35);

            // Animate angle opening from 0° to 60° (spitz)
            const targetRad = (60 * Math.PI) / 180;
            const eased = 1 - Math.pow(1 - Math.min(p / 0.7, 1), 3);
            const rad = targetRad * eased;

            // First arm (horizontal)
            ctx.strokeStyle = palette.accent;
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + armLen, cy);
            ctx.stroke();

            // Second arm (animated)
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + armLen * Math.cos(-rad), cy + armLen * Math.sin(-rad));
            ctx.stroke();

            // Arc
            const arcR = armLen * 0.3;
            ctx.beginPath();
            ctx.arc(cx, cy, arcR, -rad, 0);
            ctx.strokeStyle = palette.canvasPrimary;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label
            if (p > 0.7) {
              ctx.font = `700 ${h * 0.09}px ${FONT}`;
              ctx.fillStyle = palette.canvasText;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("60°", cx + arcR * 2, cy - arcR * 0.8);
            }
            if (p > 0.85) {
              ctx.font = `700 ${h * 0.11}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.textAlign = "center";
              ctx.fillText("→ Spitzer Winkel", w * 0.6, h * 0.2);
            }
          },
          duration: 3000,
        },
      ];
    }

    if (taskType === "area") {
      return [
        {
          title: "So geht's",
          text: "Zähle die Kästchen oder rechne Breite × Höhe.",
          mathBackground: "Fläche eines Rechtecks = Breite × Höhe. Bei einem rechtwinkligen Dreieck: Breite × Höhe ÷ 2.",
          draw(ctx, w, h, p) {
            const gridW = 4;
            const gridH = 3;
            const cellSize = Math.min(w * 0.15, h * 0.15);
            const startX = (w - gridW * cellSize) / 2;
            const startY = h * 0.25;

            // Grid
            ctx.strokeStyle = palette.gridLine;
            ctx.lineWidth = 1;
            for (let i = 0; i <= gridW; i++) {
              ctx.beginPath();
              ctx.moveTo(startX + i * cellSize, startY);
              ctx.lineTo(startX + i * cellSize, startY + gridH * cellSize);
              ctx.stroke();
            }
            for (let j = 0; j <= gridH; j++) {
              ctx.beginPath();
              ctx.moveTo(startX, startY + j * cellSize);
              ctx.lineTo(startX + gridW * cellSize, startY + j * cellSize);
              ctx.stroke();
            }

            // Fill cells with progress
            const totalCells = gridW * gridH;
            const cellsToFill = Math.floor(p * (totalCells + 2));
            let idx = 0;
            for (let row = 0; row < gridH; row++) {
              for (let col = 0; col < gridW; col++) {
                if (idx < cellsToFill) {
                  ctx.fillStyle = palette.accent;
                  ctx.globalAlpha = 0.4;
                  ctx.fillRect(startX + col * cellSize + 1, startY + row * cellSize + 1, cellSize - 2, cellSize - 2);
                  ctx.globalAlpha = 1;
                }
                idx++;
              }
            }

            // Outline
            ctx.strokeStyle = palette.canvasPrimary;
            ctx.lineWidth = 3;
            ctx.strokeRect(startX, startY, gridW * cellSize, gridH * cellSize);

            // Dimension labels
            ctx.font = `600 ${h * 0.07}px ${FONT}`;
            ctx.fillStyle = palette.canvasText;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(`${gridW}`, startX + gridW * cellSize / 2, startY + gridH * cellSize + 6);
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillText(`${gridH}`, startX - 8, startY + gridH * cellSize / 2);

            if (p > 0.85) {
              ctx.font = `700 ${h * 0.1}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("4 × 3 = 12 Kästchen²", w / 2, h * 0.85);
            }
          },
          duration: 3000,
        },
      ];
    }

    // Default: shapes
    return [
      {
        title: "So geht's",
        text: "Schau dir die Form an und tippe auf den richtigen Namen.",
        mathBackground: "Formen erkennt man an Seitenanzahl, gleichen Seiten und Winkeln. Ein Quadrat hat 4 gleiche Seiten und 4 rechte Winkel.",
        draw(ctx, w, h, p) {
          const cx = w / 2;
          const cy = h * 0.45;
          const size = Math.min(w * 0.25, h * 0.3);

          // Draw a square with animated appearance
          const scale = Math.min(p * 2, 1);
          const s = size * scale;

          ctx.beginPath();
          ctx.rect(cx - s, cy - s, s * 2, s * 2);
          ctx.fillStyle = palette.accent;
          ctx.globalAlpha = 0.3;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = palette.canvasPrimary;
          ctx.lineWidth = 3;
          ctx.stroke();

          // Right angle markers
          if (p > 0.5) {
            const markerSize = s * 0.15;
            ctx.strokeStyle = palette.canvasText;
            ctx.lineWidth = 1.5;
            // Top-left corner
            ctx.beginPath();
            ctx.moveTo(cx - s + markerSize, cy - s);
            ctx.lineTo(cx - s + markerSize, cy - s + markerSize);
            ctx.lineTo(cx - s, cy - s + markerSize);
            ctx.stroke();
          }

          if (p > 0.75) {
            ctx.font = `700 ${h * 0.11}px ${FONT}`;
            ctx.fillStyle = palette.ok;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Quadrat ✓", cx, h * 0.85);
          }
        },
        duration: 2500,
      },
    ];
  },

  generate(ctx) {
    // Reset cached choices and animations on new task
    cachedShapeChoices = null;
    cachedShapeTaskId = null;
    triangleHintProgress = 0;
    cancelAnimationFrame(triangleHintRafId);
    areaCellFills = new Map();
    cancelAnimationFrame(areaCellAnimRafId);

    // Angle arm animation
    cancelAnimationFrame(angleArmRafId);
    if (ctx.taskType === "angles") {
      angleArmProgress = 0;
      if (prefersReducedMotion()) {
        angleArmProgress = 1;
      } else if (geoScene) {
        // geoScene available (not first mount) — start animation now
        let lastTime: number | null = null;
        const armLoop = (now: number) => {
          const dt = lastTime !== null ? now - lastTime : 0;
          lastTime = now;
          if (angleArmProgress < 1) {
            angleArmProgress = Math.min(1, angleArmProgress + dt / 800);
            geoScene?.invalidate();
          }
          if (angleArmProgress < 1) angleArmRafId = requestAnimationFrame(armLoop);
        };
        angleArmRafId = requestAnimationFrame(armLoop);
      }
      // else: geoScene null (first mount) — onActivate will start animation
    } else {
      angleArmProgress = 1;
    }

    switch (ctx.taskType) {
      case "shapes": {
        const shapes = getShapes();
        return { mode: "shapes", shape: shapes[Math.floor(Math.random() * shapes.length)]! };
      }
      case "angles": return { mode: "angles", question: generateAngleQuestion(ctx.difficulty) };
      case "area": return { mode: "area", data: generateAreaTask(ctx.difficulty) };
      default: {
        const shapes = getShapes();
        return { mode: "shapes", shape: shapes[0]! };
      }
    }
  },

  check(task, answer) {
    if (task.mode === "shapes") {
      const correct = answer === task.shape.id;
      return { correct, feedback: correct ? "Richtig erkannt!" : "Schau nochmal genau hin!" };
    }
    if (task.mode === "angles") {
      const correct = answer === task.question.type;
      return { correct, feedback: correct ? "Richtig!" : `${explainAngle(task.question.degrees, task.question.type)}` };
    }
    const num = typeof answer === "number" ? answer : Number(answer);
    const correct = num === task.data.area;
    // Trigger staggered cell fill animation on correct area answer
    if (correct) {
      areaCellFills = new Map();
      const totalCells = task.data.width * task.data.height;
      cancelAnimationFrame(areaCellAnimRafId);
      let elapsed = 0;
      let last: number | null = null;
      const staggerMs = 40;
      const perCellMs = 180;
      const cellLoop = (now: number) => {
        const dt = last !== null ? now - last : 0;
        last = now;
        elapsed += dt;
        let allDone = true;
        for (let i = 0; i < totalCells; i++) {
          const start = i * staggerMs;
          if (elapsed > start) {
            const p = Math.min(1, (elapsed - start) / perCellMs);
            areaCellFills.set(i, p);
            if (p < 1) allDone = false;
          } else {
            allDone = false;
          }
        }
        geoScene?.invalidate();
        if (!allDone) areaCellAnimRafId = requestAnimationFrame(cellLoop);
      };
      areaCellAnimRafId = requestAnimationFrame(cellLoop);
    }
    return { correct, feedback: correct ? "Richtig berechnet!" : "Zähle die Kästchen nochmal." };
  },

  hints: getHints,

  getSolution(task) {
    if (task.mode === "shapes") return { text: `${task.shape.label}: ${task.shape.description}` };
    if (task.mode === "angles") return { text: explainAngle(task.question.degrees, task.question.type) };
    return { text: explainArea(task.data) };
  },

  initialState: () => ({
    selectedShape: null,
    selectedAngle: null,
    tappedCells: new Set<number>(),
  }),

  onActivate(ctx) {
    geoScene = ctx.scene;
    areaCellFills = new Map();

    // Start angle arm animation (needs geoScene for invalidate)
    if (angleArmProgress < 1 && !prefersReducedMotion()) {
      cancelAnimationFrame(angleArmRafId);
      let lastTime: number | null = null;
      const armLoop = (now: number) => {
        const dt = lastTime !== null ? now - lastTime : 0;
        lastTime = now;
        if (angleArmProgress < 1) {
          angleArmProgress = Math.min(1, angleArmProgress + dt / 800);
          geoScene?.invalidate();
        }
        if (angleArmProgress < 1) angleArmRafId = requestAnimationFrame(armLoop);
      };
      angleArmRafId = requestAnimationFrame(armLoop);
    } else if (angleArmProgress < 1) {
      angleArmProgress = 1; // reduced motion: skip to end
    }

    // Wire mutable callback refs to module context
    onShapeTap.current = (shapeId: string) => {
      ctx.setState({ selectedShape: shapeId });
      ctx.submitAnswer(shapeId);
    };
    onAngleTap.current = (angleType: string) => {
      ctx.setState({ selectedAngle: angleType });
      ctx.submitAnswer(angleType);
    };
  },

  onHint(hintIndex: number, ctx: ModuleContext<GeoTask, GeoState>) {
    // Trigger triangle hint animation on first hint for area/triangle tasks
    if (ctx.task.mode === "area" && ctx.task.data.shape === "triangle-right" && hintIndex >= 1) {
      if (triangleHintProgress > 0) return; // already running/done
      if (prefersReducedMotion()) {
        // Skip animation, show final state immediately
        triangleHintProgress = 1;
        geoScene?.invalidate();
        return;
      }
      triangleHintProgress = 0;
      cancelAnimationFrame(triangleHintRafId);
      let lastTime: number | null = null;
      const duration = 2000; // 2 seconds
      const loop = (now: number) => {
        const dt = lastTime !== null ? now - lastTime : 0;
        lastTime = now;
        triangleHintProgress = Math.min(1, triangleHintProgress + dt / duration);
        geoScene?.invalidate();
        if (triangleHintProgress < 1) {
          triangleHintRafId = requestAnimationFrame(loop);
        }
      };
      triangleHintRafId = requestAnimationFrame(loop);
    }
  },

  onDeactivate() {
    onShapeTap.current = null;
    onAngleTap.current = null;
    cancelAnimationFrame(angleArmRafId);
    cancelAnimationFrame(triangleHintRafId);
    cancelAnimationFrame(areaCellAnimRafId);
    geoScene = null;
    areaCellFills = new Map();
    areaGridGeo = null;
  },

  onPointerDown(ctx) {
    // Area mode: toggle cell tapping for interactive counting
    if (ctx.task.mode === "area" && areaGridGeo && ctx.phase === "interact") {
      const { startX, startY, cellSize, gridW, gridH, shape } = areaGridGeo;
      const col = Math.floor((ctx.x - startX) / cellSize);
      const row = Math.floor((ctx.y - startY) / cellSize);

      if (col >= 0 && col < gridW && row >= 0 && row < gridH) {
        // For triangle: skip cells outside shape
        if (shape === "triangle-right" && col > (gridH - 1 - row) * (gridW / gridH)) {
          return;
        }

        const idx = row * gridW + col;
        const newTapped = new Set(ctx.state.tappedCells);
        if (newTapped.has(idx)) {
          newTapped.delete(idx);
        } else {
          newTapped.add(idx);
        }
        ctx.setState({ tappedCells: newTapped });
      }
    }
  },

  buildScene(ctx) {
    return buildScene(ctx);
  },
});
