/**
 * Tests für Netze – 3D-Mathematik (math3d.ts)
 */
import { describe, it, expect } from "vitest";
import {
  mMul, mTranslate, mRotX, mRotY, mRotZ, mTransformPoint,
  edgeFoldMatrix, buildFoldTree, buildFaceTransforms, project,
  easeInOutCubic,
} from "@canvas/math3d";
import type { Mat4, Vec3 } from "@canvas/math3d";
import { makeNetMap, CROSS_NET } from "@test/helpers";

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

function closeTo(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) < eps;
}

function matEq(a: Mat4, b: Mat4, eps = 1e-9): boolean {
  return a.every((v, i) => closeTo(v, b[i], eps));
}

function vec3Eq(a: Vec3, b: Vec3, eps = 1e-9): boolean {
  return closeTo(a.x, b.x, eps) && closeTo(a.y, b.y, eps) && closeTo(a.z, b.z, eps);
}

// ─── mTranslate ──────────────────────────────────────────────────────────────

describe("mTranslate", () => {
  it("ist eine 4×4-Matrix mit 16 Elementen", () => {
    expect(mTranslate(1, 2, 3)).toHaveLength(16);
  });

  it("verschiebt einen Punkt korrekt", () => {
    const m = mTranslate(3, -1, 2);
    const p = mTransformPoint(m, ORIGIN);
    expect(p).toMatchObject({ x: 3, y: -1, z: 2 });
  });

  it("Einheitsverschiebung ist Identität für Ursprung", () => {
    const m = mTranslate(0, 0, 0);
    expect(vec3Eq(mTransformPoint(m, ORIGIN), ORIGIN)).toBe(true);
  });
});

// ─── mMul ────────────────────────────────────────────────────────────────────

describe("mMul", () => {
  it("Identität × Identität = Identität", () => {
    expect(matEq(mMul(IDENTITY, IDENTITY), IDENTITY)).toBe(true);
  });

  it("Translation × Translation addiert Verschiebungen", () => {
    const t1 = mTranslate(1, 0, 0);
    const t2 = mTranslate(2, 0, 0);
    const p = mTransformPoint(mMul(t1, t2), ORIGIN);
    expect(closeTo(p.x, 3)).toBe(true);
    expect(closeTo(p.y, 0)).toBe(true);
    expect(closeTo(p.z, 0)).toBe(true);
  });

  it("Identität × M = M", () => {
    const m = mTranslate(5, -3, 2);
    expect(matEq(mMul(IDENTITY, m), m)).toBe(true);
  });

  it("M × Identität = M", () => {
    const m = mTranslate(5, -3, 2);
    expect(matEq(mMul(m, IDENTITY), m)).toBe(true);
  });
});

// ─── mRotX ───────────────────────────────────────────────────────────────────

describe("mRotX", () => {
  it("dreht Y-Einheitsvektor um 90° zu Z", () => {
    const m = mRotX(Math.PI / 2);
    const p = mTransformPoint(m, { x: 0, y: 1, z: 0 });
    expect(vec3Eq(p, { x: 0, y: 0, z: 1 }, 1e-9)).toBe(true);
  });

  it("0°-Rotation = Identität", () => {
    expect(matEq(mRotX(0), IDENTITY)).toBe(true);
  });

  it("360°-Rotation = Identität", () => {
    expect(matEq(mRotX(Math.PI * 2), IDENTITY, 1e-9)).toBe(true);
  });
});

// ─── mRotY ───────────────────────────────────────────────────────────────────

describe("mRotY", () => {
  it("dreht X-Einheitsvektor um 90° zu -Z", () => {
    const m = mRotY(Math.PI / 2);
    const p = mTransformPoint(m, { x: 1, y: 0, z: 0 });
    expect(vec3Eq(p, { x: 0, y: 0, z: -1 }, 1e-9)).toBe(true);
  });

  it("0°-Rotation = Identität", () => {
    expect(matEq(mRotY(0), IDENTITY)).toBe(true);
  });
});

