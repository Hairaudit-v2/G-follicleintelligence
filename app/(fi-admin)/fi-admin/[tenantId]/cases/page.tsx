import Link from "next/link";
import { CasesWorklistView } from "@/src/components/fi-admin/cases/CasesWorklistView";
import {
  applyCasesWorklistFilters,
  buildCaseWorklistRows,
  deriveCasesIndexFilterOptions,
  sortCaseWorklistRows,
} from "@/src/lib/cases/casesIndexBuild";
import { parseCasesIndexQuery } from "@/src/lib/cases/casesIndexFilters";
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
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
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
  const rows = sortCaseWorklistRows(filtered, query.sort);

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Cases</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            SurgeryOS worklist (Stage 5G): tenant-scoped cases with search, filters, and readiness summaries — read-only
            list; open a case for 5A–5F detail. No HairAudit, audit grading, AI scoring, or certification scoring here.
          </p>
        </div>
        <Link href={`/fi-admin/${tenantId}/crm`} className="text-sm text-blue-600 hover:underline">
          CRM
        </Link>
      </div>

      <CasesWorklistView
        tenantId={tenantId}
        query={query}
        filterOptions={filterOptions}
        rows={rows}
        totalBeforeFilters={enriched.length}
      />
    </div>
  );
}
