/**
 * Pure calendar grid helpers (Stage 3C) — clinic-local day lanes aligned with URL `date` anchor.
 */

import {
  addDaysToCalendarDate,
  addMonthsToCalendarDate,
  calendarDateStringFromInstant,
  DEFAULT_CALENDAR_TIMEZONE,
  formatWeekdayShort,
  isoFromLocalDayMinutes,
  localMondayStartMsContaining,
  normalizeCalendarTimezone,
  parseCalendarDateString,
  zonedMidnightUtcMs,
  zonedNextDayUtcMs,
} from "@/src/lib/calendar/calendarTimezone";
import type { FiBookingRow } from "./types";
import type { ParsedCalendarQuery, CalendarHrefQuery, CalendarViewMode } from "./calendarQuery";

export type CalendarDayLane = {
  /** Clinic-local `YYYY-MM-DD` key for bucketing. */
  dayKey: string;
  startMs: number;
  endMs: number;
  /** IANA timezone used to build this lane. */
  timeZone: string;
  /** Short weekday label in clinic timezone. */
  headingShortUtc: string;
};

function buildLane(dayKey: string, timeZone: string): CalendarDayLane | null {
  const tz = normalizeCalendarTimezone(timeZone);
  const startMs = zonedMidnightUtcMs(dayKey, tz);
  if (startMs == null) return null;
  const endMs = zonedNextDayUtcMs(dayKey, tz) ?? startMs + 86400000;
  return {
    dayKey,
    startMs,
    endMs,
    timeZone: tz,
    headingShortUtc: formatWeekdayShort(startMs, tz),
  };
}

/** Single clinic-local day lane for day view. */
export function buildCalendarDay(dateAnchor: string, timeZone: string = DEFAULT_CALENDAR_TIMEZONE): CalendarDayLane[] {
  const tz = normalizeCalendarTimezone(timeZone);
  const ymd = parseCalendarDateString(dateAnchor, tz) ?? dateAnchor.trim();
  const lane = buildLane(ymd, tz);
  return lane ? [lane] : [];
}

/** Three consecutive clinic-local day lanes starting at `dateAnchor`. */
export function buildCalendarThreeDay(dateAnchor: string, timeZone: string = DEFAULT_CALENDAR_TIMEZONE): CalendarDayLane[] {
  const tz = normalizeCalendarTimezone(timeZone);
  const ymd = parseCalendarDateString(dateAnchor, tz) ?? dateAnchor.trim();
  const days: CalendarDayLane[] = [];
  for (let i = 0; i < 3; i++) {
    const dayKey = addDaysToCalendarDate(ymd, i, tz);
    const lane = buildLane(dayKey, tz);
    if (lane) days.push(lane);
  }
  return days;
}

/** Monday→Sunday lanes for the week containing `dateAnchor` in clinic timezone. */
export function buildCalendarWeek(dateAnchor: string, timeZone: string = DEFAULT_CALENDAR_TIMEZONE): CalendarDayLane[] {
  const tz = normalizeCalendarTimezone(timeZone);
  const ymd = parseCalendarDateString(dateAnchor, tz) ?? dateAnchor.trim();
  const anchorStart = zonedMidnightUtcMs(ymd, tz);
  if (anchorStart == null) return [];
  const monday = localMondayStartMsContaining(anchorStart, tz);
  const mondayYmd = calendarDateStringFromInstant(new Date(monday), tz);
  const days: CalendarDayLane[] = [];
  for (let i = 0; i < 7; i++) {
    const dayKey = addDaysToCalendarDate(mondayYmd, i, tz);
    const lane = buildLane(dayKey, tz);
    if (lane) days.push(lane);
  }
  return days;
}

export function buildCalendarLanesForView(
  view: CalendarViewMode,
  dateAnchor: string,
  timeZone: string = DEFAULT_CALENDAR_TIMEZONE
): CalendarDayLane[] {
  if (view === "day") return buildCalendarDay(dateAnchor, timeZone);
  if (view === "3day") return buildCalendarThreeDay(dateAnchor, timeZone);
  if (view === "month") return buildCalendarMonth(dateAnchor, timeZone);
  return buildCalendarWeek(dateAnchor, timeZone);
}

/** Six-week Monday-start grid cells as day lanes (for month view bucketing). */
export function buildCalendarMonth(dateAnchor: string, timeZone: string = DEFAULT_CALENDAR_TIMEZONE): CalendarDayLane[] {
  const tz = normalizeCalendarTimezone(timeZone);
  const anchor = parseCalendarDateString(dateAnchor, tz) ?? dateAnchor.trim();
  const anchorMs = zonedMidnightUtcMs(anchor, tz);
  if (anchorMs == null) return [];

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
  })
    .formatToParts(new Date(anchorMs))
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  const year = Number(parts.year);
  const monthIndex = Number(parts.month) - 1;
  const firstYmd = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const firstMs = zonedMidnightUtcMs(firstYmd, tz) ?? anchorMs;
  const gridStartMs = localMondayStartMsContaining(firstMs, tz);
  const lanes: CalendarDayLane[] = [];
  const firstDayKey = calendarDateStringFromInstant(new Date(gridStartMs), tz);

  for (let i = 0; i < 42; i++) {
    const dayKey = addDaysToCalendarDate(firstDayKey, i, tz);
    const lane = buildLane(dayKey, tz);
    if (lane) lanes.push(lane);
  }

  return lanes;
}

