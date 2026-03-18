/**
 * Tests für den AppStateManager (src/core/state.ts).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { appState } from "./state";

describe("AppStateManager", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset internal state by re-triggering load
    // Since appState is a singleton, we need to reset via set()
    appState.set("theme", "dark");
    appState.set("difficulty", 1);
    appState.set("onboarding", {});
    appState.set("stats", {});
  });

  // ── Theme ──────────────────────────────────────────────────────────────────

  describe("Theme", () => {
    it("Default-Theme ist 'dark'", () => {
      expect(appState.get("theme")).toBe("dark");
    });

    it("set('theme', 'light') persistiert korrekt", () => {
      appState.set("theme", "light");
      expect(appState.get("theme")).toBe("light");
    });

    it("Theme-Änderung synct Legacy-Key", () => {
      appState.set("theme", "light");
      expect(localStorage.getItem("mathelabor_theme")).toBe("light");
    });
  });

  // ── Difficulty ──────────────────────────────────────────────────────────────

  describe("Difficulty", () => {
    it("Default-Difficulty ist 1", () => {
      expect(appState.get("difficulty")).toBe(1);
    });

    it("set('difficulty', 2) persistiert korrekt", () => {
      appState.set("difficulty", 2);
      expect(appState.get("difficulty")).toBe(2);
    });

    it("Difficulty-Änderung synct Legacy-Key", () => {
      appState.set("difficulty", 2);
      expect(localStorage.getItem("mathelabor-difficulty")).toBe("2");
    });
  });

  // ── Onboarding ──────────────────────────────────────────────────────────────

  describe("Onboarding", () => {
    it("isOnboardingDone gibt false für unbekanntes Modul", () => {
      expect(appState.isOnboardingDone("unknown-module")).toBe(false);
    });

    it("markOnboardingDone setzt Flag korrekt", () => {
      appState.markOnboardingDone("multiplication");
      expect(appState.isOnboardingDone("multiplication")).toBe(true);
    });

    it("Onboarding-Flag setzt Legacy-Key", () => {
      appState.markOnboardingDone("multiplication");
      expect(localStorage.getItem("mathelabor_onboarding_multiplication")).toBe("done");
    });

    it("Onboarding für ein Modul beeinflusst andere nicht", () => {
      appState.markOnboardingDone("multiplication");
      expect(appState.isOnboardingDone("addition")).toBe(false);
    });
  });

  // ── Stats ───────────────────────────────────────────────────────────────────

  describe("Stats", () => {
    it("getStats gibt {attempts:0, correct:0} für unbekannten Key", () => {
      expect(appState.getStats("unknown")).toEqual({ attempts: 0, correct: 0 });
    });

    it("recordStat inkrementiert attempts", () => {
      appState.recordStat("multi", "dot", false);
      expect(appState.getStats("multi:dot").attempts).toBe(1);
    });

    it("recordStat mit correct=true inkrementiert correct", () => {
      appState.recordStat("multi", "dot", true);
      const s = appState.getStats("multi:dot");
      expect(s.attempts).toBe(1);
      expect(s.correct).toBe(1);
    });

    it("recordStat aktualisiert globale Stats", () => {
      appState.recordStat("multi", "dot", true);
      appState.recordStat("add", "numberline", false);
      const global = appState.getStats("__global__");
      expect(global.attempts).toBe(2);
      expect(global.correct).toBe(1);
    });

    it("getModuleStats aggregiert alle taskTypes eines Moduls", () => {
      appState.recordStat("multi", "dot", true);
      appState.recordStat("multi", "jumps", true);
      appState.recordStat("multi", "divide", false);
      const stats = appState.getModuleStats("multi");
      expect(stats.attempts).toBe(3);
      expect(stats.correct).toBe(2);
    });

    it("getModuleStats mit taskType gibt spezifische Stats", () => {
      appState.recordStat("multi", "dot", true);
      appState.recordStat("multi", "jumps", false);
      const stats = appState.getModuleStats("multi", "dot");
      expect(stats.attempts).toBe(1);
      expect(stats.correct).toBe(1);
    });
  });

  // ── Persistence ─────────────────────────────────────────────────────────────

  describe("Persistence", () => {
    it("State wird in localStorage gespeichert", () => {
      appState.set("theme", "light");
      const raw = localStorage.getItem("mathelabor_state");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.theme).toBe("light");
    });
  });
});
