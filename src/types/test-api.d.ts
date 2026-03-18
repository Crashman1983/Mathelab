/**
 * Dev-Mode Test API — exposed on `window.__moduleTestAPI` when `import.meta.env.DEV`.
 * Allows automation tools (Claude, Playwright, etc.) to interact with canvas-based
 * modules without fighting DOM pointer events and palm rejection.
 *
 * Tree-shaken in production builds.
 */

// ── Vite ImportMeta env types ────────────────────────────────────────────────

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// ── Test API Types ───────────────────────────────────────────────────────────

export interface GridTestHelper {
  /** Simulate a tap on grid cell (col, row). Returns true if cell was in bounds. */
  tapCell(col: number, row: number): boolean;
  /** Get current grid geometry (origin, cellSize, dimensions). */
  getGeometry(): {
    originX: number;
    originY: number;
    cellSize: number;
    cols: number;
    rows: number;
  };
}

export interface ModuleTestAPI {
  // ── State Inspection ──
  /** Get the current module state (typed per module). */
  getModuleState(): unknown;
  /** Get current phase: "present" | "interact" | "review". */
  getPhase(): string;
  /** Get the current task (Sets serialized as arrays). */
  getTask(): Record<string, unknown>;

  // ── Actions ──
  /** Update module state via reducer function. Triggers rebuildScene(). */
  updateState(fn: (s: unknown) => unknown): void;
  /** Force a scene rebuild + render. */
  rebuildScene(): void;
  /** Submit an answer for checking. */
  submitAnswer(answer: unknown): void;

  // ── Pointer Simulation (bypasses Palm Rejection + DOM events) ──
  /** Simulate pointerdown at CSS-pixel coordinates relative to canvas. */
  simulatePointerDown(x: number, y: number): void;
  /** Simulate pointermove at CSS-pixel coordinates relative to canvas. */
  simulatePointerMove(x: number, y: number): void;
  /** Simulate pointerup at CSS-pixel coordinates relative to canvas. */
  simulatePointerUp(x: number, y: number): void;
  /** Simulate a complete tap (down + up) at CSS-pixel coordinates. */
  simulateTap(x: number, y: number): void;

  // ── Scene Graph Queries ──
  /** Get all registered hit areas with their positions and state. */
  getHitAreas(): Array<{
    id: string;
    testId?: string;
    rect: { x: number; y: number; w: number; h: number };
    enabled: boolean;
  }>;
  /** Find and tap a button by testId or id. Returns true if found. */
  tapButton(id: string): boolean;

  // ── Module-Specific Extensions (injected by modules in onActivate) ──
  /** Grid interaction helper — set by modules that use GridInteraction. */
  grid?: GridTestHelper;
}

declare global {
  interface Window {
    __moduleTestAPI?: ModuleTestAPI;
    /** Synchronous check if a challenge is active (set by challenge.ts) */
    __challengeActive?: () => boolean;
  }
}
