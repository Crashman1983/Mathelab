/**
 * Zentrales Design-System: Farbrollen, Typografie, Abstände, Radien, Schatten.
 * Alle Module MÜSSEN diese Werte verwenden – keine lokalen Magic Numbers.
 *
 * Änderungen hier wirken sich global aus. Neue Module dürfen keine eigenen
 * Design-Werte erfinden, die hier bereits definiert sind.
 */

// ─── Color Roles ────────────────────────────────────────────────────────────

export type ColorMode = "dark" | "light";

export interface ColorPalette {
  // Backgrounds
  bg: string;
  panel: string;
  panelSoft: string;
  canvasBg: string;
  // Lines & Borders
  line: string;
  gridLine: string;
  // Text
  text: string;
  textDim: string;
  textOnAccent: string;
  // Accent
  accent: string;
  accentSubtle: string;
  accentLight: string;
  accentActive: string;
  accentBorder: string;
  accentBorderStrong: string;
  accentFocus: string;
  // Status
  ok: string;
  okHover: string;
  okSubtle: string;
  warn: string;
  warnHover: string;
  warnSubtle: string;
  bad: string;
  badHover: string;
  badSubtle: string;
  // Canvas-specific
  canvasText: string;
  canvasTextDim: string;
  canvasBorder: string;
  canvasPrimary: string;
  canvasSecondary: string;
  canvasSuccess: string;
  canvasError: string;
  canvasWarn: string;
  canvasHighlight: string;
  // Face colors for 3D geometry / dice / wheels
  faceColors: string[];
  // Coin colors (semantic — theme-invariant: Kupfer/Silber/Gold bleibt im Light Mode gleich)
  coinCopper: string;
  coinCopperRim: string;
  coinSilver: string;
  coinSilverRim: string;
  coinGold: string;
  coinGoldRim: string;
  coinText: string;
  coinTextDark: string;
  // Character colors — theme-invariant (skeuomorphic creatures)
  frogBody: string;
  frogDark: string;
  diverSuit: string;
  diverDark: string;
  diverMask: string;
  // Material colors — theme-invariant (real-world objects)
  nutBrown: string;
  nutDark: string;
  bagTan: string;
  pizzaCrust: string;
  pizzaCrustDark: string;
  pizzaFill: string;
  pizzaTopping: string;
  // Bill denomination colors
  bill5: string;
  bill5Dark: string;
  bill10: string;
  bill10Dark: string;
  bill20: string;
  bill20Dark: string;
  bill50: string;
  bill50Dark: string;
}

const DARK_PALETTE: ColorPalette = {
  bg: "#0c1b33",
  panel: "#102547",
  panelSoft: "#14315d",
  canvasBg: "#0e1e36",
  line: "rgba(255,255,255,0.22)",
  gridLine: "rgba(255,255,255,0.08)",
  text: "#f4f8ff",
  textDim: "rgba(244,248,255,0.75)",
  textOnAccent: "#ffffff",
  accent: "#6db5ff",
  accentSubtle: "rgba(109,181,255,0.08)",
  accentLight: "rgba(109,181,255,0.15)",
  accentActive: "rgba(109,181,255,0.18)",
  accentBorder: "rgba(109,181,255,0.55)",
  accentBorderStrong: "rgba(109,181,255,0.62)",
  accentFocus: "rgba(109,181,255,0.9)",
  ok: "#72d59b",
  okHover: "#5bc488",
  okSubtle: "rgba(114,213,155,0.12)",
  warn: "#ffd46d",
  warnHover: "#f0c050",
  warnSubtle: "rgba(255,212,109,0.12)",
  bad: "#ff7a7a",
  badHover: "#f06060",
  badSubtle: "rgba(255,122,122,0.12)",
  canvasText: "#f4f8ff",
  canvasTextDim: "rgba(244,248,255,0.65)",
  canvasBorder: "rgba(255,255,255,0.15)",
  canvasPrimary: "#6db5ff",
  canvasSecondary: "#a78bfa",
  canvasSuccess: "#72d59b",
  canvasError: "#ff7a7a",
  canvasWarn: "#ffd46d",
  canvasHighlight: "rgba(109,181,255,0.22)",
  faceColors: [
    "#6db5ff", "#72d59b", "#ffd46d", "#ff9f7a", "#c084fc", "#f472b6",
    "#38bdf8", "#4ade80", "#facc15", "#fb923c", "#a78bfa", "#e879f9",
  ],
  // Coin colors — semantic, theme-invariant
  coinCopper:    "#c87941",
  coinCopperRim: "#a05a28",
  coinSilver:    "#b8c0cc",
  coinSilverRim: "#8a919e",
  coinGold:      "#e8c84a",
  coinGoldRim:   "#b89a20",
  coinText:      "#ffffff",
  coinTextDark:  "#2a1a08",
  // Characters
  frogBody:      "#5bb85b",
  frogDark:      "#3d8a3d",
  diverSuit:     "#2a6aad",
  diverDark:     "#1a4a8a",
  diverMask:     "#87ceeb",
  // Materials
  nutBrown:      "#c8894e",
  nutDark:       "#a06030",
  bagTan:        "#f4c97a",
  pizzaCrust:    "#c8894e",
  pizzaCrustDark:"#a06030",
  pizzaFill:     "#e8534a",
  pizzaTopping:  "#b8312f",
  // Bills
  bill5:         "#7B9B8A",
  bill5Dark:     "#5A7A68",
  bill10:        "#E85D75",
  bill10Dark:    "#C0475E",
  bill20:        "#4A8FD4",
  bill20Dark:    "#3470B0",
  bill50:        "#E8A73E",
  bill50Dark:    "#C08930",
};

