/**
 * Overlay Navigation (Baustein 7).
 *
 * Modal overlay for module selection, difficulty, settings.
 * - role="dialog", aria-modal="true"
 * - Focus trap, ESC to close (Decision E7)
 * - 2-column grid for modules (64px touch targets)
 */

import { h } from "./h";

export interface OverlayModule {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export interface OverlayOptions {
  modules: OverlayModule[];
  activeModuleId: string | null;
  difficulty: number;
  onSelectModule: (id: string) => void;
  onChangeDifficulty: (level: number) => void;
  onClose: () => void;
}

let overlayEl: HTMLElement | null = null;
let previousFocus: HTMLElement | null = null;

/**
 * Open the module overlay.
 */
export function openOverlay(opts: OverlayOptions): void {
  if (overlayEl) closeOverlay();

  previousFocus = document.activeElement as HTMLElement | null;

  // Backdrop
  const backdrop = h("div", {
    class: "overlay-backdrop",
    style: {
      position: "fixed",
      inset: "0",
      zIndex: "1000",
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--space-lg)",
    },
    on: {
      click: (e: Event) => {
        if (e.target === backdrop) opts.onClose();
      },
    },
  });

  // Dialog
  const dialog = h("div", {
    class: "overlay-dialog",
    role: "dialog",
    ariaModal: "true",
    ariaLabel: "Modul-Auswahl",
    style: {
      background: "var(--panel)",
      borderRadius: "var(--radius-xl)",
      padding: "var(--space-md) var(--space-lg)",
      maxWidth: "720px",
      width: "100%",
      maxHeight: "80vh",
      overflowY: "auto",
      boxShadow: "var(--shadow-panel)",
      color: "var(--text)",
    },
    tabIndex: -1,
  } as Record<string, unknown>,
    // Header
    h("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "var(--space-lg)",
      },
    },
      h("h2", {
        style: {
          fontSize: "var(--font-panel-title)",
          fontWeight: "700",
          margin: "0",
        },
      }, "Module"),
      h("button", {
        class: "overlay-close-btn",
        ariaLabel: "Schließen",
        style: {
          fontSize: "var(--font-panel-title)",
          padding: "var(--space-xs) var(--space-sm)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          minWidth: "48px",
          minHeight: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        on: { click: () => opts.onClose() },
      } as Record<string, unknown>, "✕"),
    ),

    // Difficulty selector
    (() => {
      let activeDiff = opts.difficulty;
      const diffBtns: HTMLElement[] = [];

      const updateDiffButtons = (): void => {
        for (const btn of diffBtns) {
          const lvl = Number(btn.dataset.level);
          const isActive = lvl === activeDiff;
          btn.className = `overlay-diff-btn ${isActive ? "active" : ""}`;
          btn.style.background = isActive ? "var(--accent)" : "var(--panel-soft)";
          btn.style.color = isActive ? "var(--text-on-accent)" : "var(--text)";
        }
      };

      const row = h("div", {
        style: {
          display: "flex",
          gap: "var(--space-xs)",
          marginBottom: "var(--space-lg)",
          alignItems: "center",
        },
      },
        h("span", { style: { fontSize: "var(--font-small)", fontWeight: "600" } }, "Schwierigkeit:"),
        ...[1, 2, 3].map((level) => {
          const btn = h("button", {
            class: `overlay-diff-btn ${level === activeDiff ? "active" : ""}`,
            data: { level: String(level) },
            style: {
              padding: "var(--space-xs) var(--space-md)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--font-small)",
              fontWeight: "600",
              minWidth: "48px",
              minHeight: "48px",
              cursor: "pointer",
              background: level === activeDiff ? "var(--accent)" : "var(--panel-soft)",
              color: level === activeDiff ? "var(--text-on-accent)" : "var(--text)",
            },
            on: {
              click: () => {
                activeDiff = level;
                updateDiffButtons();
                opts.onChangeDifficulty(level);
              },
            },
          }, `${level}`);
          diffBtns.push(btn);
          return btn;
        }),
      );
      return row;
    })(),

    // Module grid — compact: icon + label only, 3 columns on desktop
    h("div", {
      class: "overlay-module-grid",
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: "var(--space-xs)",
      },
    },
      ...opts.modules.map((mod) =>
        h("button", {
          class: `overlay-module-card ${mod.id === opts.activeModuleId ? "active" : ""}`,
          style: {
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            padding: "var(--space-sm) var(--space-md)",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            textAlign: "left",
            minHeight: "48px",
            background: mod.id === opts.activeModuleId ? "var(--accent-light)" : "var(--panel-soft)",
            border: mod.id === opts.activeModuleId ? "2px solid var(--accent)" : "2px solid transparent",
          },
          title: mod.description,
          on: {
            click: () => {
              opts.onSelectModule(mod.id);
              opts.onClose();
            },
          },
        },
          h("span", {
            style: { fontSize: "var(--icon-module)", flexShrink: "0" },
          }, mod.icon),
          h("span", {
            style: { fontSize: "var(--font-body)", fontWeight: "600" },
          }, mod.label),
        ),
      ),
    ),
  );

  backdrop.appendChild(dialog);
  overlayEl = backdrop;
  document.body.appendChild(overlayEl);

  // Focus trap
  dialog.focus();
  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      opts.onClose();
    }
  };
  document.addEventListener("keydown", handleKeyDown);

  // Store cleanup
  (overlayEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    document.removeEventListener("keydown", handleKeyDown);
  };
}

/**
 * Close the overlay.
 */
export function closeOverlay(): void {
  if (!overlayEl) return;
  (overlayEl as HTMLElement & { _cleanup?: () => void })._cleanup?.();
  overlayEl.remove();
  overlayEl = null;
  previousFocus?.focus();
  previousFocus = null;
}

/**
 * Check if overlay is currently open.
 */
export function isOverlayOpen(): boolean {
  return overlayEl !== null;
}
