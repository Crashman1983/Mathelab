/**
 * Typen für das Symmetrie-Modul
 */

export type SymmetryMode = "mirror-v" | "mirror-h" | "enlarge-2" | "enlarge-3";
export type LessonMode = "example" | "practice" | "free";

export type CellKey = string; // "x,y"

export interface SymmetryUndoEntry {
  key: CellKey;
  added: boolean; // true = was added, false = was removed
}

export interface SymmetryState {
  /** Gittekoordinaten des Quellbereichs (Vorlage) */
  source: Set<CellKey>;
  /** Gitterkoordinaten des Antwortbereichs (Student) */
  answer: Set<CellKey>;
  /** Erwartete Antwort (berechnet aus source + mode) */
  expected: Set<CellKey>;

  symmetryMode: SymmetryMode;
  lessonMode: LessonMode;

  /** Undo-Stack (max 50 Einträge) */
  answerUndo: SymmetryUndoEntry[];

  /** Zeige Ergebnis-Overlay nach Prüfung */
  checkOverlay: {
    active: boolean;
    matching: Set<CellKey>;
    wrong: Set<CellKey>;
    missing: Set<CellKey>;
  } | null;

  /** Animation: Preview der Lösung einblenden */
  previewAlpha: number;
  showPreview: boolean;
  /** LIM-03: Preview-Animation Timing – läuft im Haupt-Loop, kein separater RAF */
  previewAnimStartTime: number | null;
  previewAnimPhase: "in" | "hold" | "out" | null;

  /** Wird ein Ziehvorgang durchgeführt (cell draw)? */
  isDragging: boolean;
  dragMode: "add" | "remove" | null;

  /** V6: Spiegelungs-Animation bei Fehler: Bogenpfade von falscher → korrekter Position */
  mirrorAnim: {
    arcs: { fx: number; fy: number; tx: number; ty: number }[];
    startTime: number;
    duration: number;
  } | null;

  /** Pulse-Phase für die Symmetrieachse (animation) */
  axisPhase: number;

  /** Grid-Konfiguration */
  gridSize: number;  // z.B. 15 (15x15)
  cellSize: number;  // px per cell (berechnet)
}

export interface GridBounds {
  sourceMinX: number;
  sourceMaxX: number;
  sourceMinY: number;
  sourceMaxY: number;
  answerMinX: number;
  answerMaxX: number;
}

/** Aufgabe für Practice-Mode */
export interface SymmetryTask {
  id: string;
  mode: SymmetryMode;
  source: CellKey[];
  label: string;
}
