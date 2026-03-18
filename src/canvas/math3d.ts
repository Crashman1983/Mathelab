/**
 * Reine 3D-Mathematik für das Netze-Modul.
 * Keine DOM- oder Canvas-Abhängigkeiten – vollständig unit-testbar.
 */

import { gridKeyOf, gridParseKey } from "@core/utils";
import type { CellKey, CellData } from "@modules/netze/logic";

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface Vec3 { x: number; y: number; z: number }
/** 4×4-Matrix, zeilenweise (row-major). */
export type Mat4 = number[];

export interface FoldChild { child: CellKey; dx: number; dy: number }

// ─── Matrix-Operationen ───────────────────────────────────────────────────────

export function mMul(a: Mat4, b: Mat4): Mat4 {
  const r = new Array(16).fill(0);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[row * 4 + k] * b[k * 4 + col];
      r[row * 4 + col] = sum;
    }
  return r;
}

export function mTranslate(tx: number, ty: number, tz: number): Mat4 {
  return [1, 0, 0, tx, 0, 1, 0, ty, 0, 0, 1, tz, 0, 0, 0, 1];
}

export function mRotX(rad: number): Mat4 {
  const c = Math.cos(rad), s = Math.sin(rad);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
}

export function mRotY(rad: number): Mat4 {
  const c = Math.cos(rad), s = Math.sin(rad);
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
}

export function mRotZ(rad: number): Mat4 {
  const c = Math.cos(rad), s = Math.sin(rad);
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function mTransformPoint(m: Mat4, p: Vec3): Vec3 {
  return {
    x: m[0] * p.x + m[1] * p.y + m[2] * p.z + m[3],
    y: m[4] * p.x + m[5] * p.y + m[6] * p.z + m[7],
    z: m[8] * p.x + m[9] * p.y + m[10] * p.z + m[11],
  };
}

// ─── Falt-Logik ───────────────────────────────────────────────────────────────

/** Falt-Matrix: dreht eine Kind-Fläche um die gemeinsame Kante mit der Elternfläche. */
export function edgeFoldMatrix(dx: number, dy: number, angleRad: number): Mat4 {
  if (dx === 1)  return mMul(mMul(mTranslate( 0.5,  0,   0), mRotY(-angleRad)), mTranslate( 0.5,  0,   0));
  if (dx === -1) return mMul(mMul(mTranslate(-0.5,  0,   0), mRotY( angleRad)), mTranslate(-0.5,  0,   0));
  if (dy === 1)  return mMul(mMul(mTranslate( 0,   0.5,  0), mRotX( angleRad)), mTranslate( 0,   0.5,  0));
  /*dy === -1*/  return mMul(mMul(mTranslate( 0,  -0.5,  0), mRotX(-angleRad)), mTranslate( 0,  -0.5,  0));
}

/** BFS-Faltbaum: gibt Wurzel und Eltern→Kind-Map zurück. */
export function buildFoldTree(
  cells: Map<CellKey, CellData>
): { root: CellKey; children: Map<CellKey, FoldChild[]> } | null {
  const keys = Array.from(cells.keys());
  if (keys.length === 0) return null;
  const root = keys[0];
  const childrenMap = new Map<CellKey, FoldChild[]>();
  keys.forEach(k => childrenMap.set(k, []));
  const visited = new Set<CellKey>([root]);
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const { x, y } = gridParseKey(current);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const neighbor = gridKeyOf(x + dx, y + dy);
      if (cells.has(neighbor) && !visited.has(neighbor)) {
        visited.add(neighbor);
        childrenMap.get(current)!.push({ child: neighbor, dx, dy });
        queue.push(neighbor);
      }
    }
  }
  return { root, children: childrenMap };
}

/** Berechnet pro Fläche 4×4-Transformationsmatrizen für einen gegebenen Faltwinkel (0 = flach, π/2 = vollständig gefaltet). */
export function buildFaceTransforms(
  cells: Map<CellKey, CellData>,
  angleRad: number
): Map<CellKey, Mat4> {
  const transforms = new Map<CellKey, Mat4>();
  const tree = buildFoldTree(cells);
  if (!tree) return transforms;

  const keys = Array.from(cells.keys());
  const cx = keys.reduce((acc, k) => acc + gridParseKey(k).x, 0) / keys.length;
  const cy = keys.reduce((acc, k) => acc + gridParseKey(k).y, 0) / keys.length;
  const base = mTranslate(-cx, -cy, 0);

  const { x: rx, y: ry } = gridParseKey(tree.root);
  const rootM = mMul(base, mTranslate(rx, ry, 0));
  const stack: { key: CellKey; m: Mat4 }[] = [{ key: tree.root, m: rootM }];

  while (stack.length > 0) {
    const item = stack.pop()!;
    transforms.set(item.key, item.m);
    for (const c of tree.children.get(item.key) ?? []) {
      const local = edgeFoldMatrix(c.dx, c.dy, angleRad);
      stack.push({ key: c.child, m: mMul(item.m, local) });
    }
  }
  return transforms;
}

// ─── Projektion ───────────────────────────────────────────────────────────────

/** Perspektivische Projektion eines 3D-Punktes auf die 2D-Leinwand. */
export function project(
  v: Vec3,
  camera: number,
  unit: number,
  cx: number,
  cy: number
): { sx: number; sy: number; depth: number } {
  const f = camera / (camera - v.z * unit);
  return { sx: cx + v.x * unit * f, sy: cy + v.y * unit * f, depth: v.z * unit };
}

// ─── Easing ──────────────────────────────────────────────────────────────────

/** Smooth easeInOut curve (cubic) — slow start, fast middle, slow end */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - (-2 * t + 2) ** 3 / 2;
}
