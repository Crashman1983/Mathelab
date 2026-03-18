/**
 * Körper & Netze V2 — interactive net builder with 3D fold animation.
 *
 * Left half: 7×7 grid for painting net cells (tap/drag with createGridInteraction).
 * Right half: 3D preview with fold animation, opposite-face coloring, auto-rotation.
 * Students build a valid net by painting cells, then submit for checking.
 */

import { defineModule, DIFFICULTIES } from "@app/module-framework";
import type { SceneContext, PointerContext, ModuleContext, TutorialStep } from "@app/module-framework";
import { vstack, hstack } from "@canvas/nodes/container";
import { text } from "@canvas/nodes/text";
import { button } from "@canvas/nodes/button";
import { custom } from "@canvas/nodes/custom";
import type { CanvasNode } from "@canvas/nodes/types";
import { getPalette, EXPERIMENT_COLORS, resolveCanvasSpacing } from "@core/design";
import { gridKeyOf, gridParseKey, prefersReducedMotion } from "@core/utils";
import { playClickSound } from "@core/sounds";
import {
  createGridInteraction,
  type GridInteraction,
} from "@canvas/interactions/grid-tap";
import {
  createDragTracker,
  type DragTracker,
} from "@canvas/interactions/drag";
import {
  analyzeNet,
  netTemplates,
  findOppositePairs,
  computeCellFrames,
  type NetBody,
  type CellData,
  type CellKey,
  type FaceId,
} from "./logic";
import {
  buildFaceTransforms,
  buildFoldTree,
  mTransformPoint,
  mRotX,
  mRotY,
  mMul,
  easeInOutCubic,
  type Vec3,
} from "@canvas/math3d";

// ─── Constants ───────────────────────────────────────────────────────────────

const GRID_COLS = 7;
const GRID_ROWS = 7;

/** 3 distinct colors for the 3 opposite-face pairs */
const PAIR_COLORS = [
  EXPERIMENT_COLORS[0],  // blue
  EXPERIMENT_COLORS[2],  // yellow
  EXPERIMENT_COLORS[4],  // purple
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface NetTask {
  body: NetBody;
  templateId: string;
  label: string;
  /** Pre-filled cells for "present" phase (template preview) */
  templateCells: Map<CellKey, CellData>;
  /** Predict mode: which face is on the bottom (marked) */
  bottomFaceKey?: CellKey;
  /** Predict mode: the correct top face ID (answer) */
  correctTopFaceId?: FaceId;
}

/** Framework-managed state (only cells — things that affect scene structure). */
interface NetState {
  cells: Set<string>;
  /** Opposite-sides mode: the first cell selected (waiting for its pair) */
  selectedFace: CellKey | null;
  /** Opposite-sides mode: pairs identified by student [[a,b], ...] */
  identifiedPairs: [CellKey, CellKey][];
  /** Predict mode: which face the student tapped as "oben" */
  predictedFaceKey: CellKey | null;
}

// ─── Module-level mutable refs ───────────────────────────────────────────────

let gridInteraction: GridInteraction | null = null;
let dragTracker: DragTracker | null = null;
let moduleCtx: ModuleContext<NetTask, NetState> | null = null;

/** Mutable callback refs for button onTap closures */
let onCheckRef: (() => void) | null = null;
let onResetRef: (() => void) | null = null;
let onTemplateRef: (() => void) | null = null;
let onFoldRef: (() => void) | null = null;
let onOppResetRef: (() => void) | null = null;

/** Track right-half bounds for drag rotation hit-testing */
let rightHalfBounds = { x: 0, y: 0, w: 0, h: 0 };
/** Track whether we're dragging on the 3D side */
let isDragging3D = false;
/**
 * Always-current cell set, updated at the start of each buildScene().
 * Avoids stale-state reads from moduleCtx.state (which is frozen at
 * pointer-event spread time and becomes outdated after updateState).
 */
let latestCells: Set<string> = new Set();

/** Track current mode (opposite-sides vs net-building) */
let isOppositeMode = false;
/** Track predict mode */
let isPredictMode = false;

/** Hint fold animation: fold→spin→unfold in opposite mode */
let hintFoldActive = false;

/** Animation frame ID for fold/spin loop */
let animFrameId = 0;

/**
 * Animation state — mutated directly, not through framework updateState.
 * This avoids the expensive rebuildScene() on every animation frame.
 * The draw() function reads these directly.
 */
let animState = {
  fold: 0,
  foldTarget: 0,
  foldStart: 0,       // fold value when animation began
  foldStartTime: 0,   // performance.now() when fold was triggered
  rotation: { x: -0.5, y: 0.6 },
  autoSpin: false,
};

/** Duration of fold/unfold animation in ms */
const FOLD_DURATION_MS = 2400;

function resetAnimState(): void {
  animState.fold = 0;
  animState.foldTarget = 0;
  animState.foldStart = 0;
  animState.foldStartTime = 0;
  animState.autoSpin = false;
}

// ─── Task Generation ─────────────────────────────────────────────────────────

function pickTemplate(body: NetBody): NetTask {
  const templates = netTemplates().filter((t) => t.body === body);
  const pick = templates[Math.floor(Math.random() * templates.length)] ?? templates[0];

  const cells = new Map<CellKey, CellData>();
  pick.cells.forEach(([x, y], i) => {
    const key = gridKeyOf(x, y);
    cells.set(key, { color: EXPERIMENT_COLORS[i % EXPERIMENT_COLORS.length], id: (i + 1) as FaceId });
  });

  return {
    body: pick.body,
    templateId: pick.id,
    label: pick.label,
    templateCells: cells,
  };
}

// ─── Helpers: CellData from painted cells ────────────────────────────────────

function cellsToMap(cells: Set<string>): Map<CellKey, CellData> {
  const result = new Map<CellKey, CellData>();
  let idx = 0;
  for (const key of cells) {
    result.set(key, {
      color: EXPERIMENT_COLORS[idx % EXPERIMENT_COLORS.length],
      id: (idx + 1) as FaceId,
    });
    idx++;
  }
  return result;
}

/**
 * Build a color map where opposite faces share the same color.
 * Falls back to sequential coloring for incomplete nets.
 */
function cellsToOppositeColorMap(cells: Set<string>): Map<CellKey, CellData> {
  const base = cellsToMap(cells);
  if (cells.size !== 6) return base;

  const pairs = findOppositePairs(base);
  if (pairs.length !== 3) return base;

  // Assign pair colors
  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i];
    const color = PAIR_COLORS[i];
    const dataA = base.get(a);
    const dataB = base.get(b);
    if (dataA) base.set(a, { ...dataA, color });
    if (dataB) base.set(b, { ...dataB, color });
  }
  return base;
}

// ─── Animation Loop ─────────────────────────────────────────────────────────

