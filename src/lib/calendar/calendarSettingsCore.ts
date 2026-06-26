/**
 * Pure calendar display settings (GC-11) — validation, defaults, and query/lane helpers.
 */

import type { CalendarResourceView, CalendarViewMode, ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import { formatWeekdayShort } from "@/src/lib/calendar/calendarTimezone";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";

export type FiCalendarSlotMinutes = 15 | 30 | 60;

export type FiCalendarSettingsDocument = {
  dayStartHour: number;
  dayEndHour: number;
  slotMinutes: FiCalendarSlotMinutes;
  defaultView: CalendarViewMode;
  showWeekends: boolean;
  bufferMinutes: number;
  resourceColumnMode: CalendarResourceView;
  showCancelledBookings: boolean;
};

export const DEFAULT_CALENDAR_SETTINGS: FiCalendarSettingsDocument = {
  dayStartHour: 6,
  dayEndHour: 19,
  slotMinutes: 15,
  defaultView: "week",
  showWeekends: false,
  bufferMinutes: 15,
  resourceColumnMode: "staff",
  showCancelledBookings: false,
};

const SLOT_MINUTES_SET = new Set<FiCalendarSlotMinutes>([15, 30, 60]);
const VIEW_SET = new Set<CalendarViewMode>(["day", "3day", "week", "month"]);
const RESOURCE_MODE_SET = new Set<CalendarResourceView>(["staff", "room", "clinic"]);

function parseViewMode(raw: unknown): CalendarViewMode {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "day") return "day";
  if (v === "3day" || v === "3-day" || v === "three_day") return "3day";
  if (v === "month") return "month";
  return "week";
}

function parseResourceMode(raw: unknown): CalendarResourceView {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "room" || v === "clinic") return v;
  return "staff";
}

function parseSlotMinutes(raw: unknown): FiCalendarSlotMinutes {
  const n = Number(raw);
  if (n === 15 || n === 30 || n === 60) return n;
  return DEFAULT_CALENDAR_SETTINGS.slotMinutes;
}

export type CalendarSettingsValidationResult =
  | { ok: true; document: FiCalendarSettingsDocument }
  | { ok: false; error: string };

/** Validates user input; returns normalized document or a single error message. */
export function validateCalendarSettingsInput(raw: unknown): CalendarSettingsValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Invalid settings payload." };
  }
  const o = raw as Record<string, unknown>;

  const dayStartHour = Number(o.dayStartHour);
  const dayEndHour = Number(o.dayEndHour);
  if (!Number.isFinite(dayStartHour) || dayStartHour < 0 || dayStartHour > 23) {
    return { ok: false, error: "Visible day start must be between 0 and 23." };
  }
  if (!Number.isFinite(dayEndHour) || dayEndHour < 1 || dayEndHour > 24) {
    return { ok: false, error: "Visible day end must be between 1 and 24." };
  }
  if (dayEndHour <= dayStartHour) {
    return { ok: false, error: "Visible day end must be after visible day start." };
  }

  const slotMinutes = parseSlotMinutes(o.slotMinutes);
  const defaultView = parseViewMode(o.defaultView);
  if (!VIEW_SET.has(defaultView)) {
    return { ok: false, error: "Invalid default view." };
  }

  const bufferMinutes = Number(o.bufferMinutes);
  if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 120) {
    return { ok: false, error: "Buffer minutes must be between 0 and 120." };
  }

  const resourceColumnMode = parseResourceMode(o.resourceColumnMode);
  if (!RESOURCE_MODE_SET.has(resourceColumnMode)) {
    return { ok: false, error: "Invalid resource column mode." };
  }

  return {
    ok: true,
    document: {
      dayStartHour: Math.floor(dayStartHour),
      dayEndHour: Math.floor(dayEndHour),
      slotMinutes: SLOT_MINUTES_SET.has(slotMinutes) ? slotMinutes : DEFAULT_CALENDAR_SETTINGS.slotMinutes,
      defaultView,
      showWeekends: Boolean(o.showWeekends),
      bufferMinutes: Math.floor(bufferMinutes),
      resourceColumnMode,
      showCancelledBookings: Boolean(o.showCancelledBookings),
    },
  };
}