// ─── mRotZ ───────────────────────────────────────────────────────────────────

describe("mRotZ", () => {
  it("dreht X-Einheitsvektor um 90° zu Y", () => {
    const m = mRotZ(Math.PI / 2);
    const p = mTransformPoint(m, { x: 1, y: 0, z: 0 });
    expect(vec3Eq(p, { x: 0, y: 1, z: 0 }, 1e-9)).toBe(true);
  });

  it("0°-Rotation = Identität", () => {
    expect(matEq(mRotZ(0), IDENTITY)).toBe(true);
  });
});

// ─── mTransformPoint ─────────────────────────────────────────────────────────

describe("mTransformPoint", () => {
  it("Identität lässt Punkt unverändert", () => {
    const p = { x: 3, y: -2, z: 7 };
    expect(vec3Eq(mTransformPoint(IDENTITY, p), p)).toBe(true);
  });

  it("verändert alle drei Koordinaten korrekt", () => {
    const m = mTranslate(10, 20, 30);
    const p = mTransformPoint(m, { x: 1, y: 2, z: 3 });
    expect(p).toMatchObject({ x: 11, y: 22, z: 33 });
  });
});

// ─── edgeFoldMatrix ──────────────────────────────────────────────────────────

describe("edgeFoldMatrix", () => {
  it("gibt eine 4×4-Matrix zurück", () => {
    expect(edgeFoldMatrix(1, 0, 0)).toHaveLength(16);
    expect(edgeFoldMatrix(-1, 0, 0)).toHaveLength(16);
    expect(edgeFoldMatrix(0, 1, 0)).toHaveLength(16);
    expect(edgeFoldMatrix(0, -1, 0)).toHaveLength(16);
  });

  it("Winkel 0 verschiebt Kind für dx=1 um +1 in X (flaches Netz)", () => {
    // Bei angle=0 positioniert die Faltmatrix das Kind relativ zum Elternteil
    // dx=1: T(0.5)*I*T(0.5) = T(1, 0, 0)
    const p = mTransformPoint(edgeFoldMatrix(1, 0, 0), ORIGIN);
    expect(closeTo(p.x, 1)).toBe(true);
    expect(closeTo(p.y, 0)).toBe(true);
    expect(closeTo(p.z, 0)).toBe(true);
  });

  it("Winkel 0 verschiebt Kind für dy=1 um +1 in Y (flaches Netz)", () => {
    // dy=1: T(0, 0.5)*I*T(0, 0.5) = T(0, 1, 0)
    const p = mTransformPoint(edgeFoldMatrix(0, 1, 0), ORIGIN);
    expect(closeTo(p.x, 0)).toBe(true);
    expect(closeTo(p.y, 1)).toBe(true);
    expect(closeTo(p.z, 0)).toBe(true);
  });

  it("verschiedene Richtungen ergeben unterschiedliche Matrizen für Winkel ≠ 0", () => {
    const angle = Math.PI / 4;
    const m1 = edgeFoldMatrix(1, 0, angle);
    const m2 = edgeFoldMatrix(0, 1, angle);
    expect(matEq(m1, m2)).toBe(false);
  });

  it("gemeinsame Kante bleibt bei jedem Faltwinkel invariant (dx=1)", () => {
    // Shared edge between parent (at origin) and child (at dx=1):
    // Child's near edge (x=-0.5 in child-local) maps to x=0.5 in parent space
    for (const angle of [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2]) {
      const m = edgeFoldMatrix(1, 0, angle);
      const top = mTransformPoint(m, { x: -0.5, y: -0.5, z: 0 });
      const bot = mTransformPoint(m, { x: -0.5, y: 0.5, z: 0 });
      expect(closeTo(top.x, 0.5, 1e-6)).toBe(true);
      expect(closeTo(bot.x, 0.5, 1e-6)).toBe(true);
      expect(closeTo(top.y, -0.5, 1e-6)).toBe(true);
      expect(closeTo(bot.y, 0.5, 1e-6)).toBe(true);
    }
  });

  it("gemeinsame Kante bleibt bei jedem Faltwinkel invariant (dy=1)", () => {
    // Child's near edge (y=-0.5 in child-local) maps to y=0.5 in parent space
    for (const angle of [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2]) {
      const m = edgeFoldMatrix(0, 1, angle);
      const left = mTransformPoint(m, { x: -0.5, y: -0.5, z: 0 });
      const right = mTransformPoint(m, { x: 0.5, y: -0.5, z: 0 });
      expect(closeTo(left.y, 0.5, 1e-6)).toBe(true);
      expect(closeTo(right.y, 0.5, 1e-6)).toBe(true);
      expect(closeTo(left.x, -0.5, 1e-6)).toBe(true);
      expect(closeTo(right.x, 0.5, 1e-6)).toBe(true);
    }
  });
});

