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

const FILTER_HEADING_ID = "cases-worklist-filters-heading";

const FILTER_FIELDS = {
  q: { inputId: "cases-worklist-filter-q", labelId: "cases-worklist-filter-q-label", label: "Search" },
  status: { inputId: "cases-worklist-filter-status", labelId: "cases-worklist-filter-status-label", label: "Patient status" },
  treatment_type: {
    inputId: "cases-worklist-filter-treatment-type",
    labelId: "cases-worklist-filter-treatment-type-label",
    label: "Treatment type",
  },
  case_type: { inputId: "cases-worklist-filter-case-type", labelId: "cases-worklist-filter-case-type-label", label: "Patient type" },
  planning_status: {
    inputId: "cases-worklist-filter-planning-status",
    labelId: "cases-worklist-filter-planning-status-label",
    label: "Planning status",
  },
  procedure_status: {
    inputId: "cases-worklist-filter-procedure-status",
    labelId: "cases-worklist-filter-procedure-status-label",
    label: "Procedure status",
  },
  post_op_status: {
    inputId: "cases-worklist-filter-post-op-status",
    labelId: "cases-worklist-filter-post-op-status-label",
    label: "Post-op status",
  },
  readiness: {
    inputId: "cases-worklist-filter-readiness",
    labelId: "cases-worklist-filter-readiness-label",
    label: "Readiness",
  },
  sort: { inputId: "cases-worklist-filter-sort", labelId: "cases-worklist-filter-sort-label", label: "Sort" },
} as const;

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
    <form
      method="get"
      action={basePath}
      className="rounded border border-white/[0.08] bg-white/[0.03] p-4"
      aria-labelledby={FILTER_HEADING_ID}
    >
      <h2 id={FILTER_HEADING_ID} className="text-sm font-semibold text-slate-100">
        Filter and search cases
      </h2>
      <input type="hidden" id="cases-worklist-filter-page-size" name="pageSize" value={String(query.pageSize)} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <label
          id={FILTER_FIELDS.q.labelId}
          htmlFor={FILTER_FIELDS.q.inputId}
          className="block text-xs font-medium text-slate-300 sm:col-span-2"
        >
          {FILTER_FIELDS.q.label}
          <input
            id={FILTER_FIELDS.q.inputId}
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder="Person, patient id, lead, treatment…"
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label
          id={FILTER_FIELDS.status.labelId}
          htmlFor={FILTER_FIELDS.status.inputId}
          className="block text-xs font-medium text-slate-300"
        >
          {FILTER_FIELDS.status.label}
          <select
            id={FILTER_FIELDS.status.inputId}
            name="status"
            defaultValue={query.status}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {filterOptions.statuses.map((s) => (
              <option key={s} value={s}>
                {fiCaseStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label
          id={FILTER_FIELDS.treatment_type.labelId}
          htmlFor={FILTER_FIELDS.treatment_type.inputId}
          className="block text-xs font-medium text-slate-300"
        >
          {FILTER_FIELDS.treatment_type.label}
          <select
            id={FILTER_FIELDS.treatment_type.inputId}
            name="treatment_type"
            defaultValue={query.treatment_type}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {filterOptions.treatment_types.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label
          id={FILTER_FIELDS.case_type.labelId}
          htmlFor={FILTER_FIELDS.case_type.inputId}
          className="block text-xs font-medium text-slate-300"
        >
          {FILTER_FIELDS.case_type.label}
          <select
            id={FILTER_FIELDS.case_type.inputId}
            name="case_type"
            defaultValue={query.case_type}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {filterOptions.case_types.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label
          id={FILTER_FIELDS.planning_status.labelId}
          htmlFor={FILTER_FIELDS.planning_status.inputId}
          className="block text-xs font-medium text-slate-300"
        >
          {FILTER_FIELDS.planning_status.label}
          <select
            id={FILTER_FIELDS.planning_status.inputId}
            name="planning_status"
            defaultValue={query.planning_status}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
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
        <label
          id={FILTER_FIELDS.procedure_status.labelId}
          htmlFor={FILTER_FIELDS.procedure_status.inputId}
          className="block text-xs font-medium text-slate-300"
        >
          {FILTER_FIELDS.procedure_status.label}
          <select
            id={FILTER_FIELDS.procedure_status.inputId}
            name="procedure_status"
            defaultValue={query.procedure_status}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
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
        <label
          id={FILTER_FIELDS.post_op_status.labelId}
          htmlFor={FILTER_FIELDS.post_op_status.inputId}
          className="block text-xs font-medium text-slate-300"
        >
          {FILTER_FIELDS.post_op_status.label}
          <select
            id={FILTER_FIELDS.post_op_status.inputId}
            name="post_op_status"
            defaultValue={query.post_op_status}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
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
        <label
          id={FILTER_FIELDS.readiness.labelId}
          htmlFor={FILTER_FIELDS.readiness.inputId}
          className="block text-xs font-medium text-slate-300"
        >
          {FILTER_FIELDS.readiness.label}
          <select
            id={FILTER_FIELDS.readiness.inputId}
            name="readiness"
            defaultValue={query.readiness}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="ready">{casesWorklistReadinessFilterLabel("ready")}</option>
            <option value="in_progress">{casesWorklistReadinessFilterLabel("in_progress")}</option>
            <option value="needs_attention">{casesWorklistReadinessFilterLabel("needs_attention")}</option>
          </select>
        </label>
        <label
          id={FILTER_FIELDS.sort.labelId}
          htmlFor={FILTER_FIELDS.sort.inputId}
          className="block text-xs font-medium text-slate-300"
        >
          {FILTER_FIELDS.sort.label}
          <select
            id={FILTER_FIELDS.sort.inputId}
            name="sort"
            defaultValue={query.sort}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
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
        <Link href={basePath} className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.03]">
          Clear
        </Link>
      </div>
    </form>
  );
}
