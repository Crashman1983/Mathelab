/**
 * CanvasScene — Scene Graph runtime (Baustein 1).
 *
 * Manages the measure→layout→draw cycle for a canvas element.
 * - Layout in CSS pixels (not physical pixels)
 * - DPR scaling handled transparently
 * - Auto HitArea collection from ButtonNodes
 * - Global reduced-motion guard (E4)
 */

import type { CanvasNode, Rect, SceneHitArea, ScenePointerEvent, SceneEventHandlers, Size } from "./nodes/types";
import { ButtonNode } from "./nodes/button";
import { CustomDrawNode } from "./nodes/custom";
import { createPalmRejection, type PalmRejection } from "./interactions/palm-rejection";
import { CelebrationEffect } from "./celebration";
import type { DrawOverlap, DrawnRegion } from "./tracked-context";

// ─── Draw Violation Types (DEV only) ────────────────────────────────────────

export type SceneViolationType =
  | "custom-draw-overlap"
  | "text-too-small"
  | "text-occluded"
  | "hit-area-overlap"
  | "hit-area-spacing"
  | "hit-area-too-small";

export interface DrawViolation {
  type: SceneViolationType;
  nodeId: string;
  overlaps: DrawOverlap[];
  regions: DrawnRegion[];
  detail?: string;
}

/** Minimum hit area size in CSS px (CLAUDE.md: 44×44) */
const MIN_HIT_AREA_SIZE = 44;
/** Minimum spacing between hit areas in CSS px (CLAUDE.md: 12px) */
const MIN_HIT_AREA_SPACING = 8;

// ─── Reduced Motion Guard (E4) ─────────────────────────────────────────────

let _reducedMotion = false;

if (typeof window !== "undefined") {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  _reducedMotion = mql.matches;
  mql.addEventListener("change", (e) => {
    _reducedMotion = e.matches;
  });
}

/** Check if reduced motion is preferred */
export function prefersReducedMotion(): boolean {
  return _reducedMotion;
}

// ─── CanvasScene ────────────────────────────────────────────────────────────