export function calendarSettingsToGridConfig(
  settings: FiCalendarSettingsDocument,
  timeZone: string
): BusinessGridConfig {
  return {
    dayStartHourUtc: settings.dayStartHour,
    dayEndHourUtc: settings.dayEndHour,
    slotMinutes: settings.slotMinutes,
    timeZone,
  };
}

export function mergeCalendarSettingsFromStorage(row: {
  day_start_hour: number;
  day_end_hour: number;
  slot_minutes: number;
  default_view: string;
  show_weekends: boolean;
  buffer_minutes: number;
  resource_column_mode: string;
  show_cancelled_bookings: boolean;
}): FiCalendarSettingsDocument {
  const validated = validateCalendarSettingsInput({
    dayStartHour: row.day_start_hour,
    dayEndHour: row.day_end_hour,
    slotMinutes: row.slot_minutes,
    defaultView: row.default_view,
    showWeekends: row.show_weekends,
    bufferMinutes: row.buffer_minutes,
    resourceColumnMode: row.resource_column_mode,
    showCancelledBookings: row.show_cancelled_bookings,
  });
  return validated.ok ? validated.document : { ...DEFAULT_CALENDAR_SETTINGS };
}

function firstSearchParam(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? String(v[0] ?? "") : String(v);
}

function parseBoolParam(v: string | string[] | undefined): boolean {
  const s = firstSearchParam(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/**
 * Applies tenant calendar settings when URL params are absent (default view, resource mode, cancelled visibility).
 */
export function applyCalendarSettingsToQuery(
  query: ParsedCalendarQuery,
  settings: FiCalendarSettingsDocument,
  searchParams: Record<string, string | string[] | undefined>
): ParsedCalendarQuery {
  const hasView = Boolean(firstSearchParam(searchParams.view).trim());
  const hasResourceView = Boolean(firstSearchParam(searchParams.resourceView).trim());
  const hasIncludeCancelled = firstSearchParam(searchParams.includeCancelled).trim() !== "";

  let next = query;

  if (!hasView && settings.defaultView !== query.view) {
    next = { ...next, view: settings.defaultView };
  }

  if (!hasResourceView && settings.resourceColumnMode !== query.resourceView) {
    next = { ...next, resourceView: settings.resourceColumnMode };
  }

  if (!hasIncludeCancelled && settings.showCancelledBookings !== query.includeCancelled) {
    next = { ...next, includeCancelled: settings.showCancelledBookings };
  }

  return next;
}

/** Builds redirect href when implicit settings differ from parsed URL defaults. */
export function calendarSettingsRedirectNeeded(
  before: ParsedCalendarQuery,
  after: ParsedCalendarQuery
): boolean {
  return (
    before.view !== after.view ||
    before.resourceView !== after.resourceView ||
    before.includeCancelled !== after.includeCancelled
  );
}

/** Filters Sat/Sun lanes from week/3day/day grids when weekends are hidden. Month uses {@link filterMonthCellsForWeekends}. */
export function filterCalendarLanesForWeekends(
  lanes: CalendarDayLane[],
  view: CalendarViewMode,
  showWeekends: boolean
): CalendarDayLane[] {
  if (showWeekends || view === "month") return lanes;
  return lanes.filter((lane) => {
    const dow = formatWeekdayShort(lane.startMs, lane.timeZone);
    return dow !== "Sat" && dow !== "Sun";
  });
}

export type MonthGridCellLike = { dayKey: string; isWeekend: boolean };

/** Month view: hide weekend columns when `showWeekends` is false. */
export function filterMonthCellsForWeekends<T extends MonthGridCellLike>(
  cells: T[],
  showWeekends: boolean
): T[] {
  if (showWeekends) return cells;
  return cells.filter((c) => !c.isWeekend);
}

export function calendarSettingsDocumentToRowPayload(
  tenantId: string,
  clinicId: string | null,
  doc: FiCalendarSettingsDocument
) {
  return {
    tenant_id: tenantId,
    clinic_id: clinicId,
    day_start_hour: doc.dayStartHour,
    day_end_hour: doc.dayEndHour,
    slot_minutes: doc.slotMinutes,
    default_view: doc.defaultView,
    show_weekends: doc.showWeekends,
    buffer_minutes: doc.bufferMinutes,
    resource_column_mode: doc.resourceColumnMode,
    show_cancelled_bookings: doc.showCancelledBookings,
    updated_at: new Date().toISOString(),
  };
}
