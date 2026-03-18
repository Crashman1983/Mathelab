/**
 * Abstract base implementation for CanvasNode.
 * Provides default lastMeasured/allocatedRect storage.
 */

import type {
  CanvasNode,
  MeasuredSize,
  Rect,
  Size,
} from "./types";
import { DEFAULT_MEASURED, DEFAULT_RECT } from "./types";

/** Minimum spacing a node requires from its neighbours in a container */
export interface Clearance {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export abstract class BaseNode implements CanvasNode {
  id?: string;
  flex?: number;
  visible?: boolean;
  /** Minimum spacing from neighbouring nodes in a stack/container (CSS px) */
  clearance?: Clearance;
  lastMeasured: MeasuredSize = { ...DEFAULT_MEASURED };
  allocatedRect: Rect = { ...DEFAULT_RECT };

  abstract measure(
    ctx: CanvasRenderingContext2D,
    available: Size,
  ): MeasuredSize;

  layout(allocated: Rect): void {
    this.allocatedRect = allocated;
  }

  abstract draw(ctx: CanvasRenderingContext2D): void;

  /** Helper: store measurement and return it */
  protected storeMeasure(m: MeasuredSize): MeasuredSize {
    this.lastMeasured = m;
    return m;
  }
}
