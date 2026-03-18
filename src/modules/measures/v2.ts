/**
 * Größen & Messen V2 — interactive module using defineModule() DSL.
 *
 * Money mode: Coin/bill buttons to collect coins toward a target.
 * Units mode: Numpad to enter converted value.
 */

import { defineModule, DIFFICULTIES } from "@app/module-framework";
import type { SceneContext, TutorialStep } from "@app/module-framework";
import { vstack, hstack } from "@canvas/nodes/container";
import { text } from "@canvas/nodes/text";
import { button } from "@canvas/nodes/button";
import { custom } from "@canvas/nodes/custom";
import { panel } from "@canvas/nodes/panel";
import type { CanvasNode } from "@canvas/nodes/types";
import { getPalette, resolveCanvasFonts } from "@core/design";
import {
  generateMoneyTask,
  generateUnitsTask,
  formatCents,
  coinLabel,
  COIN_VALUES_CT,
  UNIT_PAIRS,
  explainUnits,
  type MoneyTaskData,
  type UnitsTaskResult,
  type UnitPair,
} from "./logic";

// ─── Types ───────────────────────────────────────────────────────────────────

type MeasureTask =
  | { mode: "money"; data: MoneyTaskData }
  | { mode: "units"; data: UnitsTaskResult; pair: UnitPair };

interface MeasureState {
  selectedCoins: number[];
  totalCents: number;
  /** For mixed units: which input phase are we in? */
  unitsInputPhase: "whole" | "remainder";
  /** Stores the first (whole) answer for display during remainder phase */
  enteredWhole: number | null;
}

type Ctx = SceneContext<MeasureTask, MeasureState>;

// ─── Mutable callback refs ──────────────────────────────────────────────────

let addCoinCallback: ((coinCt: number) => void) | null = null;
let submitMoneyCallback: (() => void) | null = null;
let resetCoinsCallback: (() => void) | null = null;
let stateUpdater: ((fn: (s: MeasureState) => MeasureState) => void) | null = null;
/** Current units input phase — module-level for synchronous access in check() and buildScene */
let currentUnitsPhase: "whole" | "remainder" = "whole";
/** Entered whole value — module-level so buildScene sees it immediately after check() */
let currentEnteredWhole: number | null = null;

// ─── Hints ──────────────────────────────────────────────────────────────────

function getHints(task: MeasureTask): string[] {
  if (task.mode === "money") {
    const d = task.data;
    if (d.taskType === "change") {
      return [
        `Du bezahlst ${formatCents(d.paidInCt)} und der Preis ist ${formatCents(d.priceInCt)}.`,
        `Wechselgeld = ${formatCents(d.paidInCt)} \u2212 ${formatCents(d.priceInCt)}.`,
        `Das Wechselgeld beträgt ${formatCents(d.targetCents)}.`,
        `Lege genau ${formatCents(d.targetCents)} mit Münzen zusammen und drücke „Prüfen".`,
      ];
    }
    return [
      `Lege ${formatCents(d.targetCents)} mit Münzen und Scheinen.`,
      `Beginne mit den größten Münzen.`,
      `Der Betrag ist ${formatCents(d.targetCents)}.`,
      `Sammle Münzen bis genau ${formatCents(d.targetCents)} erreicht sind, dann drücke „Prüfen".`,
    ];
  }
  const { data, pair } = task;
  return [
    `Rechne ${data.sourceValue} ${pair.fromUnit} in ${pair.toUnit} um.`,
    `${pair.factor} ${pair.fromUnit} = 1 ${pair.toUnit}.`,
    explainUnits(data.sourceValue, pair, data.correctAnswer, data.correctRemainder),
    `${data.sourceValue} ÷ ${pair.factor} = ${data.correctAnswer}${data.correctRemainder > 0 ? ` Rest ${data.correctRemainder}` : ""}. Gib ${data.correctAnswer} ein.`,
  ];
}

// ─── Coin/Note Drawing Helpers ──────────────────────────────────────────────

/** Color config for a single Euro denomination */
interface DenomColor {
  fill: string;
  stroke: string;
  inner?: string;
}

