/**
 * Tests für das Sound-System (src/core/sounds.ts).
 * Testet nur Mute-State und Fehlerfreiheit — kein echtes Audio in jsdom.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { setMuted, isMuted, playRandomCorrectSound, playCorrectSound, playWrongSound, playClickSound, playCompletionSound } from "./sounds";

// Mock AudioContext da jsdom keinen hat
const mockAudioCtx = {
  state: "running",
  resume: vi.fn(() => Promise.resolve()),
  createOscillator: vi.fn(() => ({
    type: "sine",
    frequency: { value: 440, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createGain: vi.fn(() => ({
    gain: { value: 0.1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  })),
  destination: {},
  currentTime: 0,
};

// @ts-expect-error mock
globalThis.AudioContext = vi.fn(() => mockAudioCtx);

describe("Sounds", () => {
  beforeEach(() => {
    localStorage.clear();
    setMuted(false);
  });

  it("isMuted gibt initial false zurück", () => {
    expect(isMuted()).toBe(false);
  });

  it("setMuted(true) setzt Mute-State", () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
  });

  it("setMuted(true) persistiert in localStorage", () => {
    setMuted(true);
    expect(localStorage.getItem("mathelabor_muted")).toBe("1");
  });

  it("setMuted(false) setzt zurück", () => {
    setMuted(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(localStorage.getItem("mathelabor_muted")).toBe("0");
  });

  it("playRandomCorrectSound wirft nicht wenn muted", () => {
    setMuted(true);
    expect(() => playRandomCorrectSound()).not.toThrow();
  });

  it("playWrongSound wirft nicht wenn muted", () => {
    setMuted(true);
    expect(() => playWrongSound()).not.toThrow();
  });

  it("playClickSound wirft nicht wenn muted", () => {
    setMuted(true);
    expect(() => playClickSound()).not.toThrow();
  });

  it("playCompletionSound wirft nicht wenn muted", () => {
    setMuted(true);
    expect(() => playCompletionSound()).not.toThrow();
  });

  it("playCorrectSound wirft nicht wenn muted", () => {
    setMuted(true);
    expect(() => playCorrectSound()).not.toThrow();
  });

  it("playRandomCorrectSound('subtle') wirft nicht wenn muted", () => {
    setMuted(true);
    expect(() => playRandomCorrectSound("subtle")).not.toThrow();
  });

  // Unmuted tests — verify no errors with AudioContext mock
  it("playRandomCorrectSound wirft nicht wenn unmuted", () => {
    setMuted(false);
    expect(() => playRandomCorrectSound()).not.toThrow();
  });

  it("playWrongSound wirft nicht wenn unmuted", () => {
    setMuted(false);
    expect(() => playWrongSound()).not.toThrow();
  });

  it("playClickSound wirft nicht wenn unmuted", () => {
    setMuted(false);
    expect(() => playClickSound()).not.toThrow();
  });

  it("playCompletionSound wirft nicht wenn unmuted", () => {
    setMuted(false);
    expect(() => playCompletionSound()).not.toThrow();
  });

  it("playCorrectSound wirft nicht wenn unmuted", () => {
    setMuted(false);
    expect(() => playCorrectSound()).not.toThrow();
  });

  it("playRandomCorrectSound('full') wirft nicht wenn unmuted", () => {
    setMuted(false);
    expect(() => playRandomCorrectSound("full")).not.toThrow();
  });
});
