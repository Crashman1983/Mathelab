/**
 * Zeit & Kalender V2 — interactive clock-hand dragging + calendar tap.
 *
 * Modes:
 * - "read":     Student drags clock hands to set the time, then submits.
 * - "timespan": Two read-only clocks; student enters duration via canvas numpad buttons.
 * - "calendar": Student taps a day in the calendar grid.
 *
 */

import { defineModule, DIFFICULTIES } from "@app/module-framework";
import type { SceneContext, PointerContext, TutorialStep } from "@app/module-framework";
import type { CanvasScene } from "@canvas/scene";
import { vstack, hstack } from "@canvas/nodes/container";
import { text } from "@canvas/nodes/text";
import { button } from "@canvas/nodes/button";
import { custom } from "@canvas/nodes/custom";
import { panel } from "@canvas/nodes/panel";
import type { CanvasNode } from "@canvas/nodes/types";
import { createRadialDrag, type RadialDragTracker } from "@canvas/interactions/radial-drag";
import { getPalette } from "@core/design";
import { prefersReducedMotion } from "@core/utils";
import {
  generateReadTask,
  generateTimespanTask,
  formatTime,
  formatDuration,
  timesEqual,
  hourHandAngle,
  minuteHandAngle,
  explainTimeRead,
  explainTimespan,
  MONTH_NAMES_DE,
  daysInMonth,
  firstWeekdayOfMonth,
  generateCalendarTask,
  type TimeOfDay,
  type TimespanTask,
  type CalendarDate,
} from "./logic";

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeTask =
  | { mode: "read"; time: TimeOfDay }
  | { mode: "set"; time: TimeOfDay }
  | { mode: "timespan"; data: TimespanTask }
  | { mode: "calendar"; date: CalendarDate };

interface TimeState {
  /** Hour set by student dragging (1–12) */
  setHour: number;
  /** Minute set by student dragging (0–55 in 5-min steps) */
  setMinute: number;
  /** Which hand is currently being dragged */
  dragging: "hour" | "minute" | null;
  /** Day tapped in calendar mode */
  calendarTapped: number | null;
  /** Duration input string for timespan mode */
  timespanInput: string;
}

// ─── Module-level mutable refs ────────────────────────────────────────────────

// Radial drag tracker — recreated on each task/activate
let radialDrag: RadialDragTracker | null = null;

// Clock hand animation (present mode: hands rotate from 12:00 to target)
let timeScene: CanvasScene | null = null;
let clockAnimProgress = 1;   // 0→1
let clockAnimRafId = 0;

// Clock center geometry — set during draw, read during pointer events
let clockCenter: { cx: number; cy: number; radius: number } | null = null;

// Calendar grid geometry — set during draw, read during pointer events
let calendarGeo: {
  cellW: number;
  cellH: number;
  startX: number;
  startY: number;
  firstDay: number;
  totalDays: number;
} | null = null;

// ─── Hints ────────────────────────────────────────────────────────────────────

function getHints(task: TimeTask): string[] {
  switch (task.mode) {
    case "read":
      return [
        "Schau auf die Zeiger der Uhr.",
        "Der kleine Zeiger zeigt die Stunde, der gro\u00DFe die Minuten.",
        explainTimeRead(task.time),
        `Stelle die Zeiger auf ${formatTime(task.time)} — Stunde: ${task.time.hour % 12 || 12}, Minute: ${task.time.minute}.`,
      ];
    case "set":
      return [
        "Ziehe die Zeiger auf die richtige Position.",
        `Stelle den Stundenzeiger auf ${task.time.hour % 12 || 12} und den Minutenzeiger auf ${task.time.minute}.`,
        explainTimeRead(task.time),
        `Ziehe den kleinen Zeiger auf ${task.time.hour % 12 || 12} und den großen auf ${task.time.minute === 0 ? "12 (oben)" : task.time.minute}.`,
      ];
    case "timespan":
      return [
        `Von ${formatTime(task.data.from)} bis ${formatTime(task.data.to)}.`,
        "Z\u00E4hle die Stunden und Minuten.",
        explainTimespan(task.data),
        `Die Zeitspanne beträgt ${task.data.durationMinutes} Minuten. Gib ${task.data.durationMinutes} ein.`,
      ];
    case "calendar":
      return [
        `Finde den ${task.date.day}. ${MONTH_NAMES_DE[task.date.month - 1]} im Kalender.`,
        "Z\u00E4hle die Tage ab.",
        `Der ${task.date.day}. ${MONTH_NAMES_DE[task.date.month - 1]} ${task.date.year}.`,
        `Tippe auf die Zahl ${task.date.day} im Kalender.`,
      ];
  }
}

// ─── Clock Drawing ────────────────────────────────────────────────────────────

/**
 * Draw an analogue clock face.
 * @param time      The time to display on the clock hands.
 * @param highlight If true, draw hands with thicker strokes (for draggable clock).
 */
