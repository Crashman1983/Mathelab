/**
 * Symmetrie-Logik: rein funktional, kein DOM, kein Canvas.
 * Vollständig testbar.
 */

import type { SymmetryMode, CellKey } from "./types.js";
import { gridKeyOf, gridParseKey } from "@core/utils";

// ─── Expected Answer Calculation ─────────────────────────────────────────────

/**
 * Berechnet die erwartete Antwort für eine gegebene Quelle und Modus.
 * Gibt ein neues Set mit den korrekten Gitter-Koordinaten zurück.
 */
export function computeExpected(
  source: ReadonlySet<CellKey>,
  mode: SymmetryMode,
  gridSize: number
): Set<CellKey> {
  const expected = new Set<CellKey>();
  const half = Math.floor(gridSize / 2); // Achse (z.B. bei 15 → 7)

  for (const key of source) {
    const { x, y } = gridParseKey(key);
    let tx: number;
    let ty: number;

    switch (mode) {
      case "mirror-v": {
        // Vertikale Achse: Achse liegt mittig in Spalte `half`.
        // Spiegelformel: source x → 2*half − x
        // Damit ist Spalte half die einzige Lücke zwischen Vorlage und Spiegelbild.
        tx = 2 * half - x;
        ty = y;
        break;
      }
      case "mirror-h": {
        // Horizontale Achse: Achse liegt mittig in Zeile `half`.
        tx = x;
        ty = 2 * half - y;
        break;
      }
      case "enlarge-2": {
        // 2x Vergrößerung: rechts vom Quellbereich
        const ox = x - 0; // source origin
        const oy = y - 0;
        // Place 2x2 block in answer region
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            expected.add(gridKeyOf(half + 1 + ox * 2 + dx, oy * 2 + dy));
          }
        }
        continue; // don't use tx/ty below
      }
      case "enlarge-3": {
        const ox = x - 0;
        const oy = y - 0;
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 3; dx++) {
            expected.add(gridKeyOf(half + 1 + ox * 3 + dx, oy * 3 + dy));
          }
        }
        continue;
      }
    }

    if (
      tx >= 0 && tx < gridSize &&
      ty >= 0 && ty < gridSize
    ) {
      expected.add(gridKeyOf(tx, ty));
    }
  }

  return expected;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface CheckResult {
  matching: Set<CellKey>;
  wrong: Set<CellKey>;
  missing: Set<CellKey>;
  correct: boolean;
}

/**
 * Vergleicht Student-Antwort mit erwarteter Lösung.
 */
export function checkAnswer(
  answer: ReadonlySet<CellKey>,
  expected: ReadonlySet<CellKey>
): CheckResult {
  const matching = new Set<CellKey>();
  const wrong = new Set<CellKey>();
  const missing = new Set<CellKey>();

  for (const key of answer) {
    if (expected.has(key)) {
      matching.add(key);
    } else {
      wrong.add(key);
    }
  }

  for (const key of expected) {
    if (!answer.has(key)) {
      missing.add(key);
    }
  }

  return {
    matching,
    wrong,
    missing,
    correct: wrong.size === 0 && missing.size === 0,
  };
}

// ─── Grid Region Checks ───────────────────────────────────────────────────────

/**
 * Prüft ob eine Gitterkoordinate im Quellbereich liegt.
 */
export function isInSourceRegion(
  x: number,
  y: number,
  mode: SymmetryMode,
  gridSize: number
): boolean {
  const half = Math.floor(gridSize / 2);
  if (mode === "mirror-v" || mode.startsWith("enlarge")) {
    return x < half;
  }
  if (mode === "mirror-h") {
    return y < half;
  }
  return false;
}

/**
 * Prüft ob eine Gitterkoordinate im Antwortbereich liegt.
 */
export function isInAnswerRegion(
  x: number,
  y: number,
  mode: SymmetryMode,
  gridSize: number
): boolean {
  const half = Math.floor(gridSize / 2);
  if (mode === "mirror-v") {
    return x > half;
  }
  if (mode === "mirror-h") {
    return y > half;
  }
  if (mode.startsWith("enlarge")) {
    return x > half;
  }
  return false;
}

