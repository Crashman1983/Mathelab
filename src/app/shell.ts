/**
 * App-Shell: Initialisiert Navigation, Modul-Container, Theme-Toggle,
 * und verwaltet den Lebenszyklus aller Module.
 *
 * Verantwortlichkeiten:
 * - Module registrieren
 * - Aktivierung/Deaktivierung steuern
 * - Theme-Modus synchronisieren
 * - Resize-Events weitergeben
 * - Session-Stats verwalten
 */

import type { LernModul, ModuleRegistration, AppState } from "@core/types";
import { setColorMode } from "@core/design";
import { appEvents } from "@core/events";
import { safeGetLocalStorage, safeSetLocalStorage, debounce } from "@core/utils";
import { appState } from "@core/state";
import { isTTSAvailable, isTTSEnabled, setTTSEnabled, speak } from "@core/tts";
import { isMuted, setMuted } from "@core/sounds";
import { openOverlay, closeOverlay, isOverlayOpen } from "@ui/overlay";
import { DIFFICULTIES } from "@app/module-framework";
import { parseRoute, setRoute, onRouteChange, navigateHome } from "@app/router";

const STORAGE_KEY_LAST_MODULE = "mathelabor_last_module";

export class AppShell {
  private modules = new Map<string, LernModul>();
  private registrations = new Map<string, ModuleRegistration>();
  private state: AppState = {
    currentModuleId: null,
    colorMode: "dark",
    sessionStats: {
      attempts: 0,
      correct: 0,
      startTime: Date.now(),
    },
  };

  private containerEl: HTMLElement;
  private navEl: HTMLElement;
  private contentEl: HTMLElement;

  constructor() {
    this.containerEl = document.getElementById("app") ?? document.body;
    this.navEl = document.getElementById("app-nav") as HTMLElement;
    this.contentEl = document.getElementById("app-content") as HTMLElement;

    if (!this.navEl || !this.contentEl) {
      throw new Error("[AppShell] Required DOM elements #app-nav and #app-content not found");
    }

    this.initTheme();
    this.initKeyboardNavigation();
    this.initResize();
    this.initThemeToggle();
    this.initSoundToggle();
    this.initTTS();
    this.initTopbar();
    this.initRouter();
    this.initCrashOverlay();
  }

  // ─── Topbar (V2: home button + module label opens overlay) ─────────────────

  private initTopbar(): void {
    // Home button (E20)
    document.getElementById("topbar-home")?.addEventListener("click", () => {
      this.showHome();
      navigateHome();
    });

    // Module label opens overlay (E16)
    document.getElementById("topbar-module-label")?.addEventListener("click", () => {
      this.openModuleOverlay();
    });
  }

  // ─── Overlay Navigation (E16) ────────────────────────────────────────────

  openModuleOverlay(): void {
    if (isOverlayOpen()) { closeOverlay(); return; }
    const modules = [...this.registrations.values()].map((r) => ({
      id: r.id,
      label: r.label,
      icon: r.icon,
      description: r.description,
    }));

    const currentDifficulty = appState.get("difficulty");

    openOverlay({
      modules,
      activeModuleId: this.state.currentModuleId,
      difficulty: currentDifficulty,
      onSelectModule: (id) => {
        this.activateModule(id);
        setRoute({ moduleId: id });
      },
      onChangeDifficulty: (level) => {
        appState.set("difficulty", level);
        // If a module is active, remount it so it picks up the new difficulty
        if (this.state.currentModuleId) {
          this.activateModule(this.state.currentModuleId);
        }
      },
      onClose: () => closeOverlay(),
    });
  }

  // ─── URL Hash Router (Baustein 10) ───────────────────────────────────────

  private cleanupRouter: (() => void) | null = null;

  private initRouter(): void {
    this.cleanupRouter = onRouteChange((params) => {
      if (params && this.registrations.has(params.moduleId)) {
        this.activateModule(params.moduleId);
      } else {
        this.showHome();
      }
    });
  }

  // ─── Crash Recovery Overlay (Baustein 12) ────────────────────────────────

