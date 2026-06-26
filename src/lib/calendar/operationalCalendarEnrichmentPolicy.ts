import type { CalendarViewMode } from "@/src/lib/bookings/calendarQuery";

/**
 * Month grid renders lightweight pills only — skip patient/lead/person lookups, clinical scales,
 * and multi-resource assignment rows. Anchor labels use booking title/type via
 * {@link optimisticBookingAnchorLabel} (see {@link loadOperationalCalendarGridData}).
 *
 * Day / week / 3-day still run full enrichment in {@link loadOperationalCalendarPageData}.
 */
export function operationalCalendarSkipsHeavyEnrichment(view: CalendarViewMode): boolean {
  return view === "month";
}