const LIGHT_PALETTE: ColorPalette = {
  bg: "#f0f4fa",
  panel: "#ffffff",
  panelSoft: "#e8edf5",
  canvasBg: "#f7f9fc",
  line: "rgba(0,0,0,0.40)",
  gridLine: "rgba(0,0,0,0.18)",
  text: "#1a2340",
  textDim: "rgba(26,35,64,0.65)",
  textOnAccent: "#ffffff",
  accent: "#1a6bc4",
  accentSubtle: "rgba(26,107,196,0.06)",
  accentLight: "rgba(26,107,196,0.10)",
  accentActive: "rgba(26,107,196,0.12)",
  accentBorder: "rgba(26,107,196,0.40)",
  accentBorderStrong: "rgba(26,107,196,0.50)",
  accentFocus: "rgba(26,107,196,0.75)",
  ok: "#0d6630",          // ≥6.0 on all light backgrounds (was #1a9954 — 3.67 FAIL)
  okHover: "#0a5528",
  okSubtle: "rgba(13,102,48,0.10)",
  warn: "#7a5800",         // ≥5.5 on all light backgrounds (was #b8820a — 3.37 FAIL)
  warnHover: "#654700",
  warnSubtle: "rgba(122,88,0,0.10)",
  bad: "#cc2222",
  badHover: "#a81c1c",
  badSubtle: "rgba(204,34,34,0.10)",
  canvasText: "#1a2340",
  canvasTextDim: "rgba(26,35,64,0.72)",
  canvasBorder: "rgba(0,0,0,0.12)",
  canvasPrimary: "#1a6bc4",
  canvasSecondary: "#7c3aed",
  canvasSuccess: "#0d6630", // synced with ok
  canvasError: "#cc2222",
  canvasWarn: "#7a5800",   // synced with warn
  canvasHighlight: "rgba(26,107,196,0.14)",
  faceColors: [
    "#1a6bc4", "#0d6630", "#7a5800", "#c2410c", "#7c3aed", "#be185d",
    "#0369a1", "#0a5528", "#654700", "#ea580c", "#6d28d9", "#9d174d",
  ],
  // Coin colors — semantic, theme-invariant (same as dark palette)
  coinCopper:    "#c87941",
  coinCopperRim: "#a05a28",
  coinSilver:    "#b8c0cc",
  coinSilverRim: "#8a919e",
  coinGold:      "#e8c84a",
  coinGoldRim:   "#b89a20",
  coinText:      "#ffffff",
  coinTextDark:  "#2a1a08",
  // Characters — theme-invariant (same as dark palette)
  frogBody:      "#5bb85b",
  frogDark:      "#3d8a3d",
  diverSuit:     "#2a6aad",
  diverDark:     "#1a4a8a",
  diverMask:     "#87ceeb",
  // Materials — theme-invariant
  nutBrown:      "#c8894e",
  nutDark:       "#a06030",
  bagTan:        "#f4c97a",
  pizzaCrust:    "#c8894e",
  pizzaCrustDark:"#a06030",
  pizzaFill:     "#e8534a",
  pizzaTopping:  "#b8312f",
  // Bills — theme-invariant
  bill5:         "#7B9B8A",
  bill5Dark:     "#5A7A68",
  bill10:        "#E85D75",
  bill10Dark:    "#C0475E",
  bill20:        "#4A8FD4",
  bill20Dark:    "#3470B0",
  bill50:        "#E8A73E",
  bill50Dark:    "#C08930",
};

