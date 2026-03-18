/**
 * Tests fuer Grid Tap/Paint Interaction.
 */
import { describe, it, expect, vi } from "vitest";
import { createGridInteraction } from "./grid-tap";

const BASE_GEO = {
  originX: 0,
  originY: 0,
  cellSize: 50,
  cols: 4,
  rows: 4,
};

describe("createGridInteraction()", () => {
  it("handleDown innerhalb Grid gibt true zurueck", () => {
    const grid = createGridInteraction({ ...BASE_GEO });
    expect(grid.handleDown(25, 25)).toBe(true);
  });

  it("handleDown ausserhalb Grid gibt false zurueck", () => {
    const grid = createGridInteraction({ ...BASE_GEO });
    expect(grid.handleDown(250, 250)).toBe(false); // beyond 4*50=200
  });

  it("handleDown ruft onCellTap mit korrekter Zelle (tap mode)", () => {
    const onCellTap = vi.fn();
    const grid = createGridInteraction({ ...BASE_GEO, onCellTap });
    grid.handleDown(25, 75); // col=0, row=1
    expect(onCellTap).toHaveBeenCalledWith(0, 1);
  });

  it("Paint mode: handleDown setzt Paint-Modus basierend auf isCellFilled", () => {
    const onCellDrag = vi.fn();
    const grid = createGridInteraction({
      ...BASE_GEO,
      paintMode: true,
      isCellFilled: () => true, // cell is filled → remove mode
      onCellDrag,
    });
    grid.handleDown(25, 25); // col=0, row=0
    expect(onCellDrag).toHaveBeenCalledWith(0, 0, "remove");
  });

  it("Paint mode: handleMove ruft onCellDrag fuer neue Zellen", () => {
    const onCellDrag = vi.fn();
    const grid = createGridInteraction({
      ...BASE_GEO,
      paintMode: true,
      isCellFilled: () => false,
      onCellDrag,
    });
    grid.handleDown(25, 25); // col=0, row=0 → "add"
    grid.handleMove(75, 25); // col=1, row=0 — new cell
    expect(onCellDrag).toHaveBeenCalledTimes(2);
    expect(onCellDrag).toHaveBeenLastCalledWith(1, 0, "add");
  });

  it("Paint mode: handleMove ignoriert gleiche Zelle", () => {
    const onCellDrag = vi.fn();
    const grid = createGridInteraction({
      ...BASE_GEO,
      paintMode: true,
      isCellFilled: () => false,
      onCellDrag,
    });
    grid.handleDown(25, 25);
    grid.handleMove(30, 30); // still col=0, row=0
    expect(onCellDrag).toHaveBeenCalledTimes(1); // only initial
  });

  it("handleUp ruft onEnd in paint mode", () => {
    const onEnd = vi.fn();
    const grid = createGridInteraction({
      ...BASE_GEO,
      paintMode: true,
      isCellFilled: () => false,
      onEnd,
    });
    grid.handleDown(25, 25);
    grid.handleUp();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("updateGeometry aendert Grid-Geometrie", () => {
    const grid = createGridInteraction({ ...BASE_GEO });
    grid.updateGeometry({ originX: 10, originY: 10, cellSize: 100, cols: 2, rows: 2 });
    const geo = grid.getGeometry();
    expect(geo.cellSize).toBe(100);
    expect(geo.cols).toBe(2);
  });

  it("getGeometry gibt aktuelle Geometrie zurueck", () => {
    const grid = createGridInteraction({ ...BASE_GEO });
    const geo = grid.getGeometry();
    expect(geo.originX).toBe(0);
    expect(geo.cellSize).toBe(50);
    expect(geo.cols).toBe(4);
    expect(geo.rows).toBe(4);
  });

  it("Koordinate (75, 25) trifft Zelle (1, 0) bei cellSize=50", () => {
    const onCellTap = vi.fn();
    const grid = createGridInteraction({ ...BASE_GEO, onCellTap });
    grid.handleDown(75, 25);
    expect(onCellTap).toHaveBeenCalledWith(1, 0);
  });
});
