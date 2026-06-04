import Link from "next/link";
import { CrmCreateLeadPanel } from "@/src/components/fi/crm/CrmCreateLeadPanel";
import { CrmLeadIdJump } from "@/src/components/fi/crm/CrmLeadIdJump";
import { CrmLeadListFilters } from "@/src/components/fi/crm/CrmLeadListFilters";
import { CrmLeadListPagination } from "@/src/components/fi/crm/CrmLeadListPagination";
import { CrmLeadListTable } from "@/src/components/fi/crm/CrmLeadListTable";
import { CrmPipelinePanel } from "@/src/components/fi/crm/CrmDataPanels";
import { assertCrmShellPageAccess } from "@/src/lib/crm/crmShellAccess";
import {
  loadCrmShellLeadsIndex,
  loadCrmShellPipelineStages,
  loadCrmShellScopePickerOptions,
  loadCrmShellUserPickerOptions,
} from "@/src/lib/crm/crmShellLoaders";
import { buildCrmLeadListHref, crmLeadListHasActiveFilters, parsedCrmLeadListToHrefQuery } from "@/src/lib/crm/crmLeadListQuery";

export const metadata = {
  title: "CRM shell",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CrmShellPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { tenantId } = await params;
  const session = await assertCrmShellPageAccess(tenantId);
  const sp = searchParams ?? {};

  const [list, stages, owners, scope] = await Promise.all([
    loadCrmShellLeadsIndex(tenantId, sp),
    loadCrmShellPipelineStages(tenantId),
    loadCrmShellUserPickerOptions(tenantId),
    loadCrmShellScopePickerOptions(tenantId),
  ]);

  const { items, total, query } = list;
  const filtered = crmLeadListHasActiveFilters(query);
  const firstPageHref = buildCrmLeadListHref(tenantId, { ...parsedCrmLeadListToHrefQuery(query), page: 1 });

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-gray-900">CRM — leads</h1>
        <p className="text-sm text-gray-600">
          Signed in as tenant user <code className="rounded bg-gray-100 px-1 text-xs">{session.fiUserId}</code> with role{" "}
          <strong>{session.role}</strong>. Internal lead index (read via shell loaders); mutations use server actions / API
          only.
        </p>
        <p className="text-sm text-gray-600">
          <Link href={`/fi-admin/${tenantId}/cases`} className="text-blue-600 hover:underline">
            ← Back to cases
          </Link>
        </p>
      </header>

      <CrmLeadListFilters tenantId={tenantId} stages={stages} owners={owners} query={query} />

      <section className="space-y-0 rounded border border-gray-200 bg-white shadow-sm">
        {total === 0 && !filtered ? (
          <div className="p-8 text-center text-sm text-gray-600">
            <p className="font-medium text-gray-800">No leads yet</p>
            <p className="mt-2">Create a lead below or seed data in Supabase to see rows here.</p>
          </div>
        ) : total === 0 && filtered ? (
          <div className="p-8 text-center text-sm text-gray-600">
            <p className="font-medium text-gray-800">No leads match these filters</p>
            <p className="mt-2">Try clearing filters or widening your search.</p>
            <p className="mt-3">
              <Link href={`/fi-admin/${tenantId}/crm`} className="text-blue-600 hover:underline">
                Clear filters
              </Link>
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-600">
            <p className="font-medium text-gray-800">No leads on this page</p>
            <p className="mt-2">Try going to the first page or loosening filters.</p>
            <p className="mt-3">
              <Link href={firstPageHref} className="text-blue-600 hover:underline">
                Go to page 1
              </Link>
            </p>
          </div>
        ) : (
          <>
            <CrmLeadListTable tenantId={tenantId} items={items} />
            <CrmLeadListPagination tenantId={tenantId} query={query} total={total} />
          </>
        )}
      </section>

      <CrmPipelinePanel stages={stages} />

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Open a lead by ID</h2>
        <p className="mb-3 text-sm text-gray-600">Jump directly when you already have a UUID.</p>
        <CrmLeadIdJump tenantId={tenantId} />
      </section>

      <CrmCreateLeadPanel
        tenantId={tenantId}
        defaultOwnerUserId={session.fiUserId}
        owners={owners}
        organisations={scope.organisations}
        clinics={scope.clinics}
      />
    </div>
  );
}
