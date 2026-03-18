import { describe, it, expect } from "vitest";

// ─── Modul-Import-Sicherheit ─────────────────────────────────────────────────
// Jedes V2-Modul muss fehlerfrei importierbar sein und eine gültige
// ModuleRegistration exportieren (id, label, icon, description, factory).

interface ExpectedModule {
  /** Dynamischer Import-Pfad relativ zu src/modules/ */
  path: string;
  /** Name der exportierten Registration-Konstante */
  exportName: string;
  /** Erwartete Modul-ID */
  expectedId: string;
  /** Erwartetes Label (deutsch) */
  expectedLabel: string;
}

const MODULES: ExpectedModule[] = [
  { path: "./addition/v2", exportName: "additionV2Registration", expectedId: "addition", expectedLabel: "Addition" },
  { path: "./subtraction/v2", exportName: "subtractionV2Registration", expectedId: "subtraction", expectedLabel: "Subtraktion" },
  { path: "./multiplication/v2", exportName: "multiplicationV2Registration", expectedId: "multiplication", expectedLabel: "Einmaleins" },
  { path: "./numbers/v2", exportName: "numbersV2Registration", expectedId: "numbers", expectedLabel: "Zahlenlabor" },
  { path: "./fractions/v2", exportName: "fractionsV2Registration", expectedId: "fractions", expectedLabel: "Bruchlabor" },
  { path: "./geometry/v2", exportName: "geometryV2Registration", expectedId: "geometry", expectedLabel: "Geometrie" },
  { path: "./symmetry/v2", exportName: "symmetryV2Registration", expectedId: "symmetry", expectedLabel: "Symmetrie" },
  { path: "./patterns/v2", exportName: "patternsV2Registration", expectedId: "patterns", expectedLabel: "Muster & Strukturen" },
  { path: "./coordinates/v2", exportName: "coordinatesV2Registration", expectedId: "coordinates", expectedLabel: "Koordinaten" },
  { path: "./time/v2", exportName: "timeV2Registration", expectedId: "time", expectedLabel: "Zeit & Kalender" },
  { path: "./measures/v2", exportName: "measuresV2Registration", expectedId: "measures", expectedLabel: "Größen & Messen" },
  { path: "./chance/v2", exportName: "chanceV2Registration", expectedId: "chance", expectedLabel: "Daten & Zufall" },
  { path: "./netze/v2", exportName: "netzeV2Registration", expectedId: "netze", expectedLabel: "K\u00F6rper & Netze" },
  { path: "./algorithms/v2", exportName: "algorithmsV2Registration", expectedId: "algorithms", expectedLabel: "Schriftliches Rechnen" },
];

describe("Module-Importe (V2)", () => {
  for (const { path, expectedId } of MODULES) {
    it(`${expectedId}/v2.ts importiert ohne Fehler`, async () => {
      const mod = await import(path);
      expect(mod).toBeDefined();
    });
  }
});

describe("ModuleRegistration-Struktur", () => {
  for (const { path, exportName, expectedId } of MODULES) {
    it(`${expectedId} exportiert '${exportName}' mit korrekter Struktur`, async () => {
      const mod = await import(path);
      const reg = mod[exportName];
      expect(reg).toBeDefined();
      expect(typeof reg.id).toBe("string");
      expect(typeof reg.label).toBe("string");
      expect(typeof reg.icon).toBe("string");
      expect(typeof reg.description).toBe("string");
      expect(typeof reg.factory).toBe("function");
    });
  }
});

describe("Modul-IDs sind korrekt", () => {
  for (const { path, exportName, expectedId } of MODULES) {
    it(`${expectedId} hat id '${expectedId}'`, async () => {
      const mod = await import(path);
      expect(mod[exportName].id).toBe(expectedId);
    });
  }
});

describe("Modul-Labels (deutsch)", () => {
  for (const { path, exportName, expectedId, expectedLabel } of MODULES) {
    it(`${expectedId} hat Label '${expectedLabel}'`, async () => {
      const mod = await import(path);
      expect(mod[exportName].label).toBe(expectedLabel);
    });
  }
});

describe("Modul-Icons sind nicht leer", () => {
  for (const { path, exportName, expectedId } of MODULES) {
    it(`${expectedId} hat ein nicht-leeres Icon`, async () => {
      const mod = await import(path);
      const icon: string = mod[exportName].icon;
      expect(icon.trim().length).toBeGreaterThan(0);
    });
  }
});

describe("Modul-Descriptions sind nicht leer", () => {
  for (const { path, exportName, expectedId } of MODULES) {
    it(`${expectedId} hat eine nicht-leere Beschreibung`, async () => {
      const mod = await import(path);
      const desc: string = mod[exportName].description;
      expect(desc.trim().length).toBeGreaterThan(0);
    });
  }
});

describe("factory() erzeugt gültige LernModul-Objekte", () => {
  for (const { path, exportName, expectedId } of MODULES) {
    it(`${expectedId} factory gibt Objekt mit mount/activate/deactivate/resize/destroy`, async () => {
      const mod = await import(path);
      const lernModul = mod[exportName].factory();
      expect(typeof lernModul.mount).toBe("function");
      expect(typeof lernModul.activate).toBe("function");
      expect(typeof lernModul.deactivate).toBe("function");
      expect(typeof lernModul.resize).toBe("function");
      expect(typeof lernModul.destroy).toBe("function");
    });
  }
});
