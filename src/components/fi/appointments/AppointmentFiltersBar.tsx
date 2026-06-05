"use client";

import { buildAppointmentsHref } from "@/src/lib/bookings/appointmentsQuery";
import type { AppointmentsTab, ParsedAppointmentsQuery } from "@/src/lib/bookings/appointmentsQuery";
import {
  allBookingStatusOptions,
  allBookingTypeOptions,
} from "@/src/lib/bookings/operatorBookingLabels";
import { toDatetimeLocalValue } from "@/src/components/fi/bookings/bookingFormUtils";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";

export function AppointmentFiltersBar({
  tenantId,
  tab,
  query,
  assignees,
  clinics,
}: {
  tenantId: string;
  tab: AppointmentsTab;
  query: ParsedAppointmentsQuery;
  assignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
}) {
  const action = buildAppointmentsHref(tenantId, { tab });

  return (
    <form method="get" action={action} className="space-y-3 rounded border border-gray-200 bg-gray-50 p-4">
      <input type="hidden" name="tab" value={tab} />
      {tab === "calendar" ? (
        <>
          <input type="hidden" name="view" value={query.calendar.view} />
          <input type="hidden" name="date" value={query.calendar.dateAnchor} />
        </>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {tab === "list" ? (
          <>
            <label className="block text-xs font-medium text-gray-700">
              Range start
              <input
                name="start"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(query.operator.startIso)}
                className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Range end
              <input
                name="end"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(query.operator.endIso)}
                className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
          </>
        ) : null}
        <label className="block text-xs font-medium text-gray-700">
          Staff
          <select
            name="assignedUserId"
            defaultValue={query.operator.assignedUserId ?? query.calendar.assignedUserId ?? ""}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All staff</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email?.trim() || u.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Procedure type
          <select
            name="type"
            defaultValue={query.operator.bookingType ?? query.calendar.bookingType ?? ""}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            {allBookingTypeOptions().map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Status
          <select
            name="status"
            defaultValue={query.operator.status ?? query.calendar.status ?? ""}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            {allBookingStatusOptions().map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Clinic
          <select
            name="clinicId"
            defaultValue={query.operator.clinicId ?? query.calendar.clinicId ?? ""}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-1 text-xs text-gray-700">
          <input
            type="checkbox"
            name="includeCancelled"
            value="1"
            defaultChecked={query.operator.includeCancelled || query.calendar.includeCancelled}
          />
          Include cancelled
        </label>
      </div>
      <button type="submit" className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800">
        Apply filters
      </button>
    </form>
  );
}