/**
 * EXPERIMENT_COLORS — Farben für Würfelseiten, Drehräder und ähnliche Zufallsexperimente.
 * Aus faceColors des Dark-Palettes extrahiert; theme-unabhängig im Logic-Layer verwendbar.
 * Importiert von logic.ts-Dateien, die keinen Canvas-/Palette-Zugang haben.
 */
export const EXPERIMENT_COLORS: string[] = [
  "#6db5ff", "#72d59b", "#ffd46d", "#ff9f7a", "#c084fc", "#f472b6",
];

/** Stellenwert-Farben für Bündelungen (HT=violett, ZT=pink) */
export const PLACE_VALUE_COLORS = {
  ht: "#8b5cf6",
  zt: "#ec4899",
} as const;

let _currentMode: ColorMode = "dark";
let _palette: ColorPalette = DARK_PALETTE;

export function getColorMode(): ColorMode {
  return _currentMode;
}

export function getPalette(): ColorPalette {
  return _palette;
}

export function setColorMode(mode: ColorMode): void {
  _currentMode = mode;
  _palette = mode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
}

// ─── Typography Roles ───────────────────────────────────────────────────────

export interface TypographySystem {
  /** Page title / App name */
  pageTitle: string;
  /** Panel / section heading */
  panelTitle: string;
  /** Lead text / task instruction */
  lead: string;
  /** Body / standard text */
  body: string;
  /** Small / helper text */
  small: string;
  /** Micro / caption text */
  micro: string;
  /** Status feedback text */
  status: string;
  /** Pill / badge labels */
  pill: string;
  /** Canvas large numbers (Dienes, clock) */
  canvasXL: string;
  /** Canvas headings */
  canvasLG: string;
  /** Canvas body text */
  canvasMD: string;
  /** Canvas small labels */
  canvasSM: string;
  /** Canvas micro annotations */
  canvasXS: string;
}

// CSS-Typografie: clamp(min, preferred, max)
// MUST (Kinder 8–10 J.): body/lead/status ≥ 18px (1.125rem), small ≥ 16px (1rem),
// micro ≥ 14px (0.875rem). Slope skaliert bis 4K-Tafel (3840px CSS-Viewport).
// Spiegelt exakt tokens.css wider — immer synchron halten!
export const TYPOGRAPHY: TypographySystem = {
  pageTitle:  "clamp(1.75rem, 1.2rem + 1.4vw, 5rem)",
  panelTitle: "clamp(1.25rem, 1.05rem + 0.52vw, 2.2rem)",
  lead:       "clamp(1.125rem, 1.0rem + 0.32vw, 1.8rem)",
  body:       "clamp(1.125rem, 1.05rem + 0.22vw, 1.8rem)",
  small:      "clamp(1rem, 0.93rem + 0.22vw, 1.6rem)",
  micro:      "clamp(0.875rem, 0.82rem + 0.17vw, 1.4rem)",
  status:     "clamp(1.125rem, 1.0rem + 0.32vw, 1.8rem)",
  pill:       "clamp(0.875rem, 0.82rem + 0.16vw, 1.4rem)",
  canvasXL:   "clamp(2.00rem, 1.30rem + 1.80vw, 5.00rem)",
  canvasLG:   "clamp(1.20rem, 0.80rem + 1.05vw, 3.00rem)",
  canvasMD:   "clamp(0.88rem, 0.60rem + 0.72vw, 2.00rem)",
  canvasSM:   "clamp(0.78rem, 0.52rem + 0.67vw, 1.70rem)",
  canvasXS:   "clamp(0.68rem, 0.46rem + 0.56vw, 1.45rem)",
};

