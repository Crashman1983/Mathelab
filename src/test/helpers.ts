/**
 * Gemeinsame Test-Hilfsfunktionen für alle Module.
 */

import { gridKeyOf } from "@core/utils";
import type { CellData, FaceId } from "@modules/netze/logic";

// ─── Netze ────────────────────────────────────────────────────────────────────

/**
 * Erstellt eine CellData-Map aus einer Liste von [x, y]-Koordinaten.
 * Jede Zelle erhält eine aufsteigende FaceId (1–6) und die angegebene Farbe.
 */
export function makeNetMap(
  coords: [number, number][],
  color = "#6db5ff"
): Map<string, CellData> {
  const m = new Map<string, CellData>();
  coords.forEach(([x, y], i) => {
    m.set(gridKeyOf(x, y), { color, id: (i + 1) as FaceId });
  });
  return m;
}

/** Bekanntes gültiges Würfelnetz (Kreuzform) als Koordinaten-Liste. */
export const CROSS_NET: [number, number][] = [
  [1, 0],
  [0, 1], [1, 1], [2, 1], [3, 1],
  [1, 2],
];
