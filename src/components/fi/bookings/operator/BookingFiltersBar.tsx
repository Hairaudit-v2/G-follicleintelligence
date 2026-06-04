"use client";

import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import {
  allBookingStatusOptions,
  allBookingTypeOptions,
} from "@/src/lib/bookings/operatorBookingLabels";
import {
  buildOperatorBookingsHref,
  type ParsedOperatorBookingQuery,
} from "@/src/lib/bookings/operatorBookingQuery";
import { toDatetimeLocalValue } from "@/src/components/fi/bookings/bookingFormUtils";

export function BookingFiltersBar({
  tenantId,
  query,
  assignees,
  clinics,
}: {
  tenantId: string;
  query: ParsedOperatorBookingQuery;
  assignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
}) {
  const action = buildOperatorBookingsHref(tenantId, {});

  return (
    <form method="get" action={action} className="space-y-3 rounded border border-gray-200 bg-gray-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="block text-xs font-medium text-gray-700">
          Range start (local)
          <input
            name="start"
            type="datetime-local"
            defaultValue={toDatetimeLocalValue(query.startIso)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Range end (local)
          <input
            name="end"
            type="datetime-local"
            defaultValue={toDatetimeLocalValue(query.endIso)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Type
          <select
            name="type"
            defaultValue={query.bookingType ?? ""}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Any type</option>
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
            defaultValue={query.status ?? ""}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Any status</option>
            {allBookingStatusOptions().map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Assigned user
          <select
            name="assignedUserId"
            defaultValue={query.assignedUserId ?? ""}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Anyone</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email?.trim() || u.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Clinic
          <select
            name="clinicId"
            defaultValue={query.clinicId ?? ""}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Any clinic</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input type="checkbox" name="includeCancelled" value="1" defaultChecked={query.includeCancelled} />
        Include cancelled bookings in the list
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">
          Apply filters
        </button>
        <a
          href={buildOperatorBookingsHref(tenantId, {})}
          className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50"
        >
          Reset filters
        </a>
      </div>
    </form>
  );
}
