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

const FILTER_HEADING_ID = "operational-calendar-filters-heading";

const FILTER_FIELDS = {
  q: { inputId: "operational-calendar-filter-q", labelId: "operational-calendar-filter-q-label", label: "Search" },
  type: { inputId: "operational-calendar-filter-type", labelId: "operational-calendar-filter-type-label", label: "Type" },
  status: {
    inputId: "operational-calendar-filter-status",
    labelId: "operational-calendar-filter-status-label",
    label: "Status",
  },
  assignedUserId: {
    inputId: "operational-calendar-filter-clinician",
    labelId: "operational-calendar-filter-clinician-label",
    label: "Clinician",
  },
  clinicId: {
    inputId: "operational-calendar-filter-clinic",
    labelId: "operational-calendar-filter-clinic-label",
    label: "Site / room",
  },
  includeCancelled: {
    inputId: "operational-calendar-filter-include-cancelled",
    labelId: "operational-calendar-filter-include-cancelled-label",
    label: "Include cancelled",
  },
} as const;

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
  const action = buildCalendarHref(tenantId, {
    view: query.view,
    date: query.dateAnchor,
    sample: query.sampleMode ? true : undefined,
  });

  return (
    <form
      method="get"
      action={action}
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
      aria-labelledby={FILTER_HEADING_ID}
    >
      <h2 id={FILTER_HEADING_ID} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Filter calendar bookings
      </h2>
      <input type="hidden" name="view" value={query.view} />
      <input type="hidden" name="date" value={query.dateAnchor} />
      {query.sampleMode ? <input type="hidden" name="sample" value="1" /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label
          id={FILTER_FIELDS.q.labelId}
          htmlFor={FILTER_FIELDS.q.inputId}
          className="block text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          {FILTER_FIELDS.q.label}
          <input
            id={FILTER_FIELDS.q.inputId}
            type="search"
            name="q"
            defaultValue={query.search ?? ""}
            placeholder="Patient, lead, title…"
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            autoComplete="off"
          />
        </label>
        <label
          id={FILTER_FIELDS.type.labelId}
          htmlFor={FILTER_FIELDS.type.inputId}
          className="block text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          {FILTER_FIELDS.type.label}
          <select
            id={FILTER_FIELDS.type.inputId}
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
        <label
          id={FILTER_FIELDS.status.labelId}
          htmlFor={FILTER_FIELDS.status.inputId}
          className="block text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          {FILTER_FIELDS.status.label}
          <select
            id={FILTER_FIELDS.status.inputId}
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
        <label
          id={FILTER_FIELDS.assignedUserId.labelId}
          htmlFor={FILTER_FIELDS.assignedUserId.inputId}
          className="block text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          {FILTER_FIELDS.assignedUserId.label}
          <select
            id={FILTER_FIELDS.assignedUserId.inputId}
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
        <label
          id={FILTER_FIELDS.clinicId.labelId}
          htmlFor={FILTER_FIELDS.clinicId.inputId}
          className="block text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          {FILTER_FIELDS.clinicId.label}
          <select
            id={FILTER_FIELDS.clinicId.inputId}
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
        <label
          id={FILTER_FIELDS.includeCancelled.labelId}
          htmlFor={FILTER_FIELDS.includeCancelled.inputId}
          className="flex items-center gap-2 pt-5 text-xs text-slate-700 dark:text-slate-300"
        >
          <input
            id={FILTER_FIELDS.includeCancelled.inputId}
            type="checkbox"
            name="includeCancelled"
            value="1"
            defaultChecked={query.includeCancelled}
          />
          {FILTER_FIELDS.includeCancelled.label}
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
          href={buildCalendarHref(tenantId, {
            view: query.view,
            date: query.dateAnchor,
            sample: query.sampleMode ? true : undefined,
          })}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
        >
          Reset
        </a>
      </div>
      <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
        Grid uses clinic-local business hours from{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">fi_tenant_settings.default_timezone</code>{" "}
        (IANA). Optional window overrides live in{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">fi_tenant_settings.metadata.operational_calendar</code>{" "}
        (<code className="rounded bg-slate-100 px-1 dark:bg-slate-800">dayStartHourUtc</code> /{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">dayEndHourUtc</code> are wall-clock hours in that
        zone). Same booking overlap query as the tenant dashboard agenda.
      </p>
    </form>
  );
}
