/**
 * CalendarOS V2 — weekday helpers for workforce block derivation.
 */

import { zonedMidnightUtcMs } from "@/src/lib/calendar/calendarTimezone";
import type { StaffWeekdayKey } from "@/src/lib/staff/staffWeeklyHours";

const WEEKDAY_TO_KEY: Record<number, StaffWeekdayKey> = {
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
  0: "sun",
};

/** Map clinic-local `YYYY-MM-DD` to staff weekly hours key. */
export function weekdayKeyFromDayKey(
  dayKey: string,
  timeZone: string
): StaffWeekdayKey | null {
  const ms = zonedMidnightUtcMs(dayKey.trim(), timeZone);
  if (ms == null) return null;
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone })
    .formatToParts(new Date(ms))
    .find((p) => p.type === "weekday")?.value;
  if (!weekday) return null;
  const map: Record<string, StaffWeekdayKey> = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
    Sun: "sun",
  };
  return map[weekday] ?? null;
}

export function weekdayIndexFromDayKey(dayKey: string, timeZone: string): number | null {
  const ms = zonedMidnightUtcMs(dayKey.trim(), timeZone);
  if (ms == null) return null;
  const parts = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).formatToParts(
    new Date(ms)
  );
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return weekday != null ? (map[weekday] ?? null) : null;
}

export { WEEKDAY_TO_KEY };
