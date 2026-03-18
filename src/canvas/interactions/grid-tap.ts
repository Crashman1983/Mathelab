/**
 * Grid Tap/Paint — interaction for grid-based canvases.
 *
 * Supports two modes:
 * - Tap mode: single cell activation on pointerdown
 * - Paint mode: brush painting with persistent add/remove mode per stroke
 *
 * Used by: Symmetrie (paint), Koordinaten (tap), Netze (tap/paint), Kalender (tap).
 */

export interface GridGeometry {
  /** Grid origin X in CSS pixels */
  originX: number;
  /** Grid origin Y in CSS pixels */
  originY: number;
  /** Cell size in CSS pixels */
  cellSize: number;
  /** Number of columns */
  cols: number;
  /** Number of rows */
  rows: number;
}

export interface GridInteractionConfig extends GridGeometry {
  /** Enable brush-paint mode (add/remove persistent per stroke) */
  paintMode?: boolean;
  /** Called on single cell tap (non-paint mode) or initial cell in paint mode */
  onCellTap?: (col: number, row: number) => void;
  /** Called during paint-drag with the current mode */
  onCellDrag?: (col: number, row: number, mode: "add" | "remove") => void;
  /** Called when drag/paint ends */
  onEnd?: () => void;
  /** For paint mode: determine initial mode based on whether cell is filled */
  isCellFilled?: (col: number, row: number) => boolean;
}

export interface GridInteraction {
  handleDown(x: number, y: number): boolean; // returns true if hit grid
  handleMove(x: number, y: number): void;
  handleUp(): void;
  /** Update grid geometry (call when canvas resizes or layout changes) */
  updateGeometry(geo: GridGeometry): void;
  /** Get current grid geometry (for test API / automation) */
  getGeometry(): GridGeometry;
}

export function createGridInteraction(config: GridInteractionConfig): GridInteraction {
  let geo: GridGeometry = {
    originX: config.originX,
    originY: config.originY,
    cellSize: config.cellSize,
    cols: config.cols,
    rows: config.rows,
  };
  let painting = false;
  let paintMode: "add" | "remove" = "add";
  let lastKey = "";

  function hitTest(x: number, y: number): { col: number; row: number } | null {
    const col = Math.floor((x - geo.originX) / geo.cellSize);
    const row = Math.floor((y - geo.originY) / geo.cellSize);
    if (col < 0 || col >= geo.cols || row < 0 || row >= geo.rows) return null;
    return { col, row };
  }

  return {
    handleDown(x: number, y: number): boolean {
      const cell = hitTest(x, y);
      if (!cell) return false;

      if (config.paintMode) {
        painting = true;
        // Determine paint mode from initial cell state
        const filled = config.isCellFilled?.(cell.col, cell.row) ?? false;
        paintMode = filled ? "remove" : "add";
        lastKey = `${cell.col},${cell.row}`;
        config.onCellDrag?.(cell.col, cell.row, paintMode);
      } else {
        config.onCellTap?.(cell.col, cell.row);
      }
      return true;
    },

    handleMove(x: number, y: number): void {
      if (!painting) return;
      const cell = hitTest(x, y);
      if (!cell) return;
      const key = `${cell.col},${cell.row}`;
      if (key === lastKey) return; // same cell, skip
      lastKey = key;
      config.onCellDrag?.(cell.col, cell.row, paintMode);
    },

    handleUp(): void {
      if (painting) {
        painting = false;
        lastKey = "";
        config.onEnd?.();
      }
    },

    updateGeometry(newGeo: GridGeometry): void {
      geo = { ...newGeo };
    },

    getGeometry(): GridGeometry {
      return { ...geo };
    },
  };
}
