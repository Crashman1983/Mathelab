import { describe, it, expect } from "vitest";
import {
  generateTask,
  getSum,
  checkAnswer,
  getJumpPositions,
  getNumberLineRange,
  getHints,
} from "./logic";

describe("Addition logic", () => {
  describe("generateTask", () => {
    it("produces a task with correct mode", () => {
      const t = generateTask("numberline", 1);
      expect(t.mode).toBe("numberline");
    });

    it("difficulty 1 (Junior): sum <= 20 (ZR bis 20)", () => {
      for (let i = 0; i < 50; i++) {
        const t = generateTask("numberline", 1);
        expect(getSum(t)).toBeLessThanOrEqual(20);
        expect(t.a).toBeGreaterThanOrEqual(1);
        expect(t.b).toBeGreaterThanOrEqual(1);
      }
    });

    it("difficulty 2 (Checker): sum <= 200 (ZR bis 200)", () => {
      for (let i = 0; i < 50; i++) {
        const t = generateTask("numberline", 2);
        expect(getSum(t)).toBeLessThanOrEqual(200);
        expect(t.a).toBeGreaterThanOrEqual(1);
      }
    });

    it("difficulty 3: sum <= 1000", () => {
      for (let i = 0; i < 50; i++) {
        const t = generateTask("numberline", 3);
        expect(getSum(t)).toBeLessThanOrEqual(1000);
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

  describe("getSum", () => {
    it("returns a + b", () => {
      expect(getSum({ a: 3, b: 7, mode: "numberline" })).toBe(10);
      expect(getSum({ a: 25, b: 38, mode: "numberline" })).toBe(63);
    });
  });

  describe("checkAnswer", () => {
    it("accepts correct answer", () => {
      const t = { a: 4, b: 6, mode: "numberline" as const };
      expect(checkAnswer(t, 10)).toBe(true);
    });

    it("rejects wrong answer", () => {
      const t = { a: 4, b: 6, mode: "numberline" as const };
      expect(checkAnswer(t, 9)).toBe(false);
      expect(checkAnswer(t, 11)).toBe(false);
    });
  });

  describe("getJumpPositions", () => {
    it("two-step: returns [a, a+step1, sum]", () => {
      const t = { a: 10, b: 8, mode: "numberline" as const, step1: 5, step2: 3 };
      const pos = getJumpPositions(t);
      expect(pos).toEqual([10, 15, 18]);
    });

    it("one-step: returns [a, sum]", () => {
      const t = { a: 5, b: 3, mode: "numberline" as const };
      const pos = getJumpPositions(t);
      expect(pos).toEqual([5, 8]);
    });
  });

  describe("getNumberLineRange", () => {
    it("min >= 0, max > sum", () => {
      const t = { a: 10, b: 5, mode: "numberline" as const };
      const { min, max } = getNumberLineRange(t);
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeGreaterThan(getSum(t));
    });
  });

  describe("getHints", () => {
    it("returns at least 2 hints", () => {
      const t = generateTask("numberline", 1);
      expect(getHints(t).length).toBeGreaterThanOrEqual(2);
    });

    it("third hint contains the answer", () => {
      const t = { a: 4, b: 6, mode: "numberline" as const };
      const hints = getHints(t);
      expect(hints[2]).toContain("10");
    });
  });
});
