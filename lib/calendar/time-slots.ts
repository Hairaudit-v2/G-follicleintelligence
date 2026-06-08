/**
 * CRM calendar grid: business-day slot rows and gutter labels.
 *
 * Lane minutes and gutter text are clinic **wall-clock** (minutes from local midnight on the grid axis).
 * Do not interpret these hours through `Date` + IANA conversion — that mislabels 08:00 as an evening time
 * when a UTC anchor is shifted into Australia zones.
 *
 * Booking instants still use `calendarTimezone.ts` for ISO ↔ clinic-local placement.
 */

export type CalendarTimeSlot = {
  start: string;
  end: string;
  label: string;
};

/** Inclusive start of the default visible day (8:00 AM wall clock). */
export const CALENDAR_DAY_START_HOUR = 8;

/** Exclusive end of the default visible day (6:00 PM wall clock). */
export const CALENDAR_DAY_END_HOUR = 18;

export const CALENDAR_SLOT_MINUTES = 30;

/** Tenant / operational grid uses these field names (values are wall-clock hours, not UTC). */
export type OperationalGridHours = {
  dayStartHourUtc: number;
  dayEndHourUtc: number;
};

/**
 * Format minutes-from-local-midnight as a clock string using a fixed UTC calendar clock,
 * so the displayed hour/minute equals the wall values with no zone shift.
 */
export function formatWallClockMinutesFromMidnight(totalMinutes: number): string {
  const clamped = Math.max(0, totalMinutes);
  const h = Math.floor(clamped / 60);
  const m = Math.floor(clamped % 60);
  const ms = Date.UTC(1970, 0, 1, h, m, 0, 0);
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * Build 30-minute slot rows between configured clinic-local open/close hours (labels are wall-clock only).
 */
export function generateOperationalCalendarTimeSlots(grid: OperationalGridHours): CalendarTimeSlot[] {
  const startH = Math.floor(Number(grid.dayStartHourUtc));
  const endH = Math.floor(Number(grid.dayEndHourUtc));
  const startMinutes = Math.max(0, Math.min(23, startH)) * 60;
  const endMinutes = Math.max(startMinutes + CALENDAR_SLOT_MINUTES, Math.min(24, endH) * 60);
  const slots: CalendarTimeSlot[] = [];

  for (let cursor = startMinutes; cursor < endMinutes; cursor += CALENDAR_SLOT_MINUTES) {
    const slotEnd = cursor + CALENDAR_SLOT_MINUTES;
    const start = formatWallClockMinutesFromMidnight(cursor);
    const end = formatWallClockMinutesFromMidnight(slotEnd);
    slots.push({
      start,
      end,
      label: `${start} – ${end}`,
    });
  }

  return slots;
}

/** @deprecated Prefer {@link generateOperationalCalendarTimeSlots} with explicit hours. */
export function generateCalendarTimeSlots(): CalendarTimeSlot[] {
  return generateOperationalCalendarTimeSlots({
    dayStartHourUtc: CALENDAR_DAY_START_HOUR,
    dayEndHourUtc: CALENDAR_DAY_END_HOUR,
  });
}

/** Precomputed default 8–18 slots (wall-clock labels). */
export const CALENDAR_TIME_SLOTS: readonly CalendarTimeSlot[] = generateCalendarTimeSlots();

/** Pixel height of one hour row in the CRM calendar grid. */
export const CALENDAR_PX_PER_HOUR = 56;

/** Height of one 30-minute slot row in pixels. */
export function calendarSlotHeightPx(pxPerHour: number = CALENDAR_PX_PER_HOUR): number {
  return (pxPerHour * CALENDAR_SLOT_MINUTES) / 60;
}

/** Vertical body height for a business-hour window (same math as slot rows × slot height). */
export function calendarGridBodyHeightForBusinessHours(
  grid: OperationalGridHours,
  pxPerHour: number = CALENDAR_PX_PER_HOUR
): number {
  const hours = Math.max(1, Math.floor(grid.dayEndHourUtc) - Math.floor(grid.dayStartHourUtc));
  return hours * pxPerHour;
}

/** Total grid body height for the default 8–18 window. */
export function calendarGridBodyHeightPx(pxPerHour: number = CALENDAR_PX_PER_HOUR): number {
  return CALENDAR_TIME_SLOTS.length * calendarSlotHeightPx(pxPerHour);
}

/** Number of visible 30-minute slots for the given business window. */
export function operationalCalendarSlotCount(grid: OperationalGridHours): number {
  return generateOperationalCalendarTimeSlots(grid).length;
}

/** Number of visible 30-minute slots (20 for default 8 AM–6 PM). */
export function calendarSlotCount(): number {
  return CALENDAR_TIME_SLOTS.length;
}

/** 0-based slot index for local minutes-from-midnight within the default 8–18 business window. */
export function calendarSlotIndexFromMinutes(totalMinutes: number): number {
  const gridStart = CALENDAR_DAY_START_HOUR * 60;
  const rel = totalMinutes - gridStart;
  if (rel < 0) return 0;
  const idx = Math.floor(rel / CALENDAR_SLOT_MINUTES);
  return Math.min(idx, CALENDAR_TIME_SLOTS.length - 1);
}

/** Top offset (px) for a slot index in the grid. */
export function calendarSlotTopPx(slotIndex: number, pxPerHour: number = CALENDAR_PX_PER_HOUR): number {
  return slotIndex * calendarSlotHeightPx(pxPerHour);
}
