/**
 * Zentrale Typdefinitionen für die App-Shell und das Modul-Interface.
 * Jedes Modul MUSS dieses Interface implementieren.
 */

// ─── Module Interface ────────────────────────────────────────────────────────

/**
 * Das verbindliche Interface, das jedes Lernmodul implementieren muss.
 *
 * Konventionen:
 * - mount(): wird aufgerufen wenn das Modul zum ersten Mal angezeigt wird
 * - activate(): wird aufgerufen bei jedem Wechsel zu diesem Modul
 * - deactivate(): wird aufgerufen wenn das Modul verlassen wird
 * - resize(): wird aufgerufen wenn die Fenstergröße sich ändert
 * - destroy(): Cleanup wenn das Modul dauerhaft entfernt wird
 */
export interface LernModul {
  /** Unique identifier (z.B. "netze", "symmetry") */
  readonly id: string;
  /** Anzeigename für Navigation */
  readonly label: string;
  /** Icon-Bezeichner (Emoji oder CSS-Klasse) */
  readonly icon: string;
  /** Kurzbeschreibung für Home-Karte */
  readonly description: string;

  /**
   * Einmaliges Initialisieren: DOM-Referenzen, Event-Listener,
   * Canvas-Setup. Wird nur einmal aufgerufen.
   * @param container - Das DOM-Element für dieses Modul
   */
  mount(container: HTMLElement): void;

  /**
   * Aufgerufen bei jedem Wechsel ZU diesem Modul.
   * Refresh Canvas, restore state, start animation loops.
   */
  activate(): void;

  /**
   * Aufgerufen bei jedem Wechsel WEG von diesem Modul.
   * Stop animation loops, cleanup temporary state.
   */
  deactivate(): void;

  /**
   * Aufgerufen wenn der Viewport sich ändert.
   * Re-sync canvas sizes, re-render.
   */
  resize(): void;

  /**
   * Vollständige Bereinigung (Event-Listener entfernen, etc.)
   * Für zukünftige dynamische Modul-Lade-Systeme.
   */
  destroy(): void;
}

// ─── Module Registration ─────────────────────────────────────────────────────

export interface ModuleRegistration {
  id: string;
  label: string;
  icon: string;
  description: string;
  factory: () => LernModul;
}

// ─── App State ───────────────────────────────────────────────────────────────

export interface AppState {
  currentModuleId: string | null;
  colorMode: "dark" | "light";
  sessionStats: SessionStats;
}

export interface SessionStats {
  attempts: number;
  correct: number;
  startTime: number;
}

// ─── Event System ────────────────────────────────────────────────────────────

export type AppEventType =
  | "module:activated"
  | "module:deactivated"
  | "mode:changed"
  | "theme:changed"
  | "task:completed"
  | "task:failed";

export interface AppEvent {
  type: AppEventType;
  payload?: unknown;
}

export type AppEventListener = (event: AppEvent) => void;

// ─── Canvas Layout Slots ─────────────────────────────────────────────────────

/**
 * Definiert reservierte Layout-Slots in einer Canvas-Szene.
 * Verhindert freie Text/Grafik-Überlagerung.
 */
export interface CanvasLayoutSlots {
  /** Aufgabenbereich oben */
  task?: CanvasRect;
  /** Hauptinteraktionsbereich */
  main: CanvasRect;
  /** Statusbereich unten */
  status?: CanvasRect;
  /** Aktionsleiste */
  actions?: CanvasRect;
}

export interface CanvasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── Info Area System ────────────────────────────────────────────────────────

/**
 * Nicht-interaktiver, aber inhaltlich wesentlicher Canvas-Bereich.
 * Wird im Debug-Modus mit cyan-gestricheltem Rahmen angezeigt.
 * Beispiele: Zahlenstrahl, Würfelbild, Punktfeld, Balkendiagramm.
 */
export interface InfoArea {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── Hit Area System ─────────────────────────────────────────────────────────

/**
 * Canvas-gezeichnete interaktive Bereiche.
 * Alle Canvas-Buttons MÜSSEN als HitArea registriert werden.
 */
export interface HitArea {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Optionale Toleranz um die Fläche (Touch-Targets) */
  pad?: number;
  /** Ob der Bereich derzeit aktiv/klickbar ist */
  enabled?: boolean;
  /** Callback bei Klick */
  onTap?: (x: number, y: number) => void;
}

export function hitAreaContains(area: HitArea, x: number, y: number): boolean {
  const pad = area.pad ?? 0;
  return (
    x >= area.x - pad &&
    x <= area.x + area.w + pad &&
    y >= area.y - pad &&
    y <= area.y + area.h + pad
  );
}

// ─── Task System ─────────────────────────────────────────────────────────────

export type TaskResult = "correct" | "incorrect" | "partial" | "pending";

export interface TaskDefinition {
  id: string;
  type: string;
  difficulty?: number;
  data: Record<string, unknown>;
}

export interface TaskAttempt {
  taskId: string;
  answer: unknown;
  result: TaskResult;
  timestamp: number;
}

// ─── Utility Types ───────────────────────────────────────────────────────────

export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };
export type Matrix4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];
