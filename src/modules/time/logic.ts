/**
 * Zeit & Kalender – Logik (rein funktional, testbar)
 *
 * Alle Hilfsfunktionen für Zeit-Parsing, Dauern und Kalender-Berechnung.
 * Keine DOM- oder Canvas-Abhängigkeiten.
 */

import { padZero, randomInt } from "@core/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeOfDay {
  hour: number;   // 0–23
  minute: number; // 0–59
}

export interface CalendarDate {
  year: number;
  month: number; // 1–12
  day: number;   // 1–31
}

export interface TimespanTask {
  from: TimeOfDay;
  to: TimeOfDay;
  /** Correct duration in minutes */
  durationMinutes: number;
}

// ─── Time Formatting ──────────────────────────────────────────────────────────

/**
 * Formats a time as "HH:MM".
 */
export function formatTime(t: TimeOfDay): string {
  return `${padZero(t.hour)}:${padZero(t.minute)}`;
}

/**
 * Parses a time string "HH:MM" or "H:MM" into TimeOfDay.
 * Returns null for invalid input.
 */
export function parseTime(s: string): TimeOfDay | null {
  const match = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Converts TimeOfDay to total minutes since midnight.
 */
export function toMinutes(t: TimeOfDay): number {
  return t.hour * 60 + t.minute;
}

/**
 * Converts total minutes since midnight to TimeOfDay.
 * Wraps around 24h boundary.
 */
export function fromMinutes(minutes: number): TimeOfDay {
  const total = ((minutes % 1440) + 1440) % 1440;
  return {
    hour: Math.floor(total / 60),
    minute: total % 60,
  };
}

/**
 * Checks if two TimeOfDay values represent the same clock time.
 */
export function timesEqual(a: TimeOfDay, b: TimeOfDay): boolean {
  return a.hour === b.hour && a.minute === b.minute;
}

// ─── Duration Calculation ─────────────────────────────────────────────────────

/**
 * Calculates duration in minutes from `from` to `to` going forward.
 * Always positive. Wraps around midnight if `to` is earlier than `from`.
 */
export function durationMinutes(from: TimeOfDay, to: TimeOfDay): number {
  const diff = toMinutes(to) - toMinutes(from);
  return diff >= 0 ? diff : diff + 1440;
}

/**
 * Formats a minute count as a human-readable string: "1 Stunde 30 Minuten".
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Minute${m !== 1 ? "n" : ""}`;
  if (m === 0) return `${h} Stunde${h !== 1 ? "n" : ""}`;
  return `${h} Stunde${h !== 1 ? "n" : ""} ${m} Minute${m !== 1 ? "n" : ""}`;
}

/**
 * Formats a minute count as "HH:MM".
 */
export function formatDurationHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${padZero(h)}:${padZero(m)}`;
}

/**
 * Adds a duration (in minutes) to a time, wrapping around midnight.
 */
export function addMinutes(t: TimeOfDay, minutes: number): TimeOfDay {
  return fromMinutes(toMinutes(t) + minutes);
}

// ─── Clock Angle Helpers ──────────────────────────────────────────────────────

/**
 * Returns the angle (in radians, 0 = 12 o'clock, clockwise) for the hour hand.
 */
export function hourHandAngle(t: TimeOfDay): number {
  // Hour hand moves 360° in 12 hours, plus 0.5° per minute
  const totalMinutes = (t.hour % 12) * 60 + t.minute;
  return (totalMinutes / 720) * 2 * Math.PI - Math.PI / 2;
}

/**
 * Returns the angle (in radians, 0 = 12 o'clock, clockwise) for the minute hand.
 */
export function minuteHandAngle(t: TimeOfDay): number {
  return (t.minute / 60) * 2 * Math.PI - Math.PI / 2;
}

/**
 * Given an angle (from center of clock, 0 = right, clockwise), derive the
 * nearest 5-minute snap for the minute hand.
 */
export function angleToMinuteSnap(angle: number): number {
  // Shift angle so 0 = 12 o'clock
  const shifted = angle + Math.PI / 2;
  const normalised = ((shifted % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const rawMinutes = (normalised / (2 * Math.PI)) * 60;
  return Math.round(rawMinutes / 5) * 5 % 60;
}

/**
 * Given an angle, derive the nearest hour (1–12) for the hour hand.
 */
export function angleToHour(angle: number): number {
  const shifted = angle + Math.PI / 2;
  const normalised = ((shifted % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const rawHour = (normalised / (2 * Math.PI)) * 12;
  const snapped = Math.round(rawHour) % 12;
  return snapped === 0 ? 12 : snapped;
}

// ─── Task Generation ──────────────────────────────────────────────────────────

/**
 * Generates a random "read" time task (whole hours or half-hours for simplicity).
 * Returns the time to display on the clock.
 */
export function generateReadTask(difficulty: 1 | 2 | 3 = 1): TimeOfDay {
  const hour = randomInt(1, 12);
  let minute: number;
  if (difficulty === 1) {
    // Whole hours only
    minute = 0;
  } else if (difficulty === 2) {
    // 5-minute steps
    minute = randomInt(0, 11) * 5;
  } else {
    // Any minute
    minute = randomInt(0, 59);
  }
  return { hour, minute };
}

/**
 * Generates a random timespan task (forward duration between two times).
 */
export function generateTimespanTask(difficulty: 1 | 2 | 3 = 1): TimespanTask {
  const fromHour = randomInt(6, 20);
  const fromMinute = difficulty === 1 ? 0 : randomInt(0, 11) * 5;
  const from: TimeOfDay = { hour: fromHour, minute: fromMinute };

  let durationMin: number;
  if (difficulty === 1) {
    durationMin = randomInt(1, 4) * 60; // 1–4 whole hours
  } else if (difficulty === 2) {
    durationMin = randomInt(1, 8) * 30; // 30-min steps
  } else {
    durationMin = randomInt(10, 180); // 10–180 minutes, any
  }

  const to = addMinutes(from, durationMin);
  return { from, to, durationMinutes: durationMin };
}

// ─── Calendar Helpers ─────────────────────────────────────────────────────────

export const MONTH_NAMES_DE: readonly string[] = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export const WEEKDAY_NAMES_SHORT_DE: readonly string[] = [
  "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So",
];

/**
 * Returns the number of days in a given month/year (1-indexed month).
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Returns the weekday (0=Monday, 6=Sunday) for the first day of the month.
 */
export function firstWeekdayOfMonth(year: number, month: number): number {
  // getDay() returns 0=Sun,1=Mon,...,6=Sat; we want 0=Mon,6=Sun
  const day = new Date(year, month - 1, 1).getDay();
  return (day + 6) % 7;
}

/**
 * Returns whether a given year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the weekday name (short, German) for a given date.
 */
export function weekdayName(date: CalendarDate): string {
  const d = new Date(date.year, date.month - 1, date.day);
  const day = d.getDay(); // 0=Sun
  const idx = (day + 6) % 7; // 0=Mon
  return WEEKDAY_NAMES_SHORT_DE[idx];
}

/**
 * Generates a calendar task: find a specific day in the shown month.
 */
export function generateCalendarTask(year: number, month: number): CalendarDate {
  const days = daysInMonth(year, month);
  const day = randomInt(1, days);
  return { year, month, day };
}

/**
 * Returns the next month (year, month) pair.
 */
export function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

/**
 * Returns the previous month (year, month) pair.
 */
export function prevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

/**
 * Checks whether two CalendarDate objects refer to the same day.
 */
export function sameDay(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

// ─── Explanations ────────────────────────────────────────────────────────────

export function explainTimeRead(task: TimeOfDay): string {
  const h = task.hour % 12 || 12;
  if (task.minute === 0) {
    return `Stundenzeiger bei ${h}, Minutenzeiger bei 12 → ${formatTime(task)}`;
  }
  return `Stundenzeiger bei ${h}, Minutenzeiger bei ${task.minute} → ${formatTime(task)}`;
}

export function explainTimespan(task: TimespanTask): string {
  const dur = task.durationMinutes;
  return `Von ${formatTime(task.from)} bis ${formatTime(task.to)}: ${formatDuration(dur)} = ${dur} Minuten`;
}
