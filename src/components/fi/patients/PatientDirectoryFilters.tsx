"use client";

import type { PatientDirectoryQuery } from "@/src/lib/patients/patientDirectoryQuery";
import { NORWOOD_OPTIONS } from "@/src/lib/patients/hairLossScales";
import { PATIENT_STATUS_VALUES } from "@/src/lib/patients/patientPolicy";

export function PatientDirectoryFilters({
  tenantId,
  query,
  leadSourceOptions,
  listView = false,
}: {
  tenantId: string;
  query: PatientDirectoryQuery;
  leadSourceOptions: string[];
  listView?: boolean;
}) {
  const action = listView
    ? `/fi-admin/${tenantId}/patients?view=list`
    : `/fi-admin/${tenantId}/patients`;
  const norwoodChoices = NORWOOD_OPTIONS.filter((o) => o.value !== "unknown");

  return (
    <form
      method="get"
      action={action}
      className="space-y-3 rounded border border-white/[0.08] bg-white/[0.03] p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          Search
          <input
            name="q"
            type="search"
            defaultValue={query.search}
            placeholder="Name, email, phone…"
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Patient status
          <select
            name="status"
            defaultValue={query.patientStatus ?? ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">Any status</option>
            {PATIENT_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Norwood from
          <select
            name="norwoodMin"
            defaultValue={query.norwoodMin ?? ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            {norwoodChoices.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Norwood to
          <select
            name="norwoodMax"
            defaultValue={query.norwoodMax ?? ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            {norwoodChoices.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Last visit from
          <input
            name="lastVisitFrom"
            type="date"
            defaultValue={query.lastVisitFrom ? query.lastVisitFrom.slice(0, 10) : ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Last visit to
          <input
            name="lastVisitTo"
            type="date"
            defaultValue={query.lastVisitTo ? query.lastVisitTo.slice(0, 10) : ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Lead source
          <select
            name="leadSource"
            defaultValue={query.leadSource ?? ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">Any source</option>
            {leadSourceOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Active case
          <select
            name="hasActiveCase"
            defaultValue={
              query.hasActiveCase === true ? "true" : query.hasActiveCase === false ? "false" : ""
            }
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Has active case</option>
            <option value="false">No active case</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Future booking
          <select
            name="hasFutureBooking"
            defaultValue={
              query.hasFutureBooking === true
                ? "true"
                : query.hasFutureBooking === false
                  ? "false"
                  : ""
            }
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Has future booking</option>
            <option value="false">No future booking</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Returning from Timely
          <select
            name="returningFromTimely"
            defaultValue={query.returningFromTimely === true ? "true" : ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Returning from Timely</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Legacy source
          <select
            name="hasLegacySource"
            defaultValue={query.hasLegacySource === true ? "true" : ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Has legacy source</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Historical record
          <select
            name="historicalIncomplete"
            defaultValue={query.historicalIncomplete === true ? "true" : ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Historical record incomplete</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Follow-up encounter
          <select
            name="hasFollowUpEncounter"
            defaultValue={query.hasFollowUpEncounter === true ? "true" : ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Has follow-up encounter</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Photos captured
          <select
            name="hasPhotosCaptured"
            defaultValue={query.hasPhotosCaptured === true ? "true" : ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Photos captured</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          AI review
          <select
            name="aiReviewPending"
            defaultValue={query.aiReviewPending === true ? "true" : ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="true">AI review pending</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Clinician approved AI
          <select
            name="clinicianApprovedAi"
            defaultValue={query.clinicianApprovedAi === true ? "true" : ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Clinician approved</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Merge review
          <select
            name="needsMergeReview"
            defaultValue={query.needsMergeReview === true ? "true" : ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Needs merge review</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Photos without AI approval
          <select
            name="photosNoAiApproval"
            defaultValue={query.photosNoAiApproval === true ? "true" : ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Photos captured, review not approved</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Sort
          <select
            name="sort"
            defaultValue={query.sort}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Page size
          <select
            name="pageSize"
            defaultValue={String(query.pageSize)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
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
        <button
          type="submit"
          className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
        >
          Apply
        </button>
        <a
          href={action}
          className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.03]"
        >
          Reset
        </a>
      </div>
    </form>
  );
}
