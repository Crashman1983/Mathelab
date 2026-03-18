/**
 * Core types for the constraint-based Canvas Layout System (Baustein 0).
 *
 * Kernprinzip: Kein Element wird gezeichnet, bevor sein Platzbedarf
 * gemessen und seine Position validiert wurde.
 *
 * Zyklus: measure() → layout() → draw()
 * - measure() berechnet min/preferred Größe
 * - layout() weist Position + Größe zu (in CSS-Pixeln)
 * - draw() zeichnet an der zugewiesenen Position
 */

// ─── Geometry ───────────────────────────────────────────────────────────────

export interface Size {
  w: number;
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

// ─── Measurement ────────────────────────────────────────────────────────────

export interface MeasuredSize {
  /** Minimum width needed (e.g. text + padding) */
  minW: number;
  /** Minimum height needed */
  minH: number;
  /** Preferred width if space allows */
  prefW: number;
  /** Preferred height if space allows */
  prefH: number;
  /** Maximum width (optional cap) */
  maxW?: number;
  /** Maximum height (optional cap) */
  maxH?: number;
}

// ─── Canvas Node Interface ──────────────────────────────────────────────────

/**
 * Base interface for all canvas layout nodes.
 * Every node participates in the measure→layout→draw cycle.
 */
export interface CanvasNode {
  /** Unique id for hit-testing and scene queries */
  id?: string;

  /** Flex weight for proportional space distribution (default: 0 = fixed) */
  flex?: number;

  /** Last measurement result, set by measure() */
  lastMeasured: MeasuredSize;

  /** Allocated rectangle, set by layout() */
  allocatedRect: Rect;

  /** Whether this node is visible (default: true) */
  visible?: boolean;

  /**
   * Phase 1: Measure intrinsic size given available space.
   * Must NOT draw or modify external state.
   */
  measure(ctx: CanvasRenderingContext2D, available: Size): MeasuredSize;

  /**
   * Phase 2: Accept allocated position and size.
   * Coordinates are in CSS pixels (not physical pixels).
   * All values are Math.round()'ed by the parent container.
   */
  layout(allocated: Rect): void;

  /**
   * Phase 3: Draw at the allocated position.
   * ctx is already scaled by DPR — use CSS pixel coordinates.
   */
  draw(ctx: CanvasRenderingContext2D): void;
}

// ─── Node Properties ────────────────────────────────────────────────────────

export interface TextStyle {
  /** Font size key from resolveCanvasFonts() */
  fontSize?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Color key from getPalette() or direct color string */
  color?: string;
  /** Text alignment within allocated rect */
  align?: "left" | "center" | "right";
  /** Vertical alignment */
  vAlign?: "top" | "middle" | "bottom";
  /** Bold weight */
  bold?: boolean;
  /** Padding around text in CSS pixels */
  padding?: number;
  /** Maximum number of lines (truncate with ellipsis) */
  maxLines?: number;
}

export interface ButtonStyle {
  /** Visual variant */
  variant?: "primary" | "secondary" | "ghost" | "ok" | "warn" | "bad";
  /** Minimum width in CSS pixels */
  minWidth?: number;
  /** Minimum height in CSS pixels (default: 44 for touch targets) */
  minHeight?: number;
  /** Whether the button is currently enabled */
  enabled?: boolean;
  /** Whether the button currently has keyboard focus */
  focused?: boolean;
}

export interface PanelStyle {
  /** Background color key or direct color */
  bg?: string;
  /** Border color */
  border?: string;
  /** Border width in CSS pixels */
  borderWidth?: number;
  /** Corner radius in CSS pixels */
  radius?: number;
  /** Shadow blur radius */
  shadowBlur?: number;
  /** Padding inside the panel */
  padding?: number;
}

export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
}

// ─── Container Options ──────────────────────────────────────────────────────

export interface StackOptions {
  /** Gap between children in CSS pixels */
  gap?: number;
  /** Padding around the stack */
  padding?: number;
  /** Cross-axis alignment */
  align?: "start" | "center" | "end" | "stretch";
  /** Main-axis alignment (for non-flex children) */
  justify?: "start" | "center" | "end" | "spaceBetween";
}

export interface GridOptions {
  /** Number of columns */
  cols: number;
  /** Number of rows (auto-calculated if omitted) */
  rows?: number;
  /** Gap between cells */
  gap?: number;
  /** Padding around the grid */
  padding?: number;
}

// ─── Hit Area (auto-registered from ButtonNode) ─────────────────────────────

export interface SceneHitArea {
  id: string;
  /** Stable test identifier for automation — survives label/id changes */
  testId?: string;
  rect: Rect;
  enabled: boolean;
  onTap?: (x: number, y: number) => void;
  /** Node reference for focus management */
  node: CanvasNode;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_MEASURED: MeasuredSize = {
  minW: 0,
  minH: 0,
  prefW: 0,
  prefH: 0,
};

export const DEFAULT_RECT: Rect = { x: 0, y: 0, w: 0, h: 0 };

/** Minimum touch target size in CSS pixels (CLAUDE.md MUST) */
export const MIN_TOUCH_TARGET = 44;

// ─── Scene Pointer Events ──────────────────────────────────────────────────

/** Pointer event data in CSS-pixel coordinates relative to canvas */
export interface ScenePointerEvent {
  /** X position in CSS pixels relative to canvas */
  x: number;
  /** Y position in CSS pixels relative to canvas */
  y: number;
  pointerId: number;
  pointerType: "mouse" | "touch" | "pen";
  isPrimary: boolean;
  pressure: number;
  button: number;
  /** Hit-tested target (ButtonNode or null) */
  target: SceneHitArea | null;
}

/** Event handlers for scene pointer events */
export interface SceneEventHandlers {
  onPointerDown?: (e: ScenePointerEvent) => void;
  onPointerMove?: (e: ScenePointerEvent) => void;
  onPointerUp?: (e: ScenePointerEvent) => void;
  onPointerCancel?: (e: ScenePointerEvent) => void;
}
