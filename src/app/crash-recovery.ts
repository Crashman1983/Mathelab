/**
 * Crash Recovery (Baustein 12).
 *
 * - Global error + unhandled rejection → friendly error overlay
 * - localStorage robustness: cleanup corrupted entries
 * - In-memory fallback when localStorage is blocked
 */

// ─── Error Overlay ──────────────────────────────────────────────────────────

let errorOverlayShown = false;

function showErrorOverlay(message: string): void {
  if (errorOverlayShown) return;
  errorOverlayShown = true;

  const overlay = document.createElement("div");
  overlay.style.cssText = [
    "position: fixed",
    "inset: 0",
    "z-index: 10000", /* z-index: crash recovery (emergency overlay, above all layers) */
    "display: flex",
    "flex-direction: column",
    "align-items: center",
    "justify-content: center",
    "background: rgba(0,0,0,0.85)",
    "color: #f4f8ff",
    "font-family: 'Atkinson Hyperlegible', system-ui, sans-serif",
    "font-size: 20px",
    "padding: 32px",
    "text-align: center",
    "gap: 24px",
  ].join(";");

  const icon = document.createElement("div");
  icon.style.fontSize = "48px";
  icon.textContent = "⚠️";

  const msg = document.createElement("p");
  msg.style.maxWidth = "500px";
  msg.textContent = "Ein Fehler ist aufgetreten. Bitte Seite neu laden.";

  const detail = document.createElement("p");
  detail.style.cssText = "font-size: 14px; opacity: 0.6; max-width: 500px; word-break: break-word;";
  detail.textContent = message;

  const btn = document.createElement("button");
  btn.style.cssText = [
    "padding: 16px 48px",
    "font-size: 20px",
    "font-weight: 600",
    "border: none",
    "border-radius: 12px",
    "background: #3B82F6",
    "color: white",
    "cursor: pointer",
    "min-height: 56px",
  ].join(";");
  btn.textContent = "🔄 Seite neu laden";
  btn.addEventListener("click", () => window.location.reload());

  overlay.appendChild(icon);
  overlay.appendChild(msg);
  overlay.appendChild(detail);
  overlay.appendChild(btn);
  document.body.appendChild(overlay);
}

/** Install global error handlers. Call once at app startup. */
export function installCrashRecovery(): void {
  window.addEventListener("error", (event) => {
    const msg = event.message || "Unbekannter Fehler";
    console.error("[CrashRecovery]", msg, event.error);
    showErrorOverlay(msg);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const msg =
      event.reason instanceof Error
        ? event.reason.message
        : String(event.reason ?? "Unbekannter Fehler");
    console.error("[CrashRecovery] Unhandled rejection:", msg);
    showErrorOverlay(msg);
  });
}

// ─── localStorage Robustness ────────────────────────────────────────────────

const MATHELABOR_PREFIX = "mathelabor_";

/**
 * Clean up corrupted or stale localStorage entries.
 * Call once at app startup.
 */
export function cleanupLocalStorage(): void {
  if (!isLocalStorageAvailable()) return;

  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(MATHELABOR_PREFIX)) continue;

      const raw = localStorage.getItem(key);
      if (raw === null || raw === "undefined" || raw === "NaN") {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Silently ignore — localStorage may be restricted
  }
}

// ─── In-Memory Fallback ─────────────────────────────────────────────────────

const memoryStore = new Map<string, string>();
let _localStorageAvailable: boolean | null = null;

/** Check if localStorage is available (cached result) */
export function isLocalStorageAvailable(): boolean {
  if (_localStorageAvailable !== null) return _localStorageAvailable;

  try {
    const testKey = "__mathelabor_ls_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    _localStorageAvailable = true;
  } catch {
    _localStorageAvailable = false;
  }
  return _localStorageAvailable;
}

/**
 * Safe storage get: falls back to in-memory store if localStorage is blocked.
 */
export function safeGet(key: string): string | null {
  if (isLocalStorageAvailable()) {
    try {
      return localStorage.getItem(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  }
  return memoryStore.get(key) ?? null;
}

/**
 * Safe storage set: falls back to in-memory store if localStorage is blocked.
 */
export function safeSet(key: string, value: string): void {
  memoryStore.set(key, value);
  if (isLocalStorageAvailable()) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // QuotaExceeded or SecurityError — memory fallback already set
    }
  }
}

/**
 * Safe storage remove.
 */
export function safeRemove(key: string): void {
  memoryStore.delete(key);
  if (isLocalStorageAvailable()) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently ignore
    }
  }
}
