/**
 * Körper und Netze – reine Logik (testbar, kein DOM/Canvas).
 *
 * Enthält: Netz-Analyse, Gültigkeitsprüfung (Würfel/Quader), Templates.
 */

import { gridKeyOf, gridParseKey } from "@core/utils";
import { EXPERIMENT_COLORS } from "@core/design";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CellKey = string; // "x,y"
export type FaceId = number;  // 1-6
export type NetBody = "cube" | "cuboid";

export interface CellData {
  color: string;
  id: FaceId;
}

export interface NetAnalysis {
  faceCount: number;
  connected: boolean;
  validCubeNet: boolean;
  validCuboidNet: boolean;
  conflictPairs: [CellKey, CellKey][];
}

// ─── Adjacent Keys ────────────────────────────────────────────────────────────

export function getAdjacentKeys(key: CellKey): CellKey[] {
  const { x, y } = gridParseKey(key);
  return [
    gridKeyOf(x, y - 1),
    gridKeyOf(x, y + 1),
    gridKeyOf(x - 1, y),
    gridKeyOf(x + 1, y),
  ];
}

// ─── BFS Connectivity ────────────────────────────────────────────────────────

function isConnected(keys: CellKey[]): boolean {
  if (keys.length === 0) return true;
  const set = new Set(keys);
  const visited = new Set<CellKey>();
  const queue: CellKey[] = [keys[0]];
  visited.add(keys[0]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of getAdjacentKeys(current)) {
      if (set.has(neighbor) && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited.size === keys.length;
}

// ─── Valid Cube Net Templates ─────────────────────────────────────────────────

function canonicalToKeys(canonical: string): CellKey[] {
  return canonical.split("|");
}

function enumerateConnectedPolyominoes(size: number): string[] {
  let current = new Set<string>([gridKeyOf(0, 0)]);

  for (let count = 1; count < size; count++) {
    const next = new Set<string>();
    for (const canonical of current) {
      const keys = canonicalToKeys(canonical);
      const occupied = new Set(keys);
      const frontier = new Set<CellKey>();

      for (const key of keys) {
        for (const neighbor of getAdjacentKeys(key)) {
          if (!occupied.has(neighbor)) {
            frontier.add(neighbor);
          }
        }
      }

      for (const neighbor of frontier) {
        next.add(normalizeNet([...keys, neighbor]));
      }
    }
    current = next;
  }

  return [...current].sort();
}

function isPhysicallyFoldableCubeNet(keys: CellKey[]): boolean {
  const cells = new Map<CellKey, CellData>(
    keys.map((key, index) => [
      key,
      { color: EXPERIMENT_COLORS[0], id: (index + 1) as FaceId },
    ])
  );
  const frames = computeCellFrames(cells);
  if (frames.size !== 6) return false;
  const normals = new Set([...frames.values()].map((frame) => frame.normal.join(",")));
  if (normals.size !== 6) return false;
  return findOppositePairs(cells).length === 3;
}

/**
 * Returns the 11 known valid cube net templates.
 * Each is a list of [x, y] relative cell positions forming the net.
 */
export function getValidCubeNets(): CellKey[][] {
  return enumerateConnectedPolyominoes(6)
    .filter((canonical) => isPhysicallyFoldableCubeNet(canonicalToKeys(canonical)))
    .map(canonicalToKeys);
}

/**
 * Returns valid cuboid net templates.
 * A cuboid net has 2+2+2 = 6 faces: 2 large (top/bottom), 2 medium (front/back), 2 small (left/right).
 */
export function getValidCuboidNets(): CellKey[][] {
  return getValidCubeNets().slice(0, 5);
}

// ─── Net Normalization ────────────────────────────────────────────────────────

/** Normalizes a set of cell keys to start at (0,0) with canonical orientation */
function normalizeNet(keys: CellKey[]): string {
  const coords = keys.map(gridParseKey);

  // Generate all 8 symmetries (4 rotations × 2 reflections)
  const transforms: ((x: number, y: number) => [number, number])[] = [
    (x, y) => [x, y],
    (x, y) => [-y, x],
    (x, y) => [-x, -y],
    (x, y) => [y, -x],
    (x, y) => [-x, y],
    (x, y) => [x, -y],
    (x, y) => [y, x],
    (x, y) => [-y, -x],
  ];

  const representations: string[] = [];
  for (const t of transforms) {
    const transformed = coords.map(({ x, y }) => t(x, y));
    const minX = Math.min(...transformed.map(([tx]) => tx));
    const minY = Math.min(...transformed.map(([, ty]) => ty));
    const normalized = transformed
      .map(([tx, ty]) => gridKeyOf(tx - minX, ty - minY))
      .sort()
      .join("|");
    representations.push(normalized);
  }
  return representations.sort()[0];
}

// ─── Precompute valid net canonical forms ─────────────────────────────────────

const _cubeNetCanonicals: Set<string> = new Set(
  getValidCubeNets().map(normalizeNet)
);

const _cuboidNetCanonicals: Set<string> = new Set(
  getValidCuboidNets().map(normalizeNet)
);

// ─── Conflict Detection ───────────────────────────────────────────────────────

/** Detect cells that share the same face ID */
function findConflictPairs(cells: Map<CellKey, CellData>): [CellKey, CellKey][] {
  const byId = new Map<FaceId, CellKey[]>();
  for (const [key, data] of cells) {
    if (!byId.has(data.id)) byId.set(data.id, []);
    byId.get(data.id)!.push(key);
  }
  const pairs: [CellKey, CellKey][] = [];
  for (const keys of byId.values()) {
    if (keys.length > 1) {
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          pairs.push([keys[i], keys[j]]);
        }
      }
    }
  }
  return pairs;
}

