/**
 * Symmetrie V2 — interactive brush-paint module using defineModule() DSL.
 *
 * Students paint answer cells on a grid to mirror/enlarge the source figure.
 * Uses createGridInteraction for pointer → grid coordinate conversion.
 */

import { defineModule, DIFFICULTIES } from "@app/module-framework";
import type { SceneContext, PointerContext, ModuleContext, TutorialStep } from "@app/module-framework";
import { vstack, hstack } from "@canvas/nodes/container";
import { text } from "@canvas/nodes/text";
import { button } from "@canvas/nodes/button";
import { custom } from "@canvas/nodes/custom";
import type { CanvasNode } from "@canvas/nodes/types";
import { getPalette } from "@core/design";
import { drawButterfly } from "@canvas/illustrations/butterfly";
import { gridKeyOf, gridParseKey } from "@core/utils";
import {
  createGridInteraction,
  type GridInteraction,
  type GridGeometry,
} from "@canvas/interactions/grid-tap";
import {
  computeExpected,
  checkAnswer,
  isInSourceRegion,
  isInAnswerRegion,
  SYMMETRY_TASKS,
  generateProceduralCells,
} from "./logic";
import type { SymmetryMode, CellKey } from "./types";

// ─── Task Definition ──────────────────────────────────────────────────────────

interface SymmetryTaskDef {
  mode: SymmetryMode;
  source: Set<CellKey>;
  expected: Set<CellKey>;
  gridSize: number;
  label: string;
}

interface SymState {
  answer: Set<CellKey>;
  undoStack: Set<CellKey>[];
  /** After check: cells that are correct (in both answer and expected) */
  matchingCells: Set<CellKey> | null;
  /** After check: cells that are wrong (in answer but not expected) */
  wrongCells: Set<CellKey> | null;
}

const MODE_LABELS: Record<SymmetryMode, string> = {
  "mirror-v": "Senkrecht spiegeln",
  "mirror-h": "Waagerecht spiegeln",
  "enlarge-2": "Vergrößern ×2",
  "enlarge-3": "Vergrößern ×3",
};

// ─── Module-level mutable refs ────────────────────────────────────────────────

let gridInteraction: GridInteraction | null = null;
let moduleCtx: ModuleContext<SymmetryTaskDef, SymState> | null = null;

/** Hover cell for mouse-only preview (suppressed on touch) */
let hoverCell: { x: number; y: number } | null = null;

/** Mutable callback refs for button onTap closures */
let onCheckRef: (() => void) | null = null;
let onResetRef: (() => void) | null = null;
let onUndoRef: (() => void) | null = null;

// ─── Task Generation ──────────────────────────────────────────────────────────

function pickTask(mode: SymmetryMode, difficulty: number = 1): SymmetryTaskDef {
  const gridSize = difficulty <= 1 ? 11 : 15;

  // 50% chance to use procedural generation for more variety
  if (Math.random() < 0.5) {
    const cellCount = difficulty <= 1
      ? 2 + Math.floor(Math.random() * 2)   // 2-3 cells (Junior)
      : difficulty === 2
        ? 3 + Math.floor(Math.random() * 3)   // 3-5 cells (Checker)
        : 4 + Math.floor(Math.random() * 4);  // 4-7 cells (BossBaby)
    const cells = generateProceduralCells(mode, gridSize, cellCount);
    const source = new Set<CellKey>(cells.map(([x, y]) => gridKeyOf(x, y)));
    const expected = computeExpected(source, mode, gridSize);
    return { mode, source, expected, gridSize, label: "Zufallsmuster" };
  }

  // Template-based (original logic)
  const matching = SYMMETRY_TASKS.filter((t) => t.mode === mode);
  let pool: typeof matching;
  if (difficulty <= 1) {
    pool = matching.filter((t) => t.cells.length <= 4);
    if (pool.length === 0) pool = matching;
  } else if (difficulty === 2) {
    pool = matching.filter((t) => t.cells.length <= 6);
    if (pool.length === 0) pool = matching;
  } else {
    pool = matching;
  }
  const pick = pool[Math.floor(Math.random() * pool.length)] ?? SYMMETRY_TASKS[0];
  const source = new Set<CellKey>(pick.cells.map(([x, y]) => gridKeyOf(x, y)));
  const expected = computeExpected(source, pick.mode, gridSize);
  return { mode: pick.mode, source, expected, gridSize, label: pick.label };
}