function drawClock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  time: TimeOfDay,
  highlight = false,
  /** 0→1 animation: hands rotate from 12:00 to target (1 = fully at target) */
  animProgress = 1,
): void {
  const palette = getPalette();

  // Face
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = palette.panelSoft;
  ctx.fill();
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Hour marks
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const inner = radius * 0.82;
    const outer = radius * 0.92;
    ctx.beginPath();
    ctx.moveTo(cx + inner * Math.cos(angle), cy + inner * Math.sin(angle));
    ctx.lineTo(cx + outer * Math.cos(angle), cy + outer * Math.sin(angle));
    ctx.strokeStyle = palette.canvasText;
    ctx.lineWidth = i % 3 === 0 ? 3 : 1.5;
    ctx.stroke();
  }

  // 5-minute tick marks (between hour marks)
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue; // skip hour marks
    const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const inner = radius * 0.88;
    const outer = radius * 0.92;
    ctx.beginPath();
    ctx.moveTo(cx + inner * Math.cos(angle), cy + inner * Math.sin(angle));
    ctx.lineTo(cx + outer * Math.cos(angle), cy + outer * Math.sin(angle));
    ctx.strokeStyle = palette.canvasTextDim;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Numbers
  ctx.font = `700 ${Math.max(12, radius * 0.18)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
  ctx.fillStyle = palette.canvasText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 1; i <= 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.fillText(`${i}`, cx + radius * 0.68 * Math.cos(angle), cy + radius * 0.68 * Math.sin(angle));
  }

  // Hour hand — interpolated from 12:00 (top = -PI/2) when animating
  const targetH = hourHandAngle(time);
  const startAngle = -Math.PI / 2; // 12 o'clock
  const eased = 1 - Math.pow(1 - animProgress, 3); // easeOut
  const hAngle = startAngle + (targetH - startAngle) * eased;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + radius * 0.5 * Math.cos(hAngle), cy + radius * 0.5 * Math.sin(hAngle));
  ctx.strokeStyle = palette.canvasPrimary;
  ctx.lineWidth = highlight ? Math.max(6, radius * 0.06) : Math.max(4, radius * 0.04);
  ctx.lineCap = "round";
  ctx.stroke();

  // Minute hand — interpolated from 12:00 when animating
  const targetM = minuteHandAngle(time);
  const mAngle = startAngle + (targetM - startAngle) * eased;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + radius * 0.7 * Math.cos(mAngle), cy + radius * 0.7 * Math.sin(mAngle));
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = highlight ? Math.max(5, radius * 0.04) : Math.max(3, radius * 0.025);
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.05, 0, Math.PI * 2);
  ctx.fillStyle = palette.canvasText;
  ctx.fill();
}

// ─── Calendar Drawing ─────────────────────────────────────────────────────────

function drawCalendarGrid(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  task: { date: CalendarDate },
  tappedDay: number | null,
  showAnswer: boolean,
): void {
  const palette = getPalette();
  const days = daysInMonth(task.date.year, task.date.month);
  const firstDay = firstWeekdayOfMonth(task.date.year, task.date.month);
  const cols = 7;
  const rows = Math.ceil((days + firstDay) / 7);
  const cellW = Math.min(r.w * 0.85 / cols, r.h * 0.7 / (rows + 1));
  const cellH = cellW;
  const startX = r.x + (r.w - cols * cellW) / 2;
  const startY = r.y + r.h * 0.12;

  // Store geometry for pointer hit-testing
  calendarGeo = { cellW, cellH, startX, startY, firstDay, totalDays: days };

  // Month title
  ctx.font = `700 ${Math.max(14, cellW * 0.4)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
  ctx.fillStyle = palette.canvasText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    `${MONTH_NAMES_DE[task.date.month - 1]} ${task.date.year}`,
    r.x + r.w / 2,
    startY - cellH * 0.3,
  );

  // Weekday headers — weekend days (Sa, So) highlighted in accent color
  const headers = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  ctx.font = `600 ${Math.max(10, cellW * 0.3)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 7; i++) {
    const isWeekend = i >= 5; // Sa=5, So=6
    ctx.fillStyle = isWeekend ? palette.accent : palette.canvasTextDim;
    ctx.font = `${isWeekend ? "700" : "600"} ${Math.max(10, cellW * 0.3)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
    ctx.fillText(headers[i]!, startX + i * cellW + cellW / 2, startY + cellH / 2);
  }

  // ── Week-row backgrounds for visual grouping ──
  // Alternating subtle backgrounds so a teacher can point to "diese Woche"
  for (let row = 1; row <= rows; row++) {
    if (row % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(startX - 2, startY + row * cellH + 1, cols * cellW + 4, cellH - 2, 4);
      } else {
        ctx.rect(startX - 2, startY + row * cellH + 1, cols * cellW + 4, cellH - 2);
      }
      ctx.fill();
      ctx.restore();
    }
  }

  // Days
  for (let d = 1; d <= days; d++) {
    const pos = firstDay + d - 1;
    const col = pos % 7;
    const row = Math.floor(pos / 7) + 1;
    const x = startX + col * cellW;
    const y = startY + row * cellH;

    const isTarget = showAnswer && d === task.date.day;
    const isTapped = d === tappedDay;
    const isWeekendDay = col >= 5; // Sa=5, So=6

    // Weekend subtle background
    if (isWeekendDay && !isTarget && !isTapped) {
      ctx.fillStyle = palette.accentSubtle;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x + 2, y + 2, cellW - 4, cellH - 4, 6);
      } else {
        ctx.rect(x + 2, y + 2, cellW - 4, cellH - 4);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Highlight background for target/tapped
    if (isTarget || isTapped) {
      ctx.fillStyle = isTarget ? palette.accent : palette.warn;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x + 2, y + 2, cellW - 4, cellH - 4, 6);
      } else {
        ctx.rect(x + 2, y + 2, cellW - 4, cellH - 4);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const isHighlighted = isTarget || isTapped;
    ctx.fillStyle = isHighlighted ? palette.accent : isWeekendDay ? palette.accent : palette.canvasText;
    ctx.font = `${isHighlighted ? "700" : "400"} ${Math.max(10, cellW * 0.35)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${d}`, x + cellW / 2, y + cellH / 2);
  }
}

