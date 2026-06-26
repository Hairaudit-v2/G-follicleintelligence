import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { redirect } from "next/navigation";
import { CasesWorklistView } from "@/src/components/fi-admin/cases/CasesWorklistView";
import { SurgeryOsDashboard } from "@/src/components/fi-admin/cases/SurgeryOsDashboard";
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
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";

export const metadata = {
  title: "SurgeryOS",
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
  await assertStaffModuleAccess(tenantId, "surgery_os", "read");
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
    <div className="mx-auto max-w-6xl space-y-8 py-2 lg:max-w-[1200px]">
      <SurgeryOsDashboard tenantId={tenantId} rows={enriched} worklistQueryString={worklistQueryString} />

      <section id="surgeryos-case-worklist" aria-labelledby="cases-index-heading">
        <h2 id="cases-index-heading" className="sr-only">
          Surgery case worklist
        </h2>
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
      </section>
    </div>
  );
}