// ─── Grid Drawing ─────────────────────────────────────────────────────────────

function drawGrid(
  ctx: CanvasRenderingContext2D,
  task: SymmetryTaskDef,
  state: SymState,
  result: { correct: boolean } | null,
  ox: number,
  oy: number,
  cellSize: number,
): void {
  const palette = getPalette();
  const { gridSize, mode, source, expected } = task;
  const half = Math.floor(gridSize / 2);

  // Grid lines
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= gridSize; i++) {
    ctx.beginPath();
    ctx.moveTo(ox + i * cellSize, oy);
    ctx.lineTo(ox + i * cellSize, oy + gridSize * cellSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox, oy + i * cellSize);
    ctx.lineTo(ox + gridSize * cellSize, oy + i * cellSize);
    ctx.stroke();
  }

  // Highlight answer region border
  ctx.save();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.35;
  if (mode === "mirror-v" || mode.startsWith("enlarge")) {
    const regionX = ox + (half + 1) * cellSize;
    const regionW = (gridSize - half - 1) * cellSize;
    ctx.strokeRect(regionX, oy, regionW, gridSize * cellSize);
  } else {
    const regionY = oy + (half + 1) * cellSize;
    const regionH = (gridSize - half - 1) * cellSize;
    ctx.strokeRect(ox, regionY, gridSize * cellSize, regionH);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Axis line
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  if (mode === "mirror-v" || mode.startsWith("enlarge")) {
    const axisX = ox + half * cellSize + cellSize / 2;
    ctx.moveTo(axisX, oy);
    ctx.lineTo(axisX, oy + gridSize * cellSize);
  } else {
    const axisY = oy + half * cellSize + cellSize / 2;
    ctx.moveTo(ox, axisY);
    ctx.lineTo(ox + gridSize * cellSize, axisY);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Source cells
  for (const key of source) {
    const { x, y } = gridParseKey(key);
    ctx.fillStyle = palette.canvasPrimary;
    ctx.fillRect(ox + x * cellSize + 1, oy + y * cellSize + 1, cellSize - 2, cellSize - 2);
  }

  // Student answer cells — color-coded after check
  const hasCheckFeedback = state.matchingCells !== null;
  for (const key of state.answer) {
    const { x, y } = gridParseKey(key);
    if (hasCheckFeedback && state.wrongCells?.has(key)) {
      // Wrong cell — coral/error color
      ctx.fillStyle = palette.canvasError;
      ctx.globalAlpha = 0.65;
    } else if (hasCheckFeedback && state.matchingCells?.has(key)) {
      // Correct cell — success color
      ctx.fillStyle = palette.canvasSuccess;
      ctx.globalAlpha = 0.7;
    } else {
      // No check yet or neutral — accent
      ctx.fillStyle = palette.accent;
      ctx.globalAlpha = 0.7;
    }
    ctx.fillRect(ox + x * cellSize + 1, oy + y * cellSize + 1, cellSize - 2, cellSize - 2);
    ctx.globalAlpha = 1;
  }

  // Hover preview (mouse only) — semi-transparent accent highlight
  if (hoverCell && !hasCheckFeedback && !result?.correct) {
    const hKey = gridKeyOf(hoverCell.x, hoverCell.y);
    if (!state.answer.has(hKey) && !source.has(hKey)) {
      ctx.fillStyle = palette.accent;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(
        ox + hoverCell.x * cellSize + 1,
        oy + hoverCell.y * cellSize + 1,
        cellSize - 2, cellSize - 2,
      );
      ctx.globalAlpha = 1;
    }
  }

  // After correct check: show full expected overlay (green confirmation)
  if (result?.correct) {
    for (const key of expected) {
      const { x, y } = gridParseKey(key);
      ctx.fillStyle = palette.canvasSuccess;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(ox + x * cellSize + 1, oy + y * cellSize + 1, cellSize - 2, cellSize - 2);
      ctx.globalAlpha = 1;
    }
  }

  // Region labels
  ctx.font = `600 ${Math.max(10, cellSize * 0.8)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = palette.canvasTextDim;
  if (mode === "mirror-v" || mode.startsWith("enlarge")) {
    ctx.fillText("Vorlage", ox + (half / 2) * cellSize, oy - cellSize * 0.6);
    ctx.fillText("Antwort", ox + (half + half / 2 + 1) * cellSize, oy - cellSize * 0.6);
  } else {
    ctx.fillText("Vorlage", ox + gridSize * cellSize + cellSize * 2, oy + (half / 2) * cellSize);
    ctx.fillText("Antwort", ox + gridSize * cellSize + cellSize * 2, oy + (half + half / 2 + 1) * cellSize);
  }
}

// ─── Scene Building ───────────────────────────────────────────────────────────

function buildScene(ctx: SceneContext<SymmetryTaskDef, SymState>): CanvasNode {
  const { task, state, result } = ctx;

  return vstack([
    text(`${MODE_LABELS[task.mode]}: ${task.label}`, { fontSize: "xl", bold: true }),
    text(
      ctx.phase === "present" ? "Schau dir die Vorlage genau an." : "Male die fehlenden Felder aus.",
      { fontSize: "sm", color: "canvasTextDim" },
    ),
    custom({
      id: "symmetry-grid",
      flex: 1,
      draw(drawCtx, r) {
        const palette = getPalette();
        const maxCellW = (r.w * 0.9) / task.gridSize;
        const maxCellH = (r.h * 0.85) / task.gridSize;
        const cellSize = Math.min(maxCellW, maxCellH);
        const totalW = task.gridSize * cellSize;
        const totalH = task.gridSize * cellSize;
        const ox = r.x + (r.w - totalW) / 2;
        const oy = r.y + (r.h - totalH) / 2 + cellSize;

        // Butterfly illustration behind grid — fills with progress
        const completionRatio = task.expected.size > 0
          ? state.answer.size / task.expected.size
          : 0;
        drawButterfly(drawCtx, ox - totalW * 0.1, oy - totalH * 0.1, totalW * 1.2, totalH * 1.2, palette, {
          fillRatio: Math.min(1, completionRatio),
          alpha: 0.12,
        });

        drawGrid(drawCtx, task, state, result, ox, oy, cellSize);

        // Store grid geometry for pointer interaction
        if (gridInteraction) {
          gridInteraction.updateGeometry({
            originX: ox,
            originY: oy,
            cellSize,
            cols: task.gridSize,
            rows: task.gridSize,
          });
        }
      },
    }),
    ...(ctx.phase === "interact" ? [hstack([
      button("Rückgängig", {
        id: "sym-undo",
        variant: "secondary",
        onTap: () => onUndoRef?.(),
      }),
      button("Zurücksetzen", {
        id: "sym-reset",
        variant: "secondary",
        onTap: () => onResetRef?.(),
      }),
      button("Prüfen", {
        id: "sym-check",
        variant: "primary",
        onTap: () => onCheckRef?.(),
      }),
    ], { gap: 12, justify: "center" })] : []),
  ], { gap: 8, padding: 16, align: "center" });
}

// ─── Hints ────────────────────────────────────────────────────────────────────

function getHints(task: SymmetryTaskDef): string[] {
  switch (task.mode) {
    case "mirror-v":
      return [
        "Spiegle die Figur an der senkrechten Achse.",
        "Jede Zelle links der Achse hat ein Spiegelbild rechts.",
        `Die Figur „${task.label}" wird an der Mitte gespiegelt. Zähle die Abstände zur Achse.`,
        `Es fehlen noch ${task.expected.size} Zellen. Male sie im rechten Bereich aus.`,
      ];
    case "mirror-h":
      return [
        "Spiegle die Figur an der waagerechten Achse.",
        "Jede Zelle oberhalb der Achse hat ein Spiegelbild unterhalb.",
        `Die Figur „${task.label}" wird nach unten gespiegelt. Zähle die Abstände zur Achse.`,
        `Es fehlen noch ${task.expected.size} Zellen. Male sie im unteren Bereich aus.`,
      ];
    case "enlarge-2":
      return [
        "Vergrößere die Figur auf das Doppelte.",
        "Jede Zelle wird zu einem 2×2-Block.",
        `Die Figur „${task.label}" wird doppelt so groß. Jedes Kästchen wird zu 4 Kästchen.`,
        `Insgesamt müssen ${task.expected.size} Zellen ausgefüllt werden (${task.source.size} Quellzellen × 4).`,
      ];
    case "enlarge-3":
      return [
        "Vergrößere die Figur auf das Dreifache.",
        "Jede Zelle wird zu einem 3×3-Block.",
        `Die Figur „${task.label}" wird dreimal so groß. Jedes Kästchen wird zu 9 Kästchen.`,
        `Insgesamt müssen ${task.expected.size} Zellen ausgefüllt werden (${task.source.size} Quellzellen × 9).`,
      ];
  }
}

