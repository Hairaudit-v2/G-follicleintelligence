"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AppointmentsPageData } from "@/src/lib/bookings/appointmentsPageLoader";
import { AppointmentCalendar } from "./AppointmentCalendar";
import { AppointmentFiltersBar } from "./AppointmentFiltersBar";
import { AppointmentListTable } from "./AppointmentListTable";
import { AppointmentTodayView } from "./AppointmentTodayView";
import { AppointmentViewTabs } from "./AppointmentViewTabs";
import { useAppointmentSlideOver } from "./AppointmentSlideOver";

export function AppointmentsPage({ data }: { data: AppointmentsPageData }) {
  const searchParams = useSearchParams();
  const slide = useAppointmentSlideOver();
  const [showFilters, setShowFilters] = useState(false);

  const { tenantId, query, operator, calendar } = data;

  useEffect(() => {
    const wantsCreate =
      searchParams.get("create") === "1" ||
      searchParams.get("new") === "1" ||
      searchParams.get("openCreate") === "1";
    if (!wantsCreate) return;
    slide.openCreateAppointment(query.createPrefill ?? undefined);
  }, [searchParams, query.createPrefill, slide]);

  const sortedList = useMemo(
    () => [...operator.bookings].sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at)),
    [operator.bookings]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-gray-900">Appointments</h1>
          <p className="text-sm text-gray-600">
            Calendar, list, and today views for Evolved Hair Clinics scheduling. Click a row or drag on the calendar;
            use New appointment for lead-aware booking.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppointmentViewTabs tenantId={tenantId} query={query} />
          <button
            type="button"
            className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            onClick={() =>
              slide.openCreateAppointment({
                assignedStaffId: operator.query.assignedStaffId ?? undefined,
              })
            }
          >
            New appointment
          </button>
          <button
            type="button"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-50"
            onClick={() => setShowFilters((v) => !v)}
          >
            {showFilters ? "Hide filters" : "Filters"}
          </button>
        </div>
      </header>

      {showFilters ? (
        <AppointmentFiltersBar
          tenantId={tenantId}
          tab={query.tab}
          query={query}
          clinicalStaffOptions={operator.clinicalStaffOptions}
          clinics={operator.clinics}
          calendarTimezone={operator.calendarTimezone}
        />
      ) : null}

      {operator.listTruncated && query.tab !== "calendar" ? (
        <p className="text-xs text-amber-800">List capped — narrow your date range or filters.</p>
      ) : null}

      {query.tab === "calendar" && calendar ? (
        <AppointmentCalendar data={calendar} />
      ) : null}

      {query.tab === "list" ? (
        <AppointmentListTable
          tenantId={tenantId}
          bookings={sortedList}
          clinicalStaffOptions={operator.clinicalStaffOptions}
          userAssignees={operator.assignees}
          clinics={operator.clinics}
        />
      ) : null}

      {query.tab === "today" ? (
        <AppointmentTodayView
          tenantId={tenantId}
          bookings={operator.bookings}
          clinicalStaffOptions={operator.clinicalStaffOptions}
          userAssignees={operator.assignees}
          clinics={operator.clinics}
          nowIso={operator.groupingNowIso}
        />
      ) : null}
    </div>
  );
}