export function calendarViewPeriodStepDays(view: CalendarViewMode): number | "month" {
  if (view === "day") return 1;
  if (view === "3day") return 3;
  if (view === "month") return "month";
  return 7;
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
  return addDaysToCalendarDate(ymd, days, DEFAULT_CALENDAR_TIMEZONE);
}

function filtersPatchFromQuery(q: ParsedCalendarQuery): CalendarHrefQuery {
  return {
    status: q.status ?? undefined,
    type: q.bookingType ?? undefined,
    assignedUserId: q.assignedUserId ?? undefined,
    staffId: q.staffId ?? undefined,
    clinicId: q.clinicId ?? undefined,
    role: q.staffId?.trim() ? undefined : q.staffRoleBucket ?? undefined,
    includeCancelled: q.includeCancelled ? true : undefined,
    q: q.search?.trim() ? q.search.trim() : undefined,
    sample: q.sampleMode ? true : undefined,
    waiting: q.waitingOnly ? true : undefined,
    unassigned: q.unassignedOnly ? true : undefined,
  };
}

/**
 * Navigation deltas for calendar toolbar (clinic-local date anchor).
 */
export const calendarNavigationHelpers = {
  previousPeriod(q: ParsedCalendarQuery): CalendarHrefQuery {
    const tz = q.calendarTimezone;
    const step = calendarViewPeriodStepDays(q.view);
    if (step === "month") {
      return {
        view: q.view,
        date: addMonthsToCalendarDate(q.dateAnchor, -1, tz),
        ...filtersPatchFromQuery(q),
      };
    }
    return {
      view: q.view,
      date: addDaysToCalendarDate(q.dateAnchor, -step, tz),
      ...filtersPatchFromQuery(q),
    };
  },
  nextPeriod(q: ParsedCalendarQuery): CalendarHrefQuery {
    const tz = q.calendarTimezone;
    const step = calendarViewPeriodStepDays(q.view);
    if (step === "month") {
      return {
        view: q.view,
        date: addMonthsToCalendarDate(q.dateAnchor, 1, tz),
        ...filtersPatchFromQuery(q),
      };
    }
    return {
      view: q.view,
      date: addDaysToCalendarDate(q.dateAnchor, step, tz),
      ...filtersPatchFromQuery(q),
    };
  },
  goToToday(now: Date = new Date(), timeZone: string = DEFAULT_CALENDAR_TIMEZONE): Pick<CalendarHrefQuery, "date"> {
    return { date: calendarDateStringFromInstant(now, timeZone) };
  },
};

/** One-hour slot starting at `hour` (local clinic hour) on `dayKey`. */
export function utcHourSlotIsoRange(
  dayKey: string,
  hour: number,
  timeZone: string = DEFAULT_CALENDAR_TIMEZONE
): { startIso: string; endIso: string } | null {
  const tz = normalizeCalendarTimezone(timeZone);
  const ymd = parseCalendarDateString(dayKey, tz);
  if (!ymd) return null;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  const startMs = zonedMidnightUtcMs(ymd, tz);
  if (startMs == null) return null;
  if (tz === DEFAULT_CALENDAR_TIMEZONE) {
    const y = Number(ymd.slice(0, 4));
    const mo = Number(ymd.slice(5, 7)) - 1;
    const d = Number(ymd.slice(8, 10));
    const utcStart = Date.UTC(y, mo, d, hour, 0, 0, 0);
    const utcEnd = Date.UTC(y, mo, d, hour + 1, 0, 0, 0);
    return { startIso: new Date(utcStart).toISOString(), endIso: new Date(utcEnd).toISOString() };
  }
  const startIso = isoFromLocalDayMinutes(ymd, hour * 60, tz);
  const endIso = isoFromLocalDayMinutes(ymd, (hour + 1) * 60, tz);
  if (!startIso || !endIso) return null;
  return { startIso, endIso };
}

export const CALENDAR_GRID_PX_PER_HOUR = 44;

export const CALENDAR_DAY_COLUMN_HEIGHT_PX = 24 * CALENDAR_GRID_PX_PER_HOUR;

/**
 * Vertical placement within a calendar-day column (`lane` midnight bounds).
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
  const minsFromMidnight = (clampS - lane.startMs) / 60000;
  const durMin = (clampE - clampS) / 60000;
  const topPx = (minsFromMidnight / 60) * CALENDAR_GRID_PX_PER_HOUR;
  const heightPx = Math.max((durMin / 60) * CALENDAR_GRID_PX_PER_HOUR, 22);
  return { topPx, heightPx };
}
