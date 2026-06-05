import "server-only";

import type { CalendarViewData } from "./calendarLoader";
import { loadCalendarViewData } from "./calendarLoader";
import type { BookingsOperatorPageData } from "./bookingOperatorLoader";
import { loadBookingsOperatorPageData } from "./bookingOperatorLoader";
import { enrichCreatePrefillFromLead } from "./bookingLeadPrefill";
import { parseAppointmentsSearchParams, type ParsedAppointmentsQuery } from "./appointmentsQuery";

export type AppointmentsPageData = {
  tenantId: string;
  query: ParsedAppointmentsQuery;
  operator: BookingsOperatorPageData;
  calendar: CalendarViewData | null;
};

export async function loadAppointmentsPageData(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>
): Promise<AppointmentsPageData> {
  const tid = tenantId.trim();
  let query = parseAppointmentsSearchParams(searchParams);
  if (query.openCreate && query.createPrefill?.leadId) {
    query = {
      ...query,
      createPrefill: await enrichCreatePrefillFromLead(tid, query.createPrefill),
    };
  }
  const [operator, calendar] = await Promise.all([
    loadBookingsOperatorPageData(tid, searchParams),
    query.tab === "calendar" ? loadCalendarViewData(tid, searchParams) : Promise.resolve(null),
  ]);
  return { tenantId: tid, query, operator, calendar };
}
