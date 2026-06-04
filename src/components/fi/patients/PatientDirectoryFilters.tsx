"use client";

import type { PatientDirectoryQuery } from "@/src/lib/patients/patientDirectoryQuery";
import { PATIENT_STATUS_VALUES } from "@/src/lib/patients/patientPolicy";

export function PatientDirectoryFilters({ tenantId, query }: { tenantId: string; query: PatientDirectoryQuery }) {
  const action = `/fi-admin/${tenantId}/patients`;

  return (
    <form method="get" action={action} className="space-y-3 rounded border border-gray-200 bg-gray-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="block text-xs font-medium text-gray-700">
          Search
          <input
            name="q"
            type="search"
            defaultValue={query.search}
            placeholder="Name, email, phone…"
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Patient status
          <select
            name="status"
            defaultValue={query.patientStatus ?? ""}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Any status</option>
            {PATIENT_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Active case
          <select
            name="hasActiveCase"
            defaultValue={query.hasActiveCase === true ? "true" : query.hasActiveCase === false ? "false" : ""}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Has active case</option>
            <option value="false">No active case</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Future booking
          <select
            name="hasFutureBooking"
            defaultValue={query.hasFutureBooking === true ? "true" : query.hasFutureBooking === false ? "false" : ""}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Has future booking</option>
            <option value="false">No future booking</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Sort
          <select
            name="sort"
            defaultValue={query.sort}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Page size
          <select
            name="pageSize"
            defaultValue={String(query.pageSize)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800">
          Apply
        </button>
        <a
          href={action}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
        >
          Reset
        </a>
      </div>
    </form>
  );
}