// ─── Radial Drag Setup ────────────────────────────────────────────────────────

function setupRadialDrag(
  setState: (partial: Partial<TimeState>) => void,
): void {
  // Will be fully configured once we have clock center from drawing
  // For now, create with dummy values — reconfigured in onPointerDown
  radialDrag = null;
}

function ensureRadialDrag(
  setState: (partial: Partial<TimeState>) => void,
): RadialDragTracker | null {
  if (!clockCenter) return null;

  radialDrag = createRadialDrag({
    cx: clockCenter.cx,
    cy: clockCenter.cy,
    radius: clockCenter.radius,
    deadZone: 0.15,
    zones: [
      { id: "hour", minR: 0.25, maxR: 0.65 },
      { id: "minute", minR: 0.65, maxR: 1.5 },
    ],
    // Hour snaps to 30 deg (= 1 hour), minute snaps to 6 deg (= 5 min)
    // We handle snapping per-zone in the callback instead
    onAngleChange(angleDeg, zone) {
      if (zone === "hour") {
        // 360 / 12 = 30 deg per hour
        const snapped = Math.round(angleDeg / 30) * 30;
        let hour = (snapped / 30) % 12;
        if (hour === 0) hour = 12;
        setState({ setHour: hour, dragging: "hour" });
      } else if (zone === "minute") {
        // 360 / 60 = 6 deg per minute, snap to 5-min (= 30 deg steps)
        const snapped = Math.round(angleDeg / 6) * 6;
        // Convert degrees to minutes: 6 deg = 1 min, but we snap to 5-min
        const rawMin = Math.round(snapped / 6);
        const minute = (Math.round(rawMin / 5) * 5) % 60;
        setState({ setMinute: minute, dragging: "minute" });
      }
    },
    onEnd() {
      setState({ dragging: null });
    },
  });

  return radialDrag;
}

// ─── Scene Building ───────────────────────────────────────────────────────────

function buildScene(ctx: SceneContext<TimeTask, TimeState>): CanvasNode {
  const { task, state, phase, result } = ctx;

  switch (task.mode) {
    case "read":
      return buildReadScene(task, state, phase, result, ctx);
    case "set":
      return buildSetScene(task, state, phase, result, ctx);
    case "timespan":
      return buildTimespanScene(task, state, phase, result, ctx);
    case "calendar":
      return buildCalendarScene(task, state, phase, result, ctx);
  }
}

function buildReadScene(
  task: { mode: "read"; time: TimeOfDay },
  state: TimeState,
  phase: "present" | "interact",
  result: { correct: boolean; feedback?: string } | null,
  ctx: SceneContext<TimeTask, TimeState>,
): CanvasNode {
  const isPresent = phase === "present";
  const answered = result !== null;

  const children: CanvasNode[] = [];

  // Title
  if (isPresent) {
    children.push(text("Schau dir die Uhr an!", { fontSize: "xl", bold: true }));
  } else {
    children.push(text(`Stelle die Uhr auf ${formatTime(task.time)}`, { fontSize: "xl", bold: true }));
  }

  // Clock area
  children.push(custom({
    id: "clock",
    flex: 1,
    draw(drawCtx, r) {
      const radius = Math.min(r.w, r.h) * 0.38;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;

      if (isPresent) {
        // Show the target time (read-only) with animated hand rotation
        drawClock(drawCtx, cx, cy, radius, task.time, false, clockAnimProgress);
      } else {
        // Show the student's set time (draggable)
        const displayTime: TimeOfDay = { hour: state.setHour, minute: state.setMinute };
        drawClock(drawCtx, cx, cy, radius, displayTime, true);

        // Store geometry for pointer events
        clockCenter = { cx, cy, radius };
      }
    },
  }));

  if (isPresent) {
    // Show target time during presentation
    children.push(text(formatTime(task.time), { fontSize: "lg", color: "canvasSuccess" }));
  } else {
    // Show student's current setting
    const setTime = formatTime({ hour: state.setHour, minute: state.setMinute });
    children.push(text(`Deine Einstellung: ${setTime}`, { fontSize: "md" }));

    if (!answered) {
      // Submit button
      children.push(button("Pr\u00FCfen", {
        id: "check-btn",
        variant: "primary",
        minWidth: 160,
        onTap: () => {
          // Answer is submitted via pointer context in onPointerDown for buttons
        },
      }));
    } else if (result) {
      // Show result
      children.push(text(
        result.correct ? "Richtig abgelesen!" : "Schau nochmal auf die Zeiger.",
        { fontSize: "md", color: result.correct ? "canvasSuccess" : "warn" },
      ));
    }
  }

  return vstack(children, { gap: 8, padding: 16, align: "center" });
}