function startAnimLoop(): void {
  // Reduced-motion: jump to end state immediately (WCAG 2.3.1)
  if (prefersReducedMotion()) {
    animState.fold = animState.foldTarget;
    if (animState.foldTarget === 1) animState.autoSpin = false;
    moduleCtx?.invalidate();
    return;
  }

  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = 0; }
  const tick = () => {
    if (!moduleCtx) { animFrameId = 0; return; }
    let stillAnimating = false;

    // Fold animation — easeInOut with fixed duration
    const foldDiff = animState.foldTarget - animState.fold;
    if (Math.abs(foldDiff) > 0.001 && animState.foldStartTime > 0) {
      const elapsed = performance.now() - animState.foldStartTime;
      const t = Math.min(elapsed / FOLD_DURATION_MS, 1);
      const eased = easeInOutCubic(t);
      animState.fold = animState.foldStart + (animState.foldTarget - animState.foldStart) * eased;
      stillAnimating = true;

      // Complete: snap + activate auto-spin
      if (t >= 1) {
        animState.fold = animState.foldTarget;
        animState.foldStartTime = 0;
        if (animState.foldTarget === 1) {
          animState.autoSpin = true;
        }
      }
    } else if (Math.abs(foldDiff) > 0) {
      // Snap to target
      animState.fold = animState.foldTarget;
      animState.foldStartTime = 0;
      if (animState.foldTarget === 1) {
        animState.autoSpin = true;
      }
    }

    // Auto-rotation — spins around Y axis, preserves user's X tilt
    if (animState.autoSpin) {
      animState.rotation.y += 0.012;
      stillAnimating = true;
    }

    // Re-render with updated animation values
    moduleCtx.invalidate();

    if (stillAnimating) {
      animFrameId = requestAnimationFrame(tick);
    } else {
      animFrameId = 0;
    }
  };
  animFrameId = requestAnimationFrame(tick);
}

function stopAnimLoop(): void {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = 0;
  }
}

// ─── 3D Rendering with Fold ─────────────────────────────────────────────────

function projectView(
  p: Vec3,
  rotXAngle: number, rotYAngle: number,
  scale: number,
): { px: number; py: number; depth: number } {
  const viewMat = mMul(mRotX(rotXAngle), mRotY(rotYAngle));
  const v = mTransformPoint(viewMat, p);
  const perspective = 1 + v.z * 0.15;
  return {
    px: v.x * scale / perspective,
    py: v.y * scale / perspective,
    depth: v.z,
  };
}

/** Unit square corners for each face (CW winding for front-face culling) */
const FACE_CORNERS: Vec3[] = [
  { x: -0.5, y: -0.5, z: 0 },
  { x: -0.5, y: 0.5, z: 0 },
  { x: 0.5, y: 0.5, z: 0 },
  { x: 0.5, y: -0.5, z: 0 },
];

function draw3DFolding(
  ctx: CanvasRenderingContext2D,
  cells: Set<string>,
  rotation: { x: number; y: number },
  fold: number,
  cx: number, cy: number,
  size: number,
): void {
  const palette = getPalette();
  // Scale up as net folds — flat net spans ~4 units, cube spans ~1 unit
  // At fold=0: flat net fills ~50% of preview area
  // At fold=1: cube fills ~65% — center-rotation keeps bounds tight
  const foldScale = 1 + fold * 1.6;
  const scale = size * 0.18 * foldScale;
  const cellMap = cellsToOppositeColorMap(cells);

  if (cells.size === 0) return;

  // Compute fold transforms for each cell
  const angleRad = fold * Math.PI / 2;
  const transforms = buildFaceTransforms(cellMap, angleRad);

  // ── Centroid: rotate around the center of mass, not a corner ──
  // Compute the centroid of all face centers in world space so the
  // view rotation orbits the middle of the shape (flat net or cube).
  let centroid: Vec3 = { x: 0, y: 0, z: 0 };
  let count = 0;
  for (const [, mat] of transforms) {
    // Face center = transform of (0,0,0)
    const c = mTransformPoint(mat, { x: 0, y: 0, z: 0 });
    centroid.x += c.x;
    centroid.y += c.y;
    centroid.z += c.z;
    count++;
  }
  if (count > 0) {
    centroid.x /= count;
    centroid.y /= count;
    centroid.z /= count;
  }

  // Build face render data
  const isFolding = fold > 0.01 && fold < 0.99;
  const faces: Array<{
    key: CellKey;
    projected: Array<{ px: number; py: number }>;
    depth: number;
    color: string;
    id: FaceId;
    backFace: boolean;
  }> = [];

  for (const [key, mat] of transforms) {
    const data = cellMap.get(key);
    if (!data) continue;

    // Transform each corner through fold matrix, center around centroid,
    // then apply view rotation — rotation now orbits the shape's center
    const projectedCorners = FACE_CORNERS.map((corner) => {
      const world = mTransformPoint(mat, corner);
      const centered: Vec3 = {
        x: world.x - centroid.x,
        y: world.y - centroid.y,
        z: world.z - centroid.z,
      };
      return projectView(centered, rotation.x, rotation.y, scale);
    });

    // Average depth for painter's algorithm
    const avgDepth = projectedCorners.reduce((s, p) => s + p.depth, 0) / 4;

    // Back-face detection via screen-space cross product
    const v1x = projectedCorners[1].px - projectedCorners[0].px;
    const v1y = projectedCorners[1].py - projectedCorners[0].py;
    const v2x = projectedCorners[3].px - projectedCorners[0].px;
    const v2y = projectedCorners[3].py - projectedCorners[0].py;
    const cross = v1x * v2y - v1y * v2x;
    const isBackFace = cross > 0;

    // When fully folded: cull back-faces (standard cube rendering).
    // During fold animation: show all faces — back-faces drawn darker.
    if (isBackFace && !isFolding) continue;

    faces.push({
      key,
      projected: projectedCorners,
      depth: avgDepth,
      color: data.color,
      id: data.id,
      backFace: isBackFace,
    });
  }

  // Sort back-to-front
  faces.sort((a, b) => a.depth - b.depth);

  // ── Pass 1: Fill faces at full opacity ──
  // Slight polygon expansion (0.6px outward from centroid) eliminates
  // anti-aliasing gaps between adjacent faces sharing an edge.
  for (const face of faces) {
    const fcx = face.projected.reduce((s, p) => s + p.px, 0) / 4;
    const fcy = face.projected.reduce((s, p) => s + p.py, 0) / 4;
    ctx.beginPath();
    for (let i = 0; i < face.projected.length; i++) {
      const dx = face.projected[i].px - fcx;
      const dy = face.projected[i].py - fcy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ex = cx + face.projected[i].px + (dx / len) * 0.6;
      const ey = cy + face.projected[i].py + (dy / len) * 0.6;
      if (i === 0) ctx.moveTo(ex, ey); else ctx.lineTo(ex, ey);
    }
    ctx.closePath();
    if (face.backFace) {
      // Back-faces during fold: darken to distinguish from front
      ctx.fillStyle = face.color;
      ctx.globalAlpha = 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = face.color;
      ctx.fill();
    }
  }

  // ── Pass 2: Wireframe edges on top ──
  for (const face of faces) {
    ctx.beginPath();
    ctx.moveTo(cx + face.projected[0].px, cy + face.projected[0].py);
    for (let i = 1; i < face.projected.length; i++) {
      ctx.lineTo(cx + face.projected[i].px, cy + face.projected[i].py);
    }
    ctx.closePath();
    ctx.strokeStyle = palette.canvasText;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ── Pass 3: Face number labels (only when mostly folded or flat) ──
  if (fold < 0.1 || fold > 0.9) {
    for (const face of faces) {
      const centerX = face.projected.reduce((s, p) => s + p.px, 0) / 4;
      const centerY = face.projected.reduce((s, p) => s + p.py, 0) / 4;
      const faceW = Math.abs(face.projected[1].px - face.projected[0].px);
      const faceH = Math.abs(face.projected[3].py - face.projected[0].py);
      const faceSize = Math.max(faceW, faceH);
      if (faceSize > 20) {
        ctx.font = `700 ${Math.max(10, faceSize * 0.35)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        ctx.fillStyle = palette.canvasText;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${face.id}`, cx + centerX, cy + centerY);
      }
    }
  }

  // ── Pass 4: Fold hinge axes (visible during fold animation) ──
  if (isFolding) {
    const tree = buildFoldTree(cellMap);
    if (tree) {
    ctx.save();
    ctx.strokeStyle = palette.warn;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.globalAlpha = Math.min(1, 2 * (1 - fold)); // Fade out as fold completes

    const edgeEndpoints: Record<string, [Vec3, Vec3]> = {
      "1,0":  [{ x: 0.5, y: -0.5, z: 0 }, { x: 0.5, y: 0.5, z: 0 }],  // right edge
      "-1,0": [{ x: -0.5, y: -0.5, z: 0 }, { x: -0.5, y: 0.5, z: 0 }], // left edge
      "0,1":  [{ x: -0.5, y: 0.5, z: 0 }, { x: 0.5, y: 0.5, z: 0 }],   // bottom edge
      "0,-1": [{ x: -0.5, y: -0.5, z: 0 }, { x: 0.5, y: -0.5, z: 0 }], // top edge
    };

    for (const [parentKey, children] of tree.children) {
      const parentMat = transforms.get(parentKey);
      if (!parentMat) continue;
      for (const fc of children) {
        const endpoints = edgeEndpoints[`${fc.dx},${fc.dy}`];
        if (!endpoints) continue;
        const [e0, e1] = endpoints;
        const w0 = mTransformPoint(parentMat, e0);
        const w1 = mTransformPoint(parentMat, e1);
        const p0 = projectView(
          { x: w0.x - centroid.x, y: w0.y - centroid.y, z: w0.z - centroid.z },
          rotation.x, rotation.y, scale,
        );
        const p1 = projectView(
          { x: w1.x - centroid.x, y: w1.y - centroid.y, z: w1.z - centroid.z },
          rotation.x, rotation.y, scale,
        );
        ctx.beginPath();
        ctx.moveTo(cx + p0.px, cy + p0.py);
        ctx.lineTo(cx + p1.px, cy + p1.py);
        ctx.stroke();
      }
    }
    ctx.restore();
    } // if (tree)
  } // if (isFolding)
}

