"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BookingsOperatorPageData } from "@/src/lib/bookings/bookingOperatorLoader";
import { DEFAULT_OPERATOR_BOOKINGS_LIMIT } from "@/src/lib/bookings/operatorBookingConstants";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { BookingEditDrawer } from "./BookingEditDrawer";
import { BookingFiltersBar } from "./BookingFiltersBar";
import { BookingOperatorTable } from "./BookingOperatorTable";
import { BookingQuickCreatePanel } from "./BookingQuickCreatePanel";

export function BookingOperatorPage({ data }: { data: BookingsOperatorPageData }) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [editing, setEditing] = useState<FiBookingRow | null>(null);

  function refresh() {
    router.refresh();
  }

  const { tenantId, query, bookings, reminderJobsByBookingId, assignees, clinicalStaffOptions, clinics, summaryCounts, summaryTruncated, listTruncated, calendarTimezone, services } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold text-gray-900">Bookings</h1>
        <p className="text-sm text-gray-600">
          Use the{" "}
          <Link className="text-blue-600 underline hover:text-blue-800" href={`/fi-admin/${tenantId}/calendar`}>
            Calendar
          </Link>{" "}
          for week/day scheduling. This page is the operational booking list — filter, create, and complete work in a
          dense table.
        </p>
        <p className="text-sm text-gray-600">
          Cancelled bookings are locked except for cancellation details (server policy); use the list to review reasons.
        </p>
        <label className="block max-w-md text-xs text-gray-600">
          FI Admin key (optional — paste when your session role cannot write via service actions alone)
          <input
            type="password"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 font-mono text-sm"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            autoComplete="off"
          />
        </label>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Today (clinic calendar day)</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{summaryCounts.today}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Upcoming (active)</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{summaryCounts.upcoming}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Overdue / past incomplete</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900">{summaryCounts.overdue}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Cancelled (in summary window)</p>
          <p className="mt-1 text-2xl font-semibold text-gray-700">{summaryCounts.cancelled}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Completed (in summary window)</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">{summaryCounts.completed}</p>
        </div>
      </section>
      {summaryTruncated ? (
        <p className="text-xs text-amber-800">
          Summary counts may be capped: more than the configured maximum bookings overlap the internal summary window.
          Narrow your list filters or extend the range in a follow-up if needed.
        </p>
      ) : null}

      {listTruncated ? (
        <p className="text-xs text-amber-800">
          The booking list hit the row cap for this query ({bookings.length} rows shown, cap{" "}
          {DEFAULT_OPERATOR_BOOKINGS_LIMIT}). Narrow your date range or filters.
        </p>
      ) : null}

      <BookingFiltersBar tenantId={tenantId} query={query} clinicalStaffOptions={clinicalStaffOptions} clinics={clinics} />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(16rem,22rem)]">
        <BookingOperatorTable
          tenantId={tenantId}
          bookings={bookings}
          clinicalStaffOptions={clinicalStaffOptions}
          userAssignees={assignees}
          clinics={clinics}
          adminKey={adminKey}
          onEdit={setEditing}
          onChanged={refresh}
        />
        <BookingQuickCreatePanel
          tenantId={tenantId}
          clinicalStaffOptions={clinicalStaffOptions}
          clinics={clinics}
          adminKey={adminKey}
          calendarTimezone={calendarTimezone}
          services={services}
          onCreated={refresh}
        />
      </div>

      <BookingEditDrawer
        tenantId={tenantId}
        booking={editing}
        reminderJobs={editing ? reminderJobsByBookingId[editing.id] ?? [] : []}
        clinicalStaffOptions={clinicalStaffOptions}
        clinics={clinics}
        adminKey={adminKey}
        clinicCalendarTimezone={calendarTimezone}
        services={services}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  );
}
