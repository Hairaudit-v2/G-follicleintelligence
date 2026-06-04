import Link from "next/link";
import type { CasesIndexFilterOptions, CasesIndexQuery } from "@/src/lib/cases/casesIndexTypes";
import { CASES_INDEX_NONE_VALUE } from "@/src/lib/cases/casesIndexTypes";
import { fiCaseStatusLabel } from "@/src/lib/cases/caseLabels";
import { casesWorklistReadinessFilterLabel } from "@/src/lib/cases/casesIndexFilters";
import { POST_OP_STATUS_VALUES } from "@/src/lib/cases/postOpTypes";
import { PROCEDURE_STATUS_VALUES } from "@/src/lib/cases/procedureDayTypes";
import { postOpStatusLabel } from "@/src/lib/cases/postOpLabels";
import { procedureStatusLabel } from "@/src/lib/cases/procedureDayLabels";
import { surgeryPlanningStatusLabel } from "@/src/lib/cases/surgeryPlanningLabels";
import { SURGERY_PLANNING_STATUS_VALUES } from "@/src/lib/cases/surgeryPlanningTypes";

function mergeOptions(staticVals: readonly string[], fromRows: string[]): string[] {
  const s = new Set<string>([...staticVals, ...fromRows]);
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

export function CasesWorklistFilters({
  tenantId,
  query,
  filterOptions,
}: {
  tenantId: string;
  query: CasesIndexQuery;
  filterOptions: CasesIndexFilterOptions;
}) {
  const basePath = `/fi-admin/${tenantId}/cases`;
  const planningOpts = mergeOptions(SURGERY_PLANNING_STATUS_VALUES, filterOptions.planning_statuses);
  const procedureOpts = mergeOptions(PROCEDURE_STATUS_VALUES, filterOptions.procedure_statuses);
  const postOpOpts = mergeOptions(POST_OP_STATUS_VALUES, filterOptions.post_op_statuses);

  return (
    <form method="get" action={basePath} className="rounded border border-gray-200 bg-gray-50/80 p-4">
      <input type="hidden" name="pageSize" value={String(query.pageSize)} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <label className="block text-xs font-medium text-gray-700 sm:col-span-2">
          Search
          <input
            name="q"
            defaultValue={query.q}
            placeholder="Person, case id, lead, treatment…"
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Case status
          <select
            name="status"
            defaultValue={query.status}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {filterOptions.statuses.map((s) => (
              <option key={s} value={s}>
                {fiCaseStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Treatment type
          <select
            name="treatment_type"
            defaultValue={query.treatment_type}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {filterOptions.treatment_types.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Case type
          <select
            name="case_type"
            defaultValue={query.case_type}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {filterOptions.case_types.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Planning status
          <select
            name="planning_status"
            defaultValue={query.planning_status}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value={CASES_INDEX_NONE_VALUE}>No surgery plan</option>
            {planningOpts.map((s) => (
              <option key={s} value={s}>
                {surgeryPlanningStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Procedure status
          <select
            name="procedure_status"
            defaultValue={query.procedure_status}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value={CASES_INDEX_NONE_VALUE}>No procedure day</option>
            {procedureOpts.map((s) => (
              <option key={s} value={s}>
                {procedureStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Post-op status
          <select
            name="post_op_status"
            defaultValue={query.post_op_status}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value={CASES_INDEX_NONE_VALUE}>No post-op row</option>
            {postOpOpts.map((s) => (
              <option key={s} value={s}>
                {postOpStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Readiness
          <select
            name="readiness"
            defaultValue={query.readiness}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="ready">{casesWorklistReadinessFilterLabel("ready")}</option>
            <option value="in_progress">{casesWorklistReadinessFilterLabel("in_progress")}</option>
            <option value="needs_attention">{casesWorklistReadinessFilterLabel("needs_attention")}</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Sort
          <select name="sort" defaultValue={query.sort} className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm">
            <option value="updated_desc">Newest updated</option>
            <option value="created_desc">Newest created</option>
            <option value="procedure_date_desc">Procedure date</option>
            <option value="readiness_attention_desc">Readiness (needs attention first)</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800">
          Apply filters
        </button>
        <Link href={basePath} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50">
          Clear
        </Link>
      </div>
    </form>
  );
}