  private initCrashOverlay(): void {
    const handler = (e: ErrorEvent | PromiseRejectionEvent): void => {
      const msg = e instanceof ErrorEvent ? e.message : String((e as PromiseRejectionEvent).reason);
      console.error("[CrashRecovery]", msg);
      // Show simple reload overlay
      if (document.getElementById("crash-overlay")) return;
      const overlay = document.createElement("div");
      overlay.id = "crash-overlay";
      overlay.setAttribute("role", "alert");
      overlay.style.cssText = "position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:24px"; /* z-index: modal layer (see CLAUDE.md z-index table) */
      overlay.innerHTML = `<div style="background:var(--panel);border-radius:var(--radius-xl);padding:32px;max-width:420px;text-align:center;color:var(--text)">
        <div style="font-size:48px;margin-bottom:16px">⚠️</div>
        <h2 style="margin:0 0 12px">Ein Fehler ist aufgetreten</h2>
        <p style="opacity:0.7;font-size:var(--font-small);margin:0 0 20px">${msg.slice(0, 200)}</p>
        <button onclick="location.reload()" style="padding:12px 32px;border-radius:var(--radius-md);background:var(--accent);color:var(--text-on-accent);font-size:var(--font-body);font-weight:600;border:none;cursor:pointer;min-height:48px">Neu laden</button>
      </div>`;
      document.body.appendChild(overlay);
    };
    window.addEventListener("error", handler as EventListener);
    window.addEventListener("unhandledrejection", handler as EventListener);
  }

  // Stub-Methode für Rückwärtskompatibilität (Falls Module closeNav aufrufen)
  closeNav(): void {
    // no-op
  }

  // ─── Module Registry ───────────────────────────────────────────────────────

  register(registration: ModuleRegistration): void {
    this.registrations.set(registration.id, registration);
    this.renderNavItem(registration);
    this.renderModuleContainer(registration);
  }

  registerMany(registrations: ModuleRegistration[]): void {
    registrations.forEach((r) => this.register(r));
  }

  private renderNavItem(reg: ModuleRegistration): void {
    const btn = document.createElement("button");
    btn.className = "nav-item";
    btn.dataset.moduleId = reg.id;
    btn.setAttribute("type", "button");
    btn.setAttribute("aria-label", `Modul: ${reg.label}`);
    btn.innerHTML = `
      <span class="nav-item__icon" aria-hidden="true">${reg.icon}</span>
      <span class="nav-item__label">${reg.label}</span>
    `;
    btn.addEventListener("click", () => this.activateModule(reg.id));
    // Vor dem Spacer einfügen, damit Modul-Items oben im Nav erscheinen
    const spacer = document.getElementById("nav-spacer");
    this.navEl.insertBefore(btn, spacer ?? null);
  }

  private renderModuleContainer(reg: ModuleRegistration): void {
    const section = document.createElement("section");
    section.className = "view";
    section.id = `view-${reg.id}`;
    section.setAttribute("aria-label", reg.label);
    this.contentEl.appendChild(section);
  }

  // ─── Module Lifecycle ──────────────────────────────────────────────────────

  activateModule(id: string): void {
    if (!this.registrations.has(id)) {
      console.error(`[AppShell] Unknown module: "${id}"`);
      return;
    }

    // Deactivate current module
    if (this.state.currentModuleId) {
      this.deactivateCurrentModule();
    }

    // Lazy-initialize module on first activation
    if (!this.modules.has(id)) {
      this.mountModule(id);
    }

    const module = this.modules.get(id)!;
    const prevId = this.state.currentModuleId;
    this.state.currentModuleId = id;

    // DOM: show view
    document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
    document.getElementById(`view-${id}`)?.classList.add("active");

    // Nav: highlight active item + aria-current (audit fix: a11y)
    document.querySelectorAll(".nav-item").forEach((el) => {
      const isActive = (el as HTMLElement).dataset.moduleId === id;
      el.classList.toggle("active", isActive);
      if (isActive) {
        el.setAttribute("aria-current", "page");
      } else {
        el.removeAttribute("aria-current");
      }
    });

    // Topbar: Modul-Label aktualisieren
    const topbarLabel = document.getElementById("topbar-module-label");
    const reg = this.registrations.get(id);
    if (topbarLabel && reg) {
      topbarLabel.textContent = `${reg.icon} ${reg.label}`;
      topbarLabel.removeAttribute("hidden");
      // TTS: Modul-Name beim Wechsel vorlesen
      speak(`${reg.label}`, false, true);
    }

    // Topbar: Difficulty badge aktualisieren
    this.updateDifficultyBadge();

    // Activate module
    try {
      module.activate();
    } catch (err) {
      console.error(`[AppShell] Error activating module "${id}":`, err);
    }

    // Persist + route
    safeSetLocalStorage(STORAGE_KEY_LAST_MODULE, id);
    setRoute({ moduleId: id });

    // Emit event
    appEvents.emit({
      type: "module:activated",
      payload: { id, prevId },
    });
  }

