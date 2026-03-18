/**
 * Koordinatenlabor V2 — interactive module using defineModule() DSL.
 *
 * Modes:
 * - plot: Student taps the grid to place a point at target coordinates
 * - read: Point shown on grid, student enters coordinates via numpad
 * - path: Student taps grid points in sequence to draw a shape
 */

import { defineModule, DIFFICULTIES, type SceneContext, type TutorialStep } from "@app/module-framework";
import { vstack } from "@canvas/nodes/container";
import { text } from "@canvas/nodes/text";
import { custom } from "@canvas/nodes/custom";
import type { CanvasNode } from "@canvas/nodes/types";
import { getPalette } from "@core/design";
import { drawParchmentBg, drawCompassRose } from "@canvas/illustrations/treasure-map";
import {
  generatePlotTask,
  generateReadTask,
  nextPathShape,
  generateProceduralPath,
  gridToCanvas,
  canvasToGrid,
  isValidGridPoint,
  pointsEqual,
  checkPlotAnswer,
  checkReadAnswer,
  type PlotTask,
  type ReadTask,
  type PathTask,
  type GridPoint,
} from "./logic";

type CoordTask =
  | { mode: "plot"; data: PlotTask }
  | { mode: "read"; data: ReadTask }
  | { mode: "path"; data: PathTask };

interface CoordState {
  placedPoint: GridPoint | null;
  completedPoints: GridPoint[];
}

function getHints(task: CoordTask): string[] {
  switch (task.mode) {
    case "plot":
      return [
        `Finde den Punkt (${task.data.target.x}|${task.data.target.y}).`,
        `Gehe ${task.data.target.x} nach rechts und ${task.data.target.y} nach oben.`,
        `Der Punkt liegt bei (${task.data.target.x}|${task.data.target.y}).`,
        `Tippe genau auf x=${task.data.target.x}, y=${task.data.target.y} im Gitter.`,
      ];
    case "read":
      return [
        `Lies die Koordinaten des Punktes ab.`,
        `Zähle die Kästchen vom Ursprung.`,
        `Der Punkt liegt bei (${task.data.point.x}|${task.data.point.y}).`,
        `Gib zuerst ${task.data.point.x} ein (x-Wert), dann ${task.data.point.y} (y-Wert).`,
      ];
    case "path":
      return [
        `Zeichne die Form "${task.data.name}" nach.`,
        `Verbinde die Punkte in der richtigen Reihenfolge.`,
        `Klicke auf die Punkte: ${task.data.points.map(p => `(${p.x}|${p.y})`).join(" → ")}.`,
        `Der nächste Punkt ist (${task.data.points[task.data.nextIndex]?.x ?? "?"}|${task.data.points[task.data.nextIndex]?.y ?? "?"}). Tippe darauf.`,
      ];
  }
}

// Module-level mutable ref to store grid geometry after drawing,
// so onPointerDown can convert CSS pixel coords to grid coords.
let lastGridGeo: { originX: number; originY: number; cellSize: number } | null = null;

// Module-level hover state — shows crosshair + coordinate label on pointer move
let hoverGridPt: GridPoint | null = null;