// ─── Grid Drawing ────────────────────────────────────────────────────────────

function drawNetGrid(
  ctx: CanvasRenderingContext2D,
  cells: Set<string>,
  templateCells: Map<CellKey, CellData> | null,
  phase: "present" | "interact",
  ox: number,
  oy: number,
  cellSize: number,
): void {
  const palette = getPalette();
  const displayCells = phase === "present" && templateCells
    ? new Set(templateCells.keys())
    : cells;
  const colorMap = phase === "present" && templateCells
    ? templateCells
    : cellsToOppositeColorMap(cells);

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const key = gridKeyOf(col, row);
      const px = ox + col * cellSize;
      const py = oy + row * cellSize;

      if (displayCells.has(key)) {
        // Filled cell
        const data = colorMap.get(key);
        ctx.fillStyle = data?.color ?? palette.accent;
        ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);

        // Face number
        if (data) {
          ctx.fillStyle = palette.canvasText;
          ctx.font = `700 ${Math.max(12, cellSize * 0.4)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${data.id}`, px + cellSize / 2, py + cellSize / 2);
        }
      } else {
        // Empty cell
        ctx.fillStyle = palette.panelSoft;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(px, py, cellSize, cellSize);
        ctx.globalAlpha = 1;
      }

      // Cell border
      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px, py, cellSize, cellSize);
    }
  }
}

// ─── Scene Building ──────────────────────────────────────────────────────────

