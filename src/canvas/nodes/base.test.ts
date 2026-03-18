/**
 * Unit-Tests fuer BaseNode (abstrakte Klasse — getestet via MockNode).
 */

import { describe, it, expect } from "vitest";
import { MockNode } from "@test/test-helpers";
import { DEFAULT_MEASURED, DEFAULT_RECT } from "./types";

describe("BaseNode", () => {
  it("Default lastMeasured ist DEFAULT_MEASURED", () => {
    const node = new MockNode(100, 50);
    expect(node.lastMeasured).toEqual(DEFAULT_MEASURED);
  });

  it("Default allocatedRect ist DEFAULT_RECT", () => {
    const node = new MockNode(100, 50);
    expect(node.allocatedRect).toEqual(DEFAULT_RECT);
  });

  it("layout speichert zugewiesenes Rect", () => {
    const node = new MockNode(100, 50);
    const rect = { x: 10, y: 20, w: 200, h: 100 };
    node.layout(rect);
    expect(node.allocatedRect).toEqual(rect);
  });

  it("storeMeasure speichert und gibt Measurement zurueck", () => {
    const node = new MockNode(80, 40);
    const ctx = {} as CanvasRenderingContext2D;
    const result = node.measure(ctx, { w: 800, h: 600 });
    expect(result).toEqual({ minW: 80, minH: 40, prefW: 80, prefH: 40 });
    expect(node.lastMeasured).toEqual(result);
  });

  it("id ist optional und default undefined", () => {
    const node = new MockNode(100, 50);
    expect(node.id).toBeUndefined();
  });

  it("visible ist optional und default undefined", () => {
    const node = new MockNode(100, 50);
    expect(node.visible).toBeUndefined();
  });
});