// ─── Canvas-specific font sizes (px, resolved from canvas width) ────────────

export interface CanvasFontSizes {
  xl: number;
  lg: number;
  md: number;
  sm: number;
  xs: number;
}

/**
 * Resolves canvas font sizes from canvas width (physical device pixels).
 * All canvas text MUST use these resolved values – no free font sizes.
 *
 * Ratios für ≥ 0,5° Sehwinkel bei 4 m auf einer 85"-4K-Tafel (≈ 53 PPI,
 * canvas.width ≈ 3 200 px bei 125 % Windows-Skalierung):
 *
 *   xs  0,023  → ~74 px → ~35 mm → 0,50° @ 4 m   kleinste Achsenbeschriftungen
 *   sm  0,028  → ~90 px → ~43 mm → 0,61° @ 4 m   normale Labels
 *   md  0,036  → ~115 px → ~55 mm → 0,79° @ 4 m  Standardtext
 *   lg  0,032  → ~102 px → ~49 mm → 0,70° @ 4 m  hervorgehobene Zahlen
 *   xl  0,038  → ~122 px → ~58 mm → 0,83° @ 4 m  Hauptzahlen / Überschriften
 *
 * Keine Obergrenzen: auf Laptop/Tablet bleibt der niedrigere canvas.width-Wert
 * automatisch für passende Größen. Untergrenzen schützen nur Viewports < 900 px.
 */
export function resolveCanvasFonts(canvasWidth: number): CanvasFontSizes {
  const w = canvasWidth;
  return {
    xl: Math.max(Math.round(w * 0.038), 32),
    lg: Math.max(Math.round(w * 0.032), 28),
    md: Math.max(Math.round(w * 0.030), 24),  // Smartboard: ~96px @3200px
    sm: Math.max(Math.round(w * 0.025), 20),   // Smartboard: ~80px @3200px
    xs: Math.max(Math.round(w * 0.020), 16),   // Smartboard: ~64px @3200px
  };
}

// ─── Spacing System ──────────────────────────────────────────────────────────

export const SPACING = {
  xs: "0.3rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  xxl: "2rem",
  // Gap shorthand (synced with tokens.css --space-md)
  gapX: "0.75rem",
  gapY: "0.75rem",
  gapXTight: "0.5rem",
  gapYTight: "0.5rem",
  // Padding shorthands
  padBlock: "0.75rem 1rem",
  padBtn: "0.5rem 1rem",
} as const;

// Canvas-specific spacing (px, relative to canvas width)
export function resolveCanvasSpacing(canvasWidth: number) {
  const w = canvasWidth;
  return {
    xs: Math.round(w * 0.008),
    sm: Math.round(w * 0.014),
    md: Math.round(w * 0.022),
    lg: Math.round(w * 0.034),
    xl: Math.round(w * 0.05),
    inset: Math.round(w * 0.028), // standard inset from edges
  };
}

// ─── Border Radius ───────────────────────────────────────────────────────────

// CSS-Komponenten (feste rem-basierte Werte)
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/**
 * Skalierte Canvas-Radien (physische px), proportional zur Canvas-Breite.
 * Verhindert winzige, kaum sichtbare Rundungen auf großen/HiDPI-Canvases.
 */
export function resolveCanvasRadius(canvasWidth: number) {
  const w = canvasWidth;
  return {
    sm:   Math.max(Math.round(w * 0.006),  6),
    md:   Math.max(Math.round(w * 0.010), 10),
    lg:   Math.max(Math.round(w * 0.016), 14),
    xl:   Math.max(Math.round(w * 0.024), 20),
    pill: 9999,
  };
}

// ─── Shadows ─────────────────────────────────────────────────────────────────

export const SHADOWS = {
  panel: "0 4px 24px rgba(0,0,0,0.35)",
  card: "0 2px 12px rgba(0,0,0,0.25)",
  btn: "0 2px 8px rgba(0,0,0,0.20)",
  focus: "0 0 0 3px var(--accent-focus)",
} as const;

// ─── Animation ───────────────────────────────────────────────────────────────