function buildNetScene(ctx: SceneContext<NetTask, NetState>): CanvasNode {
  const { task, state, result, phase } = ctx;
  const bodyLabel = task.body === "cube" ? "Würfelnetz" : "Quadernetz";

  // Sync module-level cell reference so isCellFilled always reads current state
  latestCells = state.cells;

  // Reset animation when transitioning from present → interact (teacher clicked "Starten")
  if (phase === "interact" && animState.fold === 1 && state.cells.size === 0) {
    resetAnimState();
    stopAnimLoop();
  }

  // Analyze the current cells for status text
  const cellMap = cellsToMap(state.cells);
  const analysis = analyzeNet(cellMap, task.body);
  const canFold = analysis.faceCount === 6 && analysis.connected;

  const statusText = result
    ? (result.correct ? "G\u00FCltiges Netz!" : (result.feedback ?? "Kein g\u00FCltiges Netz."))
    : phase === "present"
      ? `Vorlage: ${task.label}`
      : `${analysis.faceCount}/6 Fl\u00E4chen \u00B7 ${analysis.connected ? "zusammenh\u00E4ngend" : "nicht zusammenh\u00E4ngend"}`;

  const statusColor = result
    ? (result.correct ? "canvasSuccess" : "canvasError")
    : "canvasTextDim";

  const isFolded = animState.foldTarget === 1;
  const foldLabel = isFolded ? "\u25C0 Auffalten" : "\u25B6 Falten";

  return vstack([
    text(`${bodyLabel} bauen`, { fontSize: "xl", bold: true }),
    text(statusText, { fontSize: "sm", color: statusColor }),
    // Main area: left grid + right 3D preview
    custom({
      id: "net-split",
      flex: 1,
      draw(drawCtx, r) {
        const sp = resolveCanvasSpacing(r.w);
        const halfW = Math.floor(r.w / 2);

        // ── Left half: net grid ──
        const gridArea = { x: r.x, y: r.y, w: halfW - sp.xs, h: r.h };
        const maxCellW = (gridArea.w * 0.85) / GRID_COLS;
        const maxCellH = (gridArea.h * 0.85) / GRID_ROWS;
        const cellSize = Math.min(maxCellW, maxCellH, sp.xl);
        const totalW = GRID_COLS * cellSize;
        const totalH = GRID_ROWS * cellSize;
        const ox = gridArea.x + (gridArea.w - totalW) / 2;
        const oy = gridArea.y + (gridArea.h - totalH) / 2;

        // Grid label
        const palette = getPalette();
        drawCtx.fillStyle = palette.canvasTextDim;
        drawCtx.font = `600 ${Math.max(11, cellSize * 0.35)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        drawCtx.textAlign = "center";
        drawCtx.textBaseline = "bottom";
        drawCtx.fillText(
          phase === "present" ? "Vorlage" : "Netz bauen (tippen/ziehen)",
          ox + totalW / 2,
          oy - sp.xs,
        );

        // Draw grid — always use state.cells from buildScene closure.
        // moduleCtx.state is stale (spread evaluates getter once at pointer-event time).
        const templateForPresent = phase === "present" ? task.templateCells : null;
        drawNetGrid(drawCtx, state.cells, templateForPresent, phase, ox, oy, cellSize);

        // Update grid interaction geometry
        if (gridInteraction) {
          gridInteraction.updateGeometry({
            originX: ox,
            originY: oy,
            cellSize,
            cols: GRID_COLS,
            rows: GRID_ROWS,
          });
        }

        // ── Divider ──
        drawCtx.strokeStyle = palette.line;
        drawCtx.lineWidth = 1;
        drawCtx.beginPath();
        drawCtx.moveTo(r.x + halfW, r.y + sp.sm);
        drawCtx.lineTo(r.x + halfW, r.y + r.h - sp.sm);
        drawCtx.stroke();

        // ── Right half: 3D preview ──
        const rightX = r.x + halfW + sp.xs;
        const rightW = r.w - halfW - sp.xs;
        rightHalfBounds = { x: rightX, y: r.y, w: rightW, h: r.h };

        const previewCx = rightX + rightW / 2;
        // Offset center slightly down to compensate for top-down view angle
        const previewCy = r.y + r.h * 0.52;
        // Size driven by available space — center-rotation keeps bounds tight
        const previewSize = Math.min(rightW * 0.85, r.h * 0.85);

        // 3D label
        drawCtx.fillStyle = palette.canvasTextDim;
        drawCtx.font = `600 ${Math.max(11, cellSize * 0.35)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        drawCtx.textAlign = "center";
        drawCtx.textBaseline = "bottom";
        drawCtx.fillText("3D-Vorschau (ziehen zum Drehen)", previewCx, r.y + sp.sm);

        // 3D preview cells — use state.cells from closure (same as grid)
        const previewCells = phase === "present"
          ? new Set(task.templateCells.keys())
          : state.cells;

        // Clip 3D rendering to right half — safety net for extreme rotation angles
        drawCtx.save();
        drawCtx.beginPath();
        drawCtx.rect(rightX, r.y, rightW, r.h);
        drawCtx.clip();
        draw3DFolding(drawCtx, previewCells, animState.rotation, animState.fold, previewCx, previewCy, previewSize);
        drawCtx.restore();
      },
    }),
    // Buttons (only in interact phase)
    ...(phase === "interact" ? [
      hstack([
        button("Beispiel laden", {
          id: "net-template",
          variant: "secondary",
          onTap: () => onTemplateRef?.(),
        }),
        ...(canFold ? [button(foldLabel, {
          id: "net-fold",
          variant: "secondary",
          onTap: () => onFoldRef?.(),
        })] : []),
        button("Zur\u00FCcksetzen", {
          id: "net-reset",
          variant: "secondary",
          onTap: () => onResetRef?.(),
        }),
        button("Pr\u00FCfen", {
          id: "net-check",
          variant: "primary",
          onTap: () => onCheckRef?.(),
        }),
      ], { gap: 12, justify: "center" }),
    ] : []),
  ], { gap: 8, padding: 16, align: "center" });
}

// ─── Opposite-Sides Scene ─────────────────────────────────────────────────────

function buildOppositeScene(ctx: SceneContext<NetTask, NetState>): CanvasNode {
  const { task, state, result, phase } = ctx;
  const answered = result?.correct === true;

  // In opposite mode, show the template net and let students tap pairs
  const pairsFound = state.identifiedPairs.length;
  const statusText = answered
    ? "Alle Gegenpaare richtig!"
    : state.selectedFace
      ? `Fl\u00E4che ausgew\u00E4hlt \u2014 tippe auf die gegen\u00FCberliegende! (${pairsFound}/3 Paare)`
      : `Tippe 2 gegen\u00FCberliegende Fl\u00E4chen an. (${pairsFound}/3 Paare)`;

  // Build color map: paired cells share color, selected cell highlighted
  const pairedColors = new Map<CellKey, string>();
  for (let i = 0; i < state.identifiedPairs.length; i++) {
    const [a, b] = state.identifiedPairs[i];
    const color = PAIR_COLORS[i % PAIR_COLORS.length];
    pairedColors.set(a, color);
    pairedColors.set(b, color);
  }

  return vstack([
    text("Gegen\u00FCberliegende Seiten finden", { fontSize: "xl", bold: true }),
    text(statusText, {
      fontSize: "sm",
      color: answered ? "canvasSuccess" : "canvasTextDim",
    }),
    custom({
      id: "opposite-grid",
      flex: 1,
      draw(drawCtx, r) {
        const palette = getPalette();
        const sp = resolveCanvasSpacing(r.w);

        // When hint fold is active, split into grid (left) + 3D preview (right)
        const showFold3D = hintFoldActive;
        const gridAreaW = showFold3D ? Math.floor(r.w / 2) - sp.xs : r.w;

        // Draw the template net
        const maxCellW = (gridAreaW * 0.7) / GRID_COLS;
        const maxCellH = (r.h * 0.8) / GRID_ROWS;
        const cellSize = Math.min(maxCellW, maxCellH, sp.xl);
        const totalW = GRID_COLS * cellSize;
        const totalH = GRID_ROWS * cellSize;
        const ox = r.x + (gridAreaW - totalW) / 2;
        const oy = r.y + (r.h - totalH) / 2;

        // Draw grid
        const templateKeys = new Set(task.templateCells.keys());
        for (let row = 0; row < GRID_ROWS; row++) {
          for (let col = 0; col < GRID_COLS; col++) {
            const key = gridKeyOf(col, row);
            const px = ox + col * cellSize;
            const py = oy + row * cellSize;

            if (templateKeys.has(key)) {
              const data = task.templateCells.get(key);
              // Use paired color if assigned, otherwise default
              const pairColor = pairedColors.get(key);
              if (pairColor) {
                drawCtx.fillStyle = pairColor;
              } else {
                drawCtx.fillStyle = palette.panelSoft;
              }
              drawCtx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);

              // Selected face highlight — ring outline
              if (state.selectedFace === key) {
                drawCtx.strokeStyle = palette.accent;
                drawCtx.lineWidth = 3;
                drawCtx.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
              }

              // Face number
              if (data) {
                drawCtx.fillStyle = palette.canvasText;
                drawCtx.font = `700 ${Math.max(14, cellSize * 0.45)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
                drawCtx.textAlign = "center";
                drawCtx.textBaseline = "middle";
                drawCtx.fillText(`${data.id}`, px + cellSize / 2, py + cellSize / 2);
              }
            } else {
              // Empty cell — very subtle background
              drawCtx.fillStyle = palette.panelSoft;
              drawCtx.globalAlpha = 0.1;
              drawCtx.fillRect(px, py, cellSize, cellSize);
              drawCtx.globalAlpha = 1;
            }

            // Grid line
            drawCtx.strokeStyle = palette.line;
            drawCtx.lineWidth = 0.5;
            drawCtx.strokeRect(px, py, cellSize, cellSize);
          }
        }

        // 3D fold preview (hint animation)
        if (showFold3D) {
          const halfW = Math.floor(r.w / 2);
          // Divider
          drawCtx.strokeStyle = palette.line;
          drawCtx.lineWidth = 1;
          drawCtx.beginPath();
          drawCtx.moveTo(r.x + halfW, r.y + sp.sm);
          drawCtx.lineTo(r.x + halfW, r.y + r.h - sp.sm);
          drawCtx.stroke();

          // 3D preview
          const rightX = r.x + halfW + sp.xs;
          const rightW = r.w - halfW - sp.xs;
          const previewCx = rightX + rightW / 2;
          const previewCy = r.y + r.h * 0.52;
          const previewSize = Math.min(rightW * 0.85, r.h * 0.85);

          drawCtx.save();
          drawCtx.beginPath();
          drawCtx.rect(rightX, r.y, rightW, r.h);
          drawCtx.clip();
          draw3DFolding(
            drawCtx,
            new Set(task.templateCells.keys()),
            animState.rotation,
            animState.fold,
            previewCx,
            previewCy,
            previewSize,
          );
          drawCtx.restore();
        }

        // Update grid interaction geometry for tap detection
        if (gridInteraction) {
          gridInteraction.updateGeometry({
            originX: ox,
            originY: oy,
            cellSize,
            cols: GRID_COLS,
            rows: GRID_ROWS,
          });
        }
      },
    }),
    // Buttons
    ...(phase === "interact" && !answered ? [hstack([
      button("Zur\u00FCcksetzen", {
        id: "opp-reset",
        variant: "secondary",
        onTap: () => onOppResetRef?.(),
      }),
      ...(pairsFound === 3 ? [button("Pr\u00FCfen", {
        id: "opp-check",
        variant: "primary",
        onTap: () => onCheckRef?.(),
      })] : []),
    ], { gap: 12, justify: "center" })] : []),
  ], { gap: 8, padding: 16, align: "center" });
}

// ─── Predict Scene ──────────────────────────────────────────────────────────

/** Callback ref for predict-mode tap on a face */
let onPredictTapRef: ((key: CellKey) => void) | null = null;

function buildPredictScene(ctx: SceneContext<NetTask, NetState>): CanvasNode {
  const { task, state, phase } = ctx;
  const answered = ctx.result !== null;
  const palette = getPalette();
  const cellMap = task.templateCells;
  const bottomKey = task.bottomFaceKey;
  const bottomData = bottomKey ? cellMap.get(bottomKey) : undefined;
  const predictedKey = state.predictedFaceKey;

  // Status text
  const statusText = answered
    ? (ctx.result?.correct ? "Richtig!" : `Fläche ${task.correctTopFaceId} liegt oben.`)
    : predictedKey
      ? "Tippe auf Prüfen."
      : `Fläche ${bottomData?.id ?? "?"} liegt unten — tippe auf die Fläche, die oben liegt.`;

  // After answering: trigger fold animation to confirm
  if (answered && animState.foldTarget === 0) {
    animState.foldStart = 0;
    animState.fold = 0;
    animState.foldTarget = 1;
    animState.foldStartTime = performance.now();
    animState.autoSpin = false;
    animState.rotation = { x: -0.5, y: 0.6 };
    if (!prefersReducedMotion()) {
      startAnimLoop();
    } else {
      animState.fold = 1;
    }
  }

  return vstack([
    text(statusText, {
      fontSize: "lg",
      bold: true,
      color: answered
        ? (ctx.result?.correct ? palette.ok : palette.bad)
        : palette.canvasText,
      align: "center",
    }),
    custom({
      id: "predict-grid",
      flex: 1,
      draw(drawCtx, r) {
        const sp = resolveCanvasSpacing(r.w);
        // Grid layout — full width, centered
        const maxGridW = Math.min(r.w - sp.md * 2, r.h - sp.md * 2);
        const cellSize = Math.floor(maxGridW / GRID_COLS);
        const gridW = cellSize * GRID_COLS;
        const gridH = cellSize * GRID_ROWS;
        const ox = r.x + (r.w - gridW) / 2;
        const oy = r.y + (r.h - gridH) / 2;

        for (let row = 0; row < GRID_ROWS; row++) {
          for (let col = 0; col < GRID_COLS; col++) {
            const key = gridKeyOf(col, row);
            const data = cellMap.get(key);
            const px = ox + col * cellSize;
            const py = oy + row * cellSize;

            if (data) {
              // Fill with face color
              drawCtx.fillStyle = data.color;
              drawCtx.globalAlpha = 0.4;
              drawCtx.fillRect(px, py, cellSize, cellSize);
              drawCtx.globalAlpha = 1;

              // Bottom face: thick red border + "⬇" marker
              if (key === bottomKey) {
                drawCtx.fillStyle = palette.bad;
                drawCtx.globalAlpha = 0.25;
                drawCtx.fillRect(px, py, cellSize, cellSize);
                drawCtx.globalAlpha = 1;
                drawCtx.strokeStyle = palette.bad;
                drawCtx.lineWidth = 4;
                drawCtx.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
              }

              // Predicted face: accent border
              if (key === predictedKey && key !== bottomKey) {
                drawCtx.strokeStyle = palette.accent;
                drawCtx.lineWidth = 4;
                drawCtx.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
              }

              // After answer: highlight correct top face in green
              if (answered && task.correctTopFaceId === data.id) {
                drawCtx.strokeStyle = palette.ok;
                drawCtx.lineWidth = 4;
                drawCtx.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
              }

              // Face number
              drawCtx.fillStyle = palette.canvasText;
              drawCtx.font = `700 ${Math.max(14, cellSize * 0.45)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
              drawCtx.textAlign = "center";
              drawCtx.textBaseline = "middle";
              drawCtx.fillText(`${data.id}`, px + cellSize / 2, py + cellSize / 2);

              // Bottom label
              if (key === bottomKey) {
                drawCtx.font = `400 ${Math.max(10, cellSize * 0.25)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
                drawCtx.fillStyle = palette.bad;
                drawCtx.fillText("unten", px + cellSize / 2, py + cellSize * 0.85);
              }
            } else {
              // Empty cell
              drawCtx.fillStyle = palette.panelSoft;
              drawCtx.globalAlpha = 0.1;
              drawCtx.fillRect(px, py, cellSize, cellSize);
              drawCtx.globalAlpha = 1;
            }

            // Grid line
            drawCtx.strokeStyle = palette.line;
            drawCtx.lineWidth = 0.5;
            drawCtx.strokeRect(px, py, cellSize, cellSize);
          }
        }

        // Update grid interaction geometry for tap detection
        if (gridInteraction) {
          gridInteraction.updateGeometry({
            originX: ox,
            originY: oy,
            cellSize,
            cols: GRID_COLS,
            rows: GRID_ROWS,
          });
        }
        // 3D fold preview after answering (right half of grid area)
        if (answered) {
          const halfW = Math.floor(r.w / 2);
          drawCtx.save();
          drawCtx.beginPath();
          drawCtx.rect(r.x + halfW, r.y, halfW, r.h);
          drawCtx.clip();
          const previewCx = r.x + halfW + halfW / 2;
          const previewCy = r.y + r.h * 0.5;
          const previewSize = Math.min(halfW * 0.8, r.h * 0.8);
          draw3DFolding(
            drawCtx,
            new Set(task.templateCells.keys()),
            animState.rotation,
            animState.fold,
            previewCx,
            previewCy,
            previewSize,
          );
          drawCtx.restore();
        }
      },
    }),
    // Buttons
    ...(phase === "interact" && !answered ? [hstack([
      ...(predictedKey ? [button("Pr\u00FCfen", {
        id: "predict-check",
        variant: "primary",
        onTap: () => onCheckRef?.(),
      })] : []),
    ], { gap: 12, justify: "center" })] : []),
  ], { gap: 8, padding: 16, align: "center" });
}

// ─── Hints ───────────────────────────────────────────────────────────────────

function getHints(task: NetTask): string[] {
  if (isPredictMode) {
    const bottomData = task.bottomFaceKey ? task.templateCells.get(task.bottomFaceKey) : undefined;
    return [
      `Fläche ${bottomData?.id ?? "?"} liegt unten. Stell dir vor, du faltest das Netz.`,
      "Die gegenüberliegende Fläche ist immer durch genau 2 Flächen getrennt.",
      `Tipp: Fläche ${task.correctTopFaceId} liegt oben!`,
      `Tippe auf Fläche ${task.correctTopFaceId} — sie liegt der Unterseite genau gegenüber.`,
    ];
  }
  if (isOppositeMode) {
    return [
      "Ein W\u00FCrfel hat 3 Paare gegen\u00FCberliegender Seiten.",
      "Falte das Netz im Kopf \u2014 welche Fl\u00E4chen liegen sich dann gegen\u00FCber?",
      "Gegen\u00FCberliegende Fl\u00E4chen sind durch genau 2 Fl\u00E4chen voneinander getrennt.",
      "Klicke nacheinander die Flächen an, die sich gegenüberliegen — gleiche Farbe = ein Paar.",
    ];
  }
  const bodyName = task.body === "cube" ? "W\u00FCrfel" : "Quader";
  return [
    `Ein ${bodyName} hat 6 Fl\u00E4chen.`,
    `Alle Fl\u00E4chen m\u00FCssen zusammenh\u00E4ngen (kein Loch).`,
    `Gegen\u00FCberliegende Fl\u00E4chen haben die gleiche Farbe. Falte das Netz im Kopf.`,
    `Male genau 6 zusammenhängende Kästchen aus — das ergibt ein gültiges ${bodyName}-Netz.`,
  ];
}

// ─── Module Registration ─────────────────────────────────────────────────────

export const netzeV2Registration = defineModule<NetTask, NetState>({
  id: "netze",
  label: "K\u00F6rper & Netze",
  icon: "\uD83D\uDCE6",
  description: "W\u00FCrfelnetze bauen und erkunden.",

  taskLabel(task) {
    if (isPredictMode) {
      const bottomData = task.bottomFaceKey ? task.templateCells.get(task.bottomFaceKey) : undefined;
      return `Fläche ${bottomData?.id ?? "?"} liegt unten. Welche liegt oben?`;
    }
    if (isOppositeMode) {
      return "Finde die gegenüberliegenden Seiten.";
    }
    return `Baue ein gültiges Würfelnetz.`;
  },

  flowType: "task",
  celebrationIntensity: "subtle",
  autoAdvanceMs: 8000,
  input: "canvas",

  taskTypes: [
    { id: "cube", label: "W\u00FCrfel", icon: "\uD83C\uDFB2" },
    { id: "opposite", label: "Gegen\u00FCber", icon: "\uD83C\uDFAF" },
    { id: "predict", label: "Vorhersage", icon: "\uD83D\uDD2E" },
  ],

  difficulties: DIFFICULTIES,

  tutorial: (taskType: string): TutorialStep[] => {
    const palette = getPalette();
    const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

    if (taskType === "predict") {
      return [
        {
          title: "Vorhersage",
          text: "Eine Fläche liegt unten (rot markiert). Welche Fläche liegt dann oben? Tippe darauf!",
          mathBackground: "Gegenüberliegende Flächen eines Würfels sind immer durch genau 2 Flächen getrennt. Falte das Netz im Kopf, um die Antwort zu finden.",
          draw(ctx, w, h, p) {
            const cellSize = Math.min(w * 0.12, h * 0.12);
            const cx = w / 2;
            const cy = h * 0.45;

            // Cross net
            const cells = [
              { col: 0, row: -1 }, // 1: top
              { col: -1, row: 0 }, // 2: left
              { col: 0, row: 0 },  // 3: center
              { col: 1, row: 0 },  // 4: right
              { col: 0, row: 1 },  // 5: bottom
              { col: 0, row: 2 },  // 6: very bottom
            ];

            // Bottom = cell 3 (center), Top = cell 6 (very bottom) — opposite pair
            const bottomIdx = 2;
            const topIdx = 5;

            for (let i = 0; i < cells.length; i++) {
              const cell = cells[i];
              const px = cx + cell.col * cellSize - cellSize / 2;
              const py = cy + cell.row * cellSize - cellSize / 2;

              ctx.fillStyle = palette.panelSoft;
              if (i === bottomIdx) {
                ctx.fillStyle = palette.bad;
                ctx.globalAlpha = 0.35;
              }
              if (i === topIdx && p > 0.6) {
                ctx.fillStyle = palette.ok;
                ctx.globalAlpha = 0.5;
              }
              ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
              ctx.globalAlpha = 1;

              ctx.strokeStyle = palette.line;
              ctx.lineWidth = 1.5;
              ctx.strokeRect(px, py, cellSize, cellSize);

              // Face number
              ctx.font = `700 ${cellSize * 0.4}px ${FONT}`;
              ctx.fillStyle = palette.canvasText;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(`${i + 1}`, px + cellSize / 2, py + cellSize / 2);

              // Labels
              if (i === bottomIdx) {
                ctx.font = `400 ${cellSize * 0.25}px ${FONT}`;
                ctx.fillStyle = palette.bad;
                ctx.fillText("unten", px + cellSize / 2, py + cellSize * 0.85);
              }
              if (i === topIdx && p > 0.6) {
                ctx.font = `400 ${cellSize * 0.25}px ${FONT}`;
                ctx.fillStyle = palette.ok;
                ctx.fillText("oben!", px + cellSize / 2, py + cellSize * 0.85);
              }
            }

            // Arrow hint
            if (p > 0.3 && p < 0.7) {
              ctx.font = `600 ${h * 0.06}px ${FONT}`;
              ctx.fillStyle = palette.canvasText;
              ctx.textAlign = "center";
              ctx.fillText("Fläche 3 unten — welche oben?", w / 2, h * 0.9);
            }
            if (p > 0.7) {
              ctx.font = `600 ${h * 0.06}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.textAlign = "center";
              ctx.fillText("Fläche 6 liegt oben! ✓", w / 2, h * 0.9);
            }
          },
          duration: 4000,
        },
      ];
    }

    if (taskType === "opposite") {
      return [
        {
          title: "So geht's",
          text: "Finde die 3 Paare gegenüberliegender Seiten im Würfelnetz.",
          mathBackground: "Ein Würfel hat 6 Flächen und 3 Paare gegenüberliegender Seiten. Gegenüberliegende Flächen sind durch genau 2 Flächen getrennt.",
          draw(ctx, w, h, p) {
            // Draw a cross-shaped net
            const cellSize = Math.min(w * 0.12, h * 0.12);
            const cx = w / 2;
            const cy = h * 0.45;

            // Cross net: center column (3 cells) + left and right of middle
            const cells = [
              { col: 0, row: -1 }, // top
              { col: -1, row: 0 }, // left
              { col: 0, row: 0 },  // center
              { col: 1, row: 0 },  // right
              { col: 0, row: 1 },  // bottom
              { col: 0, row: 2 },  // very bottom
            ];

            // Pair colors (revealed with progress)
            const pairColors = [palette.accent, palette.ok, palette.warn];
            const pairs = [[0, 4], [1, 3], [2, 5]]; // top-bottom, left-right, center-veryBottom

            for (let i = 0; i < cells.length; i++) {
              const cell = cells[i];
              const px = cx + cell.col * cellSize - cellSize / 2;
              const py = cy + cell.row * cellSize - cellSize / 2;

              // Find which pair this cell belongs to and if revealed
              let color = palette.panelSoft;
              for (let pi = 0; pi < pairs.length; pi++) {
                if ((pairs[pi][0] === i || pairs[pi][1] === i) && p > (pi + 1) * 0.3) {
                  color = pairColors[pi];
                  break;
                }
              }

              ctx.fillStyle = color;
              ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
              ctx.strokeStyle = palette.line;
              ctx.lineWidth = 1.5;
              ctx.strokeRect(px, py, cellSize, cellSize);

              // Face number
              ctx.font = `700 ${cellSize * 0.4}px ${FONT}`;
              ctx.fillStyle = palette.canvasText;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(`${i + 1}`, px + cellSize / 2, py + cellSize / 2);
            }

            // Legend
            if (p > 0.9) {
              ctx.font = `600 ${h * 0.06}px ${FONT}`;
              ctx.fillStyle = palette.canvasText;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("3 Paare: gleiche Farbe = gegenüber", w / 2, h * 0.9);
            }
          },
          duration: 3500,
        },
      ];
    }

    // Default: cube
    return [
      {
        title: "So geht's",
        text: "Baue ein gültiges Würfelnetz mit genau 6 zusammenhängenden Flächen.",
        mathBackground: "Ein Würfel hat 6 gleiche quadratische Flächen. Es gibt 11 verschiedene Würfelnetze.",
        draw(ctx, w, h, p) {
          const cellSize = Math.min(w * 0.1, h * 0.1);
          const cx = w / 2;
          const startY = h * 0.2;

          // Animate a cross net appearing cell by cell
          const crossCells = [
            { col: 0, row: 0 },
            { col: 0, row: 1 },
            { col: -1, row: 1 },
            { col: 1, row: 1 },
            { col: 0, row: 2 },
            { col: 0, row: 3 },
          ];

          const cellsToShow = Math.floor(p * (crossCells.length + 1));

          for (let i = 0; i < Math.min(cellsToShow, crossCells.length); i++) {
            const cell = crossCells[i];
            const px = cx + cell.col * cellSize - cellSize / 2;
            const py = startY + cell.row * cellSize;

            ctx.fillStyle = palette.accent;
            ctx.globalAlpha = 0.6;
            ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = palette.line;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px, py, cellSize, cellSize);

            // Face number
            ctx.font = `700 ${cellSize * 0.4}px ${FONT}`;
            ctx.fillStyle = palette.canvasText;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${i + 1}`, px + cellSize / 2, py + cellSize / 2);
          }

          // Fold arrow hint
          if (p > 0.8) {
            ctx.font = `600 ${h * 0.07}px ${FONT}`;
            ctx.fillStyle = palette.ok;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("→ Falte zum Würfel!", cx, startY + 4.5 * cellSize + 16);
          }
        },
        duration: 3000,
      },
    ];
  },

  generate(ctx) {
    isOppositeMode = ctx.taskType === "opposite";
    isPredictMode = ctx.taskType === "predict";
    hintFoldActive = false;
    resetAnimState();
    stopAnimLoop();

    if (isPredictMode) {
      const task = pickTemplate("cube");
      // Pick a random face as "bottom", compute its opposite as the correct "top"
      const keys = [...task.templateCells.keys()];
      const bottomKey = keys[Math.floor(Math.random() * keys.length)];
      const pairs = findOppositePairs(task.templateCells);
      let topKey: CellKey | null = null;
      for (const [a, b] of pairs) {
        if (a === bottomKey) { topKey = b; break; }
        if (b === bottomKey) { topKey = a; break; }
      }
      const topData = topKey ? task.templateCells.get(topKey) : undefined;
      return {
        ...task,
        bottomFaceKey: bottomKey,
        correctTopFaceId: topData?.id,
      };
    }

    if (isOppositeMode) {
      return pickTemplate("cube");
    }
    return pickTemplate("cube");
  },

  check(task, answer) {
    // Predict mode: answer is the predicted face key
    if (isPredictMode && typeof answer === "string") {
      const predictedKey = answer as CellKey;
      const predictedData = task.templateCells.get(predictedKey);
      const correct = predictedData?.id === task.correctTopFaceId;
      return {
        correct,
        feedback: correct
          ? "Richtig! Diese Fläche liegt oben."
          : `Nicht ganz. Fläche ${task.correctTopFaceId} liegt oben.`,
      };
    }
    // Opposite-sides mode: answer is the identified pairs array
    if (Array.isArray(answer)) {
      const studentPairs = answer as [CellKey, CellKey][];
      const correctPairs = findOppositePairs(task.templateCells);
      if (studentPairs.length !== 3) {
        return { correct: false, feedback: `Finde alle 3 Paare (${studentPairs.length}/3 gefunden).` };
      }
      // Check if all student pairs match correct pairs (order within pair doesn't matter)
      const correctSet = new Set(correctPairs.map(([a, b]) => [a, b].sort().join("+")));
      const studentSet = new Set(studentPairs.map(([a, b]) => [a, b].sort().join("+")));
      const allCorrect = correctSet.size === studentSet.size &&
        [...correctSet].every((p) => studentSet.has(p));
      return {
        correct: allCorrect,
        feedback: allCorrect
          ? "Alle Gegenpaare richtig erkannt!"
          : "Nicht alle Paare stimmen. Schau nochmal genau hin.",
      };
    }
    const cells = answer as Set<string>;
    const cellMap = cellsToMap(cells);
    const analysis = analyzeNet(cellMap, task.body);
    const isValid = task.body === "cube" ? analysis.validCubeNet : analysis.validCuboidNet;
    return {
      correct: isValid,
      feedback: isValid
        ? "Das ist ein g\u00FCltiges Netz!"
        : !analysis.connected
          ? "Die Fl\u00E4chen m\u00FCssen zusammenh\u00E4ngen."
          : analysis.faceCount !== 6
            ? `Ein Netz braucht genau 6 Fl\u00E4chen (du hast ${analysis.faceCount}).`
            : "Dieses Netz l\u00E4sst sich nicht zu einem K\u00F6rper falten.",
    };
  },

  hints: getHints,

  getSolution(task) {
    const bodyName = task.body === "cube" ? "W\u00FCrfelnetz" : "Quadernetz";
    return { text: `${bodyName} \u201E${task.label}\u201C mit 6 zusammenh\u00E4ngenden Fl\u00E4chen.` };
  },

  initialState: () => ({
    cells: new Set<string>(),
    selectedFace: null,
    identifiedPairs: [],
    predictedFaceKey: null,
  }),

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onActivate(ctx) {
    moduleCtx = ctx;
    // Present phase: show finished cube with auto-rotation (teacher preview)
    // Interact phase: start flat for student to build
    const isPresent = ctx.phase === "present";
    animState = {
      fold: isPresent ? 1 : 0,
      foldTarget: isPresent ? 1 : 0,
      foldStart: 0,
      foldStartTime: 0,
      rotation: { x: -0.5, y: 0.6 },
      autoSpin: isPresent,
    };
    if (isPresent && !prefersReducedMotion()) {
      startAnimLoop();
    }

    // Create grid interaction with paint mode for net building
    gridInteraction = createGridInteraction({
      paintMode: true,
      originX: 0,
      originY: 0,
      cellSize: 1,
      cols: GRID_COLS,
      rows: GRID_ROWS,

      isCellFilled(col, row) {
        return latestCells.has(gridKeyOf(col, row));
      },

      onCellDrag(col, row, mode) {
        if (!moduleCtx) return;
        // Present phase is read-only — teacher shows, student watches
        if (moduleCtx.phase === "present") return;
        playClickSound();
        const key = gridKeyOf(col, row);
        moduleCtx.updateState((s) => {
          const next = new Set(s.cells);
          if (mode === "add") {
            next.add(key);
          } else {
            next.delete(key);
          }
          return { ...s, cells: next };
        });
        // Reset fold when net changes — updateState already triggers rebuildScene
        resetAnimState();
        stopAnimLoop();
      },
    });

    // ── Dev-Mode Grid Test Extension ──
    if (import.meta.env.DEV && typeof window !== "undefined" && window.__moduleTestAPI) {
      const api = window.__moduleTestAPI;
      const gi = gridInteraction;
      api.grid = {
        tapCell(col: number, row: number): boolean {
          if (!gi) return false;
          const geo = gi.getGeometry();
          const x = geo.originX + (col + 0.5) * geo.cellSize;
          const y = geo.originY + (row + 0.5) * geo.cellSize;
          const hit = gi.handleDown(x, y);
          gi.handleUp();
          return hit;
        },
        getGeometry() {
          return gi?.getGeometry() ?? { originX: 0, originY: 0, cellSize: 0, cols: 0, rows: 0 };
        },
      };
    }

    // Create drag tracker for 3D rotation on the right half
    // Dragging tilts the rotation axis without stopping auto-spin,
    // so the user can orient the cube and let it keep spinning.
    dragTracker = createDragTracker({
      threshold: 4,
      onStart() {
        isDragging3D = true;
      },
      onMove(dragState) {
        if (!moduleCtx || !isDragging3D) return;
        animState.rotation.x += dragState.dy * 0.005;
        animState.rotation.y += dragState.dx * 0.005;
        // Reset drag start to get incremental deltas
        dragState.startX = dragState.currentX;
        dragState.startY = dragState.currentY;
        dragState.dx = 0;
        dragState.dy = 0;
        moduleCtx.invalidate();
      },
      onEnd() {
        isDragging3D = false;
      },
      onCancel() {
        isDragging3D = false;
      },
    });

    // Set up button callback refs
    onCheckRef = () => {
      if (!moduleCtx) return;
      if (isPredictMode) {
        moduleCtx.submitAnswer(moduleCtx.state.predictedFaceKey);
      } else if (isOppositeMode) {
        moduleCtx.submitAnswer(moduleCtx.state.identifiedPairs);
      } else {
        moduleCtx.submitAnswer(latestCells);
      }
    };

    onResetRef = () => {
      if (!moduleCtx) return;
      playClickSound();
      moduleCtx.updateState((s) => ({ ...s, cells: new Set<string>(), selectedFace: null, identifiedPairs: [] }));
      resetAnimState();
      stopAnimLoop();
      moduleCtx.rebuildScene();
    };

    onTemplateRef = () => {
      if (!moduleCtx) return;
      playClickSound();
      const templateKeys = new Set(moduleCtx.task.templateCells.keys());
      moduleCtx.updateState((s) => ({ ...s, cells: templateKeys }));
      resetAnimState();
      stopAnimLoop();
      moduleCtx.rebuildScene();
    };

    onOppResetRef = () => {
      if (!moduleCtx) return;
      playClickSound();
      moduleCtx.updateState((s) => ({ ...s, selectedFace: null, identifiedPairs: [] }));
      moduleCtx.rebuildScene();
    };

    onFoldRef = () => {
      if (!moduleCtx) return;
      playClickSound();
      const newTarget = animState.foldTarget === 1 ? 0 : 1;
      animState.foldStart = animState.fold;
      animState.foldStartTime = performance.now();
      animState.foldTarget = newTarget;
      animState.autoSpin = false;
      moduleCtx.rebuildScene();
      startAnimLoop();
    };
  },

  onHint(_hintIndex: number) {
    // In opposite mode: trigger fold→spin→unfold animation to help visualize
    if (!isOppositeMode || !moduleCtx) return;

    // Already animating — skip
    if (hintFoldActive && animState.foldTarget === 1) return;

    hintFoldActive = true;

    if (prefersReducedMotion()) {
      // Show fully folded cube immediately (no animation)
      animState.fold = 1;
      animState.foldTarget = 1;
      animState.autoSpin = false;
      moduleCtx.rebuildScene();
      moduleCtx.invalidate();
      return;
    }

    // Trigger fold animation
    animState.foldStart = 0;
    animState.fold = 0;
    animState.foldTarget = 1;
    animState.foldStartTime = performance.now();
    animState.autoSpin = false;
    animState.rotation = { x: -0.5, y: 0.6 };
    moduleCtx.rebuildScene();
    startAnimLoop();
  },

  onDeactivate() {
    stopAnimLoop();
    gridInteraction = null;
    dragTracker = null;
    moduleCtx = null;
    onCheckRef = null;
    onResetRef = null;
    onTemplateRef = null;
    onFoldRef = null;
    onOppResetRef = null;
    isOppositeMode = false;
    isPredictMode = false;
    hintFoldActive = false;
    isDragging3D = false;
    latestCells = new Set();
  },

  // ─── Pointer Hooks ────────────────────────────────────────────────────────

  onPointerDown(ctx) {
    moduleCtx = ctx;

    // Predict mode: tap to select "top" face
    if (isPredictMode && gridInteraction) {
      const geo = gridInteraction.getGeometry();
      const col = Math.floor((ctx.x - geo.originX) / geo.cellSize);
      const row = Math.floor((ctx.y - geo.originY) / geo.cellSize);
      if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
        const key = gridKeyOf(col, row);
        // Must be a face cell and not the bottom face
        if (ctx.task.templateCells.has(key) && key !== ctx.task.bottomFaceKey) {
          playClickSound();
          ctx.updateState((s) => ({ ...s, predictedFaceKey: key }));
          ctx.rebuildScene();
        }
      }
      return;
    }

    // Opposite-sides mode: tap to select/pair faces
    if (isOppositeMode && gridInteraction) {
      const geo = gridInteraction.getGeometry();
      const col = Math.floor((ctx.x - geo.originX) / geo.cellSize);
      const row = Math.floor((ctx.y - geo.originY) / geo.cellSize);
      if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
        const key = gridKeyOf(col, row);
        if (ctx.task.templateCells.has(key)) {
          // Check if this cell is already in an identified pair
          const alreadyPaired = ctx.state.identifiedPairs.some(
            ([a, b]) => a === key || b === key,
          );
          if (alreadyPaired) return;

          if (ctx.state.selectedFace === null) {
            // First tap: select this face
            playClickSound();
            ctx.updateState((s) => ({ ...s, selectedFace: key }));
            ctx.invalidate();
          } else if (ctx.state.selectedFace === key) {
            // Tap same cell: deselect
            playClickSound();
            ctx.updateState((s) => ({ ...s, selectedFace: null }));
            ctx.invalidate();
          } else {
            // Second tap: pair these two faces
            playClickSound();
            const pair: [CellKey, CellKey] = [ctx.state.selectedFace, key];
            ctx.updateState((s) => ({
              ...s,
              selectedFace: null,
              identifiedPairs: [...s.identifiedPairs, pair],
            }));
            ctx.rebuildScene();
          }
          return;
        }
      }
      return;
    }

    // Check if pointer is in the right half (3D view) for drag rotation
    if (
      ctx.x >= rightHalfBounds.x &&
      ctx.x <= rightHalfBounds.x + rightHalfBounds.w &&
      ctx.y >= rightHalfBounds.y &&
      ctx.y <= rightHalfBounds.y + rightHalfBounds.h
    ) {
      dragTracker?.handleDown(ctx.x, ctx.y, ctx.pointerId);
      return;
    }

    // Otherwise, delegate to grid interaction (left half)
    gridInteraction?.handleDown(ctx.x, ctx.y);
  },

  onPointerMove(ctx) {
    moduleCtx = ctx;
    if (isDragging3D || dragTracker?.getState().pointerId === ctx.pointerId) {
      dragTracker?.handleMove(ctx.x, ctx.y);
      return;
    }
    gridInteraction?.handleMove(ctx.x, ctx.y);
  },

  onPointerUp(ctx) {
    moduleCtx = ctx;
    if (isDragging3D || dragTracker?.getState().pointerId === ctx.pointerId) {
      dragTracker?.handleUp();
      return;
    }
    gridInteraction?.handleUp();
  },

  // ─── Scene ────────────────────────────────────────────────────────────────

  buildScene(ctx) {
    if (isPredictMode) return buildPredictScene(ctx);
    if (isOppositeMode) return buildOppositeScene(ctx);
    return buildNetScene(ctx);
  },
});