function buildSetScene(
  task: { mode: "set"; time: TimeOfDay },
  state: TimeState,
  phase: "present" | "interact",
  result: { correct: boolean; feedback?: string } | null,
  ctx: SceneContext<TimeTask, TimeState>,
): CanvasNode {
  const answered = result !== null;
  const children: CanvasNode[] = [];

  // Always show the target digital time prominently
  children.push(text(`Stelle die Uhr auf ${formatTime(task.time)}`, { fontSize: "xl", bold: true }));
  children.push(text("Ziehe die Zeiger auf die richtige Position.", { fontSize: "sm", color: "canvasTextDim" }));

  // Draggable clock
  children.push(custom({
    id: "clock-set",
    flex: 1,
    draw(drawCtx, r) {
      const radius = Math.min(r.w, r.h) * 0.38;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;

      const displayTime: TimeOfDay = answered && result?.correct
        ? task.time
        : { hour: state.setHour, minute: state.setMinute };
      drawClock(drawCtx, cx, cy, radius, displayTime, !answered);

      // Store geometry for pointer events
      clockCenter = { cx, cy, radius };
    },
  }));

  // Show student's current setting
  const setTime = formatTime({ hour: state.setHour, minute: state.setMinute });
  children.push(text(`Deine Einstellung: ${setTime}`, { fontSize: "md" }));

  if (!answered) {
    children.push(button("Pr\u00FCfen", {
      id: "check-btn",
      variant: "primary",
      minWidth: 160,
      onTap: () => {},
    }));
  } else if (result) {
    children.push(text(
      result.correct ? "Richtig gestellt!" : "Die Zeiger stimmen noch nicht.",
      { fontSize: "md", color: result.correct ? "canvasSuccess" : "warn" },
    ));
  }

  return vstack(children, { gap: 8, padding: 16, align: "center" });
}