/** Get coin/note colors from palette for a denomination in cents */
function getDenomColors(ct: number, palette: ReturnType<typeof getPalette>): DenomColor {
  // Coins: 1ct–5ct copper, 10ct–50ct gold, 1€/2€ bimetallic
  if (ct <= 5) return { fill: palette.coinCopper, stroke: palette.coinCopperRim };
  if (ct <= 50) return { fill: palette.coinGold, stroke: palette.coinGoldRim };
  if (ct === 100) return { fill: palette.coinSilver, stroke: palette.coinSilverRim, inner: palette.coinGold };
  if (ct === 200) return { fill: palette.coinGold, stroke: palette.coinGoldRim, inner: palette.coinSilver };
  // Bills — distinctive colors per denomination
  if (ct === 500) return { fill: palette.bill5, stroke: palette.bill5Dark };
  if (ct === 1000) return { fill: palette.bill10, stroke: palette.bill10Dark };
  if (ct === 2000) return { fill: palette.bill20, stroke: palette.bill20Dark };
  if (ct === 5000) return { fill: palette.bill50, stroke: palette.bill50Dark };
  return { fill: palette.coinSilver, stroke: palette.coinSilverRim };
}

/**
 * Draw a single coin or bill at (cx, cy) with given radius.
 * Bills are drawn as rounded rectangles, coins as circles.
 */
