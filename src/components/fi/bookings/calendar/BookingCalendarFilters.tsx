"use client";

import {
  buildCalendarHref,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import {
  allBookingStatusOptions,
  allBookingTypeOptions,
} from "@/src/lib/bookings/operatorBookingLabels";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";

export function BookingCalendarFilters({
  tenantId,
  query,
  assignees,
  clinics,
}: {
  tenantId: string;
  query: ParsedCalendarQuery;
  assignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
}) {
  const action = buildCalendarHref(tenantId, {
    view: query.view,
    date: query.dateAnchor,
    sample: query.sampleMode ? true : undefined,
  });

  return (
    <form method="get" action={action} className="space-y-3 rounded border border-gray-200 bg-white p-4">
      <input type="hidden" name="view" value={query.view} />
      <input type="hidden" name="date" value={query.dateAnchor} />
      {query.sampleMode ? <input type="hidden" name="sample" value="1" /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input type="checkbox" name="includeCancelled" value="1" defaultChecked={query.includeCancelled} />
          Include cancelled
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">
          Apply filters
        </button>
        <a
          href={buildCalendarHref(tenantId, {
            view: query.view,
            date: query.dateAnchor,
            sample: query.sampleMode ? true : undefined,
          })}
          className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50"
        >
          Reset filters
        </a>
      </div>
      <p className="text-xs text-gray-500">
        Grid columns are labelled in UTC. Create and edit forms use your browser&apos;s local timezone for datetime fields.
      </p>
    </form>
  );
}
