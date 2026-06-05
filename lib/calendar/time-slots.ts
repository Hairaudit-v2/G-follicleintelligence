/**
 * Fixed business-day time slots for the Evolved Hair Clinics CRM calendar grid.
 * Ensures the grid always renders the full 8 AM–6 PM window, even with zero appointments.
 */

export type CalendarTimeSlot = {
  start: string;
  end: string;
  label: string;
};

/** Inclusive start of the visible day (8:00 AM). */
export const CALENDAR_DAY_START_HOUR = 8;

/** Exclusive end of the visible day (6:00 PM). */
export const CALENDAR_DAY_END_HOUR = 18;

export const CALENDAR_SLOT_MINUTES = 30;

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
};

function formatUtcMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return new Date(Date.UTC(2000, 0, 1, hours, minutes, 0)).toLocaleTimeString(undefined, TIME_FORMAT);
}

/**
 * Build every 30-minute slot from 8:00 AM through 6:00 PM (20 slots).
 * `start` / `end` are localized short times; `label` is the slot range.
 */
export function generateCalendarTimeSlots(): CalendarTimeSlot[] {
  const startMinutes = CALENDAR_DAY_START_HOUR * 60;
  const endMinutes = CALENDAR_DAY_END_HOUR * 60;
  const slots: CalendarTimeSlot[] = [];

  for (let cursor = startMinutes; cursor < endMinutes; cursor += CALENDAR_SLOT_MINUTES) {
    const slotEnd = cursor + CALENDAR_SLOT_MINUTES;
    const start = formatUtcMinutes(cursor);
    const end = formatUtcMinutes(slotEnd);
    slots.push({
      start,
      end,
      label: `${start} – ${end}`,
    });
  }

  return slots;
}

/** Precomputed slots — same window as {@link DEFAULT_BUSINESS_GRID} in operational layout. */
export const CALENDAR_TIME_SLOTS: readonly CalendarTimeSlot[] = generateCalendarTimeSlots();

/** Pixel height of one hour row in the CRM calendar grid. */
export const CALENDAR_PX_PER_HOUR = 56;

/** Height of one 30-minute slot row in pixels. */
export function calendarSlotHeightPx(pxPerHour: number = CALENDAR_PX_PER_HOUR): number {
  return (pxPerHour * CALENDAR_SLOT_MINUTES) / 60;
}

/** Total grid body height for the fixed business-day window (20 × 30-min slots). */
export function calendarGridBodyHeightPx(pxPerHour: number = CALENDAR_PX_PER_HOUR): number {
  return CALENDAR_TIME_SLOTS.length * calendarSlotHeightPx(pxPerHour);
}

/** Number of visible 30-minute slots (20 for 8 AM–6 PM). */
export function calendarSlotCount(): number {
  return CALENDAR_TIME_SLOTS.length;
}

/** 0-based slot index for UTC minutes-from-midnight within the business window. */
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
