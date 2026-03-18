/**
 * Geometrie – reine Logik (testbar, kein DOM).
 *
 * Enthält: Formendefinitionen, Winkelerkennung, Flächen-/Umfangsberechnung.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type GeometryMode = "shapes" | "angles" | "area";

export interface Point { x: number; y: number }

/** A named 2D shape with polygon vertices (unit-size, centered at origin) */
export interface ShapeDef {
  id: string;
  label: string;
  /** Icon/emoji shorthand */
  icon: string;
  /** Vertices defining the polygon, relative to center, in a ~1-unit bounding box */
  vertices: Point[];
  /** Number of lines of symmetry */
  symmetryLines: number;
  /** All angles equal? */
  equiangular: boolean;
  /** All sides equal? */
  equilateral: boolean;
  /** How many right angles */
  rightAngles: number;
  /** Group category */
  category: "viereck" | "dreieck" | "sonstige";
  /** Fun didactic description (German) */
  description: string;
}

export type AngleType = "spitz" | "rechts" | "stumpf";

export interface AngleQuestion {
  /** Angle in degrees */
  degrees: number;
  type: AngleType;
}

export interface AreaTask {
  shape: "rect" | "square" | "triangle-right";
  /** Grid width (in cells) */
  width: number;
  /** Grid height (in cells) */
  height: number;
  /** Correct area in cells² */
  area: number;
  /** Correct perimeter in cell units */
  perimeter: number;
}

// ─── Shape Definitions ───────────────────────────────────────────────────────

function poly(sides: number, startAngle = 0): Point[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = startAngle + (i / sides) * Math.PI * 2;
    return { x: Math.cos(a), y: Math.sin(a) };
  });
}

export function getShapes(): ShapeDef[] {
  return [
    {
      id: "square",
      label: "Quadrat",
      icon: "⬛",
      vertices: [
        { x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 },
      ],
      symmetryLines: 4,
      equiangular: true,
      equilateral: true,
      rightAngles: 4,
      category: "viereck",
      description: "4 gleiche Seiten, 4 rechte Winkel, 4 Symmetrieachsen",
    },
    {
      id: "rectangle",
      label: "Rechteck",
      icon: "▬",
      vertices: [
        { x: -1.5, y: -0.85 }, { x: 1.5, y: -0.85 }, { x: 1.5, y: 0.85 }, { x: -1.5, y: 0.85 },
      ],
      symmetryLines: 2,
      equiangular: true,
      equilateral: false,
      rightAngles: 4,
      category: "viereck",
      description: "Gegenüberliegende Seiten gleich, 4 rechte Winkel",
    },
    {
      id: "rhombus",
      label: "Raute",
      icon: "🔷",
      vertices: [
        { x: 0, y: -1 }, { x: 1.2, y: 0 }, { x: 0, y: 1 }, { x: -1.2, y: 0 },
      ],
      symmetryLines: 2,
      equiangular: false,
      equilateral: true,
      rightAngles: 0,
      category: "viereck",
      description: "4 gleiche Seiten, gegenüberliegende Seiten parallel",
    },
    {
      id: "parallelogram",
      label: "Parallelogramm",
      icon: "▱",
      vertices: [
        { x: -1.2, y: -0.8 }, { x: 0.8, y: -0.8 }, { x: 1.2, y: 0.8 }, { x: -0.8, y: 0.8 },
      ],
      symmetryLines: 0,
      equiangular: false,
      equilateral: false,
      rightAngles: 0,
      category: "viereck",
      description: "Gegenüberliegende Seiten gleich und parallel",
    },
    {
      id: "trapezoid",
      label: "Trapez",
      icon: "🔺",
      vertices: [
        { x: -1.5, y: 0.8 }, { x: 1.5, y: 0.8 }, { x: 0.8, y: -0.8 }, { x: -0.8, y: -0.8 },
      ],
      symmetryLines: 1,
      equiangular: false,
      equilateral: false,
      rightAngles: 0,
      category: "viereck",
      description: "Genau ein Paar paralleler Seiten",
    },
    {
      id: "triangle-equilateral",
      label: "Gleichseitiges Dreieck",
      icon: "🔺",
      vertices: poly(3, -Math.PI / 2),
      symmetryLines: 3,
      equiangular: true,
      equilateral: true,
      rightAngles: 0,
      category: "dreieck",
      description: "3 gleiche Seiten, 3 gleiche Winkel (60°), 3 Symmetrieachsen",
    },
    {
      id: "triangle-isosceles",
      label: "Gleichschenkliges Dreieck",
      icon: "△",
      vertices: [
        { x: 0, y: -1.1 }, { x: 1, y: 0.8 }, { x: -1, y: 0.8 },
      ],
      symmetryLines: 1,
      equiangular: false,
      equilateral: false,
      rightAngles: 0,
      category: "dreieck",
      description: "2 gleiche Seiten (Schenkel), 1 Symmetrieachse",
    },
    {
      id: "triangle-right",
      label: "Rechtwinkliges Dreieck",
      icon: "◺",
      vertices: [
        { x: -1, y: 1 }, { x: 1, y: 1 }, { x: -1, y: -1 },
      ],
      symmetryLines: 0,
      equiangular: false,
      equilateral: false,
      rightAngles: 1,
      category: "dreieck",
      description: "Genau 1 rechter Winkel (90°)",
    },
    {
      id: "circle",
      label: "Kreis",
      icon: "⭕",
      vertices: poly(32),   // approximated as 32-gon for hit testing
      symmetryLines: Infinity as unknown as number,
      equiangular: true,
      equilateral: true,
      rightAngles: 0,
      category: "sonstige",
      description: "Alle Punkte gleich weit vom Mittelpunkt entfernt",
    },
    {
      id: "pentagon",
      label: "Regelmäßiges Fünfeck",
      icon: "⬠",
      vertices: poly(5, -Math.PI / 2),
      symmetryLines: 5,
      equiangular: true,
      equilateral: true,
      rightAngles: 0,
      category: "sonstige",
      description: "5 gleiche Seiten, 5 gleiche Winkel (108°)",
    },
    {
      id: "hexagon",
      label: "Regelmäßiges Sechseck",
      icon: "⬡",
      vertices: poly(6, 0),
      symmetryLines: 6,
      equiangular: true,
      equilateral: true,
      rightAngles: 0,
      category: "sonstige",
      description: "6 gleiche Seiten, 6 gleiche Winkel (120°)",
    },
  ];
}

