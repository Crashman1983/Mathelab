/**
 * Text-to-Speech (TTS) — Web Speech API Wrapper
 *
 * MUST-Anforderung (CLAUDE.md): Text-to-Speech für alle Textinhalte.
 * Zielgruppe: Kinder 8–10 Jahre, besonders Unterstützung bei Legasthenie.
 *
 * Implementierung über die browser-native SpeechSynthesis API.
 * Keine externen Abhängigkeiten — funktioniert offline.
 *
 * Verbesserungen gegenüber Basisversion:
 * - Aktive Stimmauswahl: beste verfügbare deutsche Stimme (neural/enhanced zuerst)
 * - Voices-Preloading via voiceschanged-Event (ohne Warmup fehlt die Stimme oft)
 * - Rate/Pitch per Stimmqualitätsstufe feinabgestimmt
 *
 * Plattform-Stimmqualität (beste zuerst):
 *   macOS/iOS  → "Anna" (Enhanced), "Markus", "Nils"
 *   Windows    → "Microsoft Katja", "Microsoft Conrad" (Neural)
 *   Android/CR → "Google Deutsch"
 *   Fallback   → erste verfügbare de-DE / de Stimme
 */

const STORAGE_KEY = "mathelabor_tts_enabled";

// ─── Voice Quality Ranking ─────────────────────────────────────────────────

/**
 * Bekannte Stimmnamen sortiert nach subjektiver Natürlichkeit.
 * Niedrigerer Index = höhere Priorität.
 */
const PREFERRED_VOICE_NAMES: ReadonlyArray<string> = [
  // Apple Neural / Enhanced (macOS 14+, iOS 17+) — beste Qualität
  "Anna (Enhanced)",
  "Nils (Enhanced)",
  "Markus (Enhanced)",
  "Petra (Enhanced)",
  // Apple Persönlichkeits-Stimmen (macOS 12+, iOS 15+) — deutlich natürlicher als Classic
  // Format: "Name (Deutsch (Deutschland))" — für Kinder: weibliche Stimmen bevorzugt
  "Flo (Deutsch",       // friendly, jung-weiblich — ideal für Kinder
  "Sandy (Deutsch",     // freundlich-weiblich
  "Shelley (Deutsch",   // weiblich
  "Eddy (Deutsch",      // männlich, freundlich
  "Reed (Deutsch",      // männlich, neutral
  "Rocko (Deutsch",     // männlich, energisch
  "Grandma (Deutsch",   // großmütterlich — beruhigend
  "Grandpa (Deutsch",   // großväterlich
  // Apple Classic (macOS/iOS — robotischer als Persönlichkeits-Stimmen)
  "Anna",
  "Nils",
  "Markus",
  "Petra",
  // Microsoft Neural (Windows 11, Edge)
  "Microsoft Katja Online (Natural)",
  "Microsoft Conrad Online (Natural)",
  "Microsoft Katja",
  "Microsoft Conrad",
  // Google (Chrome/Android)
  "Google Deutsch",
];

/** Gibt einen Prioritätswert zurück (niedriger = besser). */
function voiceScore(voice: SpeechSynthesisVoice): number {
  const nameIdx = PREFERRED_VOICE_NAMES.findIndex(
    (n) => voice.name.toLowerCase().includes(n.toLowerCase()),
  );
  if (nameIdx !== -1) return nameIdx;

  // Unbekannte Stimmen: de-DE besser als de-AT/de-CH, lokal besser als remote
  const langBonus = voice.lang.toLowerCase() === "de-de" ? 100 : 200;
  return langBonus + (voice.localService ? 10 : 0);
}

/** Cached voices — werden nach voiceschanged aktualisiert */
let _voices: SpeechSynthesisVoice[] = [];
let _bestVoice: SpeechSynthesisVoice | null = null;

function loadVoices(): void {
  if (!isTTSAvailable()) return;
  const all = window.speechSynthesis.getVoices();
  const german = all.filter((v) => v.lang.toLowerCase().startsWith("de"));
  if (german.length === 0) return;

  german.sort((a, b) => voiceScore(a) - voiceScore(b));
  _voices = german;
  _bestVoice = german[0];
}

