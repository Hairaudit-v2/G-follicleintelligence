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

export function OperationalCalendarFilters({
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
  const action = buildCalendarHref(tenantId, { view: query.view, date: query.dateAnchor });

  return (
    <form method="get" action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <input type="hidden" name="view" value={query.view} />
      <input type="hidden" name="date" value={query.dateAnchor} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          Search
          <input
            type="search"
            name="q"
            defaultValue={query.search ?? ""}
            placeholder="Patient, lead, title…"
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            autoComplete="off"
          />
        </label>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          Type
          <select
            name="type"
            defaultValue={query.bookingType ?? ""}
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Any type</option>
            {allBookingTypeOptions().map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          Status
          <select
            name="status"
            defaultValue={query.status ?? ""}
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Any status</option>
            {allBookingStatusOptions().map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          Clinician
          <select
            name="assignedUserId"
            defaultValue={query.assignedUserId ?? ""}
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Anyone</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email?.trim() || u.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          Site / room
          <select
            name="clinicId"
            defaultValue={query.clinicId ?? ""}
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Any site</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pt-5 text-xs text-slate-700 dark:text-slate-300">
          <input type="checkbox" name="includeCancelled" value="1" defaultChecked={query.includeCancelled} />
          Include cancelled
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Apply
        </button>
        <a
          href={buildCalendarHref(tenantId, { view: query.view, date: query.dateAnchor })}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
        >
          Reset
        </a>
      </div>
      <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
        Grid uses UTC business hours (tenant override via <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">fi_tenant_settings.metadata.operational_calendar</code>
        ). Same booking overlap query as the tenant dashboard agenda.
      </p>
    </form>
  );
}
