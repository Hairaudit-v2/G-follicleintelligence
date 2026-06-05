import "server-only";

import type { CalendarViewData } from "./calendarLoader";
import { loadCalendarViewData } from "./calendarLoader";
import type { BookingsOperatorPageData } from "./bookingOperatorLoader";
import { loadBookingsOperatorPageData } from "./bookingOperatorLoader";
import { enrichCreatePrefillFromLead } from "./bookingLeadPrefill";
import { parseAppointmentsSearchParams, type ParsedAppointmentsQuery } from "./appointmentsQuery";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

export type AppointmentsPageData = {
  tenantId: string;
  query: ParsedAppointmentsQuery;
  operator: BookingsOperatorPageData;
  calendar: CalendarViewData | null;
  services: FiServiceRow[];
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
  const [operator, calendar, services] = await Promise.all([
    loadBookingsOperatorPageData(tid, searchParams),
    query.tab === "calendar" ? loadCalendarViewData(tid, searchParams) : Promise.resolve(null),
    loadFiServicesForTenant(tid),
  ]);
  const calendarOut = calendar ? { ...calendar, services } : null;
  return { tenantId: tid, query, operator, calendar: calendarOut, services };
}
