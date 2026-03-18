/**
 * Tests für den URL Hash Router (src/app/router.ts).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { parseRoute, setRoute, onRouteChange, navigateHome } from "./router";

describe("Router", () => {
  beforeEach(() => {
    // Reset hash
    window.location.hash = "";
  });

  // ── parseRoute ──────────────────────────────────────────────────────────────

  describe("parseRoute", () => {
    it("leerer Hash gibt null zurück", () => {
      window.location.hash = "";
      expect(parseRoute()).toBeNull();
    });

    it("nur # gibt null zurück", () => {
      window.location.hash = "#";
      expect(parseRoute()).toBeNull();
    });

    it("nur #/ gibt null zurück", () => {
      window.location.hash = "#/";
      expect(parseRoute()).toBeNull();
    });

    it("parst moduleId korrekt", () => {
      window.location.hash = "#/multiplication";
      const route = parseRoute();
      expect(route).toEqual({ moduleId: "multiplication" });
    });

    it("parst moduleId + taskType korrekt", () => {
      window.location.hash = "#/multiplication/dot";
      const route = parseRoute();
      expect(route).toEqual({ moduleId: "multiplication", taskType: "dot" });
    });

    it("parst moduleId + taskType + difficulty korrekt", () => {
      window.location.hash = "#/multiplication/dot?d=2";
      const route = parseRoute();
      expect(route).toEqual({ moduleId: "multiplication", taskType: "dot", difficulty: 2 });
    });

    it("ignoriert Difficulty 0", () => {
      window.location.hash = "#/addition/numberline?d=0";
      const route = parseRoute();
      expect(route).not.toBeNull();
      expect(route!.difficulty).toBeUndefined();
    });

    it("ignoriert nicht-numerische Difficulty", () => {
      window.location.hash = "#/addition/numberline?d=abc";
      const route = parseRoute();
      expect(route).not.toBeNull();
      expect(route!.difficulty).toBeUndefined();
    });

    it("ungültiger Hash gibt null zurück", () => {
      window.location.hash = "#/123invalid";
      expect(parseRoute()).toBeNull();
    });

    it("parst Hash mit Bindestrich in moduleId", () => {
      window.location.hash = "#/schriftliches-rechnen";
      const route = parseRoute();
      expect(route).not.toBeNull();
      expect(route!.moduleId).toBe("schriftliches-rechnen");
    });
  });

  // ── setRoute ────────────────────────────────────────────────────────────────

  describe("setRoute", () => {
    it("setzt Hash mit moduleId", () => {
      setRoute({ moduleId: "multiplication" });
      expect(window.location.hash).toBe("#/multiplication");
    });

    it("setzt Hash mit moduleId + taskType", () => {
      setRoute({ moduleId: "multiplication", taskType: "dot" });
      expect(window.location.hash).toBe("#/multiplication/dot");
    });

    it("setzt Hash mit moduleId + taskType + difficulty", () => {
      setRoute({ moduleId: "multiplication", taskType: "dot", difficulty: 2 });
      expect(window.location.hash).toBe("#/multiplication/dot?d=2");
    });
  });

  // ── onRouteChange ───────────────────────────────────────────────────────────

  describe("onRouteChange", () => {
    it("gibt unsubscribe-Funktion zurück", () => {
      const unsub = onRouteChange(() => {});
      expect(typeof unsub).toBe("function");
      unsub();
    });
  });

  // ── navigateHome ────────────────────────────────────────────────────────────

  describe("navigateHome", () => {
    it("entfernt Hash aus URL", () => {
      window.location.hash = "#/multiplication";
      navigateHome();
      expect(window.location.hash).toBe("");
    });
  });
});
