"use client";

/**
 * Day / 3-Day / Week time-grid calendar for Evolved Hair Clinics CRM.
 *
 * Renders the tenant business-hour window via {@link BusinessTimeSlotGrid} inside {@link ProviderColumn}
 * (wall-clock gutter labels + lane minutes; booking placement uses clinic IANA in `calendarTimezone.ts`).
 *
 * @see lib/calendar/time-slots.ts — slot rows and body height helpers
 * @see components/calendar/WeekView.tsx — underlying implementation
 */
export {
  WeekView as CalendarGrid,
  type WeekViewProps as CalendarGridProps,
} from "@/components/calendar/WeekView";

export {
  BusinessTimeSlotGrid,
  BusinessTimeGutter,
} from "@/components/calendar/BusinessTimeSlotGrid";
export {
  CALENDAR_TIME_SLOTS,
  generateCalendarTimeSlots,
  generateOperationalCalendarTimeSlots,
  calendarGridBodyHeightPx,
  calendarGridBodyHeightForBusinessHours,
  calendarSlotHeightPx,
  calendarSlotCount,
  formatWallClockMinutesFromMidnight,
  type OperationalGridHours,
} from "@/lib/calendar/time-slots";
