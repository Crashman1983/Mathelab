import { describe, it, expect } from "vitest";
import {
  generateTask,
  getDifference,
  checkAnswer,
  getJumpPositions,
  getNumberLineRange,
  getHints,
} from "./logic";

describe("Subtraktion logic", () => {
  describe("generateTask", () => {
    it("produces a task with correct mode", () => {
      const t = generateTask("numberline", 1);
      expect(t.mode).toBe("numberline");
    });

    it("difficulty 1 (Junior): result >= 0, a <= 20 (ZR bis 20)", () => {
      for (let i = 0; i < 50; i++) {
        const t = generateTask("numberline", 1);
        expect(getDifference(t)).toBeGreaterThanOrEqual(0);
        expect(t.a).toBeLessThanOrEqual(20);
        expect(t.b).toBeGreaterThanOrEqual(1);
      }
    });

    it("difficulty 2 (Checker): result >= 0, a <= 100 (ZR bis 100)", () => {
      for (let i = 0; i < 50; i++) {
        const t = generateTask("numberline", 2);
        expect(getDifference(t)).toBeGreaterThanOrEqual(0);
        expect(t.a).toBeLessThanOrEqual(100);
      }
    });

    it("difficulty 3: result >= 0, a <= 1000", () => {
      for (let i = 0; i < 50; i++) {
        const t = generateTask("numberline", 3);
        expect(getDifference(t)).toBeGreaterThanOrEqual(0);
        expect(t.a).toBeLessThanOrEqual(1000);
      }
    });

    it("avoids repeating same task", () => {
      const t1 = generateTask("numberline", 1);
      const t2 = generateTask("numberline", 1, t1);
      expect(t1.a === t2.a && t1.b === t2.b).toBe(false);
    });

    it("decomposes b by place value (Stellenwertzerlegung)", () => {
      for (let i = 0; i < 100; i++) {
        const t = generateTask("numberline", 2);
        const s1 = t.step1 ?? 0;
        const s2 = t.step2 ?? 0;
        // step1 + step2 must equal b
        expect(s1 + s2).toBe(t.b);
        // step1 should be a clean multiple of 10 or 100
        if (t.b >= 100) {
          expect(s1 % 100).toBe(0); // hundreds
        } else if (t.b >= 10) {
          expect(s1 % 10).toBe(0); // tens
        }
      }
    });
  });

  describe("getDifference", () => {
    it("returns a - b", () => {
      expect(getDifference({ a: 10, b: 3, mode: "numberline" })).toBe(7);
      expect(getDifference({ a: 50, b: 18, mode: "numberline" })).toBe(32);
    });
  });

  describe("checkAnswer", () => {
    it("accepts correct answer", () => {
      const t = { a: 15, b: 7, mode: "numberline" as const };
      expect(checkAnswer(t, 8)).toBe(true);
    });

    it("rejects wrong answer", () => {
      const t = { a: 15, b: 7, mode: "numberline" as const };
      expect(checkAnswer(t, 7)).toBe(false);
      expect(checkAnswer(t, 9)).toBe(false);
    });
  });

  describe("getJumpPositions", () => {
    it("two-step: returns [a, a-step1, difference]", () => {
      const t = { a: 18, b: 8, mode: "numberline" as const, step1: 5, step2: 3 };
      const pos = getJumpPositions(t);
      expect(pos).toEqual([18, 13, 10]);
    });

    it("one-step: returns [a, difference]", () => {
      const t = { a: 10, b: 4, mode: "numberline" as const };
      const pos = getJumpPositions(t);
      expect(pos).toEqual([10, 6]);
    });
  });

  describe("getNumberLineRange", () => {
    it("min >= 0, max > a", () => {
      const t = { a: 20, b: 8, mode: "numberline" as const };
      const { min, max } = getNumberLineRange(t);
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeGreaterThan(t.a);
    });
  });

  describe("getHints", () => {
    it("returns at least 2 hints", () => {
      const t = generateTask("numberline", 1);
      expect(getHints(t).length).toBeGreaterThanOrEqual(2);
    });

    it("third hint contains the answer", () => {
      const t = { a: 12, b: 5, mode: "numberline" as const };
      const hints = getHints(t);
      expect(hints[2]).toContain("7");
    });
  });
});
