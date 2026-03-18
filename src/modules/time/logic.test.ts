/**
 * Tests für Zeit & Kalender Logik
 */
import { describe, it, expect } from "vitest";
import {
  formatTime,
  parseTime,
  toMinutes,
  fromMinutes,
  timesEqual,
  durationMinutes,
  formatDuration,
  formatDurationHHMM,
  addMinutes,
  hourHandAngle,
  minuteHandAngle,
  angleToMinuteSnap,
  angleToHour,
  daysInMonth,
  firstWeekdayOfMonth,
  isLeapYear,
  weekdayName,
  nextMonth,
  prevMonth,
  sameDay,
  MONTH_NAMES_DE,
  WEEKDAY_NAMES_SHORT_DE,
  explainTimeRead,
  explainTimespan,
  generateReadTask,
  generateTimespanTask,
  generateCalendarTask,
} from "./logic";
import type { CalendarDate, TimespanTask } from "./logic";

// ─── formatTime ───────────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("formats midnight as 00:00", () => {
    expect(formatTime({ hour: 0, minute: 0 })).toBe("00:00");
  });

  it("formats 9:05 with leading zeros", () => {
    expect(formatTime({ hour: 9, minute: 5 })).toBe("09:05");
  });

  it("formats 23:59 correctly", () => {
    expect(formatTime({ hour: 23, minute: 59 })).toBe("23:59");
  });

  it("formats 12:30 correctly", () => {
    expect(formatTime({ hour: 12, minute: 30 })).toBe("12:30");
  });
});

// ─── parseTime ────────────────────────────────────────────────────────────────

describe("parseTime", () => {
  it("parses '08:30' correctly", () => {
    expect(parseTime("08:30")).toEqual({ hour: 8, minute: 30 });
  });

  it("parses '9:05' (no leading zero on hour)", () => {
    expect(parseTime("9:05")).toEqual({ hour: 9, minute: 5 });
  });

  it("parses '00:00'", () => {
    expect(parseTime("00:00")).toEqual({ hour: 0, minute: 0 });
  });

  it("parses '23:59'", () => {
    expect(parseTime("23:59")).toEqual({ hour: 23, minute: 59 });
  });

  it("returns null for hour > 23", () => {
    expect(parseTime("24:00")).toBeNull();
  });

  it("returns null for minute > 59", () => {
    expect(parseTime("10:60")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseTime("")).toBeNull();
  });

  it("returns null for text without colon", () => {
    expect(parseTime("1230")).toBeNull();
  });

  it("returns null for negative-looking input", () => {
    expect(parseTime("-1:00")).toBeNull();
  });

  it("trims whitespace before parsing", () => {
    expect(parseTime("  12:00  ")).toEqual({ hour: 12, minute: 0 });
  });
});

// ─── toMinutes / fromMinutes ──────────────────────────────────────────────────

describe("toMinutes", () => {
  it("converts midnight to 0", () => {
    expect(toMinutes({ hour: 0, minute: 0 })).toBe(0);
  });

  it("converts 1:30 to 90", () => {
    expect(toMinutes({ hour: 1, minute: 30 })).toBe(90);
  });

  it("converts 23:59 to 1439", () => {
    expect(toMinutes({ hour: 23, minute: 59 })).toBe(1439);
  });
});

describe("fromMinutes", () => {
  it("converts 0 to midnight", () => {
    expect(fromMinutes(0)).toEqual({ hour: 0, minute: 0 });
  });

  it("converts 90 to 1:30", () => {
    expect(fromMinutes(90)).toEqual({ hour: 1, minute: 30 });
  });

  it("wraps at 1440 (full day)", () => {
    expect(fromMinutes(1440)).toEqual({ hour: 0, minute: 0 });
  });

  it("wraps negative values", () => {
    // -60 minutes from midnight = 23:00
    expect(fromMinutes(-60)).toEqual({ hour: 23, minute: 0 });
  });
});

// ─── timesEqual ───────────────────────────────────────────────────────────────

describe("timesEqual", () => {
  it("returns true for identical times", () => {
    expect(timesEqual({ hour: 10, minute: 30 }, { hour: 10, minute: 30 })).toBe(true);
  });

  it("returns false for different hours", () => {
    expect(timesEqual({ hour: 10, minute: 0 }, { hour: 11, minute: 0 })).toBe(false);
  });

  it("returns false for different minutes", () => {
    expect(timesEqual({ hour: 10, minute: 0 }, { hour: 10, minute: 1 })).toBe(false);
  });
});

// ─── durationMinutes ──────────────────────────────────────────────────────────

