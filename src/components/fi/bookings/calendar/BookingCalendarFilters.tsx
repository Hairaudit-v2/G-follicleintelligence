"use client";

import {
  buildCalendarHref,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import {
  allBookingStatusOptions,
  allBookingTypeOptions,
} from "@/src/lib/bookings/operatorBookingLabels";
import type { CrmShellClinicOption } from "@/src/lib/crm/types";
import { formatClinicalPickerOptionLabel, type ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";

export function BookingCalendarFilters({
  tenantId,
  query,
  clinicalStaffOptions,
  clinics,
}: {
  tenantId: string;
  query: ParsedCalendarQuery;
  clinicalStaffOptions: ClinicalStaffPickerOption[];
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
          Clinical provider
          <select
            name="staffId"
            defaultValue={query.staffId ?? ""}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Any provider</option>
            {clinicalStaffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {formatClinicalPickerOptionLabel(s)}
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
        Times use the tenant clinic timezone ({query.calendarTimezone}). Create and quick-edit fields use the same
        wall clock.
      </p>
    </form>
  );
}
