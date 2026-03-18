/**
 * Text-to-Speech (TTS) — Web Speech API Wrapper
 *
 * MUST-Anforderung (CLAUDE.md): Text-to-Speech für alle Textinhalte.
 * Zielgruppe: Kinder 8–10 Jahre, besonders Unterstützung bei Legasthenie.
 *
 * Implementierung über die browser-native SpeechSynthesis API.
 * Keine externen Abhängigkeiten — funktioniert offline.
 *
 * Nutzung:
 *   import { speak, setTTSEnabled, isTTSEnabled } from "@core/tts";
 *   speak("Berechne 3 plus 5");          // Spricht falls TTS aktiv
 *   setTTSEnabled(true);                 // Aktiviert TTS global
 */

const STORAGE_KEY = "mathelabor_tts_enabled";

/** Ob die SpeechSynthesis API im Browser verfügbar ist */
export function isTTSAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Aktueller Aktivierungszustand aus localStorage lesen */
function loadEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

let _enabled: boolean = loadEnabled();

/** Ist TTS momentan aktiviert? */
export function isTTSEnabled(): boolean {
  return _enabled;
}

/** TTS global aktivieren oder deaktivieren */
export function setTTSEnabled(enabled: boolean): void {
  _enabled = enabled;
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // localStorage kann in Private-Browsing-Mode blockiert sein — ignorieren
  }
  if (!enabled) {
    window.speechSynthesis?.cancel();
  }
}

/**
 * Spricht einen Text vor, wenn TTS aktiviert ist.
 *
 * @param text     Der vorzulesende Text (deutsch)
 * @param force    true = Text unabhängig vom aktivierten Status sprechen
 * @param priority true = laufende Ausgabe abbrechen und sofort sprechen
 */
export function speak(text: string, force = false, priority = true): void {
  if (!isTTSAvailable()) return;
  if (!force && !_enabled) return;
  if (!text.trim()) return;

  const synth = window.speechSynthesis;

  if (priority) {
    synth.cancel(); // Vorherige Ausgabe sofort stoppen
  }

  const utterance = new SpeechSynthesisUtterance(text);

  // Deutsche Sprache — Kinder hören Deutsch
  utterance.lang = "de-DE";

  // Etwas langsamer als normal: besser für Kinder und Legastheniker
  utterance.rate = 0.85;

  // Leicht erhöhte Tonlage: freundlicher, kinderfreundlicher
  utterance.pitch = 1.1;

  // Normale Lautstärke
  utterance.volume = 1.0;

  synth.speak(utterance);
}

/**
 * Spricht den Text, falls TTS aktiviert ist (Shortcut für übliche Nutzung).
 * Module rufen diese Funktion nach bedeutsamen Aktionen auf.
 */
export function speakIfEnabled(text: string): void {
  if (_enabled) {
    speak(text, false, true);
  }
}

/**
 * Extrahiert sichtbaren Text aus einem DOM-Element und liest ihn vor.
 * Nützlich für Status-Boxen, Task-Boxen etc.
 */
export function speakElement(el: HTMLElement | null): void {
  if (!el || !_enabled) return;
  const text = el.textContent?.trim() ?? "";
  if (text) speak(text);
}