// ─── buildFoldTree ───────────────────────────────────────────────────────────

describe("buildFoldTree", () => {
  it("gibt null für leere Map zurück", () => {
    expect(buildFoldTree(new Map())).toBeNull();
  });

  it("gibt Wurzel und Children-Map für eine einzelne Zelle zurück", () => {
    const m = makeNetMap([[0, 0]]);
    const tree = buildFoldTree(m);
    expect(tree).not.toBeNull();
    expect(tree!.root).toBe("0,0");
    expect(tree!.children.size).toBe(1);
    expect(tree!.children.get("0,0")).toHaveLength(0);
  });

  it("verbindet alle Zellen des Kreuznetzes", () => {
    const m = makeNetMap(CROSS_NET);
    const tree = buildFoldTree(m);
    expect(tree).not.toBeNull();
    // Root soll eine Zelle des Netzes sein
    expect(m.has(tree!.root)).toBe(true);
    // Alle 6 Zellen müssen in der Children-Map sein
    expect(tree!.children.size).toBe(6);
  });

  it("deckt alle Knoten durch den BFS-Baum ab", () => {
    const m = makeNetMap(CROSS_NET);
    const tree = buildFoldTree(m)!;
    // Alle Knoten (außer Root) müssen als Kind irgendeines Elternteils auftreten
    const allChildren = new Set<string>();
    for (const children of tree.children.values()) {
      for (const c of children) allChildren.add(c.child);
    }
    const keys = new Set(m.keys());
    keys.delete(tree.root);
    for (const k of keys) {
      expect(allChildren.has(k)).toBe(true);
    }
  });
});

// ─── buildFaceTransforms ─────────────────────────────────────────────────────