export const ANIMATION = {
  durationFast:   150,
  durationMedium: 300,
  durationSlow:   500,
  easeDefault: "ease",
  easeOut:     "ease-out",
  easeInOut:   "ease-in-out",
  /** Flüssige Eintritte für Kinder-UI (cubic-bezier spring-ähnlich) */
  easeEnter: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** Schnelle Ausgänge */
  easeExit:  "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

// ─── Responsive Breakpoints ──────────────────────────────────────────────────

export const BREAKPOINTS = {
  /** Below this: single-column mobile layout (matches CSS 1100px boundary) */
  mobile: 1100,
  /** Below this: compact 2-column, above: full 2-column */
  tablet: 1400,
  /** Above this: "roomy" layout with extra space utilisation */
  desktop: 1800,
  /** Above this: wide/4K optimisations */
  wide: 2200,
} as const;

// ─── Domain-specific color constants ─────────────────────────────────────────
// Intentionally theme-invariant: these represent real-world objects
// (analog clock, Euro coins) where faithful color is part of the learning goal.

export const CLOCK_COLORS = {
  /** Warm cream clock face — realistic analog clock */
  face:           "#fffef5",
  /** Gold border ring */
  border:         "#d0ac3a",
  /** Subtle pastel quadrant backgrounds (child readability aid) */
  sectors:        ["#fff8e1", "#f3ffe8", "#e8f4ff", "#fff0f8"] as string[],
  /** Hour numbers — always dark (clock face is always light) */
  numText:        "#1a2340",
  /** Tick marks — always dark (clock face is always light) */
  tick:           "rgba(26,35,64,0.75)",
  /** Hour hand fill */
  hourHand:       "#c62828",
  /** Hour hand dark edge / shadow */
  hourHandDark:   "#7f0000",
  /** Minute hand fill */
  minuteHand:     "#1565c0",
  /** Minute hand dark edge / shadow */
  minuteHandDark: "#0d47a1",
  /** Center pivot red dot */
  center:         "#e53935",
} as const;

export const COIN_COLORS = {
  /** Weiß für Beschriftung auf Kupfermünzen */
  copperText: "#ffffff",
  /** Kupfermünzen (1, 2, 5 Cent) — leicht unterschiedliche Töne für Wiedererkennbarkeit */
  copper1:    "#d4856a", copper1Rim: "#9c4a2f",
  copper2:    "#c97b5e", copper2Rim: "#8c3d22",
  copper5:    "#bf7050", copper5Rim: "#7a2e12",
  /** Goldmünzen (10, 20, 50 Cent — "Nordic Gold", erscheint golden) */
  gold10:     "#e8c84a", gold10Rim:  "#b8960a",  gold10Text: "#6b4a00",
  gold20:     "#f0d050", gold20Rim:  "#c8a020",  gold20Text: "#6b4a00",
  gold50:     "#f0c040", gold50Rim:  "#c09010",  gold50Text: "#5a3a00",
  /** Silber/bimetallisch (1€ = Silber-Rand) */
  silver100:  "#d0d8e8", silver100Rim: "#7090b0", silver100Text: "#1a3050",
  /** 2€ bimetallisch — goldene Mitte */
  gold200:    "#e8c850", gold200Rim:   "#8070b0", gold200Text: "#2a1060",
  /** 2€ bimetallic inner ring (silver-tone nickel alloy) */
  bimetallic: "#c8d0e0",
} as const;

export const DICE_COLORS = {
  /** Warm ivory die face — classic board-game die */
  face:   "#fffff8",
  /** Warm golden-cream border ring */
  border: "#c8b97a",
  /** Deep near-black pips */
  pip:    "#1a1a2e",
} as const;

// ─── Status Variants ─────────────────────────────────────────────────────────

export type StatusVariant = "ok" | "warn" | "bad" | "task" | "neutral";

export function getStatusColor(variant: StatusVariant, palette: ColorPalette): string {
  switch (variant) {
    case "ok": return palette.ok;
    case "warn": return palette.warn;
    case "bad": return palette.bad;
    case "task": return palette.accent;
    case "neutral": return palette.textDim;
  }
}

export function getStatusBgColor(variant: StatusVariant, palette: ColorPalette): string {
  switch (variant) {
    case "ok": return palette.okSubtle;
    case "warn": return palette.warnSubtle;
    case "bad": return palette.badSubtle;
    case "task": return palette.accentSubtle;
    case "neutral": return "transparent";
  }
}