// ─── Module Registration ──────────────────────────────────────────────────────

export const symmetryV2Registration = defineModule<SymmetryTaskDef, SymState>({
  id: "symmetry",
  label: "Symmetrie",
  icon: "🦋",
  description: "Figuren spiegeln und vergrößern.",

  taskLabel(task) {
    if (task.mode.startsWith("enlarge")) {
      const factor = task.mode === "enlarge-2" ? "doppelte" : "dreifache";
      return `Vergrößere die Figur auf das ${factor}.`;
    }
    return task.mode === "mirror-v"
      ? "Spiegle die Figur senkrecht."
      : "Spiegle die Figur waagerecht.";
  },

  flowType: "task",
  celebrationIntensity: "subtle",
  autoAdvanceMs: 8000,
  input: "canvas",

  taskTypes: [
    { id: "mirror-v", label: "Senkrecht", icon: "↕" },
    { id: "mirror-h", label: "Waagerecht", icon: "↔" },
    { id: "enlarge-2", label: "×2", icon: "🔍" },
    { id: "enlarge-3", label: "×3", icon: "🔎" },
  ],

  difficulties: DIFFICULTIES,

  tutorial: (taskType: string): TutorialStep[] => {
    const palette = getPalette();
    const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

    const drawGrid = (ctx: CanvasRenderingContext2D, ox: number, oy: number, size: number, cols: number, rows: number) => {
      ctx.strokeStyle = palette.canvasTextDim;
      ctx.lineWidth = 1;
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(ox, oy + r * size);
        ctx.lineTo(ox + cols * size, oy + r * size);
        ctx.stroke();
      }
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(ox + c * size, oy);
        ctx.lineTo(ox + c * size, oy + rows * size);
        ctx.stroke();
      }
    };

    const fillCell = (ctx: CanvasRenderingContext2D, ox: number, oy: number, size: number, col: number, row: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(ox + col * size + 1, oy + row * size + 1, size - 2, size - 2);
    };

    if (taskType === "enlarge-2" || taskType === "enlarge-3") {
      const factor = taskType === "enlarge-2" ? 2 : 3;
      return [{
        title: "So geht's",
        text: `Vergrößere die Figur auf das ${factor}-fache. Jedes Feld wird zu einem ${factor}×${factor}-Block.`,
        mathBackground: `Vergrößern bedeutet: Jede Kante wird ${factor}× so lang. Die Fläche wird ${factor * factor}× so groß.`,
        draw(ctx, w, h, p) {
          const cs = Math.min(w * 0.06, h * 0.1);
          // Source: L-shape (3 cells)
          const srcOx = w * 0.15;
          const srcOy = h * 0.3;
          drawGrid(ctx, srcOx, srcOy, cs, 3, 3);
          const srcCells = [[0, 0], [0, 1], [1, 1]];
          for (const [c, r] of srcCells) {
            fillCell(ctx, srcOx, srcOy, cs, c, r, palette.accent);
          }

          // Arrow
          ctx.font = `${h * 0.15}px ${FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = palette.canvasText;
          ctx.fillText("→", w * 0.42, h * 0.5);

          // Target: enlarged
          const tgtOx = w * 0.52;
          const tgtOy = h * 0.15;
          const tgtSize = 3 * factor;
          drawGrid(ctx, tgtOx, tgtOy, cs, tgtSize, tgtSize);

          // Animated fill
          const cellsToFill: [number, number][] = [];
          for (const [c, r] of srcCells) {
            for (let dc = 0; dc < factor; dc++) {
              for (let dr = 0; dr < factor; dr++) {
                cellsToFill.push([c * factor + dc, r * factor + dr]);
              }
            }
          }
          const fillCount = Math.floor(p * cellsToFill.length);
          for (let i = 0; i < fillCount; i++) {
            fillCell(ctx, tgtOx, tgtOy, cs, cellsToFill[i][0], cellsToFill[i][1], palette.ok);
          }
        },
        duration: 2500,
      }];
    }

    if (taskType === "mirror-h") {
      return [{
        title: "So geht's",
        text: "Spiegle die Figur an der waagerechten Achse. Was oben ist, kommt nach unten.",
        mathBackground: "Waagerechte Spiegelung: Die x-Koordinate bleibt gleich, die y-Koordinate wird gespiegelt.",
        draw(ctx, w, h, p) {
          const cs = Math.min(w * 0.08, h * 0.08);
          const ox = w / 2 - 2.5 * cs;
          const oy = h * 0.1;
          drawGrid(ctx, ox, oy, cs, 5, 5);

          // Mirror line (horizontal, row 2.5)
          ctx.strokeStyle = palette.bad;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(ox, oy + 2.5 * cs);
          ctx.lineTo(ox + 5 * cs, oy + 2.5 * cs);
          ctx.stroke();
          ctx.setLineDash([]);

          // Source cells (top)
          const src = [[1, 0], [2, 0], [1, 1]];
          for (const [c, r] of src) fillCell(ctx, ox, oy, cs, c, r, palette.accent);

          // Animated mirror (bottom)
          const mirrored: [number, number][] = [[1, 4], [2, 4], [1, 3]];
          const fillCount = Math.floor(p * mirrored.length);
          for (let i = 0; i < fillCount; i++) {
            fillCell(ctx, ox, oy, cs, mirrored[i][0], mirrored[i][1], palette.ok);
          }
        },
        duration: 2000,
      }];
    }

    // Default: mirror-v
    return [{
      title: "So geht's",
      text: "Spiegle die Figur an der senkrechten Achse. Was links ist, kommt nach rechts.",
      mathBackground: "Senkrechte Spiegelung: Die y-Koordinate bleibt gleich, die x-Koordinate wird gespiegelt.",
      draw(ctx, w, h, p) {
        const cs = Math.min(w * 0.08, h * 0.08);
        const ox = w / 2 - 2.5 * cs;
        const oy = h * 0.1;
        drawGrid(ctx, ox, oy, cs, 5, 5);

        // Mirror line (vertical, col 2.5)
        ctx.strokeStyle = palette.bad;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(ox + 2.5 * cs, oy);
        ctx.lineTo(ox + 2.5 * cs, oy + 5 * cs);
        ctx.stroke();
        ctx.setLineDash([]);

        // Source cells (left)
        const src = [[0, 1], [1, 1], [1, 2]];
        for (const [c, r] of src) fillCell(ctx, ox, oy, cs, c, r, palette.accent);

        // Animated mirror (right)
        const mirrored: [number, number][] = [[4, 1], [3, 1], [3, 2]];
        const fillCount = Math.floor(p * mirrored.length);
        for (let i = 0; i < fillCount; i++) {
          fillCell(ctx, ox, oy, cs, mirrored[i][0], mirrored[i][1], palette.ok);
        }
      },
      duration: 2000,
    }];
  },

  generate(ctx) {
    const mode = (ctx.taskType ?? "mirror-v") as SymmetryMode;
    return pickTask(mode, ctx.difficulty ?? 1);
  },

  check(task, answer) {
    const answerSet = answer as Set<CellKey>;
    const result = checkAnswer(answerSet, task.expected);
    return {
      correct: result.correct,
      feedback: result.correct
        ? (task.mode.startsWith("enlarge") ? "Perfekt vergr\u00F6\u00DFert!" : "Perfekt gespiegelt!")
        : `Noch ${result.missing.size} Felder fehlen, ${result.wrong.size} sind falsch.`,
    };
  },

  hints: getHints,

  getSolution(task) {
    return { text: `${task.expected.size} Felder müssen ausgefüllt werden (${MODE_LABELS[task.mode]}).` };
  },

  initialState: () => ({
    answer: new Set<CellKey>(),
    undoStack: [],
    matchingCells: null,
    wrongCells: null,
  }),

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onActivate(ctx) {
    moduleCtx = ctx;

    // Create grid interaction with paint mode
    gridInteraction = createGridInteraction({
      paintMode: true,
      originX: 0,
      originY: 0,
      cellSize: 1,
      cols: ctx.task.gridSize,
      rows: ctx.task.gridSize,

      isCellFilled(col, row) {
        if (!moduleCtx) return false;
        return moduleCtx.state.answer.has(gridKeyOf(col, row));
      },

      onCellDrag(col, row, mode) {
        if (!moduleCtx) return;
        const task = moduleCtx.task;
        // Only allow painting in the answer region
        if (!isInAnswerRegion(col, row, task.mode, task.gridSize)) return;

        const key = gridKeyOf(col, row);
        moduleCtx.updateState((s) => {
          const next = new Set(s.answer);
          if (mode === "add") {
            next.add(key);
          } else {
            next.delete(key);
          }
          // Clear check feedback when user modifies answer
          return { ...s, answer: next, matchingCells: null, wrongCells: null };
        });
        moduleCtx.invalidate();
      },

      onEnd() {
        if (!moduleCtx) return;
        // Push current answer to undo stack on stroke end
        moduleCtx.updateState((s) => {
          const stack = [...s.undoStack, new Set(s.answer)];
          // Keep stack manageable
          if (stack.length > 50) stack.shift();
          return { ...s, undoStack: stack };
        });
      },
    });

    // Set up button callback refs
    onCheckRef = () => {
      if (!moduleCtx) return;
      // Compute matching/wrong before submitting (to store in state for visual feedback)
      const result = checkAnswer(moduleCtx.state.answer, moduleCtx.task.expected);
      moduleCtx.updateState((s) => ({
        ...s,
        matchingCells: result.matching,
        wrongCells: result.wrong,
      }));
      moduleCtx.submitAnswer(moduleCtx.state.answer);
    };

    onResetRef = () => {
      if (!moduleCtx) return;
      moduleCtx.updateState((s) => ({
        ...s,
        answer: new Set<CellKey>(),
        undoStack: [],
        matchingCells: null,
        wrongCells: null,
      }));
      moduleCtx.rebuildScene();
    };

    onUndoRef = () => {
      if (!moduleCtx) return;
      moduleCtx.updateState((s) => {
        if (s.undoStack.length === 0) return s;
        const stack = [...s.undoStack];
        const previous = stack.pop()!;
        return { ...s, answer: previous, undoStack: stack, matchingCells: null, wrongCells: null };
      });
      moduleCtx.invalidate();
    };
  },

  onDeactivate() {
    gridInteraction = null;
    moduleCtx = null;
    hoverCell = null;
    onCheckRef = null;
    onResetRef = null;
    onUndoRef = null;
  },

  // ─── Pointer Hooks ──────────────────────────────────────────────────────

  onPointerDown(ctx) {
    moduleCtx = ctx;
    gridInteraction?.handleDown(ctx.x, ctx.y);
  },

  onPointerMove(ctx) {
    moduleCtx = ctx;
    gridInteraction?.handleMove(ctx.x, ctx.y);

    // Hover preview — mouse only (no sticky hover on touch)
    if (ctx.pointerType === "mouse" && gridInteraction) {
      const geo = gridInteraction.getGeometry();
      if (geo.cellSize > 0) {
        const col = Math.floor((ctx.x - geo.originX) / geo.cellSize);
        const row = Math.floor((ctx.y - geo.originY) / geo.cellSize);
        const valid = col >= 0 && col < ctx.task.gridSize && row >= 0 && row < ctx.task.gridSize;
        const inAnswer = valid && isInAnswerRegion(col, row, ctx.task.mode, ctx.task.gridSize);
        if (inAnswer) {
          if (!hoverCell || hoverCell.x !== col || hoverCell.y !== row) {
            hoverCell = { x: col, y: row };
            ctx.invalidate();
          }
        } else if (hoverCell) {
          hoverCell = null;
          ctx.invalidate();
        }
      }
    }
  },

  onPointerUp(ctx) {
    moduleCtx = ctx;
    gridInteraction?.handleUp();
  },

  // ─── Scene ──────────────────────────────────────────────────────────────

  buildScene(ctx) {
    return buildScene(ctx);
  },
});