describe("durationMinutes", () => {
  it("calculates simple forward duration", () => {
    expect(durationMinutes({ hour: 8, minute: 0 }, { hour: 10, minute: 0 })).toBe(120);
  });

  it("calculates duration with partial hours", () => {
    expect(durationMinutes({ hour: 9, minute: 15 }, { hour: 10, minute: 45 })).toBe(90);
  });

  it("wraps around midnight (from 23:00 to 01:00 = 120 min)", () => {
    expect(durationMinutes({ hour: 23, minute: 0 }, { hour: 1, minute: 0 })).toBe(120);
  });

  it("returns 0 for same time", () => {
    expect(durationMinutes({ hour: 12, minute: 0 }, { hour: 12, minute: 0 })).toBe(0);
  });
});

// ─── formatDuration ───────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats 0 minutes", () => {
    expect(formatDuration(0)).toBe("0 Minuten");
  });

  it("formats 1 minute with singular", () => {
    expect(formatDuration(1)).toBe("1 Minute");
  });

  it("formats 45 minutes", () => {
    expect(formatDuration(45)).toBe("45 Minuten");
  });

  it("formats exactly 1 hour (singular)", () => {
    expect(formatDuration(60)).toBe("1 Stunde");
  });

  it("formats 2 hours (plural)", () => {
    expect(formatDuration(120)).toBe("2 Stunden");
  });

  it("formats 1 hour 30 minutes", () => {
    expect(formatDuration(90)).toBe("1 Stunde 30 Minuten");
  });

  it("formats 2 hours 5 minutes", () => {
    expect(formatDuration(125)).toBe("2 Stunden 5 Minuten");
  });
});

// ─── formatDurationHHMM ───────────────────────────────────────────────────────

describe("formatDurationHHMM", () => {
  it("formats 90 minutes as 01:30", () => {
    expect(formatDurationHHMM(90)).toBe("01:30");
  });

  it("formats 0 as 00:00", () => {
    expect(formatDurationHHMM(0)).toBe("00:00");
  });

  it("formats 125 as 02:05", () => {
    expect(formatDurationHHMM(125)).toBe("02:05");
  });
});

// ─── addMinutes ───────────────────────────────────────────────────────────────

describe("addMinutes", () => {
  it("adds minutes within same hour", () => {
    expect(addMinutes({ hour: 10, minute: 0 }, 30)).toEqual({ hour: 10, minute: 30 });
  });

  it("adds minutes crossing hour boundary", () => {
    expect(addMinutes({ hour: 10, minute: 45 }, 30)).toEqual({ hour: 11, minute: 15 });
  });

  it("wraps around midnight", () => {
    expect(addMinutes({ hour: 23, minute: 30 }, 60)).toEqual({ hour: 0, minute: 30 });
  });

  it("handles negative addition (subtraction)", () => {
    expect(addMinutes({ hour: 10, minute: 0 }, -30)).toEqual({ hour: 9, minute: 30 });
  });
});

// ─── hourHandAngle / minuteHandAngle ──────────────────────────────────────────

describe("hourHandAngle", () => {
  it("points up (−π/2) at 12:00", () => {
    expect(hourHandAngle({ hour: 12, minute: 0 })).toBeCloseTo(-Math.PI / 2);
  });

  it("points right (0) at 3:00", () => {
    expect(hourHandAngle({ hour: 3, minute: 0 })).toBeCloseTo(0);
  });

  it("points down (π/2) at 6:00", () => {
    expect(hourHandAngle({ hour: 6, minute: 0 })).toBeCloseTo(Math.PI / 2);
  });

  it("points left (= π) at 9:00", () => {
    const angle = hourHandAngle({ hour: 9, minute: 0 });
    // 9:00 → 9*60/720 * 2π - π/2 = 1.5π - 0.5π = π (pointing left)
    expect(angle).toBeCloseTo(Math.PI);
  });

  it("is slightly past 12 at 12:30 (minute moves hand)", () => {
    const at12 = hourHandAngle({ hour: 12, minute: 0 });
    const at1230 = hourHandAngle({ hour: 12, minute: 30 });
    expect(at1230).toBeGreaterThan(at12);
  });
});

describe("minuteHandAngle", () => {
  it("points up at :00", () => {
    expect(minuteHandAngle({ hour: 0, minute: 0 })).toBeCloseTo(-Math.PI / 2);
  });

  it("points right at :15", () => {
    expect(minuteHandAngle({ hour: 0, minute: 15 })).toBeCloseTo(0);
  });

  it("points down at :30", () => {
    expect(minuteHandAngle({ hour: 0, minute: 30 })).toBeCloseTo(Math.PI / 2);
  });
});

