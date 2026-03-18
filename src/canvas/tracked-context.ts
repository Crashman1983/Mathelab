/**
 * TrackedContext — Debug wrapper for CanvasRenderingContext2D.
 *
 * Intercepts drawing calls (fillText, strokeText, fillRect, arc) inside
 * CustomDrawNode and records their bounding boxes. After drawing, checks
 * for pairwise overlaps between recorded regions.
 *
 * Tree-shaken in production: only imported behind `import.meta.env.DEV`.
 */

import type { Rect } from "./nodes/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DrawnRegion {
  /** Auto-generated ID: method + content, e.g. "fillText:'Ziel:'" */
  id: string;
  /** Bounding box in CSS pixels */
  rect: Rect;
  /** Drawing method that created this region */
  method: "fillText" | "strokeText" | "fillRect" | "arc";
}

export interface DrawOverlap {
  regionA: string;
  regionB: string;
  overlapPx: { x: number; y: number };
  detail: string;
}

/** Violation types detected during custom drawing */
export type DrawViolationType =
  | "text-too-small"
  | "text-occluded"
  | "custom-draw-overlap";

export interface DrawViolationEntry {
  type: DrawViolationType;
  detail: string;
  region?: DrawnRegion;
  occluder?: DrawnRegion;
}

/** Minimum font size in CSS pixels for canvas text (CLAUDE.md: 18px for body, 12px absolute min) */
const MIN_CANVAS_FONT_SIZE = 12;
/** Overlap fraction threshold: text is "occluded" if >30% of its area is covered */
const OCCLUSION_THRESHOLD = 0.3;

/** Parse font size from a CSS font string like "700 18px Atkinson..." */
function parseFontSizePx(font: string): number {
  const match = font.match(/(\d+(?:\.\d+)?)\s*px/);
  return match ? parseFloat(match[1]!) : 0;
}

// ─── Text Bounding Box Calculation ──────────────────────────────────────────

/**
 * Calculate the bounding box of a fillText/strokeText call,
 * accounting for textAlign and textBaseline.
 */
function textBBox(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
): Rect {
  const metrics = ctx.measureText(str);
  const w = metrics.width;

  // Vertical extents from baseline
  const ascent = metrics.actualBoundingBoxAscent ?? metrics.fontBoundingBoxAscent ?? 0;
  const descent = metrics.actualBoundingBoxDescent ?? metrics.fontBoundingBoxDescent ?? 0;
  const h = ascent + descent;

  // Horizontal offset based on textAlign
  let left = x;
  const align = ctx.textAlign;
  if (align === "center") {
    left = x - w / 2;
  } else if (align === "right" || align === "end") {
    left = x - w;
  }

  // Vertical offset based on textBaseline
  let top = y;
  const baseline = ctx.textBaseline;
  if (baseline === "middle") {
    top = y - h / 2;
  } else if (baseline === "top" || baseline === "hanging") {
    top = y;
  } else if (baseline === "alphabetic" || baseline === "ideographic") {
    top = y - ascent;
  } else if (baseline === "bottom") {
    top = y - h;
  } else {
    // default: treat as alphabetic
    top = y - ascent;
  }

  return { x: left, y: top, w, h };
}

// ─── Overlap Detection ──────────────────────────────────────────────────────

function rectsOverlap(a: Rect, b: Rect, tolerance: number): { ox: number; oy: number } | null {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (ox > tolerance && oy > tolerance) {
    return { ox, oy };
  }
  return null;
}

// ─── TrackedContext ─────────────────────────────────────────────────────────

/**
 * Creates a Proxy around CanvasRenderingContext2D that intercepts
 * drawing calls and tracks bounding boxes.
 *
 * Returns the proxy and a controller to query regions/overlaps.
 */