// ─── Main Analysis Function ───────────────────────────────────────────────────

export function analyzeNet(cells: Map<CellKey, CellData>, _body: NetBody): NetAnalysis {
  const keys = Array.from(cells.keys());
  const faceCount = keys.length;
  const connected = faceCount > 0 ? isConnected(keys) : false;
  const conflictPairs = findConflictPairs(cells);

  let validCubeNet = false;
  let validCuboidNet = false;

  if (faceCount === 6 && connected && conflictPairs.length === 0) {
    const canonical = normalizeNet(keys);
    validCubeNet = _cubeNetCanonicals.has(canonical);
    validCuboidNet = validCubeNet || _cuboidNetCanonicals.has(canonical);
  }

  return { faceCount, connected, validCubeNet, validCuboidNet, conflictPairs };
}

// ─── Opposite Face Detection (fold simulation) ───────────────────────────────

export type Vec3i = [number, number, number];

export interface FaceFrame {
  normal: Vec3i;
  up:     Vec3i; // corresponds to grid -y direction
  right:  Vec3i; // corresponds to grid +x direction
}

function neg(v: Vec3i): Vec3i { return [-v[0], -v[1], -v[2]]; }

/**
 * Given the current face frame and a grid step (dx,dy), returns the frame
 * of the face reached by folding over that edge.
 */
function foldStep(f: FaceFrame, dx: number, dy: number): FaceFrame {
  if (dx === 1)  return { normal: [...f.right] as Vec3i, up: [...f.up]     as Vec3i, right: neg(f.normal) };
  if (dx === -1) return { normal: neg(f.right),           up: [...f.up]     as Vec3i, right: [...f.normal] as Vec3i };
  if (dy === -1) return { normal: [...f.up]    as Vec3i,  up: neg(f.normal),           right: [...f.right] as Vec3i };
  /*  dy === 1 */ return { normal: neg(f.up),              up: [...f.normal] as Vec3i, right: [...f.right] as Vec3i };
}

/**
 * BFS fold simulation: assigns each reachable cell a FaceFrame
 * (normal, up, right in 3D cube space).
 * Starts from the first cell in the map with the canonical front-face frame.
 */
export function computeCellFrames(cells: Map<CellKey, CellData>): Map<CellKey, FaceFrame> {
  const keys = Array.from(cells.keys());
  if (keys.length === 0) return new Map();

  const startFrame: FaceFrame = { normal: [0, 0, 1], up: [0, -1, 0], right: [1, 0, 0] };
  const frames = new Map<CellKey, FaceFrame>();
  frames.set(keys[0], startFrame);

  const queue = [keys[0]];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const frame = frames.get(current)!;
    const { x, y } = gridParseKey(current);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const neighbor = gridKeyOf(x + dx, y + dy);
      if (cells.has(neighbor) && !frames.has(neighbor)) {
        frames.set(neighbor, foldStep(frame, dx, dy));
        queue.push(neighbor);
      }
    }
  }
  return frames;
}

/**
 * Returns the 3 pairs of opposite-face cell keys for a 6-cell net.
 * Uses BFS fold simulation to assign each cell a cube face normal,
 * then pairs cells whose normals are opposite.
 * Returns an empty array if the net doesn't have exactly 6 cells.
 */
export function findOppositePairs(cells: Map<CellKey, CellData>): [CellKey, CellKey][] {
  if (cells.size !== 6) return [];

  const cellFrames = computeCellFrames(cells);

  // Group cells by normal vector key
  const byNormal = new Map<string, CellKey>();
  for (const [key, f] of cellFrames) {
    byNormal.set(f.normal.join(","), key);
  }

  // Match opposite normal pairs
  const pairs: [CellKey, CellKey][] = [];
  const used = new Set<string>();
  for (const [normalStr, key] of byNormal) {
    if (used.has(normalStr)) continue;
    const oppStr = normalStr.split(",").map((n) => String(-Number(n))).join(",");
    const oppKey = byNormal.get(oppStr);
    if (oppKey) {
      pairs.push([key, oppKey]);
      used.add(normalStr);
      used.add(oppStr);
    }
  }
  return pairs;
}

// ─── Net Templates ────────────────────────────────────────────────────────────

const CUBE_NET_NAMES = [
  "Haken", "Blitz", "T-Form", "S-Form", "Z-Form", "Fahne",
  "Treppe", "Gabel", "L-Form", "Kreuz", "Welle",
];

const CUBOID_NET_NAMES = ["Haken", "Blitz", "T-Form"];

export function netTemplates(): Array<{
  id: string;
  label: string;
  body: NetBody;
  cells: [number, number][];
}> {
  const toCoords = (keys: CellKey[]): [number, number][] =>
    keys.map((key) => {
      const { x, y } = gridParseKey(key);
      return [x, y];
    });

  const cubeTemplates = getValidCubeNets().map((keys, index) => ({
    id: `cube-template-${index + 1}`,
    label: CUBE_NET_NAMES[index] ?? `Würfelnetz ${index + 1}`,
    body: "cube" as const,
    cells: toCoords(keys),
  }));

  const cuboidTemplates = getValidCuboidNets().slice(0, 3).map((keys, index) => ({
    id: `cuboid-template-${index + 1}`,
    label: CUBOID_NET_NAMES[index] ?? `Quadernetz ${index + 1}`,
    body: "cuboid" as const,
    cells: toCoords(keys),
  }));

  return [...cubeTemplates, ...cuboidTemplates];
}
