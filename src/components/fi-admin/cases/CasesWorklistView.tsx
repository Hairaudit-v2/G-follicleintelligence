import Link from "next/link";
import type { CaseWorklistRow, CasesIndexFilterOptions, CasesIndexQuery } from "@/src/lib/cases/casesIndexTypes";
import { CasesWorklistFilters } from "./CasesWorklistFilters";
import { CasesWorklistMobileCards } from "./CasesWorklistMobileCards";
import { CasesWorklistPagination } from "./CasesWorklistPagination";
import { CasesWorklistTable } from "./CasesWorklistTable";

export type CasesWorklistPaginationSummary = {
  page: number;
  pageSize: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
};

export function CasesWorklistView({
  tenantId,
  query,
  filterOptions,
  rows,
  totalBeforeFilters,
  totalMatching,
  pagination,
  worklistQueryString,
  firstCaseWizardHref,
}: {
  tenantId: string;
  query: CasesIndexQuery;
  filterOptions: CasesIndexFilterOptions;
  rows: CaseWorklistRow[];
  totalBeforeFilters: number;
  totalMatching: number;
  pagination: CasesWorklistPaginationSummary;
  /** Passed to case detail links as `fromCases` so “back to cases” can restore filters. */
  worklistQueryString?: string;
  /** When the tenant has zero cases, empty-state CTA for the first-case wizard. */
  firstCaseWizardHref?: string;
}) {
  const hasActiveFilters =
    !!query.q.trim() ||
    !!query.status ||
    !!query.treatment_type ||
    !!query.case_type ||
    !!query.planning_status ||
    !!query.procedure_status ||
    !!query.post_op_status ||
    query.readiness !== "all";

  const allInTenantUnfiltered = totalMatching === totalBeforeFilters && !hasActiveFilters;

  const emptyTenantNoFilters = totalBeforeFilters === 0 && !hasActiveFilters;

  return (
    <div className="space-y-4">
      <CasesWorklistFilters tenantId={tenantId} query={query} filterOptions={filterOptions} />
      {totalMatching === 0 && emptyTenantNoFilters && firstCaseWizardHref ? (
        <div className="rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-700">
          <p className="font-medium text-gray-900">No cases in this tenant yet</p>
          <p className="mt-1 text-xs text-gray-600">
            Use the wizard to add a test person, patient, and case without SQL or imports.
          </p>
          <Link
            href={firstCaseWizardHref}
            className="mt-4 inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create test case
          </Link>
        </div>
      ) : null}
      {!(totalMatching === 0 && emptyTenantNoFilters && firstCaseWizardHref) ? (
        <p className="text-xs text-gray-600">
          {totalMatching === 0 ? (
            <>{emptyTenantNoFilters ? <>No cases in this tenant yet.</> : <>No cases match the current filters.</>}</>
          ) : (
            <>
              Showing <span className="font-medium text-gray-900">{pagination.rangeStart}</span>–
              <span className="font-medium text-gray-900">{pagination.rangeEnd}</span> of{" "}
              <span className="font-medium text-gray-900">{totalMatching}</span> {allInTenantUnfiltered ? "cases" : "matching"}
              {!allInTenantUnfiltered ? (
                <>
                  {" "}
                  · <span className="font-medium text-gray-900">{totalBeforeFilters}</span> in this tenant
                </>
              ) : null}
              {hasActiveFilters ? <span className="text-gray-500"> (filters applied)</span> : null}
            </>
          )}
        </p>
      ) : null}
      {totalMatching > 0 ? (
        <>
          <CasesWorklistTable tenantId={tenantId} rows={rows} worklistQueryString={worklistQueryString} />
          <CasesWorklistMobileCards tenantId={tenantId} rows={rows} worklistQueryString={worklistQueryString} />
        </>
      ) : null}
      <CasesWorklistPagination tenantId={tenantId} query={query} totalMatching={totalMatching} />
    </div>
  );
}
