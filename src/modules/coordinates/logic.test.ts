/**
 * Tests für Koordinatenlabor – Logik
 */
import { describe, it, expect } from "vitest";
import {
  generatePlotTask,
  generateReadTask,
  nextPathShape,
  gridToCanvas,
  canvasToGrid,
  isValidGridPoint,
  pointsEqual,
  checkPlotAnswer,
  checkReadAnswer,
  PATH_SHAPES,
} from "./logic";

describe("generatePlotTask", () => {
  it("liefert Punkt im Bereich 1–9", () => {
    const task = generatePlotTask();
    expect(task.target.x).toBeGreaterThanOrEqual(1);
    expect(task.target.x).toBeLessThanOrEqual(9);
    expect(task.target.y).toBeGreaterThanOrEqual(1);
    expect(task.target.y).toBeLessThanOrEqual(9);
  });

  it("liefert anderen Punkt als exclude (fast immer)", () => {
    const first = generatePlotTask();
    let foundDiff = false;
    for (let i = 0; i < 30; i++) {
      const next = generatePlotTask(first);
      if (next.target.x !== first.target.x || next.target.y !== first.target.y) {
        foundDiff = true;
        break;
      }
    }
    expect(foundDiff).toBe(true);
  });

  it("erzeugt 50 Tasks ohne Fehler", () => {
    for (let i = 0; i < 50; i++) {
      const t = generatePlotTask();
      expect(t.target.x).toBeGreaterThan(0);
    }
  });
});

describe("generateReadTask", () => {
  it("liefert Punkt im Bereich 1–9", () => {
    const task = generateReadTask();
    expect(task.point.x).toBeGreaterThanOrEqual(1);
    expect(task.point.y).toBeGreaterThanOrEqual(1);
  });

  it("exclude liefert anderen Punkt", () => {
    const first = generateReadTask();
    let foundDiff = false;
    for (let i = 0; i < 30; i++) {
      const next = generateReadTask(first);
      if (next.point.x !== first.point.x || next.point.y !== first.point.y) {
        foundDiff = true;
        break;
      }
    }
    expect(foundDiff).toBe(true);
  });
});