function buildTimespanScene(
  task: { mode: "timespan"; data: TimespanTask },
  state: TimeState,
  phase: "present" | "interact",
  result: { correct: boolean; feedback?: string } | null,
  ctx: SceneContext<TimeTask, TimeState>,
): CanvasNode {
  const isPresent = phase === "present";
  const answered = result !== null;

  const children: CanvasNode[] = [];

  children.push(
    text(`Von ${formatTime(task.data.from)} bis ${formatTime(task.data.to)}`, { fontSize: "xl", bold: true }),
  );
  children.push(text("Wie lange dauert es?", { fontSize: "sm", color: "canvasTextDim" }));

  // Two clocks (always read-only)
  children.push(custom({
    id: "timespan-clocks",
    flex: 1,
    draw(drawCtx, r) {
      const radius = Math.min(r.w / 4, r.h * 0.35);
      drawClock(drawCtx, r.x + r.w * 0.25, r.y + r.h / 2, radius, task.data.from, false, clockAnimProgress);
      drawClock(drawCtx, r.x + r.w * 0.75, r.y + r.h / 2, radius, task.data.to, false, clockAnimProgress);

      const palette = getPalette();
      drawCtx.font = `700 ${Math.max(20, radius * 0.3)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
      drawCtx.fillStyle = palette.accent;
      drawCtx.textAlign = "center";
      drawCtx.textBaseline = "middle";
      drawCtx.fillText("\u2192", r.x + r.w / 2, r.y + r.h / 2);
    },
  }));

  if (!isPresent) {
    // Input display
    const inputStr = state.timespanInput || "\u00A0";
    children.push(text(`${inputStr} Minuten`, { fontSize: "lg" }));

    // Canvas numpad buttons (3x4 grid + clear + submit)
    const numRow = (digits: string[]) =>
      hstack(
        digits.map((d) =>
          button(d, {
            id: `num-${d}`,
            variant: "secondary",
            minWidth: 56,
            minHeight: 56,
            onTap: () => { /* handled via pointer target */ },
          }),
        ),
        { gap: 8, align: "center", justify: "center" },
      );

    children.push(numRow(["7", "8", "9"]));
    children.push(numRow(["4", "5", "6"]));
    children.push(numRow(["1", "2", "3"]));
    children.push(
      hstack([
        button("\u232B", {
          id: "num-back",
          variant: "ghost",
          minWidth: 56,
          minHeight: 56,
          onTap: () => {},
        }),
        button("0", {
          id: "num-0",
          variant: "secondary",
          minWidth: 56,
          minHeight: 56,
          onTap: () => {},
        }),
        button("Pr\u00FCfen", {
          id: "num-enter",
          variant: "primary",
          minWidth: 56,
          minHeight: 56,
          onTap: () => {},
        }),
      ], { gap: 8, align: "center", justify: "center" }),
    );

    if (answered && result) {
      children.push(text(
        result.correct ? "Richtig berechnet!" : "Z\u00E4hle die Stunden und Minuten nochmal.",
        { fontSize: "md", color: result.correct ? "canvasSuccess" : "warn" },
      ));
      // Show answer only after submission
      children.push(text(formatDuration(task.data.durationMinutes), { fontSize: "sm", color: "canvasTextDim" }));
    }
  } else {
    // Present phase: just show the two clocks, no answer
  }

  return vstack(children, { gap: 6, padding: 16, align: "center" });
}

function buildCalendarScene(
  task: { mode: "calendar"; date: CalendarDate },
  state: TimeState,
  phase: "present" | "interact",
  result: { correct: boolean; feedback?: string } | null,
  ctx: SceneContext<TimeTask, TimeState>,
): CanvasNode {
  const isPresent = phase === "present";
  const answered = result !== null;

  const children: CanvasNode[] = [];

  children.push(
    text(`Finde den ${task.date.day}. ${MONTH_NAMES_DE[task.date.month - 1]}`, { fontSize: "xl", bold: true }),
  );

  // Calendar grid wrapped in panel for visual framing
  children.push(panel(
    { id: "calendar-panel", bg: "panelSoft", radius: 12, padding: 8 },
    custom({
      id: "calendar",
      flex: 1,
      draw(drawCtx, r) {
        drawCalendarGrid(drawCtx, r, task, state.calendarTapped, isPresent);
      },
    }),
  ));

  if (!isPresent) {
    if (state.calendarTapped !== null && !answered) {
      children.push(text(`Deine Auswahl: ${state.calendarTapped}. ${MONTH_NAMES_DE[task.date.month - 1]}`, { fontSize: "md" }));
      children.push(button("Pr\u00FCfen", {
        id: "cal-check-btn",
        variant: "primary",
        minWidth: 160,
        onTap: () => {},
      }));
    }

    if (answered && result) {
      children.push(text(
        result.correct ? "Richtig gefunden!" : "Z\u00E4hle nochmal ab.",
        { fontSize: "md", color: result.correct ? "canvasSuccess" : "warn" },
      ));
    }
  } else {
    // Present phase: show the target highlighted
    children.push(text(
      `${task.date.day}. ${MONTH_NAMES_DE[task.date.month - 1]} ${task.date.year}`,
      { fontSize: "lg", color: "canvasSuccess" },
    ));
  }

  return vstack(children, { gap: 8, padding: 16, align: "center" });
}

// ─── Module Registration ──────────────────────────────────────────────────────

export const timeV2Registration = defineModule<TimeTask, TimeState>({
  id: "time",
  label: "Zeit & Kalender",
  icon: "\uD83D\uDD50",
  description: "Uhrzeiten ablesen, Zeitspannen berechnen und Kalender verstehen.",

  taskLabel(task) {
    switch (task.mode) {
      case "read":
        return "Lies die Uhrzeit ab.";
      case "set":
        return `Stelle die Uhr auf ${formatTime(task.time)}.`;
      case "timespan":
        return "Berechne die Zeitspanne.";
      case "calendar":
        return `Finde den ${task.date.day}. ${MONTH_NAMES_DE[task.date.month - 1]} im Kalender.`;
    }
  },

  flowType: "task",
  input: "canvas",

  taskTypes: [
    { id: "read", label: "Uhr lesen", icon: "\uD83D\uDD50" },
    { id: "set", label: "Uhr stellen", icon: "\uD83D\uDD70" },
    { id: "timespan", label: "Zeitspanne", icon: "\u23F1" },
    { id: "calendar", label: "Kalender", icon: "\uD83D\uDCC5" },
  ],

  difficulties: DIFFICULTIES,

  tutorial: (taskType: string): TutorialStep[] => {
    const palette = getPalette();
    const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

    if (taskType === "set") {
      return [
        {
          title: "So geht's",
          text: "Ziehe die Zeiger der Uhr auf die angezeigte Uhrzeit.",
          mathBackground: "Der kleine Zeiger zeigt die Stunde, der große die Minuten. Ziehe beide Zeiger an die richtige Position.",
          draw(ctx, w, h, p) {
            const cx = w / 2;
            const cy = h * 0.45;
            const radius = Math.min(w, h) * 0.3;

            // Clock face
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = palette.panelSoft;
            ctx.fill();
            ctx.strokeStyle = palette.line;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Hour marks
            for (let i = 0; i < 12; i++) {
              const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
              ctx.beginPath();
              ctx.moveTo(cx + radius * 0.82 * Math.cos(angle), cy + radius * 0.82 * Math.sin(angle));
              ctx.lineTo(cx + radius * 0.92 * Math.cos(angle), cy + radius * 0.92 * Math.sin(angle));
              ctx.strokeStyle = palette.canvasText;
              ctx.lineWidth = i % 3 === 0 ? 3 : 1.5;
              ctx.stroke();
            }

            // Numbers
            ctx.font = `700 ${radius * 0.18}px ${FONT}`;
            ctx.fillStyle = palette.canvasText;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            for (let i = 1; i <= 12; i++) {
              const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
              ctx.fillText(`${i}`, cx + radius * 0.68 * Math.cos(angle), cy + radius * 0.68 * Math.sin(angle));
            }

            // Animated hands to 3:30
            const eased = 1 - Math.pow(1 - Math.min(p / 0.7, 1), 3);
            const targetHourAngle = ((3 + 30 / 60) / 12) * Math.PI * 2 - Math.PI / 2;
            const targetMinAngle = (30 / 60) * Math.PI * 2 - Math.PI / 2;
            const startAngle = -Math.PI / 2;

            const hAngle = startAngle + (targetHourAngle - startAngle) * eased;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + radius * 0.5 * Math.cos(hAngle), cy + radius * 0.5 * Math.sin(hAngle));
            ctx.strokeStyle = palette.canvasPrimary;
            ctx.lineWidth = 5;
            ctx.lineCap = "round";
            ctx.stroke();

            const mAngle = startAngle + (targetMinAngle - startAngle) * eased;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + radius * 0.7 * Math.cos(mAngle), cy + radius * 0.7 * Math.sin(mAngle));
            ctx.strokeStyle = palette.accent;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Center dot
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 0.05, 0, Math.PI * 2);
            ctx.fillStyle = palette.canvasText;
            ctx.fill();

            if (p > 0.8) {
              ctx.font = `700 ${h * 0.1}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.textAlign = "center";
              ctx.fillText("3:30 Uhr ✓", w / 2, h * 0.9);
            }
          },
          duration: 2500,
        },
      ];
    }

    if (taskType === "timespan") {
      return [
        {
          title: "So geht's",
          text: "Berechne, wie viel Zeit zwischen zwei Uhrzeiten liegt.",
          mathBackground: "Zeitspanne = Endzeit − Startzeit. Zähle Stunden und Minuten getrennt.",
          draw(ctx, w, h, p) {
            ctx.font = `700 ${h * 0.11}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = palette.canvasText;
            ctx.fillText("Von 8:00 bis 10:30", w / 2, h * 0.15);

            if (p > 0.2) {
              ctx.font = `600 ${h * 0.09}px ${FONT}`;
              ctx.fillStyle = palette.accent;
              ctx.fillText("8:00 → 10:00 = 2 Stunden", w / 2, h * 0.4);
            }
            if (p > 0.5) {
              ctx.fillStyle = palette.accent;
              ctx.fillText("10:00 → 10:30 = 30 Minuten", w / 2, h * 0.58);
            }
            if (p > 0.8) {
              ctx.font = `700 ${h * 0.12}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.fillText("= 150 Minuten ✓", w / 2, h * 0.8);
            }
          },
          duration: 2500,
        },
      ];
    }

    if (taskType === "calendar") {
      return [
        {
          title: "So geht's",
          text: "Finde den richtigen Tag im Kalender.",
          mathBackground: "Ein Kalender zeigt die Tage eines Monats. Die Woche beginnt mit Montag (Mo).",
          draw(ctx, w, h, p) {
            ctx.font = `700 ${h * 0.1}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = palette.canvasText;
            ctx.fillText("Finde den 15. März", w / 2, h * 0.1);

            // Mini calendar grid
            const headers = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
            const cellW = w * 0.1;
            const startX = w / 2 - 3.5 * cellW;
            const startY = h * 0.25;

            ctx.font = `600 ${h * 0.06}px ${FONT}`;
            ctx.fillStyle = palette.canvasTextDim;
            for (let i = 0; i < 7; i++) {
              ctx.fillText(headers[i]!, startX + i * cellW + cellW / 2, startY);
            }

            // Days (March starts on Saturday=5 in 2025)
            const firstDay = 5;
            const targetDay = 15;
            const daysToShow = Math.floor(p * 20) + 1;

            for (let d = 1; d <= Math.min(daysToShow, 20); d++) {
              const pos = firstDay + d - 1;
              const col = pos % 7;
              const row = Math.floor(pos / 7) + 1;
              const x = startX + col * cellW;
              const y = startY + row * cellW * 0.9;

              if (d === targetDay && p > 0.7) {
                ctx.fillStyle = palette.accent;
                ctx.globalAlpha = 0.25;
                ctx.beginPath();
                if (typeof ctx.roundRect === "function") ctx.roundRect(x + 2, y - cellW * 0.3, cellW - 4, cellW * 0.7, 4);
                else ctx.rect(x + 2, y - cellW * 0.3, cellW - 4, cellW * 0.7);
                ctx.fill();
                ctx.globalAlpha = 1;
              }

              ctx.font = `${d === targetDay && p > 0.7 ? "700" : "400"} ${h * 0.06}px ${FONT}`;
              ctx.fillStyle = d === targetDay && p > 0.7 ? palette.accent : palette.canvasText;
              ctx.fillText(`${d}`, x + cellW / 2, y);
            }

            if (p > 0.85) {
              ctx.font = `700 ${h * 0.1}px ${FONT}`;
              ctx.fillStyle = palette.ok;
              ctx.textAlign = "center";
              ctx.fillText("15. März ✓", w / 2, h * 0.92);
            }
          },
          duration: 2500,
        },
      ];
    }

    // Default: read
    return [
      {
        title: "So geht's",
        text: "Lies die Uhrzeit von der Uhr ab. Achte auf beide Zeiger!",
        mathBackground: "1 Stunde = 60 Minuten. Der kleine Zeiger zeigt Stunden, der große Minuten.",
        draw(ctx, w, h, p) {
          const cx = w / 2;
          const cy = h * 0.45;
          const radius = Math.min(w, h) * 0.3;

          // Clock face
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fillStyle = palette.panelSoft;
          ctx.fill();
          ctx.strokeStyle = palette.line;
          ctx.lineWidth = 3;
          ctx.stroke();

          // Hour marks
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(cx + radius * 0.82 * Math.cos(angle), cy + radius * 0.82 * Math.sin(angle));
            ctx.lineTo(cx + radius * 0.92 * Math.cos(angle), cy + radius * 0.92 * Math.sin(angle));
            ctx.strokeStyle = palette.canvasText;
            ctx.lineWidth = i % 3 === 0 ? 3 : 1.5;
            ctx.stroke();
          }

          // Numbers
          ctx.font = `700 ${radius * 0.18}px ${FONT}`;
          ctx.fillStyle = palette.canvasText;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          for (let i = 1; i <= 12; i++) {
            const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
            ctx.fillText(`${i}`, cx + radius * 0.68 * Math.cos(angle), cy + radius * 0.68 * Math.sin(angle));
          }

          // Animated hands from 12:00 to 9:15
          const eased = 1 - Math.pow(1 - Math.min(p / 0.7, 1), 3);
          const targetHourAngle = ((9 + 15 / 60) / 12) * Math.PI * 2 - Math.PI / 2;
          const targetMinAngle = (15 / 60) * Math.PI * 2 - Math.PI / 2;
          const startAngle = -Math.PI / 2;

          const hAngle = startAngle + (targetHourAngle - startAngle) * eased;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + radius * 0.5 * Math.cos(hAngle), cy + radius * 0.5 * Math.sin(hAngle));
          ctx.strokeStyle = palette.canvasPrimary;
          ctx.lineWidth = 5;
          ctx.lineCap = "round";
          ctx.stroke();

          const mAngle = startAngle + (targetMinAngle - startAngle) * eased;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + radius * 0.7 * Math.cos(mAngle), cy + radius * 0.7 * Math.sin(mAngle));
          ctx.strokeStyle = palette.accent;
          ctx.lineWidth = 3;
          ctx.stroke();

          // Center dot
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 0.05, 0, Math.PI * 2);
          ctx.fillStyle = palette.canvasText;
          ctx.fill();

          // Labels
          if (p > 0.5) {
            ctx.font = `600 ${h * 0.07}px ${FONT}`;
            ctx.fillStyle = palette.canvasPrimary;
            ctx.fillText("← Stunde", cx + radius * 0.5 * Math.cos(hAngle) + radius * 0.2, cy + radius * 0.5 * Math.sin(hAngle));
          }

          if (p > 0.8) {
            ctx.font = `700 ${h * 0.1}px ${FONT}`;
            ctx.fillStyle = palette.ok;
            ctx.textAlign = "center";
            ctx.fillText("9:15 Uhr ✓", w / 2, h * 0.9);
          }
        },
        duration: 2500,
      },
    ];
  },

  generate(ctx) {
    // Map 3-level difficulty directly to time logic's 3-level:
    // D1 (Junior) → level 1 (whole hours)
    // D2 (Checker) → level 2 (5-min steps)
    // D3 (BossBaby) → level 3 (any minute)
    // Reset clock animation for new task
    clockAnimProgress = 0;
    const d = (ctx.difficulty ?? 2) as 1 | 2 | 3;
    switch (ctx.taskType) {
      case "read":
        return { mode: "read", time: generateReadTask(d as 1 | 2 | 3) };
      case "set":
        return { mode: "set", time: generateReadTask(d as 1 | 2 | 3) };
      case "timespan":
        return { mode: "timespan", data: generateTimespanTask(d as 1 | 2 | 3) };
      case "calendar": {
        const now = new Date();
        return { mode: "calendar", date: generateCalendarTask(now.getFullYear(), now.getMonth() + 1) };
      }
      default:
        return { mode: "read", time: generateReadTask(d as 1 | 2 | 3) };
    }
  },

  check(task, answer) {
    if (task.mode === "read" || task.mode === "set") {
      const ans = answer as TimeOfDay;
      const correct = timesEqual(task.time, ans);
      const fb = task.mode === "set"
        ? (correct ? "Richtig gestellt!" : "Die Zeiger stimmen noch nicht.")
        : (correct ? "Richtig abgelesen!" : "Schau nochmal auf die Zeiger.");
      return { correct, feedback: fb };
    }
    if (task.mode === "timespan") {
      const num = typeof answer === "number" ? answer : Number(answer);
      const correct = num === task.data.durationMinutes;
      return { correct, feedback: correct ? "Richtig berechnet!" : "Z\u00E4hle die Stunden und Minuten nochmal." };
    }
    const num = typeof answer === "number" ? answer : Number(answer);
    const correct = num === task.date.day;
    return { correct, feedback: correct ? "Richtig gefunden!" : "Z\u00E4hle nochmal ab." };
  },

  hints: getHints,

  getSolution(task) {
    if (task.mode === "read" || task.mode === "set") return { text: explainTimeRead(task.time) };
    if (task.mode === "timespan") return { text: explainTimespan(task.data) };
    return { text: `${task.date.day}. ${MONTH_NAMES_DE[task.date.month - 1]} ${task.date.year}` };
  },

  initialState: () => ({
    setHour: 12,
    setMinute: 0,
    dragging: null,
    calendarTapped: null,
    timespanInput: "",
  }),

  buildScene(ctx) {
    return buildScene(ctx);
  },

  onActivate(ctx) {
    // Reset mutable refs
    radialDrag = null;
    clockCenter = null;
    calendarGeo = null;
    timeScene = ctx.scene;
    clockAnimProgress = 0;

    // Animate clock hands from 12:00 to target (1000ms easeOut)
    cancelAnimationFrame(clockAnimRafId);
    if (prefersReducedMotion()) {
      clockAnimProgress = 1;
      clockAnimRafId = 0;
      return;
    }
    let lastT: number | null = null;
    const loop = (now: number) => {
      const dt = lastT !== null ? now - lastT : 0;
      lastT = now;
      if (clockAnimProgress < 1) {
        clockAnimProgress = Math.min(1, clockAnimProgress + dt / 1000);
        timeScene?.invalidate();
      }
      if (clockAnimProgress < 1) clockAnimRafId = requestAnimationFrame(loop);
    };
    clockAnimRafId = requestAnimationFrame(loop);
  },

  onDeactivate() {
    radialDrag = null;
    clockCenter = null;
    calendarGeo = null;
    cancelAnimationFrame(clockAnimRafId);
    timeScene = null;
  },

  onPointerDown(ctx) {
    const task = ctx.task;

    // Handle button taps via target
    if (ctx.target) {
      const targetId = typeof ctx.target === "object" && "id" in ctx.target ? (ctx.target as { id?: string }).id : undefined;

      if (targetId === "check-btn" && (task.mode === "read" || task.mode === "set")) {
        const answer: TimeOfDay = { hour: ctx.state.setHour, minute: ctx.state.setMinute };
        ctx.submitAnswer(answer);
        return;
      }

      if (targetId === "cal-check-btn" && task.mode === "calendar" && ctx.state.calendarTapped !== null) {
        ctx.submitAnswer(ctx.state.calendarTapped);
        return;
      }

      // Timespan numpad buttons
      if (task.mode === "timespan" && targetId) {
        if (targetId === "num-enter") {
          if (ctx.state.timespanInput.length > 0) {
            ctx.submitAnswer(Number(ctx.state.timespanInput));
          }
          return;
        }
        if (targetId === "num-back") {
          ctx.setState({ timespanInput: ctx.state.timespanInput.slice(0, -1) });
          return;
        }
        const digitMatch = targetId.match(/^num-(\d)$/);
        if (digitMatch) {
          if (ctx.state.timespanInput.length < 6) {
            ctx.setState({ timespanInput: ctx.state.timespanInput + digitMatch[1] });
          }
          return;
        }
      }
    }

    // Clock radial drag (read/set mode, interact phase)
    if (task.mode === "read" || task.mode === "set") {
      // Recreate radial drag with current clock geometry
      const drag = ensureRadialDrag((partial) => ctx.setState(partial));
      if (drag && drag.handleDown(ctx.x, ctx.y)) {
        return;
      }
    }

    // Calendar tap (calendar mode, interact phase)
    if (task.mode === "calendar" && calendarGeo) {
      const { cellW, cellH, startX, startY, firstDay, totalDays } = calendarGeo;
      // Convert CSS coords to day number
      const col = Math.floor((ctx.x - startX) / cellW);
      const row = Math.floor((ctx.y - startY) / cellH) - 1; // row 0 = headers
      if (col >= 0 && col < 7 && row >= 0) {
        const dayIndex = row * 7 + col - firstDay + 1;
        if (dayIndex >= 1 && dayIndex <= totalDays) {
          ctx.setState({ calendarTapped: dayIndex });
        }
      }
    }
  },

  onPointerMove(ctx) {
    if ((ctx.task.mode === "read" || ctx.task.mode === "set") && radialDrag) {
      radialDrag.handleMove(ctx.x, ctx.y);
    }
  },

  onPointerUp(ctx) {
    if ((ctx.task.mode === "read" || ctx.task.mode === "set") && radialDrag) {
      radialDrag.handleUp();
      ctx.setState({ dragging: null });
    }
  },
});
