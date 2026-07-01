import type { CalendarViewMode } from "@/src/lib/bookings/calendarQuery";

/**
 * CalendarOS v2 — all views use the lightweight operational feed instead of full patient/profile joins.
 * Month grid still uses abbreviated anchor labels; day/week get operational intelligence overlays.
 */
export function operationalCalendarSkipsHeavyEnrichment(_view: CalendarViewMode): boolean {
  return true;
}