describe("PATH_SHAPES", () => {
  it("enthält mindestens 3 Formen", () => {
    expect(PATH_SHAPES.length).toBeGreaterThanOrEqual(3);
  });

  it("jede Form hat name und mindestens 3 Punkte", () => {
    PATH_SHAPES.forEach((shape) => {
      expect(shape.name.length).toBeGreaterThan(0);
      expect(shape.points.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("enthält 'Haus'", () => {
    expect(PATH_SHAPES.some((s) => s.name === "Haus")).toBe(true);
  });

  it("enthält 'Dreieck'", () => {
    expect(PATH_SHAPES.some((s) => s.name === "Dreieck")).toBe(true);
  });
});

describe("nextPathShape", () => {
  it("liefert PathTask mit nextIndex=0", () => {
    const task = nextPathShape();
    expect(task.nextIndex).toBe(0);
  });

  it("liefert gültigen Shapename", () => {
    const task = nextPathShape();
    expect(task.name.length).toBeGreaterThan(0);
  });

  it("rotiert durch die Formen", () => {
    const shapes = new Set<string>();
    for (let i = 0; i < PATH_SHAPES.length * 2; i++) {
      shapes.add(nextPathShape().name);
    }
    expect(shapes.size).toBe(PATH_SHAPES.length);
  });
});

describe("gridToCanvas", () => {
  it("Ursprung (0,0) liegt am originX/originY", () => {
    const { cx, cy } = gridToCanvas({ x: 0, y: 0 }, 100, 500, 40);
    expect(cx).toBe(100);
    expect(cy).toBe(500);
  });

  it("x=1 erhöht cx um cellSize", () => {
    const { cx } = gridToCanvas({ x: 1, y: 0 }, 100, 500, 40);
    expect(cx).toBe(140);
  });

  it("y=1 verringert cy um cellSize (y-Achse zeigt nach oben)", () => {
    const { cy } = gridToCanvas({ x: 0, y: 1 }, 100, 500, 40);
    expect(cy).toBe(460);
  });

  it("Punkt (3, 4) wird korrekt transformiert", () => {
    const { cx, cy } = gridToCanvas({ x: 3, y: 4 }, 50, 450, 30);
    expect(cx).toBe(50 + 3 * 30);  // 140
    expect(cy).toBe(450 - 4 * 30); // 330
  });
});

describe("canvasToGrid", () => {
  it("Ursprungspunkt ergibt (0,0)", () => {
    const pt = canvasToGrid(100, 500, 100, 500, 40);
    expect(pt).toEqual({ x: 0, y: 0 });
  });

  it("Umkehrung von gridToCanvas", () => {
    const origin = { ox: 80, oy: 480, cs: 35 };
    const grid = { x: 5, y: 7 };
    const { cx, cy } = gridToCanvas(grid, origin.ox, origin.oy, origin.cs);
    const back = canvasToGrid(cx, cy, origin.ox, origin.oy, origin.cs);
    expect(back).toEqual(grid);
  });

  it("rundet auf nächsten Gitterpunkt", () => {
    // Punkt ist 12px rechts von origin (cellSize=40 → 0.3 cells → rounds to 0)
    const pt = canvasToGrid(112, 500, 100, 500, 40);
    expect(pt.x).toBe(0);
  });

  it("rundet auf 1 bei 20px (0.5 cells, cellSize=40)", () => {
    const pt = canvasToGrid(120, 500, 100, 500, 40);
    expect(pt.x).toBe(1); // Math.round(0.5) = 1
  });
});

describe("isValidGridPoint", () => {
  it("(0,0) ist gültig", () => {
    expect(isValidGridPoint({ x: 0, y: 0 })).toBe(true);
  });
  it("(10,10) ist gültig (Grenze)", () => {
    expect(isValidGridPoint({ x: 10, y: 10 })).toBe(true);
  });
  it("(11,0) ist ungültig", () => {
    expect(isValidGridPoint({ x: 11, y: 0 })).toBe(false);
  });
  it("(-1,5) ist ungültig", () => {
    expect(isValidGridPoint({ x: -1, y: 5 })).toBe(false);
  });
  it("(5,5) ist gültig", () => {
    expect(isValidGridPoint({ x: 5, y: 5 })).toBe(true);
  });
  it("custom size: (5,5) bei size=4 ungültig", () => {
    expect(isValidGridPoint({ x: 5, y: 5 }, 4)).toBe(false);
  });
});

describe("pointsEqual", () => {
  it("gleiche Punkte sind gleich", () => {
    expect(pointsEqual({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(true);
  });
  it("unterschiedliche x sind nicht gleich", () => {
    expect(pointsEqual({ x: 3, y: 4 }, { x: 4, y: 4 })).toBe(false);
  });
  it("unterschiedliche y sind nicht gleich", () => {
    expect(pointsEqual({ x: 3, y: 4 }, { x: 3, y: 5 })).toBe(false);
  });
  it("Ursprung", () => {
    expect(pointsEqual({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(true);
  });
});

describe("checkPlotAnswer", () => {
  it("exakter Treffer wird akzeptiert", () => {
    expect(checkPlotAnswer({ x: 5, y: 3 }, { x: 5, y: 3 })).toBe(true);
  });
  it("falscher Punkt wird abgelehnt", () => {
    expect(checkPlotAnswer({ x: 5, y: 3 }, { x: 4, y: 3 })).toBe(false);
    expect(checkPlotAnswer({ x: 5, y: 3 }, { x: 5, y: 2 })).toBe(false);
  });
});

describe("checkReadAnswer", () => {
  it("korrekte Koordinaten werden akzeptiert", () => {
    expect(checkReadAnswer({ x: 7, y: 8 }, { x: 7, y: 8 })).toBe(true);
  });
  it("falsche x-Koordinate wird abgelehnt", () => {
    expect(checkReadAnswer({ x: 7, y: 8 }, { x: 6, y: 8 })).toBe(false);
  });
  it("falsche y-Koordinate wird abgelehnt", () => {
    expect(checkReadAnswer({ x: 7, y: 8 }, { x: 7, y: 9 })).toBe(false);
  });
});