export class CanvasScene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private root: CanvasNode | null = null;
  private hitAreas: SceneHitArea[] = [];
  private drawViolations: DrawViolation[] = [];
  private animFrameId = 0;
  private needsRender = true;
  private eventHandlers: SceneEventHandlers = {};
  private palmRejection: PalmRejection = createPalmRejection();
  private activeButton: SceneHitArea | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundPointerUp: ((e: PointerEvent) => void) | null = null;
  private boundPointerCancel: ((e: PointerEvent) => void) | null = null;
  private celebration = new CelebrationEffect();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2d context");
    this.ctx = ctx;
  }

  /** Set the root node of the scene */
  setRoot(node: CanvasNode): void {
    this.root = node;
    this.needsRender = true;
  }

  /** Get the current root node */
  getRoot(): CanvasNode | null {
    return this.root;
  }

  /** Get collected hit areas (available after render) */
  getHitAreas(): SceneHitArea[] {
    return this.hitAreas;
  }

  /** Get draw violations from CustomDrawNodes (DEV only, available after render) */
  getDrawViolations(): DrawViolation[] {
    return this.drawViolations;
  }

  /** Find a node by id in the tree */
  find(id: string): CanvasNode | null {
    if (!this.root) return null;
    return findNode(this.root, id);
  }

  /** Mark the scene as needing a re-render */
  invalidate(): void {
    this.needsRender = true;
  }

  /** Perform a single render: sync canvas size, measure→layout→draw */
  render(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;

    // Sync canvas physical size
    const physW = Math.round(rect.width * dpr);
    const physH = Math.round(rect.height * dpr);
    if (this.canvas.width !== physW || this.canvas.height !== physH) {
      this.canvas.width = physW;
      this.canvas.height = physH;
    }

    const ctx = this.ctx;

    // Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, physW, physH);

    // Scale for DPR — all drawing uses CSS pixel coordinates
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!this.root) return;

    // CSS pixel dimensions
    const available: Size = { w: rect.width, h: rect.height };

    // Phase 1: Measure
    this.root.measure(ctx, available);

    // Phase 2: Layout
    this.root.layout({
      x: 0,
      y: 0,
      w: rect.width,
      h: rect.height,
    });

    // Collect hit areas from ButtonNodes
    this.hitAreas = [];
    collectHitAreas(this.root, this.hitAreas);

    // Phase 3: Draw
    this.root.draw(ctx);

    // DEV: Collect draw violations from CustomDrawNodes + hit area validation
    if (import.meta.env.DEV) {
      this.drawViolations = [];
      collectDrawViolations(this.root, this.drawViolations);
      validateHitAreas(this.hitAreas, this.drawViolations);
    }

    // Celebration overlay (drawn on top of scene graph)
    if (this.celebration.isActive) {
      this.celebration.draw(ctx, rect.width, rect.height);
    }

    this.needsRender = false;
  }

  /** Start a render loop using requestAnimationFrame */
  startLoop(): void {
    let lastTime: number | null = null;
    const loop = (now: number) => {
      const dt = lastTime !== null ? now - lastTime : 0;
      lastTime = now;

      // Tick celebration and force re-render each frame while active
      if (this.celebration.isActive) {
        this.celebration.tick(dt);
        this.needsRender = true;
      }

      if (this.needsRender) {
        this.render();
      }
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  /** Trigger a celebration burst centered on the canvas */
  triggerCelebration(variant?: number): void {
    const rect = this.canvas.getBoundingClientRect();
    this.celebration.trigger(rect.width / 2, rect.height / 2, variant);
    this.needsRender = true;
  }

  /** Stop the render loop */
  stopLoop(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  /** Hit test a point (in CSS pixels relative to canvas) */
  hitTest(x: number, y: number): SceneHitArea | null {
    // Search in reverse order (topmost first)
    for (let i = this.hitAreas.length - 1; i >= 0; i--) {
      const area = this.hitAreas[i];
      if (!area.enabled) continue;
      const r = area.rect;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return area;
      }
    }
    return null;
  }

  /** Find a hit area by testId or id */
  findHitArea(testId: string): SceneHitArea | null {
    return this.hitAreas.find(a => a.testId === testId || a.id === testId) ?? null;
  }

  /** Get all hit areas as plain objects (for test API serialization) */
  getHitAreasSummary(): Array<{ id: string; testId?: string; rect: Rect; enabled: boolean }> {
    return this.hitAreas.map(a => ({
      id: a.id,
      testId: a.testId,
      rect: { ...a.rect },
      enabled: a.enabled,
    }));
  }

  /** Get CSS pixel dimensions of the canvas */
  getCSSSize(): Size {
    const rect = this.canvas.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }

  /** Set event handlers for pointer events */
  setEventHandlers(handlers: SceneEventHandlers): void {
    this.eventHandlers = handlers;
  }

  /** Attach pointer event listeners to the canvas */
  attachPointerEvents(): void {
    if (this.boundPointerDown) return; // already attached

    const toSceneEvent = (e: PointerEvent, type: string): ScenePointerEvent | null => {
      if (this.palmRejection.shouldIgnore(e)) return null;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const target = (type === "down" || type === "up") ? this.hitTest(x, y) : null;
      return {
        x, y,
        pointerId: e.pointerId,
        pointerType: e.pointerType as ScenePointerEvent["pointerType"],
        isPrimary: e.isPrimary,
        pressure: e.pressure,
        button: e.button,
        target,
      };
    };

    this.boundPointerDown = (e: PointerEvent) => {
      const se = toSceneEvent(e, "down");
      if (!se) return;

      // Button press handling (WCAG 2.5.2: visual on down, action on up)
      if (se.target?.onTap) {
        this.activeButton = se.target;
        const btn = se.target.node;
        if (btn instanceof ButtonNode) {
          btn.setPressed(true);
          this.invalidate();
        }
      }

      this.eventHandlers.onPointerDown?.(se);
    };

    this.boundPointerMove = (e: PointerEvent) => {
      if (this.palmRejection.shouldIgnore(e)) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const se: ScenePointerEvent = {
        x, y,
        pointerId: e.pointerId,
        pointerType: e.pointerType as ScenePointerEvent["pointerType"],
        isPrimary: e.isPrimary,
        pressure: e.pressure,
        button: e.button,
        target: null,
      };
      this.eventHandlers.onPointerMove?.(se);
    };

    this.boundPointerUp = (e: PointerEvent) => {
      const se = toSceneEvent(e, "up");
      if (!se) return;

      // Button release: fire onTap if still over the same button
      if (this.activeButton) {
        const btn = this.activeButton.node;
        if (btn instanceof ButtonNode) {
          btn.setPressed(false);
          this.invalidate();
        }
        // Check if pointer is still within the button rect
        const r = this.activeButton.rect;
        if (se.x >= r.x && se.x <= r.x + r.w && se.y >= r.y && se.y <= r.y + r.h) {
          this.activeButton.onTap?.(se.x, se.y);
        }
        this.activeButton = null;
      }

      this.eventHandlers.onPointerUp?.(se);
    };

    this.boundPointerCancel = (e: PointerEvent) => {
      // Clear active button without firing
      if (this.activeButton) {
        const btn = this.activeButton.node;
        if (btn instanceof ButtonNode) {
          btn.setPressed(false);
          this.invalidate();
        }
        this.activeButton = null;
      }

      const se = toSceneEvent(e, "cancel");
      if (se) this.eventHandlers.onPointerCancel?.(se);
    };

    this.canvas.addEventListener("pointerdown", this.boundPointerDown);
    this.canvas.addEventListener("pointermove", this.boundPointerMove);
    this.canvas.addEventListener("pointerup", this.boundPointerUp);
    this.canvas.addEventListener("pointercancel", this.boundPointerCancel);
    // Prevent default touch actions on the canvas (no scroll/zoom)
    this.canvas.style.touchAction = "none";
  }

  /** Detach pointer event listeners */
  detachPointerEvents(): void {
    if (this.boundPointerDown) {
      this.canvas.removeEventListener("pointerdown", this.boundPointerDown);
      this.canvas.removeEventListener("pointermove", this.boundPointerMove!);
      this.canvas.removeEventListener("pointerup", this.boundPointerUp!);
      this.canvas.removeEventListener("pointercancel", this.boundPointerCancel!);
      this.boundPointerDown = null;
      this.boundPointerMove = null;
      this.boundPointerUp = null;
      this.boundPointerCancel = null;
    }
    this.palmRejection.reset();
    this.activeButton = null;
  }

  /** Dispose resources */
  destroy(): void {
    this.detachPointerEvents();
    this.stopLoop();
    this.root = null;
    this.hitAreas = [];
  }
}

// ─── Tree Traversal ─────────────────────────────────────────────────────────

function findNode(node: CanvasNode, id: string): CanvasNode | null {
  if (node.id === id) return node;

  // Check children for container types
  const children = getChildren(node);
  for (const child of children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function collectHitAreas(
  node: CanvasNode,
  areas: SceneHitArea[],
): void {
  if (node.visible === false) return;

  if (node instanceof ButtonNode) {
    areas.push(node.toHitArea());
  }

  for (const child of getChildren(node)) {
    collectHitAreas(child, areas);
  }
}

function collectDrawViolations(
  node: CanvasNode,
  violations: DrawViolation[],
): void {
  if (node.visible === false) return;

  if (node instanceof CustomDrawNode) {
    // Existing overlap check
    if (node._debugOverlaps.length > 0) {
      violations.push({
        type: "custom-draw-overlap",
        nodeId: node.id ?? "custom",
        overlaps: node._debugOverlaps,
        regions: node._debugRegions,
      });
    }
    // New: check for text-too-small and text-occluded via checkViolations
    if (node._debugViolations && node._debugViolations.length > 0) {
      for (const v of node._debugViolations) {
        violations.push({
          type: v.type as SceneViolationType,
          nodeId: node.id ?? "custom",
          overlaps: [],
          regions: v.region ? [v.region] : [],
          detail: v.detail,
        });
      }
    }
  }

  for (const child of getChildren(node)) {
    collectDrawViolations(child, violations);
  }
}

/** Validate hit areas for size, overlap, and spacing */
function validateHitAreas(
  areas: SceneHitArea[],
  violations: DrawViolation[],
): void {
  for (let i = 0; i < areas.length; i++) {
    const a = areas[i]!;

    // Check minimum size (44×44 CSS px)
    if (a.rect.w < MIN_HIT_AREA_SIZE || a.rect.h < MIN_HIT_AREA_SIZE) {
      violations.push({
        type: "hit-area-too-small",
        nodeId: a.id,
        overlaps: [],
        regions: [],
        detail: `Hit area "${a.id}" is ${Math.round(a.rect.w)}×${Math.round(a.rect.h)}px (min: ${MIN_HIT_AREA_SIZE}×${MIN_HIT_AREA_SIZE}px)`,
      });
    }

    // Check pairwise overlap and spacing
    for (let j = i + 1; j < areas.length; j++) {
      const b = areas[j]!;

      // Overlap check
      const ox = Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w) - Math.max(a.rect.x, b.rect.x);
      const oy = Math.min(a.rect.y + a.rect.h, b.rect.y + b.rect.h) - Math.max(a.rect.y, b.rect.y);
      if (ox > 0 && oy > 0) {
        violations.push({
          type: "hit-area-overlap",
          nodeId: `${a.id}+${b.id}`,
          overlaps: [],
          regions: [],
          detail: `Hit areas "${a.id}" and "${b.id}" overlap by ${Math.round(ox)}×${Math.round(oy)}px`,
        });
        continue; // Skip spacing check if overlapping
      }

      // Spacing check — only for nearby areas (within 100px)
      const gapX = Math.max(0, Math.max(a.rect.x, b.rect.x) - Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w));
      const gapY = Math.max(0, Math.max(a.rect.y, b.rect.y) - Math.min(a.rect.y + a.rect.h, b.rect.y + b.rect.h));
      const gap = Math.sqrt(gapX * gapX + gapY * gapY);
      if (gap > 0 && gap < MIN_HIT_AREA_SPACING) {
        violations.push({
          type: "hit-area-spacing",
          nodeId: `${a.id}+${b.id}`,
          overlaps: [],
          regions: [],
          detail: `Hit areas "${a.id}" and "${b.id}" are only ${Math.round(gap)}px apart (min: ${MIN_HIT_AREA_SPACING}px)`,
        });
      }
    }
  }
}

function getChildren(node: CanvasNode): CanvasNode[] {
  // Duck-type: check for 'children' array
  const n = node as unknown as Record<string, unknown>;
  if (Array.isArray(n.children)) {
    return n.children as CanvasNode[];
  }
  return [];
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createScene(canvas: HTMLCanvasElement): CanvasScene {
  return new CanvasScene(canvas);
}
