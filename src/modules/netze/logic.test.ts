/**
 * Tests für Körper und Netze – Logik
 */
import { describe, it, expect } from "vitest";
import {
  analyzeNet,
  computeCellFrames,
  findOppositePairs,
  getAdjacentKeys,
  getValidCubeNets,
  getValidCuboidNets,
  netTemplates,
} from "./logic";
import type { CellData, NetBody } from "./logic";
import { gridKeyOf } from "@core/utils";
import { makeNetMap, CROSS_NET } from "@test/helpers";

// ─── Helper (lokaler Alias + rückwärtskompatible Wrapper) ─────────────────────

const makeMap = makeNetMap;
const BODY: NetBody = "cube";

// ─── getAdjacentKeys ─────────────────────────────────────────────────────────

describe("getAdjacentKeys", () => {
  it("returns 4 neighbors for a given key", () => {
    const adj = getAdjacentKeys("0,0");
    expect(adj).toHaveLength(4);
  });

  it("returns correct neighbors for (0,0)", () => {
    const adj = new Set(getAdjacentKeys("0,0"));
    expect(adj.has("0,-1")).toBe(true);
    expect(adj.has("0,1")).toBe(true);
    expect(adj.has("-1,0")).toBe(true);
    expect(adj.has("1,0")).toBe(true);
  });

  it("returns correct neighbors for (2,3)", () => {
    const adj = new Set(getAdjacentKeys("2,3"));
    expect(adj.has("2,2")).toBe(true);
    expect(adj.has("2,4")).toBe(true);
    expect(adj.has("1,3")).toBe(true);
    expect(adj.has("3,3")).toBe(true);
  });

  it("does not include diagonals", () => {
    const adj = getAdjacentKeys("0,0");
    expect(adj).not.toContain("1,1");
    expect(adj).not.toContain("-1,-1");
  });
});

// ─── analyzeNet – empty/small ─────────────────────────────────────────────────

describe("analyzeNet – empty/small maps", () => {
  it("empty map: faceCount 0, not connected, not valid", () => {
    const result = analyzeNet(new Map(), BODY);
    expect(result.faceCount).toBe(0);
    expect(result.connected).toBe(false);
    expect(result.validCubeNet).toBe(false);
    expect(result.validCuboidNet).toBe(false);
    expect(result.conflictPairs).toHaveLength(0);
  });

  it("single cell: faceCount 1, connected, not valid cube net", () => {
    const m = makeMap([[0, 0]]);
    const result = analyzeNet(m, BODY);
    expect(result.faceCount).toBe(1);
    expect(result.connected).toBe(true);
    expect(result.validCubeNet).toBe(false);
  });

  it("5 connected cells: not a valid cube net (too few faces)", () => {
    const m = makeMap([[0,0],[1,0],[2,0],[3,0],[4,0]]);
    const result = analyzeNet(m, BODY);
    expect(result.faceCount).toBe(5);
    expect(result.connected).toBe(true);
    expect(result.validCubeNet).toBe(false);
  });

  it("7 connected cells: not a valid cube net (too many faces)", () => {
    const m = makeMap([[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0]]);
    const result = analyzeNet(m, BODY);
    expect(result.faceCount).toBe(7);
    expect(result.validCubeNet).toBe(false);
  });
});

// ─── analyzeNet – connectivity ────────────────────────────────────────────────

describe("analyzeNet – connectivity", () => {
  it("disconnected 6 cells: not valid", () => {
    // Two groups far apart
    const m = makeMap([[0,0],[1,0],[2,0],[10,10],[11,10],[12,10]]);
    const result = analyzeNet(m, BODY);
    expect(result.connected).toBe(false);
    expect(result.validCubeNet).toBe(false);
  });

  it("connected cross shape: connected=true", () => {
    const cross: [number, number][] = [[1,0],[0,1],[1,1],[2,1],[3,1],[1,2]];
    const m = makeMap(cross);
    const result = analyzeNet(m, BODY);
    expect(result.connected).toBe(true);
  });
});

// ─── analyzeNet – valid cube nets ────────────────────────────────────────────

describe("analyzeNet – valid cube nets", () => {
  it("classic cross net is valid", () => {
    const m = makeMap(CROSS_NET);
    const result = analyzeNet(m, "cube");
    expect(result.validCubeNet).toBe(true);
  });

  it("linear row of 6 is NOT a valid cube net", () => {
    const m = makeMap([[0,0],[1,0],[2,0],[3,0],[4,0],[5,0]]);
    const result = analyzeNet(m, "cube");
    expect(result.validCubeNet).toBe(false);
  });

  it("2×3 rectangle IS NOT a valid cube net", () => {
    const m = makeMap([[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]]);
    const result = analyzeNet(m, "cube");
    expect(result.validCubeNet).toBe(false);
  });

  it("T-shape net is valid cube net", () => {
    const cells: [number, number][] = [[0,0],[1,0],[2,0],[1,1],[1,2],[1,-1]];
    const m = makeMap(cells);
    const result = analyzeNet(m, "cube");
    expect(result.validCubeNet).toBe(true);
  });
});

