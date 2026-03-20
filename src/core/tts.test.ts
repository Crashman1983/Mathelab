/**
 * Tests für Text-to-Speech (src/core/tts.ts).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { isTTSAvailable, isTTSEnabled, setTTSEnabled, speak, speakIfEnabled, speakElement } from "./tts";

// Mock speechSynthesis
const mockSynth = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn(() => []),
  speaking: false,
  pending: false,
  paused: false,
  onvoiceschanged: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => true),
};

// SpeechSynthesisUtterance mock
class MockUtterance {
  text: string;
  lang = "";
  rate = 1;
  pitch = 1;
  volume = 1;
  constructor(text: string) {
    this.text = text;
  }
}

Object.defineProperty(window, "speechSynthesis", { value: mockSynth, writable: true });
// @ts-expect-error mock
globalThis.SpeechSynthesisUtterance = MockUtterance;

describe("TTS", () => {
  beforeEach(() => {
    localStorage.clear();
    setTTSEnabled(false);
    vi.clearAllMocks();
  });

  it("isTTSAvailable gibt true zurück wenn speechSynthesis vorhanden", () => {
    expect(isTTSAvailable()).toBe(true);
  });

  it("isTTSEnabled gibt initial false zurück", () => {
    expect(isTTSEnabled()).toBe(false);
  });

  it("setTTSEnabled(true) aktiviert TTS", () => {
    setTTSEnabled(true);
    expect(isTTSEnabled()).toBe(true);
  });

  it("setTTSEnabled(true) persistiert in localStorage", () => {
    setTTSEnabled(true);
    expect(localStorage.getItem("mathelabor_tts_enabled")).toBe("true");
  });

  it("setTTSEnabled(false) ruft speechSynthesis.cancel auf", () => {
    setTTSEnabled(true);
    setTTSEnabled(false);
    expect(mockSynth.cancel).toHaveBeenCalled();
  });

  it("speak ruft speechSynthesis.speak auf wenn enabled", () => {
    setTTSEnabled(true);
    speak("Hallo");
    expect(mockSynth.speak).toHaveBeenCalledTimes(1);
    const utterance = mockSynth.speak.mock.calls[0][0] as MockUtterance;
    expect(utterance.text).toBe("Hallo");
  });

  it("speak ruft nicht auf wenn disabled und force=false", () => {
    setTTSEnabled(false);
    speak("Hallo", false);
    expect(mockSynth.speak).not.toHaveBeenCalled();
  });

  it("speak mit force=true spricht auch wenn disabled", () => {
    setTTSEnabled(false);
    speak("Hallo", true);
    expect(mockSynth.speak).toHaveBeenCalledTimes(1);
  });

  it("speak setzt de-DE als Sprache", () => {
    setTTSEnabled(true);
    speak("Test");
    const utterance = mockSynth.speak.mock.calls[0][0] as MockUtterance;
    expect(utterance.lang).toBe("de-DE");
  });

  it("speak setzt rate auf 0.82 (Standard-Stimme, verlangsamt für Kinder)", () => {
    setTTSEnabled(true);
    speak("Test");
    const utterance = mockSynth.speak.mock.calls[0][0] as MockUtterance;
    expect(utterance.rate).toBe(0.82);
  });

  it("speak mit priority=true ruft cancel vorher auf", () => {
    setTTSEnabled(true);
    speak("Test", false, true);
    expect(mockSynth.cancel).toHaveBeenCalled();
  });

  it("speak ignoriert leeren Text", () => {
    setTTSEnabled(true);
    speak("   ");
    expect(mockSynth.speak).not.toHaveBeenCalled();
  });

  it("speakIfEnabled spricht nur wenn enabled", () => {
    setTTSEnabled(false);
    speakIfEnabled("Hallo");
    expect(mockSynth.speak).not.toHaveBeenCalled();

    setTTSEnabled(true);
    speakIfEnabled("Hallo");
    expect(mockSynth.speak).toHaveBeenCalledTimes(1);
  });

  it("speakElement liest Textinhalt eines Elements vor", () => {
    setTTSEnabled(true);
    const el = document.createElement("div");
    el.textContent = "Aufgabe lösen";
    speakElement(el);
    expect(mockSynth.speak).toHaveBeenCalledTimes(1);
  });

  it("speakElement ignoriert null", () => {
    setTTSEnabled(true);
    speakElement(null);
    expect(mockSynth.speak).not.toHaveBeenCalled();
  });
});
