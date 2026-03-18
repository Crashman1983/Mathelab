/**
 * Canvas Mock für Vitest/jsdom.
 * jsdom unterstützt HTMLCanvasElement.getContext('2d') nicht nativ.
 * Dieser Mock stellt alle benötigten CanvasRenderingContext2D-Methoden als vi.fn() bereit.
 */
import { vi } from "vitest";

// Canvas 2D context mock — alle Methoden als no-op vi.fn()
const createCtx2DMock = () => {
  const ctx: Record<string, unknown> = {
    canvas: {} as HTMLCanvasElement,
    // State
    save: vi.fn(),
    restore: vi.fn(),
    // Transform
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    // Path
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    rect: vi.fn(),
    // Draw
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    // Measure
    measureText: vi.fn(() => ({ width: 50, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 3 })),
    // Image
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
    putImageData: vi.fn(),
    createImageData: vi.fn(),
    // Style
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createPattern: vi.fn(() => null),
    // Other
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
    isPointInPath: vi.fn(() => false),
    isPointInStroke: vi.fn(() => false),
    // Mutable style properties
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    miterLimit: 10,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    shadowBlur: 0,
    shadowColor: "rgba(0,0,0,0)",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  };
  return ctx;
};

// Patch HTMLCanvasElement.prototype.getContext
const origGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function(
  this: HTMLCanvasElement,
  contextId: string,
  ...args: unknown[]
) {
  if (contextId === "2d") {
    const ctx = createCtx2DMock();
    ctx.canvas = this;
    return ctx as unknown as CanvasRenderingContext2D;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (origGetContext as any).call(this, contextId, ...args);
} as typeof HTMLCanvasElement.prototype.getContext;

// Stub requestAnimationFrame / cancelAnimationFrame if not present
if (typeof window.requestAnimationFrame === "undefined") {
  window.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 16) as unknown as number;
  window.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

// Stub matchMedia (benötigt von scene.ts für prefers-reduced-motion)
if (typeof window.matchMedia !== "function") {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  })) as unknown as typeof window.matchMedia;
}

// Stub ResizeObserver
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