// ─── analyzeNet – conflict pairs ─────────────────────────────────────────────

describe("analyzeNet – conflict pairs", () => {
  it("no conflicts when all IDs are unique", () => {
    const m = makeMap(CROSS_NET);
    expect(analyzeNet(m, "cube").conflictPairs).toHaveLength(0);
  });

  it("detects conflict when two cells have same face ID", () => {
    const m = new Map<string, CellData>([
      [gridKeyOf(0, 0), { color: "#fff", id: 1 }],
      [gridKeyOf(1, 0), { color: "#fff", id: 1 }], // duplicate ID
      [gridKeyOf(2, 0), { color: "#fff", id: 2 }],
    ]);
    const result = analyzeNet(m, "cube");
    expect(result.conflictPairs.length).toBeGreaterThan(0);
  });
});

// ─── getValidCubeNets ─────────────────────────────────────────────────────────

describe("getValidCubeNets", () => {
  it("returns exactly 11 nets", () => {
    expect(getValidCubeNets()).toHaveLength(11);
  });

  it("each net has exactly 6 cells", () => {
    for (const net of getValidCubeNets()) {
      expect(net).toHaveLength(6);
    }
  });

  it("each net has unique cell keys", () => {
    for (const net of getValidCubeNets()) {
      expect(new Set(net).size).toBe(6);
    }
  });
});

// ─── getValidCuboidNets ───────────────────────────────────────────────────────

describe("getValidCuboidNets", () => {
  it("returns at least 3 nets", () => {
    expect(getValidCuboidNets().length).toBeGreaterThanOrEqual(3);
  });

  it("each net has exactly 6 cells", () => {
    for (const net of getValidCuboidNets()) {
      expect(net).toHaveLength(6);
    }
  });
});

// ─── netTemplates ─────────────────────────────────────────────────────────────

describe("netTemplates", () => {
  it("returns at least 8 templates", () => {
    expect(netTemplates().length).toBeGreaterThanOrEqual(8);
  });

  it("at least 5 cube templates", () => {
    const cubeTemplates = netTemplates().filter((t) => t.body === "cube");
    expect(cubeTemplates.length).toBeGreaterThanOrEqual(5);
  });

  it("at least 3 cuboid templates", () => {
    const cuboidTemplates = netTemplates().filter((t) => t.body === "cuboid");
    expect(cuboidTemplates.length).toBeGreaterThanOrEqual(3);
  });

  it("each template has 6 cells", () => {
    for (const template of netTemplates()) {
      expect(template.cells).toHaveLength(6);
    }
  });

  it("each template has a unique id", () => {
    const ids = netTemplates().map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each template has a non-empty label", () => {
    for (const template of netTemplates()) {
      expect(template.label.length).toBeGreaterThan(0);
    }
  });

  it("returns exactly 11 cube templates", () => {
    const cubeTemplates = netTemplates().filter((t) => t.body === "cube");
    expect(cubeTemplates).toHaveLength(11);
  });

  it("cube template labels are all unique", () => {
    const labels = netTemplates()
      .filter((t) => t.body === "cube")
      .map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("no cube template falls back to generic label", () => {
    const cubeTemplates = netTemplates().filter((t) => t.body === "cube");
    for (const template of cubeTemplates) {
      expect(template.label).not.toMatch(/^Würfelnetz \d+$/);
    }
  });

  it("cube template labels match expected names", () => {
    const expectedNames = [
      "Haken", "Blitz", "T-Form", "S-Form", "Z-Form", "Fahne",
      "Treppe", "Gabel", "L-Form", "Kreuz", "Welle",
    ];
    const actualLabels = netTemplates()
      .filter((t) => t.body === "cube")
      .map((t) => t.label);
    expect(actualLabels).toEqual(expectedNames);
  });
});

describe("computeCellFrames / findOppositePairs", () => {
  it("ordnet bei einem gültigen Würfelnetz sechs unterschiedliche Normalen zu", () => {
    const frames = computeCellFrames(makeMap(CROSS_NET));
    expect(frames.size).toBe(6);
    const normals = new Set([...frames.values()].map((frame) => frame.normal.join(",")));
    expect(normals.size).toBe(6);
  });

  it("findet bei einem gültigen Würfelnetz genau drei Gegenüber-Paare", () => {
    const pairs = findOppositePairs(makeMap(CROSS_NET));
    expect(pairs).toHaveLength(3);
    expect(new Set(pairs.flat()).size).toBe(6);
  });

  it("liefert für alle bekannten Würfelnetze sechs eindeutige Flächennormalen", () => {
    for (const net of getValidCubeNets()) {
      const coords = net.map((key) => {
        const [x, y] = key.split(",").map(Number);
        return [x, y] as [number, number];
      });
      const frames = computeCellFrames(makeMap(coords));
      const normals = new Set([...frames.values()].map((frame) => frame.normal.join(",")));
      expect(normals.size).toBe(6);
    }
  });
});
