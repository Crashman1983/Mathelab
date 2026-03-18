/**
 * Tests für CanvasScene — Scene Graph Runtime.
 * Prüft measure→layout→draw Pipeline, HitArea-Sammlung, Baumsuche.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createScene, prefersReducedMotion } from "./scene";
import { ButtonNode } from "./nodes/button";
import { text } from "./nodes/text";
import { vstack } from "./nodes/container";
import { mockCanvas } from "@test/test-helpers";

describe("CanvasScene", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = mockCanvas(800, 600);
  });

  it("createScene erstellt CanvasScene-Instanz", () => {
    const scene = createScene(canvas);
    expect(scene).not.toBeNull();
    expect(scene).toBeDefined();
  });

  it("setRoot setzt root-Node", () => {
    const scene = createScene(canvas);
    const root = vstack([]);
    scene.setRoot(root);
    expect(scene.getRoot()).toBe(root);
  });

  it("getRoot gibt null wenn kein root gesetzt", () => {
    const scene = createScene(canvas);
    expect(scene.getRoot()).toBeNull();
  });

  it("getRoot gibt gesetzten root zurück", () => {
    const scene = createScene(canvas);
    const node = vstack([text("Hallo")]);
    scene.setRoot(node);
    expect(scene.getRoot()).toBe(node);
  });

  it("render mit null root wirft keinen Fehler", () => {
    const scene = createScene(canvas);
    expect(() => scene.render()).not.toThrow();
  });

  it("render mit root führt Pipeline aus", () => {
    const scene = createScene(canvas);
    const btn = new ButtonNode("Test");
    const root = vstack([btn]);
    scene.setRoot(root);
    scene.render();

    // Nach render sollte der root eine zugewiesene Größe haben
    expect(root.allocatedRect.w).toBeGreaterThan(0);
    expect(root.allocatedRect.h).toBeGreaterThan(0);
  });

  it("hitTest gibt null für leere Szene", () => {
    const scene = createScene(canvas);
    scene.setRoot(vstack([]));
    scene.render();
    expect(scene.hitTest(100, 100)).toBeNull();
  });

  it("hitTest gibt HitArea für ButtonNode zurück", () => {
    const scene = createScene(canvas);
    const tap = vi.fn();
    const btn = new ButtonNode("Klick", { onTap: tap, testId: "hit-btn" });
    scene.setRoot(vstack([btn]));
    scene.render();

    const rect = btn.allocatedRect;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const hit = scene.hitTest(cx, cy);

    expect(hit).not.toBeNull();
    expect(hit!.testId).toBe("hit-btn");
  });

  it("hitTest gibt null für Koordinaten außerhalb von Buttons", () => {
    const scene = createScene(canvas);
    const btn = new ButtonNode("Test", { testId: "btn-1" });
    scene.setRoot(vstack([btn]));
    scene.render();

    // Weit außerhalb des Canvas
    const hit = scene.hitTest(9999, 9999);
    expect(hit).toBeNull();
  });

  it("findHitArea findet nach testId", () => {
    const scene = createScene(canvas);
    const btn = new ButtonNode("Suche", { testId: "find-me" });
    scene.setRoot(vstack([btn]));
    scene.render();

    const area = scene.findHitArea("find-me");
    expect(area).not.toBeNull();
    expect(area!.testId).toBe("find-me");
  });

  it("findHitArea gibt null für nicht existierende testId", () => {
    const scene = createScene(canvas);
    scene.setRoot(vstack([new ButtonNode("A")]));
    scene.render();

    expect(scene.findHitArea("gibts-nicht")).toBeNull();
  });

  it("find findet Node nach id", () => {
    const scene = createScene(canvas);
    const title = text("Überschrift", { id: "title" });
    scene.setRoot(vstack([title]));
    scene.render();

    const found = scene.find("title");
    expect(found).not.toBeNull();
    expect(found!.id).toBe("title");
  });

  it("find gibt null für nicht existierende id", () => {
    const scene = createScene(canvas);
    scene.setRoot(vstack([text("Hallo")]));
    scene.render();

    expect(scene.find("existiert-nicht")).toBeNull();
  });

  it("getHitAreas gibt leeres Array ohne Buttons", () => {
    const scene = createScene(canvas);
    scene.setRoot(vstack([text("Nur Text")]));
    scene.render();

    expect(scene.getHitAreas()).toEqual([]);
  });

  it("getHitAreas sammelt ButtonNode HitAreas nach render", () => {
    const scene = createScene(canvas);
    const btn1 = new ButtonNode("Eins", { testId: "b1" });
    const btn2 = new ButtonNode("Zwei", { testId: "b2" });
    scene.setRoot(vstack([btn1, btn2]));
    scene.render();

    const areas = scene.getHitAreas();
    expect(areas).toHaveLength(2);
    expect(areas[0].testId).toBe("b1");
    expect(areas[1].testId).toBe("b2");
  });

  it("invalidate markiert Scene für Re-Render", () => {
    const scene = createScene(canvas);
    expect(() => scene.invalidate()).not.toThrow();
  });

  it("destroy bereinigt Ressourcen", () => {
    const scene = createScene(canvas);
    scene.setRoot(vstack([new ButtonNode("X")]));
    scene.render();

    expect(() => scene.destroy()).not.toThrow();
    expect(scene.getRoot()).toBeNull();
  });

  it("prefersReducedMotion gibt boolean zurück", () => {
    const result = prefersReducedMotion();
    expect(typeof result).toBe("boolean");
  });
});