// ─── Angle Logic ──────────────────────────────────────────────────────────────

export function classifyAngle(degrees: number): AngleType {
  if (degrees === 90) return "rechts";
  if (degrees < 90) return "spitz";
  return "stumpf";
}

export function angleLabel(type: AngleType): string {
  switch (type) {
    case "spitz":  return "Spitzer Winkel (< 90°)";
    case "rechts": return "Rechter Winkel (= 90°)";
    case "stumpf": return "Stumpfer Winkel (> 90°)";
  }
}

export function generateAngleQuestion(difficulty: number = 1): AngleQuestion {
  const pool = difficulty >= 3
    ? [20, 30, 45, 60, 90, 110, 120, 150, 170]
    : difficulty >= 2
      ? [30, 45, 60, 90, 120]
      : [90, 45, 60];
  const degrees = pool[Math.floor(Math.random() * pool.length)]!;
  const type = classifyAngle(degrees);
  return { degrees, type };
}

// ─── Area / Perimeter Logic ───────────────────────────────────────────────────

export function generateAreaTask(difficulty: number = 1): AreaTask {
  // Junior: only squares and rectangles; Checker/BossBaby: all shapes
  const shapes: AreaTask["shape"][] = difficulty <= 1
    ? ["rect", "square"]
    : ["rect", "square", "triangle-right"];
  const shape = shapes[Math.floor(Math.random() * shapes.length)];
  // D1 (Junior): sides 2-3, D2 (Checker): sides 2-5, D3 (BossBaby): sides 2-8
  const maxSide = difficulty >= 3 ? 8 : difficulty >= 2 ? 5 : 3;
  const range = maxSide - 2 + 1; // number of possible values (2..maxSide)
  let w: number, h: number;
  if (shape === "square") {
    w = 2 + Math.floor(Math.random() * range); // 2..maxSide
    h = w;
  } else if (shape === "triangle-right") {
    // Ensure even width so area = w×h÷2 is always an integer (Dezimalzahlen = Kl. 5+)
    const maxEven = Math.floor(maxSide / 2); // max multiplier for *2
    w = (1 + Math.floor(Math.random() * maxEven)) * 2; // 2, 4, ... maxSide
    h = 2 + Math.floor(Math.random() * range); // 2..maxSide
  } else {
    w = 2 + Math.floor(Math.random() * range); // 2..maxSide
    h = 2 + Math.floor(Math.random() * range); // 2..maxSide
  }
  const area = shape === "triangle-right" ? (w * h) / 2 : w * h;
  const perimeter = shape === "triangle-right" ? 0 : 2 * (w + h);
  return { shape, width: w, height: h, area, perimeter };
}

// ─── Explanations ────────────────────────────────────────────────────────────

export function explainAngle(degrees: number, type: AngleType): string {
  const label = angleLabel(type);
  if (type === "rechts") return `${degrees}° = 90° → ${label}`;
  const cmp = type === "spitz" ? "<" : ">";
  return `${degrees}° ${cmp} 90° → ${label}`;
}

export function explainArea(task: AreaTask): string {
  const { shape, width: w, height: h, area, perimeter } = task;
  if (shape === "triangle-right") {
    return `Fläche: ${w} × ${h} ÷ 2 = ${area} Kästchen²`;
  }
  return `Fläche: ${w} × ${h} = ${area} Kästchen². Umfang: 2 × (${w} + ${h}) = ${perimeter} Kästchen`;
}
