import { describe, it, expect } from "vitest";
import { DIFFICULTIES } from "./module-framework";
import type { DifficultyDefinition } from "./module-framework";

describe("DIFFICULTIES Konstante", () => {
  it("hat genau 3 Einträge (Junior, Checker, BossBaby)", () => {
    expect(DIFFICULTIES).toHaveLength(3);
  });

  it("erster Eintrag hat level 1 und Label 'Junior'", () => {
    expect(DIFFICULTIES[0].level).toBe(1);
    expect(DIFFICULTIES[0].label).toBe("Junior");
  });

  it("zweiter Eintrag hat level 2 und Label 'Checker'", () => {
    expect(DIFFICULTIES[1].level).toBe(2);
    expect(DIFFICULTIES[1].label).toBe("Checker");
  });

  it("dritter Eintrag hat level 3 und Label 'BossBaby'", () => {
    expect(DIFFICULTIES[2].level).toBe(3);
    expect(DIFFICULTIES[2].label).toBe("BossBaby");
  });

  it("beide Einträge haben ein Icon", () => {
    for (const d of DIFFICULTIES) {
      expect(d.icon).toBeDefined();
      expect(typeof d.icon).toBe("string");
      expect(d.icon!.length).toBeGreaterThan(0);
    }
  });

  it("alle Labels sind nicht-leere Strings", () => {
    for (const d of DIFFICULTIES) {
      expect(typeof d.label).toBe("string");
      expect(d.label.length).toBeGreaterThan(0);
    }
  });

  it("alle Levels sind positive ganze Zahlen", () => {
    for (const d of DIFFICULTIES) {
      expect(Number.isInteger(d.level)).toBe(true);
      expect(d.level).toBeGreaterThan(0);
    }
  });

  it("Level-Werte sind aufsteigend sortiert", () => {
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      expect(DIFFICULTIES[i].level).toBeGreaterThan(DIFFICULTIES[i - 1].level);
    }
  });

  it("jeder Eintrag hat genau die Felder level, label und icon", () => {
    for (const d of DIFFICULTIES) {
      expect(d).toHaveProperty("level");
      expect(d).toHaveProperty("label");
      expect(d).toHaveProperty("icon");
    }
  });

  it("Level-Werte sind eindeutig", () => {
    const levels = DIFFICULTIES.map((d) => d.level);
    const unique = new Set(levels);
    expect(unique.size).toBe(levels.length);
  });

  it("erfüllt das DifficultyDefinition-Interface", () => {
    // Typsicherheit: jeder Eintrag muss level (number), label (string) haben
    for (const d of DIFFICULTIES) {
      const typed: DifficultyDefinition = d;
      expect(typeof typed.level).toBe("number");
      expect(typeof typed.label).toBe("string");
    }
  });

  it("Icons sind Emoji-Strings (nicht leer, kein reiner Whitespace)", () => {
    for (const d of DIFFICULTIES) {
      expect(d.icon).toBeDefined();
      expect(d.icon!.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("defineModule Struktur (via Multiplication-Modul)", () => {
  it("multiplicationV2Registration hat id, label, icon, description, factory", async () => {
    const mod = await import("@modules/multiplication/v2");
    const reg = mod.multiplicationV2Registration;
    expect(reg).toBeDefined();
    expect(typeof reg.id).toBe("string");
    expect(typeof reg.label).toBe("string");
    expect(typeof reg.icon).toBe("string");
    expect(typeof reg.description).toBe("string");
    expect(typeof reg.factory).toBe("function");
  });

  it("multiplicationV2Registration hat id 'multiplication'", async () => {
    const mod = await import("@modules/multiplication/v2");
    expect(mod.multiplicationV2Registration.id).toBe("multiplication");
  });

  it("factory gibt ein Objekt mit mount, activate, deactivate, resize, destroy zurück", async () => {
    const mod = await import("@modules/multiplication/v2");
    const lernModul = mod.multiplicationV2Registration.factory();
    expect(typeof lernModul.mount).toBe("function");
    expect(typeof lernModul.activate).toBe("function");
    expect(typeof lernModul.deactivate).toBe("function");
    expect(typeof lernModul.resize).toBe("function");
    expect(typeof lernModul.destroy).toBe("function");
  });
});