describe("buildFaceTransforms", () => {
  it("gibt leere Map für leere Zellen zurück", () => {
    expect(buildFaceTransforms(new Map(), 0).size).toBe(0);
  });

  it("liefert für jede Zelle eine Matrix (flach, angle=0)", () => {
    const m = makeNetMap(CROSS_NET);
    const transforms = buildFaceTransforms(m, 0);
    expect(transforms.size).toBe(6);
    for (const key of m.keys()) {
      expect(transforms.has(key)).toBe(true);
    }
  });

  it("liefert für jede Zelle eine Matrix (vollständig gefaltet, angle=π/2)", () => {
    const m = makeNetMap(CROSS_NET);
    const transforms = buildFaceTransforms(m, Math.PI / 2);
    expect(transforms.size).toBe(6);
  });

  it("Zwischenwinkel liefert endliche Matrixeinträge", () => {
    const m = makeNetMap(CROSS_NET);
    const transforms = buildFaceTransforms(m, Math.PI / 4);
    for (const mat of transforms.values()) {
      for (const v of mat) {
        expect(isFinite(v)).toBe(true);
      }
    }
  });

  it("bei fold=0 liegen alle Flächen-Zentren in der Z=0-Ebene", () => {
    const m = makeNetMap(CROSS_NET);
    const transforms = buildFaceTransforms(m, 0);
    for (const mat of transforms.values()) {
      const center = mTransformPoint(mat, ORIGIN);
      expect(Math.abs(center.z)).toBeLessThan(1e-9);
    }
  });

  it("bei fold=π/2 bilden 6 Kreuz-Zellen einen geschlossenen Würfel", () => {
    const m = makeNetMap(CROSS_NET);
    const transforms = buildFaceTransforms(m, Math.PI / 2);
    // Collect all face centers — each should be at distance ~0.5 from centroid on one axis
    const centers: Vec3[] = [];
    for (const mat of transforms.values()) {
      centers.push(mTransformPoint(mat, ORIGIN));
    }
    // Centroid of all face centers should be near the origin (the center of the cube)
    const cx = centers.reduce((s, c) => s + c.x, 0) / 6;
    const cy = centers.reduce((s, c) => s + c.y, 0) / 6;
    const cz = centers.reduce((s, c) => s + c.z, 0) / 6;
    // Each face center should be ~0.5 units from centroid along one axis
    for (const c of centers) {
      const dx = Math.abs(c.x - cx);
      const dy = Math.abs(c.y - cy);
      const dz = Math.abs(c.z - cz);
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      expect(dist).toBeCloseTo(0.5, 4);
    }
  });
});

// ─── project ─────────────────────────────────────────────────────────────────

describe("project", () => {
  it("projiziert den Ursprung auf die Mitte des Bildschirms", () => {
    const { sx, sy } = project(ORIGIN, 5, 100, 400, 300);
    expect(sx).toBeCloseTo(400);
    expect(sy).toBeCloseTo(300);
  });

  it("gibt eine endliche Tiefe zurück", () => {
    const { depth } = project({ x: 1, y: 1, z: 0.5 }, 5, 100, 400, 300);
    expect(isFinite(depth)).toBe(true);
  });

  it("negativer z-Wert (hinter der Ebene) erscheint kleiner als z=0", () => {
    // camera=10, unit=1: für z=-1 ist f = 10/(10-(-1)) = 10/11 < 1
    // Punkt (1,0,-1) projiziert näher an Mittelpunkt als (1,0,0)
    const atOrigin = project({ x: 1, y: 0, z:  0 }, 10, 1, 0, 0);
    const behind   = project({ x: 1, y: 0, z: -1 }, 10, 1, 0, 0);
    expect(behind.sx).toBeLessThan(atOrigin.sx);
  });
});

// ─── easeInOutCubic ─────────────────────────────────────────────────────────

describe("easeInOutCubic", () => {
  it("Randfälle: 0→0, 0.5→0.5, 1→1", () => {
    expect(easeInOutCubic(0)).toBeCloseTo(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(1)).toBeCloseTo(1);
  });

  it("ist monoton steigend", () => {
    const steps = 100;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      expect(easeInOutCubic(t1)).toBeGreaterThanOrEqual(easeInOutCubic(t0));
    }
  });

  it("ist symmetrisch um (0.5, 0.5)", () => {
    for (const t of [0.1, 0.2, 0.3, 0.4]) {
      const left = easeInOutCubic(t);
      const right = easeInOutCubic(1 - t);
      expect(left + right).toBeCloseTo(1, 9);
    }
  });

  it("Werte liegen zwischen 0 und 1", () => {
    for (let i = 0; i <= 100; i++) {
      const v = easeInOutCubic(i / 100);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("beginnt langsam (ease-in) und endet langsam (ease-out)", () => {
    // Erste Ableitung bei t=0 sollte klein sein (slow start)
    const nearZero = easeInOutCubic(0.01);
    expect(nearZero).toBeLessThan(0.01); // slower than linear

    // Letzte Ableitung bei t=1 sollte klein sein (slow end)
    const nearOne = easeInOutCubic(0.99);
    expect(nearOne).toBeGreaterThan(0.99); // slower than linear
  });
});
