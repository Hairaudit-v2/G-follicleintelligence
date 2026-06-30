"use client";

import { buildAppointmentsHref } from "@/src/lib/bookings/appointmentsQuery";
import type { AppointmentsTab, ParsedAppointmentsQuery } from "@/src/lib/bookings/appointmentsQuery";
import {
  allBookingStatusOptions,
  allBookingTypeOptions,
} from "@/src/lib/bookings/operatorBookingLabels";
import { toDatetimeLocalValue } from "@/src/components/fi/bookings/bookingFormUtils";
import { formatClinicalPickerOptionLabel, type ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import type { CrmShellClinicOption } from "@/src/lib/crm/types";

export function AppointmentFiltersBar({
  tenantId,
  tab,
  query,
  clinicalStaffOptions,
  clinics,
  calendarTimezone,
}: {
  tenantId: string;
  tab: AppointmentsTab;
  query: ParsedAppointmentsQuery;
  clinicalStaffOptions: ClinicalStaffPickerOption[];
  clinics: CrmShellClinicOption[];
  calendarTimezone?: string | null;
}) {
  const tz = calendarTimezone?.trim() || null;
  const action = buildAppointmentsHref(tenantId, { tab });

  return (
    <form method="get" action={action} className="space-y-3 rounded border border-white/[0.08] bg-white/[0.03] p-4">
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
            <label className="block text-xs font-medium text-slate-300">
              Range start
              <input
                name="start"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(query.operator.startIso, tz)}
                className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-slate-300">
              Range end
              <input
                name="end"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(query.operator.endIso, tz)}
                className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
              />
            </label>
          </>
        ) : null}
        <label className="block text-xs font-medium text-slate-300">
          Clinical provider
          <select
            name="staffId"
            defaultValue={query.operator.assignedStaffId ?? query.calendar.staffId ?? ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">Any provider</option>
            {clinicalStaffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {formatClinicalPickerOptionLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Procedure type
          <select
            name="type"
            defaultValue={query.operator.bookingType ?? query.calendar.bookingType ?? ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            {allBookingTypeOptions().map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Status
          <select
            name="status"
            defaultValue={query.operator.status ?? query.calendar.status ?? ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            {allBookingStatusOptions().map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Clinic
          <select
            name="clinicId"
            defaultValue={query.operator.clinicId ?? query.calendar.clinicId ?? ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-1 text-xs text-slate-300">
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
