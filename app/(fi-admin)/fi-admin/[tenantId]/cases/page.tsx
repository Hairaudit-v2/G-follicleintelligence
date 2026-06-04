import Link from "next/link";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { redirect } from "next/navigation";
import { CasesWorklistView } from "@/src/components/fi-admin/cases/CasesWorklistView";
import {
  applyCasesWorklistFilters,
  buildCaseWorklistRows,
  deriveCasesIndexFilterOptions,
  paginateCaseWorklistRows,
  sortCaseWorklistRows,
} from "@/src/lib/cases/casesIndexBuild";
import { buildCasesWorklistQueryString, casesWorklistHref, parseCasesIndexQuery } from "@/src/lib/cases/casesIndexFilters";
import { loadCasesIndexExtensionBundle } from "@/src/lib/cases/casesIndexLoaders";
import { loadCasesIndexForTenant } from "@/src/lib/cases/caseLoaders";

export const metadata = {
  title: "Cases",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CasesIndexRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await params;
  const sp = (await searchParams) ?? {};

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const query = parseCasesIndexQuery(sp);
  const baseRows = await loadCasesIndexForTenant(tenantId);
  const ext = await loadCasesIndexExtensionBundle(
    tenantId,
    baseRows.map((r) => r.id)
  );
  const enriched = buildCaseWorklistRows(tenantId, baseRows, ext);
  const filterOptions = deriveCasesIndexFilterOptions(enriched);
  const filtered = applyCasesWorklistFilters(enriched, query);
  const sorted = sortCaseWorklistRows(filtered, query.sort);
  const pagination = paginateCaseWorklistRows(sorted, query.page, query.pageSize);

  if (pagination.total > 0 && pagination.page !== query.page) {
    redirect(casesWorklistHref(tenantId, { ...query, page: pagination.page }));
  }

  const rows = pagination.pageRows;
  const effectiveQuery = { ...query, page: pagination.page, pageSize: pagination.pageSize };
  const worklistQueryString = buildCasesWorklistQueryString(effectiveQuery) || undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">Cases</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#94A3B8] sm:text-base">
            SurgeryOS worklist (Stage 5H): tenant-scoped cases with URL pagination, search, filters, and readiness
            summaries — read-only list; open a case for 5A–5G detail. No HairAudit, audit grading, AI scoring, or
            certification scoring here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href={`/fi-admin/${tenantId}/cases/new`}
            className="text-sm font-semibold text-[#22C1FF] underline decoration-[#22C1FF]/35 underline-offset-4 transition hover:text-[#0EA5E9]"
          >
            Create case
          </Link>
          <Link href={`/fi-admin/${tenantId}/crm`} className="text-sm text-[#94A3B8] transition hover:text-[#22C1FF]">
            CRM
          </Link>
        </div>
      </div>

      <CasesWorklistView
        tenantId={tenantId}
        query={{ ...query, page: pagination.page, pageSize: pagination.pageSize }}
        filterOptions={filterOptions}
        rows={rows}
        totalBeforeFilters={enriched.length}
        totalMatching={pagination.total}
        worklistQueryString={worklistQueryString}
        firstCaseWizardHref={`/fi-admin/${tenantId}/cases/new`}
        pagination={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          totalPages: pagination.totalPages,
          rangeStart: pagination.rangeStart,
          rangeEnd: pagination.rangeEnd,
        }}
      />
    </div>
  );
}
