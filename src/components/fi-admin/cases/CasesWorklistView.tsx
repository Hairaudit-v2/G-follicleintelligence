import Link from "next/link";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import type {
  CaseWorklistRow,
  CasesIndexFilterOptions,
  CasesIndexQuery,
} from "@/src/lib/cases/casesIndexTypes";
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
        <DashboardCard className="border-dashed border-[#22C1FF]/25 bg-[#0F1629]/90 p-8 text-center shadow-[0_0_40px_rgba(34,193,255,0.06)]">
          <p className="text-lg font-semibold tracking-tight text-[#F8FAFC] sm:text-xl">
            No surgery cases yet
          </p>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-[#94A3B8]">
            Start a surgery case to plan procedures, track the day-of flow, and coordinate post-op
            follow-ups.
          </p>
          <Link
            href={firstCaseWizardHref}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-cyan-950/40 transition duration-200 ease-out hover:-translate-y-0.5 hover:from-cyan-500 hover:to-sky-500 hover:shadow-xl hover:shadow-cyan-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22C1FF]/60"
          >
            Start first surgery case
          </Link>
        </DashboardCard>
      ) : null}
      {!(totalMatching === 0 && emptyTenantNoFilters && firstCaseWizardHref) ? (
        <div className="text-sm text-[#94A3B8]">
          {totalMatching === 0 ? (
            emptyTenantNoFilters ? (
              <p>No surgery cases in this tenant yet.</p>
            ) : (
              <DashboardCard className="border-dashed border-white/[0.12] bg-[#0F1629]/70 p-4 text-base leading-relaxed text-[#CBD5E1]">
                No cases match the current filters. Clear search or reset filters to see more of
                your worklist.
              </DashboardCard>
            )
          ) : (
            <p>
              Showing <span className="font-medium text-[#F8FAFC]">{pagination.rangeStart}</span>–
              <span className="font-medium text-[#F8FAFC]">{pagination.rangeEnd}</span> of{" "}
              <span className="font-medium text-[#F8FAFC]">{totalMatching}</span>{" "}
              {allInTenantUnfiltered ? "surgery cases" : "matching cases"}
              {!allInTenantUnfiltered ? (
                <>
                  {" "}
                  · <span className="font-medium text-[#F8FAFC]">{totalBeforeFilters}</span> in this
                  tenant
                </>
              ) : null}
              {hasActiveFilters ? <span className="text-[#64748B]"> (filters applied)</span> : null}
            </p>
          )}
        </div>
      ) : null}
      {totalMatching > 0 ? (
        <>
          <CasesWorklistTable
            tenantId={tenantId}
            rows={rows}
            worklistQueryString={worklistQueryString}
          />
          <CasesWorklistMobileCards
            tenantId={tenantId}
            rows={rows}
            worklistQueryString={worklistQueryString}
          />
        </>
      ) : null}
      <CasesWorklistPagination tenantId={tenantId} query={query} totalMatching={totalMatching} />
    </div>
  );
}