function drawDenom(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  ct: number,
  palette: ReturnType<typeof getPalette>,
): void {
  const colors = getDenomColors(ct, palette);
  const isBill = ct >= 500;

  if (isBill) {
    const billW = radius * 2.2;
    const billH = radius * 1.3;
    c.beginPath();
    if (typeof c.roundRect === "function") {
      c.roundRect(cx - billW / 2, cy - billH / 2, billW, billH, radius * 0.2);
    } else {
      c.rect(cx - billW / 2, cy - billH / 2, billW, billH);
    }
    c.fillStyle = colors.fill;
    c.fill();
    c.strokeStyle = colors.stroke;
    c.lineWidth = 2;
    c.stroke();

    // Inner pattern line for bills
    c.save(); c.globalAlpha = 0.18;
    c.strokeStyle = palette.textOnAccent;
    c.lineWidth = 1;
    c.beginPath();
    if (typeof c.roundRect === "function") {
      c.roundRect(cx - billW / 2 + 4, cy - billH / 2 + 4, billW - 8, billH - 8, radius * 0.12);
    }
    c.stroke();
    c.restore();
  } else {
    // Coin circle
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.fillStyle = colors.fill;
    c.fill();
    c.strokeStyle = colors.stroke;
    c.lineWidth = 2;
    c.stroke();

    // Bimetallic inner circle for 1€ and 2€
    if (colors.inner) {
      c.beginPath();
      c.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
      c.fillStyle = colors.inner;
      c.fill();
    }

    // Subtle rim shine
    c.beginPath();
    c.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    c.save(); c.globalAlpha = 0.25;
    c.strokeStyle = palette.textOnAccent;
    c.lineWidth = 1;
    c.stroke();
    c.restore();
  }

  // Label text
  const fontSize = Math.max(10, radius * (isBill ? 0.55 : 0.5));
  c.font = `700 ${fontSize}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
  c.fillStyle = isBill ? palette.coinText : palette.coinTextDark;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(coinLabel(ct as typeof COIN_VALUES_CT[number]), cx, cy);
}

/**
 * Decompose a cent amount into a minimal set of denominations for display.
 * Returns array of cent values (e.g. [200, 50, 20, 5] for 2,75 €).
 */
function decomposeCents(totalCt: number): number[] {
  const denoms = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
  const result: number[] = [];
  let remaining = totalCt;
  for (const d of denoms) {
    while (remaining >= d) {
      result.push(d);
      remaining -= d;
    }
  }
  return result;
}

/**
 * Draw a row of coin/note icons representing a cent amount.
 * Automatically scales and centers within the available width.
 */
function drawDenomRow(
  c: CanvasRenderingContext2D,
  denoms: number[],
  startX: number,
  cy: number,
  coinR: number,
  palette: ReturnType<typeof getPalette>,
  maxWidth: number,
): void {
  if (denoms.length === 0) return;

  // Calculate spacing so it fits within maxWidth
  const itemWidths = denoms.map(d => d >= 500 ? coinR * 2.4 : coinR * 2);
  const totalItemW = itemWidths.reduce((s, w) => s + w, 0);
  const gapBase = coinR * 0.4;
  const totalGap = gapBase * Math.max(0, denoms.length - 1);
  const scale = (totalItemW + totalGap) > maxWidth
    ? maxWidth / (totalItemW + totalGap)
    : 1;
  const gap = gapBase * scale;
  const scaledR = coinR * scale;

  // Center the row
  const scaledWidths = itemWidths.map(w => w * scale);
  const rowW = scaledWidths.reduce((s, w) => s + w, 0) + gap * Math.max(0, denoms.length - 1);
  let x = startX + (maxWidth - rowW) / 2;

  for (let i = 0; i < denoms.length; i++) {
    const halfW = scaledWidths[i]! / 2;
    drawDenom(c, x + halfW, cy, scaledR, denoms[i]!, palette);
    x += scaledWidths[i]! + gap;
  }
}

// ─── Change Task: Structured Kassenbon Layout ──────────────────────────────

/**
 * Builds the Change task illustration as structured Scene Graph nodes
 * instead of a monolithic custom() draw call.
 *
 * Visual structure (Kassenbon metaphor — natürliche Einkaufsreihenfolge):
 * ┌─────────────────────────────────────┐
 * │  Preis:            ┌──────────┐     │  ← Preisschild (warn)
 * │                    │  1,99 €  │     │
 * │                    └──────────┘     │
 * │  Bezahlt: 2,00 €     [2€-Münze]    │  ← panelSoft row
 * │─────────────────────────────────────│  ← Kassenbon-Trennlinie
 * │  = Rückgeld:    ┌╌╌╌╌╌╌╌╌┐        │  ← accentSubtle panel
 * │                 ╎   ?    ╎        │
 * │                 └╌╌╌╌╌╌╌╌┘        │
 * └─────────────────────────────────────┘
 */
function buildChangeIllustration(d: MoneyTaskData, answered: boolean): CanvasNode {
  // ── Row 1: "Bezahlt" with coin visualization — centered vertical layout ──
  const paidRow = vstack([
    text(`Bezahlt: ${formatCents(d.paidInCt)}`, {
      fontSize: "md",
      bold: true,
      align: "center",
    }),
    custom({
      id: "paid-coins",
      h: 40,
      measure(_ctx, available) {
        const w = Math.min(available.w * 0.8, 360);
        return { minW: 60, minH: 40, prefW: w, prefH: 40 };
      },
      draw(c, r) {
        const palette = getPalette();
        const coinR = Math.min(r.w * 0.04, 20);
        const paidDenoms = decomposeCents(d.paidInCt);
        drawDenomRow(c, paidDenoms, r.x, r.y + r.h / 2, coinR, palette, r.w);
      },
    }),
  ], { gap: 4, align: "center" });

  // ── Row 2: "Preis" with price tag — centered ──
  const priceRow = vstack([
    text(`Preis:`, { fontSize: "md", bold: true, align: "center", color: "canvasTextDim" }),
    custom({
      id: "price-tag",
      h: 40,
      measure() {
        return { minW: 120, minH: 40, prefW: 180, prefH: 40 };
      },
      draw(c, r) {
        const palette = getPalette();
        const fonts = resolveCanvasFonts(r.w + 400);
        const tagW = Math.min(r.w, 180);
        const tagH = 36;
        const tagX = r.x + (r.w - tagW) / 2;
        const tagY = r.y + (r.h - tagH) / 2;

        // Price tag background
        c.beginPath();
        if (typeof c.roundRect === "function") {
          c.roundRect(tagX, tagY, tagW, tagH, 10);
        } else {
          c.rect(tagX, tagY, tagW, tagH);
        }
        c.fillStyle = palette.warnSubtle;
        c.fill();
        c.strokeStyle = palette.warn;
        c.lineWidth = 2;
        c.stroke();

        // Price text
        c.font = `700 ${fonts.md}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        c.fillStyle = palette.canvasText;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(formatCents(d.priceInCt), tagX + tagW / 2, tagY + tagH / 2);

        // Small decorative circle (price tag hole)
        c.beginPath();
        c.arc(tagX + tagW - 6, tagY + 6, 4, 0, Math.PI * 2);
        c.fillStyle = palette.warn;
        c.fill();
      },
    }),
  ], { gap: 4, align: "center" });

  // ── Kassenbon divider (double line) ──
  const divider = custom({
    id: "receipt-divider",
    h: 6,
    draw(c, r) {
      const palette = getPalette();
      c.strokeStyle = palette.canvasTextDim;
      c.globalAlpha = 0.35;
      c.lineWidth = 1;
      // Double line like a receipt total
      c.beginPath();
      c.moveTo(r.x + 8, r.y + 1);
      c.lineTo(r.x + r.w - 8, r.y + 1);
      c.stroke();
      c.beginPath();
      c.moveTo(r.x + 8, r.y + 4);
      c.lineTo(r.x + r.w - 8, r.y + 4);
      c.stroke();
      c.globalAlpha = 1;
    },
  });

  // ── Row 3: "Rückgeld" result area — centered ──
  const changeContent = answered
    ? vstack([
        text(`= Rückgeld: ${formatCents(d.targetCents)}`, {
          fontSize: "md", bold: true, color: "canvasSuccess", align: "center",
        }),
        custom({
          id: "change-coins",
          h: 40,
          measure(_ctx, available) {
            const w = Math.min(available.w * 0.8, 360);
            return { minW: 60, minH: 40, prefW: w, prefH: 40 };
          },
          draw(c, r) {
            const palette = getPalette();
            const coinR = Math.min(r.w * 0.04, 20);
            const changeDenoms = decomposeCents(d.targetCents);
            drawDenomRow(c, changeDenoms, r.x, r.y + r.h / 2, coinR, palette, r.w);
          },
        }),
      ], { gap: 4, align: "center" })
    : vstack([
        text("= Rückgeld:", { fontSize: "md", bold: true, color: "canvasPrimary", align: "center" }),
        custom({
          id: "change-question",
          h: 40,
          measure() {
            return { minW: 80, minH: 40, prefW: 90, prefH: 40 };
          },
          draw(c, r) {
            const palette = getPalette();
            const fonts = resolveCanvasFonts(r.w + 400);
            const qBoxW = 80;
            const qBoxH = 32;
            const qBoxX = r.x + (r.w - qBoxW) / 2;
            const qBoxY = r.y + (r.h - qBoxH) / 2;

            // Dashed question box
            c.beginPath();
            if (typeof c.roundRect === "function") {
              c.roundRect(qBoxX, qBoxY, qBoxW, qBoxH, 8);
            } else {
              c.rect(qBoxX, qBoxY, qBoxW, qBoxH);
            }
            c.fillStyle = palette.accentSubtle;
            c.fill();
            c.strokeStyle = palette.accentBorder;
            c.lineWidth = 2;
            c.setLineDash([6, 4]);
            c.stroke();
            c.setLineDash([]);

            // "?" text
            c.font = `700 ${fonts.lg}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
            c.fillStyle = palette.canvasPrimary;
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText("?", qBoxX + qBoxW / 2, qBoxY + qBoxH / 2);
          },
        }),
      ], { gap: 4, align: "center" });

  // ── Rückgeld wrapped in accent panel ──
  const changePanel = panel(
    {
      id: "change-result-panel",
      bg: answered ? "okSubtle" : "accentSubtle",
      radius: 10,
      padding: 10,
    },
    changeContent,
  );

  // ── Full change illustration (clean receipt layout) ──
  return panel(
    {
      id: "change-illustration",
      bg: "panelSoft",
      radius: 12,
      padding: 16,
    },
    vstack([
      priceRow,
      paidRow,
      divider,
      changePanel,
    ], { gap: 8, align: "stretch" }),
  );
}

// ─── Scene Builders ─────────────────────────────────────────────────────────

function buildMoneyScene(ctx: Ctx): CanvasNode {
  const { task, state, result } = ctx;
  if (task.mode !== "money") return text("Fehler", { fontSize: "lg" });

  const d = task.data;
  const answered = result?.correct === true;

  // ── Task illustration: visual coin/note representation ──
  const taskIllustration = d.taskType === "change"
    ? buildChangeIllustration(d, answered)
    : custom({
        id: "money-illustration",
        h: 120,
        draw(c, r) {
          const palette = getPalette();
          const fonts = resolveCanvasFonts(r.w);
          const coinR = Math.min(r.w * 0.035, 24);

          // ── Assemble task: show target amount with coin icons ──
          const targetDenoms = decomposeCents(d.targetCents);
          const denomMaxW = r.w * 0.8;

          // "Ziel:" label
          c.font = `700 ${fonts.sm}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          c.fillStyle = palette.canvasTextDim;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText("Ziel:", r.x + r.w / 2, r.y + 16);

          // Large amount — spaced well below the label
          c.font = `700 ${fonts.xl}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
          c.fillStyle = palette.canvasPrimary;
          c.fillText(formatCents(d.targetCents), r.x + r.w / 2, r.y + 50);

          // Coin icons showing one way to make the amount — bottom of the area
          const rowCy = r.y + r.h - coinR - 8;
          drawDenomRow(c, targetDenoms, r.x + r.w * 0.1, rowCy, coinR, palette, denomMaxW);
        },
      });

  // Build coin buttons — 4 per row
  const coinRows: CanvasNode[] = [];
  for (let i = 0; i < COIN_VALUES_CT.length; i += 4) {
    const rowButtons: CanvasNode[] = [];
    for (let j = i; j < Math.min(i + 4, COIN_VALUES_CT.length); j++) {
      const coinCt = COIN_VALUES_CT[j];
      rowButtons.push(
        button(coinLabel(coinCt), {
          id: `coin-${coinCt}`,
          variant: "secondary",
          minWidth: 72,
          enabled: !answered,
          onTap: () => addCoinCallback?.(coinCt),
        }),
      );
    }
    coinRows.push(hstack(rowButtons, { gap: 12, align: "center" }));
  }

  // Running total display — money tasks always show coins (no present/interact split)
  const totalLabel = answered
    ? `Gesammelt: ${formatCents(state.totalCents)}`
    : state.totalCents > 0
      ? `Gesammelt: ${formatCents(state.totalCents)}`
      : "Tippe auf Münzen, um zu sammeln";

  // Selected coins visualization — uses shared drawDenom helper
  const coinsVis = custom({
    id: "coins-collected",
    h: 80,
    draw(c, r) {
      const palette = getPalette();
      if (state.selectedCoins.length === 0) return;

      const coinR = Math.min(r.w * 0.04, 28);
      const gap = coinR * 0.5;
      const cols = Math.max(1, Math.floor(r.w / (coinR * 2 + gap)));
      const startX = r.x + (r.w - Math.min(state.selectedCoins.length, cols) * (coinR * 2 + gap)) / 2 + coinR;
      const startY = r.y + coinR + 6;

      for (let i = 0; i < state.selectedCoins.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = startX + col * (coinR * 2 + gap);
        const cy = startY + row * (coinR * 2 + gap);
        const val = state.selectedCoins[i]!;
        drawDenom(c, cx, cy, coinR, val, palette);
      }
    },
  });

  // Action buttons
  const actionButtons: CanvasNode[] = [];
  if (!answered) {
    actionButtons.push(
      button("Prüfen", {
        id: "submit-money",
        variant: "primary",
        minWidth: 120,
        enabled: state.totalCents > 0,
        onTap: () => submitMoneyCallback?.(),
      }),
      button("Zurücksetzen", {
        id: "reset-money",
        variant: "ghost",
        minWidth: 120,
        enabled: state.selectedCoins.length > 0,
        onTap: () => resetCoinsCallback?.(),
      }),
    );
  }

  // Title differs by task type
  const title = d.taskType === "change"
    ? "Berechne das Rückgeld!"
    : `Lege ${formatCents(d.targetCents)}`;

  return vstack([
    text(title, { fontSize: "xl", bold: true }),
    taskIllustration,
    text(totalLabel, {
      fontSize: "lg",
      color: answered ? "canvasSuccess" : "canvasText",
    }),
    coinsVis, ...coinRows,
    ...(actionButtons.length > 0
      ? [hstack(actionButtons, { gap: 16, align: "center" })]
      : []),
    ...(answered
      ? [text(`Ziel: ${formatCents(d.targetCents)}`, { fontSize: "md", color: "canvasSuccess" })]
      : []),
  ], { gap: 10, padding: 16, align: "center" });
}

function buildUnitsScene(ctx: Ctx): CanvasNode {
  const { task, input, result } = ctx;
  if (task.mode !== "units") return text("Fehler", { fontSize: "lg" });

  const { data, pair } = task;
  const answered = result?.correct === true;
  // Read from module-level vars (set synchronously in check()) rather than state
  // because the framework calls rebuildScene() before the async stateUpdater fires
  const phase = currentUnitsPhase;
  const enteredWhole = currentEnteredWhole;

  // Build the question label based on input phase
  let questionLabel: string;
  if (answered) {
    questionLabel = `${data.sourceValue} ${pair.fromUnit} = ${data.correctAnswer} ${pair.toUnit}${data.correctRemainder > 0 ? ` ${data.correctRemainder} ${pair.fromUnit}` : ""}`;
  } else if (data.isMixed && phase === "remainder") {
    // Second phase: whole part locked in, entering remainder
    questionLabel = `${data.sourceValue} ${pair.fromUnit} = ${enteredWhole} ${pair.toUnit}  ${input || "?"} ${pair.fromUnit}`;
  } else if (data.isMixed) {
    // First phase: entering whole units, show remainder placeholder
    questionLabel = `${data.sourceValue} ${pair.fromUnit} = ${input || "?"} ${pair.toUnit}  __ ${pair.fromUnit}`;
  } else {
    questionLabel = `${data.sourceValue} ${pair.fromUnit} = ${input || "?"} ${pair.toUnit}`;
  }

  return vstack([
    text(questionLabel, { fontSize: "xl", bold: true }),
    text(`${pair.factor} ${pair.fromUnit} = 1 ${pair.toUnit}`, { fontSize: "sm", color: "canvasTextDim" }),
    custom({
      id: "units-vis",
      flex: 1,
      draw(c, r) {
        const palette = getPalette();
        const barW = r.w * 0.7;
        const barH = Math.min(r.h * 0.15, 40);
        const bx = r.x + (r.w - barW) / 2;
        const by = r.y + r.h * 0.4;

        // Bar max = one full unit beyond the answer (shows how many complete units fit)
        // e.g. 250 cm → 2 m: bar spans 3 × 100 cm = 300 cm total
        const maxValue = (data.correctAnswer + 1) * pair.factor;

        // Full bar (background)
        c.fillStyle = palette.panelSoft;
        c.fillRect(bx, by, barW, barH);
        c.strokeStyle = palette.line;
        c.strokeRect(bx, by, barW, barH);

        // Filled portion (the sourceValue relative to maxValue)
        const fillRatio = Math.min(data.sourceValue / maxValue, 1);
        c.fillStyle = answered ? palette.canvasSuccess : palette.canvasPrimary;
        c.globalAlpha = 0.6;
        c.fillRect(bx, by, barW * fillRatio, barH);
        c.globalAlpha = 1;

        // Tick marks at each complete unit boundary
        c.strokeStyle = palette.line;
        c.lineWidth = 1.5;
        for (let unit = 1; unit <= data.correctAnswer; unit++) {
          const tickX = bx + (unit * pair.factor / maxValue) * barW;
          c.beginPath();
          c.moveTo(tickX, by);
          c.lineTo(tickX, by + barH);
          c.stroke();
        }

        c.font = `700 ${Math.max(14, barH * 0.5)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
        c.fillStyle = palette.canvasText;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(`${data.sourceValue} ${pair.fromUnit}`, bx + barW / 2, by + barH / 2);
      },
    }),
    ...(answered
      ? [text(
          explainUnits(data.sourceValue, pair, data.correctAnswer, data.correctRemainder),
          { fontSize: "md", color: "canvasSuccess" },
        )]
      : []),
  ], { gap: 12, padding: 16, align: "center" });
}

