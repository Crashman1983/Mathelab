/**
 * Tests für Geometrie – Logik
 */
import { describe, it, expect } from "vitest";
import {
  getShapes,
  classifyAngle,
  angleLabel,
  explainAngle,
  explainArea,
  generateAngleQuestion,
  generateAreaTask,
} from "./logic";

describe("getShapes", () => {
  it("liefert mindestens 8 vorbereitete Formen", () => {
    expect(getShapes().length).toBeGreaterThanOrEqual(8);
  });

  it("enthält zentrale Grundformen", () => {
    const ids = getShapes().map((shape) => shape.id);
    expect(ids).toContain("square");
    expect(ids).toContain("rectangle");
    expect(ids).toContain("circle");
    expect(ids).toContain("triangle-right");
    expect(ids).toContain("trapezoid");
    expect(ids).toContain("hexagon");
  });

  it("beschreibt das Quadrat mit 4 rechten Winkeln", () => {
    const square = getShapes().find((shape) => shape.id === "square");
    expect(square).toBeDefined();
    expect(square?.rightAngles).toBe(4);
    expect(square?.symmetryLines).toBe(4);
    expect(square?.equilateral).toBe(true);
  });
});

describe("classifyAngle", () => {
  it("klassifiziert spitze Winkel", () => {
    expect(classifyAngle(45)).toBe("spitz");
  });

  it("klassifiziert rechte Winkel", () => {
    expect(classifyAngle(90)).toBe("rechts");
  });

  it("klassifiziert stumpfe Winkel", () => {
    expect(classifyAngle(120)).toBe("stumpf");
  });

  it("klassifiziert 180° als stumpf (kein gestreckter Winkel im Lehrplan)", () => {
    expect(classifyAngle(180)).toBe("stumpf");
  });
});

describe("angleLabel", () => {
  it("liefert sprechende Beschriftungen", () => {
    expect(angleLabel("spitz")).toContain("Spitzer");
    expect(angleLabel("rechts")).toContain("90");
    expect(angleLabel("stumpf")).toContain(">");
  });
});

describe("generateAngleQuestion", () => {
  it("liefert konsistente Winkeltypen", () => {
    for (let i = 0; i < 40; i++) {
      const question = generateAngleQuestion();
      expect(classifyAngle(question.degrees)).toBe(question.type);
    }
  });
});

describe("generateAreaTask", () => {
  it("liefert nur unterstützte Formtypen", () => {
    for (let i = 0; i < 30; i++) {
      expect(["rect", "square", "triangle-right"]).toContain(generateAreaTask().shape);
    }
  });

  it("berechnet für Quadrate gleiche Seitenlängen", () => {
    for (let i = 0; i < 20; i++) {
      const task = generateAreaTask();
      if (task.shape === "square") {
        expect(task.width).toBe(task.height);
        expect(task.area).toBe(task.width * task.height);
        expect(task.perimeter).toBe(2 * (task.width + task.height));
      }
    }
  });

  it("berechnet Rechteck-Fläche und Umfang korrekt", () => {
    for (let i = 0; i < 20; i++) {
      const task = generateAreaTask();
      if (task.shape === "rect") {
        expect(task.area).toBe(task.width * task.height);
        expect(task.perimeter).toBe(2 * (task.width + task.height));
      }
    }
  });

  it("berechnet beim rechtwinkligen Dreieck die halbe Rechtecksfläche", () => {
    for (let i = 0; i < 30; i++) {
      const task = generateAreaTask();
      if (task.shape === "triangle-right") {
        expect(task.area).toBe((task.width * task.height) / 2);
      }
    }
  });
});

describe("explainAngle", () => {
  it("rechter Winkel enthält 90°", () => {
    expect(explainAngle(90, "rechts")).toContain("90°");
  });

  it("spitzer Winkel enthält <", () => {
    expect(explainAngle(45, "spitz")).toContain("<");
  });

  it("stumpfer Winkel enthält >", () => {
    expect(explainAngle(120, "stumpf")).toContain(">");
  });
});

describe("explainArea", () => {
  it("Rechteck enthält Multiplikation und Umfang", () => {
    const task = { shape: "rect" as const, width: 4, height: 3, area: 12, perimeter: 14 };
    const result = explainArea(task);
    expect(result).toContain("4");
    expect(result).toContain("3");
    expect(result).toContain("12");
  });

  it("rechtwinkliges Dreieck enthält ÷ 2", () => {
    const task = { shape: "triangle-right" as const, width: 4, height: 3, area: 6, perimeter: 0 };
    expect(explainArea(task)).toContain("÷ 2");
  });
});
