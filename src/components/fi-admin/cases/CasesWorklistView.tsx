import type { CaseWorklistRow, CasesIndexFilterOptions, CasesIndexQuery } from "@/src/lib/cases/casesIndexTypes";
import { CasesWorklistFilters } from "./CasesWorklistFilters";
import { CasesWorklistMobileCards } from "./CasesWorklistMobileCards";
import { CasesWorklistTable } from "./CasesWorklistTable";

export function CasesWorklistView({
  tenantId,
  query,
  filterOptions,
  rows,
  totalBeforeFilters,
}: {
  tenantId: string;
  query: CasesIndexQuery;
  filterOptions: CasesIndexFilterOptions;
  rows: CaseWorklistRow[];
  totalBeforeFilters: number;
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

  return (
    <div className="space-y-4">
      <CasesWorklistFilters tenantId={tenantId} query={query} filterOptions={filterOptions} />
      <p className="text-xs text-gray-600">
        Showing <span className="font-medium text-gray-900">{rows.length}</span> of{" "}
        <span className="font-medium text-gray-900">{totalBeforeFilters}</span> cases
        {hasActiveFilters ? " (filters applied)" : ""}.
      </p>
      <CasesWorklistTable tenantId={tenantId} rows={rows} />
      <CasesWorklistMobileCards tenantId={tenantId} rows={rows} />
      {rows.length === 0 ? <p className="text-sm text-gray-500">No cases match the current filters.</p> : null}
    </div>
  );
}