function drawGrid(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  gridSize: number,
): { originX: number; originY: number; cellSize: number } {
  const palette = getPalette();
  const margin = Math.min(r.w, r.h) * 0.1;
  const available = Math.min(r.w - margin * 2, r.h - margin * 2);
  const cellSize = available / gridSize;
  const originX = r.x + margin;
  const originY = r.y + r.h - margin;

  // Parchment background
  drawParchmentBg(ctx, r.x, r.y, r.w, r.h, palette, 0.06);

  // Compass rose in top-right corner
  const roseSize = Math.min(r.w, r.h) * 0.12;
  drawCompassRose(ctx, r.x + r.w - roseSize * 0.7, r.y + roseSize * 0.7, roseSize, palette, 0.12);

  // Grid lines
  ctx.strokeStyle = palette.gridLine;
  ctx.lineWidth = 1;
  for (let i = 0; i <= gridSize; i++) {
    ctx.beginPath();
    ctx.moveTo(originX + i * cellSize, originY);
    ctx.lineTo(originX + i * cellSize, originY - gridSize * cellSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(originX, originY - i * cellSize);
    ctx.lineTo(originX + gridSize * cellSize, originY - i * cellSize);
    ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(originX + gridSize * cellSize, originY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(originX, originY - gridSize * cellSize);
  ctx.stroke();

  // Tick labels
  const font = `600 ${Math.max(10, cellSize * 0.35)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
  ctx.font = font;
  ctx.fillStyle = palette.canvasText;
  ctx.textAlign = "center";
  for (let i = 0; i <= gridSize; i++) {
    ctx.fillText(`${i}`, originX + i * cellSize, originY + cellSize * 0.5);
    if (i > 0) ctx.fillText(`${i}`, originX - cellSize * 0.4, originY - i * cellSize + 4);
  }

  // Axis labels: "x →" and "↑ y" so students know which axis is which
  const axisFont = `700 ${Math.max(13, cellSize * 0.45)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
  ctx.font = axisFont;
  ctx.fillStyle = palette.accent;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("x →", originX + gridSize * cellSize + cellSize * 0.3, originY);
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("↑ y", originX, originY - gridSize * cellSize - cellSize * 0.3);

  // Store geometry for pointer hit-testing
  lastGridGeo = { originX, originY, cellSize };

  // ── Hover crosshair + coordinate label ──
  if (hoverGridPt && isValidGridPoint(hoverGridPt, gridSize)) {
    const { cx: hx, cy: hy } = gridToCanvas(hoverGridPt, originX, originY, cellSize);

    // Dashed crosshair lines
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;

    // Vertical line from point down to x-axis
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx, originY);
    ctx.stroke();

    // Horizontal line from point left to y-axis
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(originX, hy);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Small dot at the hover intersection (no coordinate label — dashed lines suffice)
    ctx.beginPath();
    ctx.arc(hx, hy, cellSize * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  return { originX, originY, cellSize };
}

/** Draw a filled dot on the grid at the given point */
function drawDot(
  ctx: CanvasRenderingContext2D,
  point: GridPoint,
  originX: number,
  originY: number,
  cellSize: number,
  color: string,
  alpha = 1,
): void {
  const { cx, cy } = gridToCanvas(point, originX, originY, cellSize);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, cellSize * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Draw a checkmark inside a circle at the given point */
function drawCheckDot(
  ctx: CanvasRenderingContext2D,
  point: GridPoint,
  originX: number,
  originY: number,
  cellSize: number,
): void {
  const palette = getPalette();
  const { cx, cy } = gridToCanvas(point, originX, originY, cellSize);
  const r = cellSize * 0.35;

  // Green circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = palette.ok;
  ctx.fill();

  // White checkmark
  ctx.strokeStyle = palette.textOnAccent;
  ctx.lineWidth = Math.max(2, r * 0.25);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.35, cy);
  ctx.lineTo(cx - r * 0.05, cy + r * 0.3);
  ctx.lineTo(cx + r * 0.35, cy - r * 0.25);
  ctx.stroke();
}

function buildScene(ctx: SceneContext<CoordTask, CoordState>): CanvasNode {
  const { task, state, result } = ctx;
  const isCorrect = result?.correct === true;

  switch (task.mode) {
    case "plot":
      return vstack([
        text(
          isCorrect
            ? `Richtig! (${task.data.target.x}|${task.data.target.y})`
            : `Klicke auf (${task.data.target.x}|${task.data.target.y})`,
          { fontSize: "xl", bold: true },
        ),
        custom({
          id: "grid-plot",
          flex: 1,
          draw(drawCtx, r) {
            const geo = drawGrid(drawCtx, r, 10);
            const palette = getPalette();

            // Show placed point (student's tap) if it exists and not yet correct
            if (state.placedPoint && !isCorrect) {
              drawDot(drawCtx, state.placedPoint, geo.originX, geo.originY, geo.cellSize, palette.accent);
            }

            // After correct answer, show green checkmark dot at target
            if (isCorrect) {
              drawCheckDot(drawCtx, task.data.target, geo.originX, geo.originY, geo.cellSize);
            }
          },
        }),
      ], { gap: 8, padding: 16, align: "center" });

    case "read":
      return vstack([
        text("Welche Koordinaten hat der Punkt?", { fontSize: "xl", bold: true }),
        ...(isCorrect
          ? [text(`Richtig! (${task.data.point.x}|${task.data.point.y})`, { fontSize: "md", color: "ok" })]
          : []),
        ...(!isCorrect
          ? [text("Gib erst die x-Zahl ein, dann die y-Zahl. F\u00FCr den Punkt (3|5) tippst du 3, dann 5.", { fontSize: "sm", color: "canvasTextDim" })]
          : []),
        custom({
          id: "grid-read",
          flex: 1,
          draw(drawCtx, r) {
            const geo = drawGrid(drawCtx, r, 10);
            const palette = getPalette();

            // Always show the point the student needs to read
            if (isCorrect) {
              drawCheckDot(drawCtx, task.data.point, geo.originX, geo.originY, geo.cellSize);
            } else {
              drawDot(drawCtx, task.data.point, geo.originX, geo.originY, geo.cellSize, palette.canvasPrimary);
            }
          },
        }),
      ], { gap: 8, padding: 16, align: "center" });

    case "path": {
      const nextIdx = task.data.nextIndex;
      const totalPts = task.data.points.length;
      const pathDone = state.completedPoints.length >= totalPts;

      return vstack([
        text(`Zeichne: ${task.data.name}`, { fontSize: "xl", bold: true }),
        text(
          pathDone
            ? "Fertig! Alle Punkte verbunden."
            : `Punkt ${nextIdx + 1} von ${totalPts}: (${task.data.points[nextIdx]!.x}|${task.data.points[nextIdx]!.y})`,
          { fontSize: "sm", color: pathDone ? "ok" : "canvasTextDim" },
        ),
        custom({
          id: "grid-path",
          flex: 1,
          draw(drawCtx, r) {
            const geo = drawGrid(drawCtx, r, 10);
            const palette = getPalette();
            const colors = palette.faceColors;

            // Draw completed segments from state.completedPoints
            const completed = state.completedPoints;
            for (let i = 0; i < completed.length - 1; i++) {
              const from = gridToCanvas(completed[i]!, geo.originX, geo.originY, geo.cellSize);
              const to = gridToCanvas(completed[i + 1]!, geo.originX, geo.originY, geo.cellSize);
              drawCtx.beginPath();
              drawCtx.moveTo(from.cx, from.cy);
              drawCtx.lineTo(to.cx, to.cy);
              drawCtx.strokeStyle = colors[i % colors.length]!;
              drawCtx.lineWidth = 3;
              drawCtx.stroke();
            }

            // Draw completed points
            for (let i = 0; i < completed.length; i++) {
              drawCheckDot(drawCtx, completed[i]!, geo.originX, geo.originY, geo.cellSize);
            }

            // Highlight next target point (if not done)
            if (!pathDone && nextIdx < totalPts) {
              const target = task.data.points[nextIdx]!;
              drawDot(drawCtx, target, geo.originX, geo.originY, geo.cellSize, palette.accent, 0.4);
            }
          },
        }),
      ], { gap: 8, padding: 16, align: "center" });
    }
  }
}

export const coordinatesV2Registration = defineModule<CoordTask, CoordState>({
  id: "coordinates",
  label: "Koordinaten",
  icon: "📍",
  description: "Punkte im Koordinatensystem finden, ablesen und Formen zeichnen.",

  taskLabel(task) {
    switch (task.mode) {
      case "plot": return `Zeichne den Punkt (${task.data.target.x}|${task.data.target.y}) ein.`;
      case "read": return `Lies die Koordinaten des markierten Punktes ab.`;
      case "path": return `Zeichne die Form „${task.data.name}" nach.`;
    }
  },

  flowType: "task",
  celebrationIntensity: "subtle",
  autoAdvanceMs: 8000,
  input: (taskType) => taskType === "read" ? "numberPad" : "canvas",

  taskTypes: [
    { id: "plot", label: "Einzeichnen", icon: "📌" },
    { id: "read", label: "Ablesen", icon: "👁" },
    { id: "path", label: "Formen", icon: "✏️" },
  ],

  difficulties: DIFFICULTIES,

  tutorial: (taskType: string): TutorialStep[] => {
    const palette = getPalette();
    const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

    if (taskType === "read") {
      return [
        {
          title: "So geht's",
          text: "Lies die Koordinaten des Punktes ab: erst x (waagerecht), dann y (senkrecht).",
          mathBackground: "Ein Punkt hat zwei Koordinaten: x (waagerecht) und y (senkrecht). Man schreibt (x|y).",
          draw(ctx, w, h, p) {
            const margin = w * 0.12;
            const gridSize = 5;
            const available = Math.min(w - margin * 2, h * 0.7);
            const cellSize = available / gridSize;
            const ox = margin;
            const oy = h * 0.8;

            // Grid lines
            ctx.strokeStyle = palette.gridLine;
            ctx.lineWidth = 1;
            for (let i = 0; i <= gridSize; i++) {
              ctx.beginPath();
              ctx.moveTo(ox + i * cellSize, oy);
              ctx.lineTo(ox + i * cellSize, oy - gridSize * cellSize);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(ox, oy - i * cellSize);
              ctx.lineTo(ox + gridSize * cellSize, oy - i * cellSize);
              ctx.stroke();
            }

            // Axes
            ctx.strokeStyle = palette.canvasText;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(ox + gridSize * cellSize, oy);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(ox, oy - gridSize * cellSize);
            ctx.stroke();

            // Labels
            ctx.font = `600 ${cellSize * 0.35}px ${FONT}`;
            ctx.fillStyle = palette.canvasText;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            for (let i = 0; i <= gridSize; i++) {
              ctx.fillText(`${i}`, ox + i * cellSize, oy + 4);
            }

            // Point at (3, 4)
            const ptX = ox + 3 * cellSize;
            const ptY = oy - 4 * cellSize;
            ctx.beginPath();
            ctx.arc(ptX, ptY, cellSize * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = palette.accent;
            ctx.fill();

            // Animated crosshair
            if (p > 0.3) {
              ctx.setLineDash([4, 4]);
              ctx.strokeStyle = palette.accent;
              ctx.lineWidth = 1.5;
              ctx.globalAlpha = 0.6;
              const lineP = Math.min((p - 0.3) / 0.3, 1);
              // x-line
              ctx.beginPath();
              ctx.moveTo(ptX, ptY);
              ctx.lineTo(ptX, ptY + (oy - ptY) * lineP);
              ctx.stroke();
              // y-line
              ctx.beginPath();
              ctx.moveTo(ptX, ptY);
              ctx.lineTo(ptX - (ptX - ox) * lineP, ptY);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.globalAlpha = 1;
            }

            if (p > 0.7) {
              ctx.font = `700 ${h * 0.09}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("(3|4)", w * 0.75, h * 0.2);
            }
          },
          duration: 3000,
        },
      ];
    }

    if (taskType === "path") {
      return [
        {
          title: "So geht's",
          text: "Verbinde die Punkte der Reihe nach, um eine Form zu zeichnen.",
          mathBackground: "Tippe die Punkte in der richtigen Reihenfolge an. Die Koordinaten zeigen dir, wo der nächste Punkt liegt.",
          draw(ctx, w, h, p) {
            ctx.font = `700 ${h * 0.1}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = palette.canvasText;
            ctx.fillText("Zeichne ein Dreieck", w / 2, h * 0.12);

            // Three points forming a triangle
            const points = [
              { x: w * 0.3, y: h * 0.7 },
              { x: w * 0.7, y: h * 0.7 },
              { x: w * 0.5, y: h * 0.3 },
            ];

            // Draw lines with progress
            const totalSegments = 3;
            const segmentP = p * totalSegments;

            ctx.strokeStyle = palette.accent;
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            for (let i = 0; i < totalSegments; i++) {
              if (segmentP <= i) break;
              const from = points[i];
              const to = points[(i + 1) % points.length];
              const localP = Math.min(segmentP - i, 1);
              ctx.beginPath();
              ctx.moveTo(from.x, from.y);
              ctx.lineTo(from.x + (to.x - from.x) * localP, from.y + (to.y - from.y) * localP);
              ctx.stroke();
            }

            // Draw dots
            for (let i = 0; i < points.length; i++) {
              if (p * totalSegments > i) {
                ctx.beginPath();
                ctx.arc(points[i].x, points[i].y, 6, 0, Math.PI * 2);
                ctx.fillStyle = palette.ok;
                ctx.fill();
              }
            }
          },
          duration: 3000,
        },
      ];
    }

    // Default: plot
    return [
      {
        title: "So geht's",
        text: "Finde den Punkt im Koordinatensystem und tippe auf die richtige Stelle.",
        mathBackground: "Ein Punkt hat zwei Koordinaten: x (waagerecht) und y (senkrecht). Gehe erst nach rechts, dann nach oben.",
        draw(ctx, w, h, p) {
          const margin = w * 0.12;
          const gridSize = 5;
          const available = Math.min(w - margin * 2, h * 0.7);
          const cellSize = available / gridSize;
          const ox = margin;
          const oy = h * 0.8;

          // Grid lines
          ctx.strokeStyle = palette.gridLine;
          ctx.lineWidth = 1;
          for (let i = 0; i <= gridSize; i++) {
            ctx.beginPath();
            ctx.moveTo(ox + i * cellSize, oy);
            ctx.lineTo(ox + i * cellSize, oy - gridSize * cellSize);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(ox, oy - i * cellSize);
            ctx.lineTo(ox + gridSize * cellSize, oy - i * cellSize);
            ctx.stroke();
          }

          // Axes
          ctx.strokeStyle = palette.canvasText;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + gridSize * cellSize, oy);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox, oy - gridSize * cellSize);
          ctx.stroke();

          // Task label
          ctx.font = `700 ${h * 0.09}px ${FONT}`;
          ctx.fillStyle = palette.canvasText;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("Klicke auf (3|2)", w * 0.7, h * 0.1);

          // Animated: arrow moving right then up
          const ptX = ox + 3 * cellSize;
          const ptY = oy - 2 * cellSize;

          if (p > 0.1) {
            // Horizontal arrow (animated)
            const hP = Math.min((p - 0.1) / 0.35, 1);
            ctx.strokeStyle = palette.accent;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(ox + 3 * cellSize * hP, oy);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          if (p > 0.45) {
            // Vertical arrow (animated)
            const vP = Math.min((p - 0.45) / 0.35, 1);
            ctx.strokeStyle = palette.accent;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            ctx.moveTo(ptX, oy);
            ctx.lineTo(ptX, oy - 2 * cellSize * vP);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Final dot
          if (p > 0.8) {
            ctx.beginPath();
            ctx.arc(ptX, ptY, cellSize * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = palette.ok;
            ctx.fill();
          }
        },
        duration: 3000,
      },
    ];
  },

  generate(ctx) {
    const prev = ctx.previous as CoordTask | undefined;
    const diff = ctx.difficulty;
    switch (ctx.taskType) {
      case "plot": return { mode: "plot", data: generatePlotTask(prev?.mode === "plot" ? prev.data as PlotTask : undefined, diff) };
      case "read": return { mode: "read", data: generateReadTask(prev?.mode === "read" ? prev.data as ReadTask : undefined, diff) };
      case "path": {
        // 50% procedural, 50% fixed shapes
        if (Math.random() < 0.5) {
          const points = generateProceduralPath(diff);
          return { mode: "path", data: { name: "Zufallspfad", points, nextIndex: 0 } };
        }
        return { mode: "path", data: nextPathShape(diff) };
      }
      default: return { mode: "plot", data: generatePlotTask(undefined, diff) };
    }
  },

  check(task, answer) {
    if (task.mode === "plot") {
      const pt = answer as GridPoint;
      const correct = checkPlotAnswer(task.data.target, pt);
      return { correct, feedback: correct ? "Genau richtig!" : "Nicht ganz – zähle die Kästchen nochmal." };
    }
    if (task.mode === "read") {
      const pt = answer as GridPoint;
      const correct = checkReadAnswer(task.data.point, pt);
      return { correct, feedback: correct ? "Richtig abgelesen!" : "Schau nochmal genau hin." };
    }
    // Path mode: check individual point tap
    if (task.mode === "path") {
      const pt = answer as GridPoint;
      const target = task.data.points[task.data.nextIndex];
      if (!target) return { correct: true };
      const correct = pointsEqual(target, pt);
      return { correct, feedback: correct ? "Weiter so!" : "Das ist nicht der nächste Punkt." };
    }
    return { correct: true };
  },

  hints: getHints,

  getSolution(task) {
    if (task.mode === "plot") return { text: `(${task.data.target.x}|${task.data.target.y})` };
    if (task.mode === "read") return { text: `(${task.data.point.x}|${task.data.point.y})` };
    return { text: task.data.points.map(p => `(${p.x}|${p.y})`).join(" → ") };
  },

  initialState: () => ({ placedPoint: null, completedPoints: [] }),

  onActivate() {
    hoverGridPt = null;
  },

  onDeactivate() {
    hoverGridPt = null;
  },

  buildScene(ctx) {
    return buildScene(ctx);
  },

  onPointerMove(ctx) {
    if (!lastGridGeo) return;
    const { originX, originY, cellSize } = lastGridGeo;
    const gridPt = canvasToGrid(ctx.x, ctx.y, originX, originY, cellSize);

    // Only show hover for valid grid points
    if (isValidGridPoint(gridPt, 10)) {
      if (!hoverGridPt || hoverGridPt.x !== gridPt.x || hoverGridPt.y !== gridPt.y) {
        hoverGridPt = gridPt;
        ctx.invalidate();
      }
    } else if (hoverGridPt) {
      hoverGridPt = null;
      ctx.invalidate();
    }
  },

  onPointerDown(ctx) {
    if (!lastGridGeo) return;
    const { originX, originY, cellSize } = lastGridGeo;

    // Convert CSS pixel position to nearest grid point
    const gridPt = canvasToGrid(ctx.x, ctx.y, originX, originY, cellSize);

    // Validate: must be within grid bounds
    if (!isValidGridPoint(gridPt, 10)) return;

    const task = ctx.task;

    if (task.mode === "plot") {
      // Already answered correctly? Ignore taps
      if (ctx.state.placedPoint && ctx.submitAnswer(ctx.state.placedPoint)?.correct) return;

      // Place the point and submit
      ctx.setState({ placedPoint: gridPt });
      const result = ctx.submitAnswer(gridPt);

      // If correct, clear placedPoint (checkmark is shown via result)
      if (result?.correct) {
        ctx.setState({ placedPoint: null });
      }
    } else if (task.mode === "read") {
      // Read mode uses numpad, but also allow grid tap as answer
      ctx.submitAnswer(gridPt);
    } else if (task.mode === "path") {
      const target = task.data.points[task.data.nextIndex];
      if (!target) return;

      if (pointsEqual(target, gridPt)) {
        // Correct point tapped — add to completed and advance
        const newCompleted = [...ctx.state.completedPoints, gridPt];
        ctx.setState({ completedPoints: newCompleted });

        // Advance nextIndex on the task data (mutate — it's regenerated each task)
        task.data.nextIndex++;

        // Submit correct answer for feedback/sound
        ctx.submitAnswer(gridPt);

        // If all points done, rebuild to show finished state
        if (task.data.nextIndex >= task.data.points.length) {
          ctx.rebuildScene();
        }
      } else {
        // Wrong point — submit for feedback
        ctx.submitAnswer(gridPt);
      }
    }
  },
});