// ─── Sample Tasks ─────────────────────────────────────────────────────────────

/** Vorbereitete Aufgaben (Quellzellen) für den Practice-Modus */
export const SYMMETRY_TASKS: Array<{ id: string; label: string; mode: SymmetryMode; cells: [number, number][] }> = [
  {
    id: "v-arrow",
    label: "Pfeil",
    mode: "mirror-v",
    cells: [[3, 3], [4, 2], [4, 3], [4, 4], [5, 3], [6, 3]],
  },
  {
    id: "v-house",
    label: "Haus",
    mode: "mirror-v",
    cells: [[2, 6], [3, 5], [4, 4], [4, 6], [4, 7], [5, 4], [5, 5], [5, 6], [5, 7], [6, 6]],
  },
  {
    id: "v-letter-L",
    label: "Buchstabe L",
    mode: "mirror-v",
    cells: [[3, 3], [3, 4], [3, 5], [3, 6], [3, 7], [4, 7], [5, 7]],
  },
  {
    id: "h-wave",
    label: "Welle",
    mode: "mirror-h",
    cells: [[1, 3], [2, 2], [3, 3], [4, 2], [5, 3], [6, 2]],
  },
  {
    id: "h-cross",
    label: "Kreuz",
    mode: "mirror-h",
    cells: [[3, 2], [3, 3], [3, 4], [2, 3], [4, 3]],
  },
  {
    id: "e2-block",
    label: "Block × 2",
    mode: "enlarge-2",
    cells: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [1, 1]],
  },
  {
    id: "e2-step",
    label: "Treppe × 2",
    mode: "enlarge-2",
    cells: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
  },
  {
    id: "e3-l-shape",
    label: "L-Form × 3",
    mode: "enlarge-3",
    cells: [[0, 0], [0, 1], [1, 1]],
  },
  {
    id: "e3-corner",
    label: "Ecke × 3",
    mode: "enlarge-3",
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]],
  },
];

// ─── Procedural Task Generation ──────────────────────────────────────────────

/**
 * Generates a random connected cluster of cells in the source region.
 * Uses random neighbor expansion to guarantee connectivity.
 */
export function generateProceduralCells(
  mode: SymmetryMode,
  gridSize: number,
  cellCount: number,
): [number, number][] {
  const half = Math.floor(gridSize / 2);

  // Determine bounds for source region
  let maxX: number, maxY: number, minX: number, minY: number;
  if (mode === "mirror-v" || mode.startsWith("enlarge")) {
    minX = 0; maxX = half - 1;
    minY = 0; maxY = gridSize - 1;
  } else {
    minX = 0; maxX = gridSize - 1;
    minY = 0; maxY = half - 1;
  }

  // For enlarge modes, constrain to smaller area
  if (mode === "enlarge-2") {
    maxX = Math.min(maxX, 3);
    maxY = Math.min(maxY, 5);
  } else if (mode === "enlarge-3") {
    maxX = Math.min(maxX, 2);
    maxY = Math.min(maxY, 3);
  }

  // Start with a random seed cell near the center of the source region
  const startX = minX + Math.floor(Math.random() * (maxX - minX + 1));
  const startY = minY + Math.floor(Math.random() * (maxY - minY + 1));

  const cells = new Set<string>();
  const cellList: [number, number][] = [];
  const addCell = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (!cells.has(key)) {
      cells.add(key);
      cellList.push([x, y]);
    }
  };

  addCell(startX, startY);

  // Grow by random neighbor expansion
  const dirs: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  let attempts = 0;
  while (cellList.length < cellCount && attempts < 200) {
    attempts++;
    const [cx, cy] = cellList[Math.floor(Math.random() * cellList.length)];
    const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY) {
      addCell(nx, ny);
    }
  }

  return cellList;
}

// ─── Undo ─────────────────────────────────────────────────────────────────────

export const MAX_UNDO = 50;
