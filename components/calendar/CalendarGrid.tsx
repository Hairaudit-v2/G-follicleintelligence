"use client";

/**
 * Day / 3-Day / Week time-grid calendar for Evolved Hair Clinics CRM.
 *
 * Always renders the full 8 AM–6 PM business window via {@link BusinessTimeSlotGrid}
 * inside {@link ProviderColumn} — empty columns stay structurally complete.
 *
 * @see lib/calendar/time-slots.ts — slot generation (20 × 30-min rows)
 * @see components/calendar/WeekView.tsx — underlying implementation
 */
export { WeekView as CalendarGrid, type WeekViewProps as CalendarGridProps } from "@/components/calendar/WeekView";

export { BusinessTimeSlotGrid, BusinessTimeGutter } from "@/components/calendar/BusinessTimeSlotGrid";
export {
  CALENDAR_TIME_SLOTS,
  generateCalendarTimeSlots,
  calendarGridBodyHeightPx,
  calendarSlotHeightPx,
  calendarSlotCount,
} from "@/lib/calendar/time-slots";
