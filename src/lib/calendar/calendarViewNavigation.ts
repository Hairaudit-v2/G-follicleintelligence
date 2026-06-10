/**
 * Central helpers for FI calendar URL updates (day / week / month, resource views, filters).
 * Keeps navigation consistent with {@link mergeCalendarHrefQuery} / {@link buildCalendarHref}.
 */

import {
  buildCalendarHref,
  mergeCalendarHrefQuery,
  type CalendarHrefQuery,
  type CalendarRoute,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";

/** Merge a patch onto the parsed calendar query (pure). */
export function updateCalendarSearchParams(
  current: ParsedCalendarQuery,
  patch: CalendarHrefQuery
): CalendarHrefQuery {
  return mergeCalendarHrefQuery(current, patch);
}

/** Full path + query string for a tenant calendar navigation step. */
export function buildCalendarNavigationHref(
  tenantId: string,
  current: ParsedCalendarQuery,
  patch: CalendarHrefQuery,
  opts?: { route?: CalendarRoute }
): string {
  return buildCalendarHref(tenantId, updateCalendarSearchParams(current, patch), opts);
}