// ─── angleToMinuteSnap ────────────────────────────────────────────────────────

describe("angleToMinuteSnap", () => {
  it("snaps to 0 from the 12-o'clock angle", () => {
    const angle = -Math.PI / 2; // 12 o'clock in our convention
    expect(angleToMinuteSnap(angle)).toBe(0);
  });

  it("snaps to 15 from 3-o'clock angle", () => {
    const angle = 0; // 3 o'clock = right
    expect(angleToMinuteSnap(angle)).toBe(15);
  });

  it("snaps to 30 from 6-o'clock angle", () => {
    const angle = Math.PI / 2; // 6 o'clock
    expect(angleToMinuteSnap(angle)).toBe(30);
  });

  it("snaps to 45 from 9-o'clock angle", () => {
    const angle = Math.PI; // 9 o'clock
    expect(angleToMinuteSnap(angle)).toBe(45);
  });
});

// ─── angleToHour ──────────────────────────────────────────────────────────────

describe("angleToHour", () => {
  it("returns 12 from 12-o'clock angle", () => {
    expect(angleToHour(-Math.PI / 2)).toBe(12);
  });

  it("returns 3 from right angle", () => {
    expect(angleToHour(0)).toBe(3);
  });

  it("returns 6 from bottom angle", () => {
    expect(angleToHour(Math.PI / 2)).toBe(6);
  });

  it("returns 9 from left angle", () => {
    expect(angleToHour(Math.PI)).toBe(9);
  });
});

// ─── daysInMonth ──────────────────────────────────────────────────────────────

describe("daysInMonth", () => {
  it("returns 31 for January", () => {
    expect(daysInMonth(2024, 1)).toBe(31);
  });

  it("returns 28 for February in non-leap year", () => {
    expect(daysInMonth(2023, 2)).toBe(28);
  });

  it("returns 29 for February in leap year", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
  });

  it("returns 30 for April", () => {
    expect(daysInMonth(2024, 4)).toBe(30);
  });

  it("returns 31 for December", () => {
    expect(daysInMonth(2024, 12)).toBe(31);
  });
});

// ─── firstWeekdayOfMonth ──────────────────────────────────────────────────────

describe("firstWeekdayOfMonth", () => {
  it("Jan 2024 starts on Monday (0)", () => {
    // 2024-01-01 is Monday
    expect(firstWeekdayOfMonth(2024, 1)).toBe(0);
  });

  it("Feb 2024 starts on Thursday (3)", () => {
    // 2024-02-01 is Thursday
    expect(firstWeekdayOfMonth(2024, 2)).toBe(3);
  });

  it("returns value in range 0–6", () => {
    for (let m = 1; m <= 12; m++) {
      const wd = firstWeekdayOfMonth(2024, m);
      expect(wd).toBeGreaterThanOrEqual(0);
      expect(wd).toBeLessThanOrEqual(6);
    }
  });
});

// ─── isLeapYear ───────────────────────────────────────────────────────────────

describe("isLeapYear", () => {
  it("2024 is a leap year", () => {
    expect(isLeapYear(2024)).toBe(true);
  });

  it("2023 is not a leap year", () => {
    expect(isLeapYear(2023)).toBe(false);
  });

  it("2000 is a leap year (divisible by 400)", () => {
    expect(isLeapYear(2000)).toBe(true);
  });

  it("1900 is not a leap year (divisible by 100 but not 400)", () => {
    expect(isLeapYear(1900)).toBe(false);
  });

  it("2100 is not a leap year", () => {
    expect(isLeapYear(2100)).toBe(false);
  });
});

// ─── weekdayName ──────────────────────────────────────────────────────────────

describe("weekdayName", () => {
  it("2024-01-01 is Mo", () => {
    expect(weekdayName({ year: 2024, month: 1, day: 1 })).toBe("Mo");
  });

  it("2024-01-07 is So (Sunday)", () => {
    expect(weekdayName({ year: 2024, month: 1, day: 7 })).toBe("So");
  });

  it("2024-03-14 is Do (Thursday)", () => {
    expect(weekdayName({ year: 2024, month: 3, day: 14 })).toBe("Do");
  });
});

// ─── nextMonth / prevMonth ────────────────────────────────────────────────────

describe("nextMonth", () => {
  it("advances from January to February", () => {
    expect(nextMonth(2024, 1)).toEqual({ year: 2024, month: 2 });
  });

  it("wraps from December to January next year", () => {
    expect(nextMonth(2024, 12)).toEqual({ year: 2025, month: 1 });
  });
});

