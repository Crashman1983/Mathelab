/**
 * Tests fuer Crash Recovery (localStorage-Robustheit).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isLocalStorageAvailable,
  safeGet,
  safeSet,
  safeRemove,
  cleanupLocalStorage,
} from "./crash-recovery";

beforeEach(() => {
  localStorage.clear();
});

describe("isLocalStorageAvailable()", () => {
  it("gibt true in jsdom zurueck", () => {
    // jsdom provides a working localStorage
    expect(isLocalStorageAvailable()).toBe(true);
  });
});

describe("safeGet()", () => {
  it("liest Wert aus localStorage", () => {
    localStorage.setItem("testKey", "hello");
    expect(safeGet("testKey")).toBe("hello");
  });

  it("gibt null fuer nicht existierenden Key", () => {
    expect(safeGet("doesNotExist")).toBeNull();
  });
});

describe("safeSet()", () => {
  it("schreibt Wert in localStorage", () => {
    safeSet("myKey", "myValue");
    expect(localStorage.getItem("myKey")).toBe("myValue");
  });

  it("schreibt auch in memoryStore (lesbar via safeGet)", () => {
    safeSet("memKey", "memValue");
    // safeGet should return it (from localStorage or memory)
    expect(safeGet("memKey")).toBe("memValue");
  });
});

describe("safeRemove()", () => {
  it("entfernt aus localStorage", () => {
    localStorage.setItem("rmKey", "val");
    safeRemove("rmKey");
    expect(localStorage.getItem("rmKey")).toBeNull();
  });

  it("entfernt aus memoryStore (nicht mehr lesbar via safeGet)", () => {
    safeSet("rmKey2", "val2");
    safeRemove("rmKey2");
    expect(safeGet("rmKey2")).toBeNull();
  });
});

describe("cleanupLocalStorage()", () => {
  it("entfernt ungueltige Eintraege ('undefined', 'NaN')", () => {
    localStorage.setItem("mathelabor_broken1", "undefined");
    localStorage.setItem("mathelabor_broken2", "NaN");
    cleanupLocalStorage();
    expect(localStorage.getItem("mathelabor_broken1")).toBeNull();
    expect(localStorage.getItem("mathelabor_broken2")).toBeNull();
  });

  it("entfernt nur mathelabor_-prefixed Keys", () => {
    localStorage.setItem("other_key", "undefined");
    localStorage.setItem("mathelabor_bad", "undefined");
    cleanupLocalStorage();
    // non-prefixed key should remain
    expect(localStorage.getItem("other_key")).toBe("undefined");
    expect(localStorage.getItem("mathelabor_bad")).toBeNull();
  });

  it("ignoriert gueltige Eintraege", () => {
    localStorage.setItem("mathelabor_valid", '{"score":42}');
    cleanupLocalStorage();
    expect(localStorage.getItem("mathelabor_valid")).toBe('{"score":42}');
  });
});
