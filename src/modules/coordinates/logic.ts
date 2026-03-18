/**
 * Koordinatenlabor – Reine Logik (kein DOM/Canvas)
 * Koordinatensystem Klasse 3/4
 */

export type CoordsMode = "plot" | "read" | "path";

export interface GridPoint {
  x: number;
  y: number;
}

export interface PlotTask {
  target: GridPoint;
}

export interface ReadTask {
  point: GridPoint;
}

export interface PathTask {
  name: string;
  points: GridPoint[];
  /** Index des nächsten zu klickenden Punktes */
  nextIndex: number;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generatePlotTask(exclude?: PlotTask, difficulty = 2): PlotTask {
  const max = difficulty === 1 ? 4 : difficulty === 2 ? 7 : 9;
  const x = randInt(1, max);
  const y = randInt(1, max);
  if (exclude && exclude.target.x === x && exclude.target.y === y) {
    return generatePlotTask(undefined, difficulty);
  }
  return { target: { x, y } };
}

export function generateReadTask(exclude?: ReadTask, difficulty = 2): ReadTask {
  const max = difficulty === 1 ? 4 : difficulty === 2 ? 7 : 9;
  const x = randInt(1, max);
  const y = randInt(1, max);
  if (exclude && exclude.point.x === x && exclude.point.y === y) {
    return generateReadTask(undefined, difficulty);
  }
  return { point: { x, y } };
}

/** Einfache Pfad-Aufgaben für Difficulty 1 (Koordinaten 1–5) */
export const PATH_SHAPES_EASY: Array<{ name: string; points: GridPoint[] }> = [
  {
    name: "Quadrat",
    points: [
      { x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 4 }, { x: 1, y: 4 }, { x: 1, y: 1 },
    ],
  },
  {
    name: "Dreieck",
    points: [
      { x: 1, y: 1 }, { x: 5, y: 1 }, { x: 3, y: 5 }, { x: 1, y: 1 },
    ],
  },
  {
    name: "Rechteck",
    points: [
      { x: 1, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 4 }, { x: 1, y: 4 }, { x: 1, y: 2 },
    ],
  },
];

/** Vordefinierte Pfad-Aufgaben für Difficulty 2 (Koordinaten 1–9) */
export const PATH_SHAPES: Array<{ name: string; points: GridPoint[] }> = [
  {
    name: "Haus",
    points: [
      { x: 2, y: 1 }, { x: 7, y: 1 }, { x: 7, y: 5 },
      { x: 5, y: 7 }, { x: 2, y: 5 }, { x: 2, y: 1 },
    ],
  },
  {
    name: "Dreieck",
    points: [
      { x: 5, y: 8 }, { x: 1, y: 1 }, { x: 9, y: 1 }, { x: 5, y: 8 },
    ],
  },
  {
    name: "Rechteck",
    points: [
      { x: 1, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 7 }, { x: 1, y: 7 }, { x: 1, y: 2 },
    ],
  },
  {
    name: "Pfeil",
    points: [
      { x: 1, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 2 },
      { x: 9, y: 5 }, { x: 6, y: 8 }, { x: 6, y: 6 }, { x: 1, y: 6 }, { x: 1, y: 4 },
    ],
  },
];

let pathShapeIndexEasy = 0;
let pathShapeIndex = 0;
export function nextPathShape(difficulty = 2): PathTask {
  if (difficulty <= 1) {
    const shape = PATH_SHAPES_EASY[pathShapeIndexEasy % PATH_SHAPES_EASY.length]!;
    pathShapeIndexEasy++;
    return { name: shape.name, points: shape.points, nextIndex: 0 };
  }
  const shape = PATH_SHAPES[pathShapeIndex % PATH_SHAPES.length]!;
  pathShapeIndex++;
  return { name: shape.name, points: shape.points, nextIndex: 0 };
}

// ─── Procedural Path Generation ─────────────────────────────────────────────

/** Generates a random path of distinct waypoints within grid bounds.
 *  Difficulty 1: coordinates 1-5, 3 waypoints
 *  Difficulty 2: coordinates 1-9, 4-5 waypoints
 *  Returns array of [x, y] coordinate pairs (as GridPoint[]).
 */
export function generateProceduralPath(difficulty: number): GridPoint[] {
  const max = difficulty >= 3 ? 9 : difficulty >= 2 ? 7 : 4;
  const waypointCount = difficulty >= 3 ? randInt(4, 5) : difficulty >= 2 ? randInt(3, 4) : 3;
  const points: GridPoint[] = [];

  let attempts = 0;
  while (points.length < waypointCount && attempts < 100) {
    const candidate: GridPoint = { x: randInt(1, max), y: randInt(1, max) };

    // Ensure waypoint is distinct from all existing ones
    const isDuplicate = points.some(p => p.x === candidate.x && p.y === candidate.y);
    if (!isDuplicate) {
      points.push(candidate);
    }
    attempts++;
  }

  return points;
}

/** Konvertiert Grid-Koordinate → Canvas-Pixel */
export function gridToCanvas(
  point: GridPoint,
  originX: number,
  originY: number,
  cellSize: number
): { cx: number; cy: number } {
  return {
    cx: originX + point.x * cellSize,
    cy: originY - point.y * cellSize,
  };
}

/** Konvertiert Canvas-Pixel → nächste Gitterpunkt */
export function canvasToGrid(
  cx: number,
  cy: number,
  originX: number,
  originY: number,
  cellSize: number
): GridPoint {
  return {
    x: Math.round((cx - originX) / cellSize),
    y: Math.round((originY - cy) / cellSize),
  };
}

export function isValidGridPoint(p: GridPoint, size = 10): boolean {
  return p.x >= 0 && p.x <= size && p.y >= 0 && p.y <= size;
}

export function pointsEqual(a: GridPoint, b: GridPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

export function checkPlotAnswer(target: GridPoint, tapped: GridPoint): boolean {
  return pointsEqual(target, tapped);
}

export function checkReadAnswer(expected: GridPoint, answer: GridPoint): boolean {
  return pointsEqual(expected, answer);
}