describe("prevMonth", () => {
  it("goes back from March to February", () => {
    expect(prevMonth(2024, 3)).toEqual({ year: 2024, month: 2 });
  });

  it("wraps from January to December previous year", () => {
    expect(prevMonth(2024, 1)).toEqual({ year: 2023, month: 12 });
  });
});

// ─── sameDay ──────────────────────────────────────────────────────────────────

describe("sameDay", () => {
  const date: CalendarDate = { year: 2024, month: 3, day: 14 };

  it("returns true for identical dates", () => {
    expect(sameDay(date, { ...date })).toBe(true);
  });

  it("returns false for different day", () => {
    expect(sameDay(date, { ...date, day: 15 })).toBe(false);
  });

  it("returns false for different month", () => {
    expect(sameDay(date, { ...date, month: 4 })).toBe(false);
  });

  it("returns false for different year", () => {
    expect(sameDay(date, { ...date, year: 2025 })).toBe(false);
  });
});

// ─── Constants ────────────────────────────────────────────────────────────────

describe("MONTH_NAMES_DE", () => {
  it("has 12 entries", () => {
    expect(MONTH_NAMES_DE).toHaveLength(12);
  });

  it("starts with Januar", () => {
    expect(MONTH_NAMES_DE[0]).toBe("Januar");
  });

  it("ends with Dezember", () => {
    expect(MONTH_NAMES_DE[11]).toBe("Dezember");
  });
});

describe("WEEKDAY_NAMES_SHORT_DE", () => {
  it("has 7 entries", () => {
    expect(WEEKDAY_NAMES_SHORT_DE).toHaveLength(7);
  });

  it("starts with Mo", () => {
    expect(WEEKDAY_NAMES_SHORT_DE[0]).toBe("Mo");
  });

  it("ends with So", () => {
    expect(WEEKDAY_NAMES_SHORT_DE[6]).toBe("So");
  });
});

describe("explainTimeRead", () => {
  it("volle Stunde enthält keine Minutenangabe", () => {
    const result = explainTimeRead({ hour: 9, minute: 0 });
    expect(result).toContain("09:00");
  });

  it("mit Minuten enthält Minutenzeiger-Info", () => {
    const result = explainTimeRead({ hour: 9, minute: 30 });
    expect(result).toContain("30");
    expect(result).toContain("09:30");
  });

  it("Mitternacht wird korrekt erklärt", () => {
    const result = explainTimeRead({ hour: 0, minute: 0 });
    expect(result).toContain("00:00");
  });
});

describe("explainTimespan", () => {
  it("gibt korrekte Von–bis-Beschreibung zurück", () => {
    const task: TimespanTask = {
      from: { hour: 8, minute: 0 },
      to: { hour: 9, minute: 30 },
      durationMinutes: 90,
    };
    const result = explainTimespan(task);
    expect(result).toContain("08:00");
    expect(result).toContain("09:30");
    expect(result).toContain("90");
  });
});

describe("generateReadTask", () => {
  it("Schwierigkeit 1 liefert immer volle Stunden", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateReadTask(1).minute).toBe(0);
    }
  });

  it("Schwierigkeit 2 liefert Vielfache von 5", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateReadTask(2).minute % 5).toBe(0);
    }
  });

  it("Schwierigkeit 3 liefert beliebige Minuten im Bereich 0–59", () => {
    const minutes = new Set(Array.from({ length: 100 }, () => generateReadTask(3).minute));
    expect(minutes.size).toBeGreaterThan(5);
  });
});

describe("generateTimespanTask", () => {
  it("durationMinutes ist positiv", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateTimespanTask(1).durationMinutes).toBeGreaterThan(0);
    }
  });

  it("to = from + durationMinutes", () => {
    for (let i = 0; i < 20; i++) {
      const task = generateTimespanTask(2);
      const expected = addMinutes(task.from, task.durationMinutes);
      expect(timesEqual(task.to, expected)).toBe(true);
    }
  });
});

describe("generateCalendarTask", () => {
  it("day liegt im gültigen Bereich des Monats", () => {
    for (let m = 1; m <= 12; m++) {
      const task = generateCalendarTask(2024, m);
      expect(task.day).toBeGreaterThanOrEqual(1);
      expect(task.day).toBeLessThanOrEqual(daysInMonth(2024, m));
    }
  });

  it("year und month bleiben unverändert", () => {
    const task = generateCalendarTask(2024, 3);
    expect(task.year).toBe(2024);
    expect(task.month).toBe(3);
  });
});

