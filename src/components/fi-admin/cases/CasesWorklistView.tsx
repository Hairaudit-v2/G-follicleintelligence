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

  return (
    <div className="space-y-4">
      <CasesWorklistFilters tenantId={tenantId} query={query} filterOptions={filterOptions} />
      <p className="text-xs text-gray-600">
        {totalMatching === 0 ? (
          <>No cases match the current filters.</>
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