  private mountModule(id: string): void {
    const reg = this.registrations.get(id)!;
    const container = document.getElementById(`view-${id}`);
    if (!container) {
      console.error(`[AppShell] Container for module "${id}" not found`);
      return;
    }

    let module: LernModul;
    try {
      module = reg.factory();
      module.mount(container);
    } catch (err) {
      console.error(`[AppShell] Failed to mount module "${id}":`, err);
      container.innerHTML = `
        <div style="padding:2rem;color:var(--bad)">
          <strong>Fehler beim Laden des Moduls</strong><br>
          <small>${String(err)}</small>
        </div>
      `;
      return;
    }

    this.modules.set(id, module);
  }

  private deactivateCurrentModule(): void {
    const id = this.state.currentModuleId;
    if (!id) return;

    const module = this.modules.get(id);
    if (module) {
      try {
        module.deactivate();
      } catch (err) {
        console.error(`[AppShell] Error deactivating module "${id}":`, err);
      }
    }

    appEvents.emit({
      type: "module:deactivated",
      payload: { id },
    });
  }

  // ─── Home View ─────────────────────────────────────────────────────────────

  showHome(): void {
    // Deactivate current module
    if (this.state.currentModuleId) {
      this.deactivateCurrentModule();
      this.state.currentModuleId = null;
    }

    document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
    document.getElementById("view-home")?.classList.add("active");
    document.querySelectorAll(".nav-item").forEach((el) => {
      el.classList.remove("active");
      el.removeAttribute("aria-current");
    });
    const homeNav = document.querySelector(".nav-item[data-module-id='home']");
    homeNav?.classList.add("active");
    homeNav?.setAttribute("aria-current", "page");

    // Topbar: Modul-Label ausblenden
    document.getElementById("topbar-module-label")?.setAttribute("hidden", "");
    navigateHome();
  }

  // ─── Text-to-Speech ────────────────────────────────────────────────────────

  private initTTS(): void {
    const btn = document.getElementById("tts-toggle");
    if (!btn) return;

    // Button ausblenden falls TTS nicht verfügbar (z.B. ältere Browser)
    if (!isTTSAvailable()) {
      btn.setAttribute("hidden", "");
      return;
    }

    // Initialen Zustand aus localStorage wiederherstellen
    this.updateTTSButton(btn, isTTSEnabled());

    btn.addEventListener("click", () => {
      const next = !isTTSEnabled();
      setTTSEnabled(next);
      this.updateTTSButton(btn, next);
      // Kurzfeedback: neuen Status vorlesen
      speak(next ? "Vorlesen aktiviert" : "Vorlesen deaktiviert", true, true);
    });
  }

  private updateTTSButton(btn: HTMLElement, enabled: boolean): void {
    btn.setAttribute("aria-pressed", String(enabled));
    btn.setAttribute("title", enabled ? "Vorlesen deaktivieren" : "Vorlesen aktivieren");
    btn.setAttribute("aria-label", enabled ? "Vorlesen deaktivieren" : "Vorlesen aktivieren");
    btn.textContent = enabled ? "🔊" : "🔇";
  }

  /**
   * Spricht einen Text vor (falls TTS aktiviert).
   * Module können diese Methode über getShell().speak(...) aufrufen.
   */
  speakText(text: string): void {
    speak(text);
  }

  // ─── Theme ─────────────────────────────────────────────────────────────────

  private initTheme(): void {
    const mode = appState.get("theme");
    this.applyTheme(mode);
  }

  private applyTheme(mode: "dark" | "light"): void {
    this.state.colorMode = mode;
    setColorMode(mode);

    if (mode === "light") {
      document.body.classList.add("light-mode");
    } else {
      document.body.classList.remove("light-mode");
    }

    appState.set("theme", mode);
    appEvents.emit({ type: "theme:changed", payload: { mode } });

    // Re-render active module
    const module = this.state.currentModuleId
      ? this.modules.get(this.state.currentModuleId)
      : null;
    module?.resize();
  }