// ─── Module Definition ───────────────────────────────────────────────────────

export const measuresV2Registration = defineModule<MeasureTask, MeasureState>({
  id: "measures",
  label: "Größen & Messen",
  icon: "📏",
  description: "Geld, Längen, Gewichte und Volumen umrechnen.",

  taskLabel(task) {
    if (task.mode === "money") {
      return task.data.taskType === "change"
        ? `Berechne das Wechselgeld von ${formatCents(task.data.paidInCt)} minus ${formatCents(task.data.priceInCt)}.`
        : `Lege ${formatCents(task.data.targetCents)} mit Münzen.`;
    }
    return `${task.data.sourceValue} ${task.pair.fromUnit} in ${task.pair.toUnit} umrechnen.`;
  },

  flowType: "task",
  input: (taskType: string) => taskType === "money" ? "canvas" : "numberPad",

  taskTypes: [
    { id: "money", label: "Geld", icon: "💰" },
    { id: "units", label: "Einheiten", icon: "📐" },
  ],

  difficulties: DIFFICULTIES,

  tutorial: (taskType: string): TutorialStep[] => {
    const palette = getPalette();
    const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

    if (taskType === "units") {
      return [
        {
          title: "So geht's",
          text: "Rechne zwischen verschiedenen Einheiten um: Länge, Gewicht oder Volumen.",
          mathBackground: "1 m = 100 cm, 1 km = 1000 m, 1 kg = 1000 g, 1 l = 1000 ml. Merke dir die Umrechnungszahlen!",
          draw(ctx, w, h, p) {
            ctx.font = `700 ${h * 0.1}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = palette.canvasText;
            ctx.fillText("250 cm = ? m", w / 2, h * 0.18);

            // Animated bar showing 250 cm
            const barW = w * 0.7;
            const barH = h * 0.12;
            const bx = (w - barW) / 2;
            const by = h * 0.35;

            ctx.fillStyle = palette.panelSoft;
            ctx.fillRect(bx, by, barW, barH);
            ctx.strokeStyle = palette.line;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(bx, by, barW, barH);

            // Fill progress
            const fillW = barW * Math.min(p * 1.2, 1);
            ctx.fillStyle = palette.accent;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(bx, by, fillW, barH);
            ctx.globalAlpha = 1;

            // Tick marks at 100cm intervals
            if (p > 0.3) {
              ctx.strokeStyle = palette.canvasText;
              ctx.lineWidth = 2;
              for (let i = 1; i <= 2; i++) {
                const tx = bx + (i / 3) * barW;
                ctx.beginPath();
                ctx.moveTo(tx, by);
                ctx.lineTo(tx, by + barH);
                ctx.stroke();
              }
            }

            // Labels
            if (p > 0.5) {
              ctx.font = `600 ${h * 0.07}px ${FONT}`;
              ctx.fillStyle = palette.accent;
              ctx.fillText("100 cm = 1 m", w / 2, h * 0.58);
            }
            if (p > 0.8) {
              ctx.font = `700 ${h * 0.1}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.fillText("250 cm = 2 m 50 cm", w / 2, h * 0.78);
            }
          },
          duration: 3000,
        },
      ];
    }

    // Default: money
    return [
      {
        title: "So geht's",
        text: "Lege einen Betrag mit Münzen und Scheinen oder berechne das Wechselgeld.",
        mathBackground: "1 € = 100 ct. Beginne immer mit den größten Münzen oder Scheinen.",
        draw(ctx, w, h, p) {
          ctx.font = `700 ${h * 0.12}px ${FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = palette.canvasText;
          ctx.fillText("Lege 1,35 €", w / 2, h * 0.15);

          // Animated coins appearing
          const coins = [
            { label: "1 €", x: w * 0.25, r: Math.min(w * 0.08, 28) },
            { label: "20 ct", x: w * 0.45, r: Math.min(w * 0.065, 22) },
            { label: "10 ct", x: w * 0.62, r: Math.min(w * 0.06, 20) },
            { label: "5 ct", x: w * 0.77, r: Math.min(w * 0.055, 18) },
          ];
          const cy = h * 0.5;

          for (let i = 0; i < coins.length; i++) {
            const threshold = (i + 1) / (coins.length + 1);
            if (p < threshold) continue;
            const coin = coins[i];
            const alpha = Math.min(1, (p - threshold) * 5);

            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(coin.x, cy, coin.r, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? palette.coinSilver : palette.coinGold;
            ctx.fill();
            ctx.strokeStyle = i === 0 ? palette.coinSilverRim : palette.coinGoldRim;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.font = `700 ${coin.r * 0.55}px ${FONT}`;
            ctx.fillStyle = palette.canvasText;
            ctx.fillText(coin.label, coin.x, cy);
            ctx.globalAlpha = 1;
          }

          if (p > 0.85) {
            ctx.font = `700 ${h * 0.1}px ${FONT}`;
            ctx.fillStyle = palette.ok;
            ctx.fillText("= 1,35 € ✓", w / 2, h * 0.82);
          }
        },
        duration: 3500,
      },
    ];
  },

  generate(ctx) {
    const diff = ctx.difficulty ?? 1;
    if (ctx.taskType === "money") {
      return { mode: "money", data: generateMoneyTask(diff) };
    }
    const pairIndex = Math.floor(Math.random() * UNIT_PAIRS.length);
    return { mode: "units", data: generateUnitsTask(pairIndex, diff), pair: UNIT_PAIRS[pairIndex]! };
  },

  check(task, answer) {
    if (task.mode === "money") {
      const num = typeof answer === "number" ? answer : Number(answer);
      const correct = num === task.data.targetCents;
      return { correct, feedback: correct ? "Richtig! Gut gerechnet!" : "Probier nochmal \u2013 zähl die Münzen." };
    }
    const num = typeof answer === "number" ? answer : Number(answer);

    // Mixed units: two-phase input (e.g., 4591 g → first enter 4 kg, then 591 g)
    if (task.data.isMixed && currentUnitsPhase === "whole") {
      const wholeCorrect = Math.abs(num - task.data.correctAnswer) < 0.001;
      if (wholeCorrect) {
        // Advance to remainder phase — set module-level vars synchronously
        // so that rebuildScene() (called by framework after continueInput) sees them immediately
        currentUnitsPhase = "remainder";
        currentEnteredWhole = num;
        stateUpdater?.(s => ({ ...s, unitsInputPhase: "remainder", enteredWhole: num }));
        return {
          correct: false,
          feedback: `${num} ${task.pair.toUnit} richtig! Jetzt den Rest in ${task.pair.fromUnit} eingeben.`,
          continueInput: true,
        };
      }
      return { correct: false, feedback: `Fast! Wie viele ganze ${task.pair.toUnit} passen rein?` };
    }

    if (task.data.isMixed && currentUnitsPhase === "remainder") {
      const remainderCorrect = Math.abs(num - task.data.correctRemainder) < 0.001;
      if (remainderCorrect) {
        return { correct: true, feedback: "Richtig umgerechnet!" };
      }
      return { correct: false, feedback: `Fast! Wie viele ${task.pair.fromUnit} bleiben übrig?` };
    }

    // Non-mixed: single answer
    const correct = Math.abs(num - task.data.correctAnswer) < 0.001;
    return { correct, feedback: correct ? "Richtig umgerechnet!" : "Fast! Schau dir die Umrechnung nochmal an." };
  },

  hints: getHints,

  getSolution(task) {
    if (task.mode === "money") return { text: `${formatCents(task.data.targetCents)}` };
    return { text: explainUnits(task.data.sourceValue, task.pair, task.data.correctAnswer, task.data.correctRemainder) };
  },

  initialState: () => ({ selectedCoins: [], totalCents: 0, unitsInputPhase: "whole" as const, enteredWhole: null }),

  onActivate(ctx) {
    // Reset units input phase for new task
    currentUnitsPhase = "whole";
    currentEnteredWhole = null;
    stateUpdater = (fn) => ctx.updateState(fn);

    addCoinCallback = (coinCt: number) => {
      ctx.updateState(s => ({
        ...s,
        selectedCoins: [...s.selectedCoins, coinCt],
        totalCents: s.totalCents + coinCt,
      }));
    };

    submitMoneyCallback = () => {
      ctx.submitAnswer(ctx.state.totalCents);
    };

    resetCoinsCallback = () => {
      ctx.updateState(s => ({
        ...s,
        selectedCoins: [],
        totalCents: 0,
      }));
    };
  },

  onDeactivate() {
    addCoinCallback = null;
    submitMoneyCallback = null;
    resetCoinsCallback = null;
    stateUpdater = null;
    currentUnitsPhase = "whole";
    currentEnteredWhole = null;
  },

  buildScene(ctx) {
    const { task } = ctx;
    switch (task.mode) {
      case "money":
        return buildMoneyScene(ctx);
      case "units":
        return buildUnitsScene(ctx);
      default:
        return text("Unbekannter Modus", { fontSize: "lg" });
    }
  },
});