function initVoices(): void {
  if (!isTTSAvailable()) return;
  loadVoices();
  // Chrome/Android: Stimmen werden asynchron geladen
  window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
}

// Sofort beim Modulimport initialisieren (löst den voiceschanged-Listener aus)
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  // requestIdleCallback wenn vorhanden, sonst setTimeout — blockiert nicht den Start
  if ("requestIdleCallback" in window) {
    requestIdleCallback(initVoices);
  } else {
    setTimeout(initVoices, 0);
  }
}

// ─── Rate / Pitch pro Stimmqualität ────────────────────────────────────────

interface VoiceParams {
  rate: number;
  pitch: number;
}

function getVoiceParams(voice: SpeechSynthesisVoice | null): VoiceParams {
  if (!voice) return { rate: 0.82, pitch: 1.05 };

  const name = voice.name.toLowerCase();

  // Apple Enhanced / Microsoft Natural / Neural — sehr natürlich, minimale Verlangsamung
  if (name.includes("enhanced") || name.includes("natural") || name.includes("neural")) {
    return { rate: 0.90, pitch: 1.0 };
  }

  // Apple Persönlichkeits-Stimmen (Flo, Sandy, Eddy, …) — modernes Synthesis-System
  // "(deutsch" matcht "(Deutsch (Deutschland))" case-insensitive
  if (name.includes("(deutsch") || name.includes("(german")) {
    return { rate: 0.88, pitch: 1.0 };
  }

  // Google Deutsch
  if (name.includes("google")) {
    return { rate: 0.86, pitch: 1.0 };
  }

  // Apple Classic / Microsoft Standard — deutlich verlangsamt, leicht erhöhtes Pitch für Kinder
  return { rate: 0.82, pitch: 1.08 };
}

// ─── Enabled State ─────────────────────────────────────────────────────────

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

/** Gibt die aktuell gewählte Stimme zurück (für Debug/Settings UI). */
export function getSelectedVoiceName(): string | null {
  return _bestVoice?.name ?? null;
}

/** Alle verfügbaren deutschen Stimmen (für Settings UI). */
export function getAvailableGermanVoices(): SpeechSynthesisVoice[] {
  return _voices;
}

// ─── Text-Normalisierung ────────────────────────────────────────────────────

/**
 * Bereitet Text für TTS auf — ersetzt Mathe-Symbole durch ausgeschriebene Wörter,
 * damit die Stimme "3 mal 4" statt "3 x 4" sagt.
 */
function normalizeForSpeech(text: string): string {
  return text
    // Mathe-Operatoren
    .replace(/×/g, " mal ")
    .replace(/÷/g, " geteilt durch ")
    .replace(/\+/g, " plus ")
    .replace(/−/g, " minus ")       // Unicode-Minus (U+2212)
    .replace(/–/g, " minus ")       // En-Dash als Minus
    .replace(/=/g, " ist ")
    .replace(/≠/g, " ist nicht ")
    .replace(/</g, " kleiner als ")
    .replace(/>/g, " größer als ")
    .replace(/≤/g, " kleiner oder gleich ")
    .replace(/≥/g, " größer oder gleich ")
    // Brüche
    .replace(/½/g, " ein halb ")
    .replace(/¼/g, " ein viertel ")
    .replace(/¾/g, " drei viertel ")
    // Fragezeichen am Ende entfernen (TTS macht sonst Frageintonation)
    .replace(/\?$/, "")
    // Mehrfache Leerzeichen normalisieren
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─── Speak ─────────────────────────────────────────────────────────────────

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

  const utterance = new SpeechSynthesisUtterance(normalizeForSpeech(text));

  // Deutsche Sprache
  utterance.lang = "de-DE";

  // Stimmen ggf. nachladen (kann beim ersten Aufruf noch leer sein)
  if (!_bestVoice) loadVoices();

  // Beste verfügbare Stimme setzen (null = Browser-Default)
  if (_bestVoice) {
    utterance.voice = _bestVoice;
  }

  // Rate und Pitch je nach Stimmqualität
  const params = getVoiceParams(_bestVoice);
  utterance.rate = params.rate;
  utterance.pitch = params.pitch;
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