  private updateDifficultyBadge(): void {
    const diff = appState.get("difficulty") ?? 2;
    const current = DIFFICULTIES.find(d => d.level === diff) ?? DIFFICULTIES[1];

    let badge = document.getElementById("difficulty-badge") as HTMLButtonElement | null;
    if (!badge) {
      badge = document.createElement("button");
      badge.type = "button";
      badge.id = "difficulty-badge";
      badge.className = "difficulty-badge";
      badge.setAttribute("aria-label", "Schwierigkeit ändern");
      badge.addEventListener("click", () => {
        // Cycle through difficulties: 1→2→3→1
        const currentLevel = appState.get("difficulty") ?? 2;
        const nextLevel = (currentLevel % DIFFICULTIES.length) + 1;
        appState.set("difficulty", nextLevel);
        this.updateDifficultyBadge();
        // Re-mount active module with new difficulty
        if (this.state.currentModuleId) {
          this.activateModule(this.state.currentModuleId);
        }
      });
      // Insert after topbar-module-label
      const topbarLabel = document.getElementById("topbar-module-label");
      topbarLabel?.insertAdjacentElement("afterend", badge);
    }
    badge.textContent = `${current?.icon ?? ""} ${current?.label ?? ""}`;
  }

  private initThemeToggle(): void {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const next = this.state.colorMode === "dark" ? "light" : "dark";
      this.applyTheme(next);
      btn.textContent = next === "dark" ? "☀️" : "🌙";
    });
  }

  private initSoundToggle(): void {
    const btn = document.getElementById("sound-toggle");
    if (!btn) return;
    // Sync initial state from localStorage
    const startMuted = isMuted();
    btn.textContent = startMuted ? "🔕" : "🔔";
    btn.setAttribute("aria-pressed", String(startMuted));
    btn.addEventListener("click", () => {
      const next = !isMuted();
      setMuted(next);
      btn.textContent = next ? "🔕" : "🔔";
      btn.setAttribute("aria-pressed", String(next));
    });
  }

  // ─── Resize ────────────────────────────────────────────────────────────────

  private initResize(): void {
    const onResize = debounce(() => {
      const module = this.state.currentModuleId
        ? this.modules.get(this.state.currentModuleId)
        : null;
      module?.resize();
    }, 100);

    window.addEventListener("resize", onResize);

    // ResizeObserver for the content area
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(onResize);
      observer.observe(this.contentEl);
    }
  }

  // ─── Keyboard Navigation ──────────────────────────────────────────────────

  private initKeyboardNavigation(): void {
    document.addEventListener("keydown", (e) => {
      // Alt+0: Home
      if (e.altKey && e.key === "0") {
        e.preventDefault();
        this.showHome();
        return;
      }

      // Alt+1-9: Module shortcuts
      if (e.altKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        const ids = [...this.registrations.keys()];
        if (idx < ids.length) {
          this.activateModule(ids[idx]);
        }
      }
    });
  }

  // ─── Session Stats ─────────────────────────────────────────────────────────

  recordAttempt(correct: boolean): void {
    this.state.sessionStats.attempts++;
    if (correct) this.state.sessionStats.correct++;

    appEvents.emit({
      type: correct ? "task:completed" : "task:failed",
      payload: { ...this.state.sessionStats },
    });

    this.updateStatsDisplay();
  }

  private updateStatsDisplay(): void {
    const { attempts, correct } = this.state.sessionStats;
    const el = document.getElementById("session-stats");
    if (!el) return;
    const pct = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
    el.innerHTML = `
      <span class="stat-item">✅ <strong>${correct}</strong></span>
      <span class="stat-item">📝 <strong>${attempts}</strong></span>
      ${attempts > 0 ? `<span class="stat-item">🎯 <strong>${pct}%</strong></span>` : ""}
    `;
  }

  // ─── Restore Last Session ─────────────────────────────────────────────────

  restoreSession(): void {
    // Priority: URL hash > home
    // (localStorage remembers last module for internal use, but fresh start always shows home)
    const route = parseRoute();
    if (route && this.registrations.has(route.moduleId)) {
      this.activateModule(route.moduleId);
      return;
    }
    this.showHome();
  }
}

// Singleton
let _shell: AppShell | null = null;
export function getShell(): AppShell {
  if (!_shell) throw new Error("[AppShell] Not yet initialized");
  return _shell;
}

export function initShell(): AppShell {
  _shell = new AppShell();
  return _shell;
}
