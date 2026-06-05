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
