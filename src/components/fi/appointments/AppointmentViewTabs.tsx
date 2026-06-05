"use client";

import Link from "next/link";
import { buildAppointmentsHref } from "@/src/lib/bookings/appointmentsQuery";
import type { ParsedAppointmentsQuery } from "@/src/lib/bookings/appointmentsQuery";

export function AppointmentViewTabs({
  tenantId,
  query,
}: {
  tenantId: string;
  query: ParsedAppointmentsQuery;
}) {
  const baseFilters = {
    view: query.calendar.view,
    date: query.calendar.dateAnchor,
    status: query.operator.status ?? undefined,
    type: query.operator.bookingType ?? undefined,
    assignedUserId: query.operator.assignedUserId ?? undefined,
    clinicId: query.operator.clinicId ?? undefined,
    includeCancelled: query.operator.includeCancelled ? true : undefined,
  };

  const calendarHref = buildAppointmentsHref(tenantId, { tab: "calendar", ...baseFilters });
  const listHref = buildAppointmentsHref(tenantId, {
    tab: "list",
    start: query.operator.startIso,
    end: query.operator.endIso,
    status: baseFilters.status,
    type: baseFilters.type,
    assignedUserId: baseFilters.assignedUserId,
    clinicId: baseFilters.clinicId,
    includeCancelled: baseFilters.includeCancelled,
  });
  const todayHref = buildAppointmentsHref(tenantId, {
    tab: "today",
    assignedUserId: baseFilters.assignedUserId,
    type: baseFilters.type,
    status: baseFilters.status,
    clinicId: baseFilters.clinicId,
  });

  const tab = query.tab;

  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm shadow-sm">
      <Link
        href={calendarHref}
        className={`rounded-md px-3 py-1.5 font-medium ${tab === "calendar" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50"}`}
      >
        Calendar
      </Link>
      <Link
        href={listHref}
        className={`rounded-md px-3 py-1.5 font-medium ${tab === "list" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50"}`}
      >
        List
      </Link>
      <Link
        href={todayHref}
        className={`rounded-md px-3 py-1.5 font-medium ${tab === "today" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50"}`}
      >
        Today
      </Link>
    </div>
  );
}
