/**
 * Pure calendar grid helpers (Stage 3C) — UTC calendar lanes aligned with URL `date` anchor.
 */

import type { FiBookingRow } from "./types";
import {
  parseUtcCalendarDateString,
  utcCalendarDateStringFromDate,
  utcMondayStartMsContaining,
  type ParsedCalendarQuery,
  type CalendarHrefQuery,
  type CalendarViewMode,
} from "./calendarQuery";

export type CalendarDayLane = {
  /** UTC `YYYY-MM-DD` key for bucketing. */
  dayKey: string;
  startMs: number;
  endMs: number;
  /** Short weekday label (UTC) for headers. */
  headingShortUtc: string;
};

function utcMidnightMsFromYmd(ymd: string): number {
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7)) - 1;
  const d = Number(ymd.slice(8, 10));
  return Date.UTC(y, mo, d, 0, 0, 0, 0);
}

function formatUtcWeekdayShort(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

/** Single UTC day lane for day view. */
export function buildCalendarDay(dateAnchor: string): CalendarDayLane[] {
  const ymd = parseUtcCalendarDateString(dateAnchor) ?? dateAnchor.trim();
  const startMs = utcMidnightMsFromYmd(ymd);
  const endMs = startMs + 86400000;
  const key = utcCalendarDateStringFromDate(new Date(startMs));
  return [{ dayKey: key, startMs, endMs, headingShortUtc: formatUtcWeekdayShort(startMs) }];
}

/** Monday→Sunday UTC lanes for the week containing `dateAnchor`. */
export function buildCalendarWeek(dateAnchor: string): CalendarDayLane[] {
  const ymd = parseUtcCalendarDateString(dateAnchor) ?? dateAnchor.trim();
  const anchorStart = utcMidnightMsFromYmd(ymd);
  const monday = utcMondayStartMsContaining(anchorStart);
  const days: CalendarDayLane[] = [];
  for (let i = 0; i < 7; i++) {
    const startMs = monday + i * 86400000;
    const endMs = startMs + 86400000;
    const dayKey = utcCalendarDateStringFromDate(new Date(startMs));
    days.push({ dayKey, startMs, endMs, headingShortUtc: formatUtcWeekdayShort(startMs) });
  }
  return days;
}

export function buildCalendarLanesForView(view: CalendarViewMode, dateAnchor: string): CalendarDayLane[] {
  return view === "day" ? buildCalendarDay(dateAnchor) : buildCalendarWeek(dateAnchor);
}

/** Bookings overlapping each lane (`start_at < lane.end` and `end_at > lane.start`). */
export function bucketBookingsIntoCalendar(
  bookings: FiBookingRow[],
  lanes: CalendarDayLane[]
): Map<string, FiBookingRow[]> {
  const map = new Map<string, FiBookingRow[]>();
  for (const lane of lanes) {
    map.set(lane.dayKey, []);
  }
  for (const b of bookings) {
    const s = Date.parse(b.start_at);
    const e = Date.parse(b.end_at);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    for (const lane of lanes) {
      if (s < lane.endMs && e > lane.startMs) {
        const arr = map.get(lane.dayKey);
        if (arr) arr.push(b);
      }
    }
  }
  for (const lane of lanes) {
    const arr = map.get(lane.dayKey);
    if (arr) {
      arr.sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
    }
  }
  return map;
}

export function addUtcDaysToCalendarDate(ymd: string, days: number): string {
  const normalized = parseUtcCalendarDateString(ymd) ?? ymd.trim();
  const ms = utcMidnightMsFromYmd(normalized) + days * 86400000;
  return utcCalendarDateStringFromDate(new Date(ms));
}

function filtersPatchFromQuery(q: ParsedCalendarQuery): CalendarHrefQuery {
  return {
    status: q.status ?? undefined,
    type: q.bookingType ?? undefined,
    assignedUserId: q.assignedUserId ?? undefined,
    clinicId: q.clinicId ?? undefined,
    includeCancelled: q.includeCancelled ? true : undefined,
    q: q.search?.trim() ? q.search.trim() : undefined,
  };
}

/**
 * Navigation deltas for calendar toolbar (UTC date anchor).
 * Week view shifts by 7 days; day view by 1 day. `today` only sets `date`.
 */
export const calendarNavigationHelpers = {
  previousPeriod(q: ParsedCalendarQuery): CalendarHrefQuery {
    const delta = q.view === "day" ? -1 : -7;
    return {
      view: q.view,
      date: addUtcDaysToCalendarDate(q.dateAnchor, delta),
      ...filtersPatchFromQuery(q),
    };
  },
  nextPeriod(q: ParsedCalendarQuery): CalendarHrefQuery {
    const delta = q.view === "day" ? 1 : 7;
    return {
      view: q.view,
      date: addUtcDaysToCalendarDate(q.dateAnchor, delta),
      ...filtersPatchFromQuery(q),
    };
  },
  goToToday(now: Date = new Date()): Pick<CalendarHrefQuery, "date"> {
    return { date: utcCalendarDateStringFromDate(now) };
  },
};

/** One-hour UTC slot starting at `hour` (0–23) on `dayKey` (`YYYY-MM-DD`). */
export function utcHourSlotIsoRange(dayKey: string, hour: number): { startIso: string; endIso: string } | null {
  const ymd = parseUtcCalendarDateString(dayKey);
  if (!ymd) return null;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7)) - 1;
  const d = Number(ymd.slice(8, 10));
  const startMs = Date.UTC(y, mo, d, hour, 0, 0, 0);
  const endMs = Date.UTC(y, mo, d, hour + 1, 0, 0, 0);
  return { startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() };
}

export const CALENDAR_GRID_PX_PER_HOUR = 44;

export const CALENDAR_DAY_COLUMN_HEIGHT_PX = 24 * CALENDAR_GRID_PX_PER_HOUR;

/**
 * Vertical placement within a UTC calendar-day column (`lane` midnight bounds).
 * Returns pixel offsets using {@link CALENDAR_GRID_PX_PER_HOUR}.
 */
export function layoutBookingUtcDayColumn(
  booking: FiBookingRow,
  lane: CalendarDayLane
): { topPx: number; heightPx: number } | null {
  const s = Date.parse(booking.start_at);
  const e = Date.parse(booking.end_at);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  const clampS = Math.max(s, lane.startMs);
  const clampE = Math.min(e, lane.endMs);
  if (clampE <= clampS) return null;
  const start = new Date(clampS);
  const minsFromMidnight =
    start.getUTCHours() * 60 + start.getUTCMinutes() + start.getUTCSeconds() / 60 + start.getUTCMilliseconds() / 60000;
  const durMin = (clampE - clampS) / 60000;
  const topPx = (minsFromMidnight / 60) * CALENDAR_GRID_PX_PER_HOUR;
  const heightPx = Math.max((durMin / 60) * CALENDAR_GRID_PX_PER_HOUR, 22);
  return { topPx, heightPx };
}