export function createTrackedContext(
  ctx: CanvasRenderingContext2D,
  nodeId: string,
): {
  proxy: CanvasRenderingContext2D;
  getRegions: () => DrawnRegion[];
  checkOverlaps: (tolerance?: number) => DrawOverlap[];
  checkViolations: (tolerance?: number) => DrawViolationEntry[];
} {
  const regions: DrawnRegion[] = [];
  let textCounter = 0;
  let rectCounter = 0;
  let arcCounter = 0;

  const proxy = new Proxy(ctx, {
    get(target, prop, receiver) {
      // Intercept fillText
      if (prop === "fillText") {
        return (str: string, x: number, y: number, maxWidth?: number) => {
          // Record bounding box
          const bbox = textBBox(target, str, x, y);
          if (maxWidth !== undefined && bbox.w > maxWidth) {
            bbox.w = maxWidth;
          }
          // Record font size for text-too-small check
          const fontSize = parseFontSizePx(target.font);
          if (fontSize > 0 && fontSize < bbox.h) {
            // Use parsed font size as height (more reliable than measureText descent)
            bbox.h = fontSize;
          }
          const label = str.length > 30 ? str.slice(0, 27) + "..." : str;
          regions.push({
            id: `${nodeId}/fillText[${textCounter++}]:'${label}'`,
            rect: bbox,
            method: "fillText",
          });
          // Call original
          return target.fillText(str, x, y, maxWidth);
        };
      }

      // Intercept strokeText
      if (prop === "strokeText") {
        return (str: string, x: number, y: number, maxWidth?: number) => {
          const bbox = textBBox(target, str, x, y);
          if (maxWidth !== undefined && bbox.w > maxWidth) {
            bbox.w = maxWidth;
          }
          const label = str.length > 30 ? str.slice(0, 27) + "..." : str;
          regions.push({
            id: `${nodeId}/strokeText[${textCounter++}]:'${label}'`,
            rect: bbox,
            method: "strokeText",
          });
          return target.strokeText(str, x, y, maxWidth);
        };
      }

      // Intercept fillRect (skip clearRect-like calls with globalAlpha < 0.05)
      if (prop === "fillRect") {
        return (x: number, y: number, w: number, h: number) => {
          // Only track meaningful rects (not tiny decorations)
          if (w >= 10 && h >= 10) {
            regions.push({
              id: `${nodeId}/fillRect[${rectCounter++}]`,
              rect: { x, y, w, h },
              method: "fillRect",
            });
          }
          return target.fillRect(x, y, w, h);
        };
      }

      // Intercept arc (circle drawing — approximate as square bounding box)
      if (prop === "arc") {
        return (cx: number, cy: number, radius: number, startAngle: number, endAngle: number, ccw?: boolean) => {
          // Only track full circles (not partial arcs used for paths)
          if (Math.abs(endAngle - startAngle) >= Math.PI * 1.9) {
            regions.push({
              id: `${nodeId}/arc[${arcCounter++}]`,
              rect: { x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 },
              method: "arc",
            });
          }
          return target.arc(cx, cy, radius, startAngle, endAngle, ccw);
        };
      }

      // All other properties: pass through with correct `this`
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },

    set(target, prop, value) {
      // Allow setting properties like font, fillStyle, etc.
      (target as unknown as Record<string | symbol, unknown>)[prop] = value;
      return true;
    },
  });

  return {
    proxy,
    getRegions: () => regions,
    checkOverlaps: (tolerance = 2) => {
      const overlaps: DrawOverlap[] = [];

      // Only check text regions against each other (text-on-text overlap matters most)
      const textRegions = regions.filter(r => r.method === "fillText" || r.method === "strokeText");

      for (let i = 0; i < textRegions.length; i++) {
        for (let j = i + 1; j < textRegions.length; j++) {
          const a = textRegions[i]!;
          const b = textRegions[j]!;
          const overlap = rectsOverlap(a.rect, b.rect, tolerance);
          if (overlap) {
            overlaps.push({
              regionA: a.id,
              regionB: b.id,
              overlapPx: { x: Math.round(overlap.ox), y: Math.round(overlap.oy) },
              detail: `Text overlap ${Math.round(overlap.ox)}×${Math.round(overlap.oy)}px: "${a.id}" ∩ "${b.id}"`,
            });
          }
        }
      }

      return overlaps;
    },

    /**
     * Check for all drawing quality violations:
     * - text-too-small: font size < 12px
     * - text-occluded: text bbox >30% covered by another drawn region
     * - custom-draw-overlap: text-on-text overlaps (existing check)
     */
    checkViolations: (tolerance = 2): DrawViolationEntry[] => {
      const violations: DrawViolationEntry[] = [];

      const textRegions = regions.filter(r => r.method === "fillText" || r.method === "strokeText");
      const nonTextRegions = regions.filter(r => r.method === "fillRect" || r.method === "arc");

      // ── text-too-small: check font sizes recorded during draw ──
      for (const r of textRegions) {
        // Font size is encoded in the region height (ascent + descent)
        // For a more reliable check, we use the recorded font sizes
        if (r.rect.h > 0 && r.rect.h < MIN_CANVAS_FONT_SIZE) {
          violations.push({
            type: "text-too-small",
            detail: `Text "${r.id}" rendered at ~${Math.round(r.rect.h)}px (min: ${MIN_CANVAS_FONT_SIZE}px)`,
            region: r,
          });
        }
      }

      // ── text-occluded: text covered by non-text regions (sprites, shapes) ──
      for (const textR of textRegions) {
        const textArea = textR.rect.w * textR.rect.h;
        if (textArea <= 0) continue;

        for (const other of nonTextRegions) {
          const overlap = rectsOverlap(textR.rect, other.rect, 0);
          if (overlap) {
            const overlapArea = overlap.ox * overlap.oy;
            const fraction = overlapArea / textArea;
            if (fraction >= OCCLUSION_THRESHOLD) {
              violations.push({
                type: "text-occluded",
                detail: `Text "${textR.id}" is ${Math.round(fraction * 100)}% occluded by "${other.id}"`,
                region: textR,
                occluder: other,
              });
            }
          }
        }
      }

      // ── custom-draw-overlap: text-on-text (existing logic) ──
      for (let i = 0; i < textRegions.length; i++) {
        for (let j = i + 1; j < textRegions.length; j++) {
          const a = textRegions[i]!;
          const b = textRegions[j]!;
          const overlap = rectsOverlap(a.rect, b.rect, tolerance);
          if (overlap) {
            violations.push({
              type: "custom-draw-overlap",
              detail: `Text overlap ${Math.round(overlap.ox)}×${Math.round(overlap.oy)}px: "${a.id}" ∩ "${b.id}"`,
              region: a,
              occluder: b,
            });
          }
        }
      }

      return violations;
    },
  };
}
