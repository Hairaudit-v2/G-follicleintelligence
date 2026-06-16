import type { CalendarViewMode } from "@/src/lib/bookings/calendarQuery";

/**
 * Month grid renders lightweight pills only — skip expensive per-booking enrichment queries
 * (clinical scales + multi-resource assignment rows) while keeping anchor labels from {@link loadBookingDisplayContextMaps}.
 *
 * Day / week / 3-day still run full enrichment in {@link loadOperationalCalendarPageData}.
 */
export function operationalCalendarSkipsHeavyEnrichment(view: CalendarViewMode): boolean {
  return view === "month";
}
