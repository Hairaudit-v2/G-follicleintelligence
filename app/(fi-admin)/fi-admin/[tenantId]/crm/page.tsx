import Link from "next/link";
import { CrmCreateLeadPanel } from "@/src/components/fi/crm/CrmCreateLeadPanel";
import { CrmLeadIdJump } from "@/src/components/fi/crm/CrmLeadIdJump";
import { CrmKanbanBoard } from "@/src/components/fi/crm/CrmKanbanBoard";
import { CrmLeadIndexViewTabs } from "@/src/components/fi/crm/CrmLeadIndexViewTabs";
import { CrmLeadListFilters } from "@/src/components/fi/crm/CrmLeadListFilters";
import { CrmLeadListPagination } from "@/src/components/fi/crm/CrmLeadListPagination";
import { CrmLeadListTable } from "@/src/components/fi/crm/CrmLeadListTable";
import { CrmPipelinePanel } from "@/src/components/fi/crm/CrmDataPanels";
import { getCrmShellPageSession } from "@/src/lib/crm/crmShellAccess";
import {
  loadCrmShellLeadsBoardIndex,
  loadCrmShellLeadsIndex,
  loadCrmShellPipelineStages,
  loadCrmShellScopePickerOptions,
  loadCrmShellUserPickerOptions,
} from "@/src/lib/crm/crmShellLoaders";
import { attachSearchPattern, buildCrmLeadListHref, crmLeadListHasActiveFilters, parseCrmLeadListQuery, parsedCrmLeadListToHrefQuery } from "@/src/lib/crm/crmLeadListQuery";
import { escapeIlikePattern } from "@/src/lib/fi/foundation/search";

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
  const session = await getCrmShellPageSession(tenantId);
  const sp = searchParams ?? {};

  const baseQuery = parseCrmLeadListQuery(sp);
  const esc = baseQuery.searchRaw ? escapeIlikePattern(baseQuery.searchRaw) : null;
  const parsed = attachSearchPattern(baseQuery, esc);
  const isBoard = parsed.view === "board";

  const [list, board, stages, owners, scope] = await Promise.all([
    !isBoard ? loadCrmShellLeadsIndex(tenantId, sp) : Promise.resolve(null),
    isBoard ? loadCrmShellLeadsBoardIndex(tenantId, sp) : Promise.resolve(null),
    loadCrmShellPipelineStages(tenantId),
    loadCrmShellUserPickerOptions(tenantId),
    loadCrmShellScopePickerOptions(tenantId),
  ]);

  const query = isBoard && board ? board.query : list!.query;
  const filtered = crmLeadListHasActiveFilters(query);
  const firstPageHref = buildCrmLeadListHref(tenantId, { ...parsedCrmLeadListToHrefQuery(query), page: 1 });

  return (
    <div className={`mx-auto space-y-6 py-6 ${isBoard ? "max-w-[100rem] px-3 sm:px-4" : "max-w-6xl"}`}>
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-gray-900">CRM — leads</h1>
          <p className="text-sm text-gray-600">
            Signed in as tenant user <code className="rounded bg-gray-100 px-1 text-xs">{session.fiUserId}</code> with role{" "}
            <strong>{session.role}</strong>. Internal lead index (read via shell loaders); mutations use server actions / API
            only.
          </p>
          <p className="text-sm text-gray-600">
            <Link href={`/fi-admin/${tenantId}/cases`} className="text-blue-600 hover:underline">
              ← Back to patients
            </Link>
          </p>
        </div>
        <CrmLeadIndexViewTabs tenantId={tenantId} query={query} />
      </header>

      <CrmLeadListFilters tenantId={tenantId} stages={stages} owners={owners} query={query} />

      {isBoard && board ? (
        <section className="space-y-3 rounded border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
          {board.total === 0 && !filtered ? (
            <div className="p-8 text-center text-sm text-gray-600">
              <p className="font-medium text-gray-800">No leads yet</p>
              <p className="mt-2">Create a lead below or seed data in Supabase to see cards here.</p>
            </div>
          ) : board.total === 0 && filtered ? (
            <div className="p-8 text-center text-sm text-gray-600">
              <p className="font-medium text-gray-800">No leads match these filters</p>
              <p className="mt-2">Try clearing filters or widening your search.</p>
              <p className="mt-3">
                <Link href={`/fi-admin/${tenantId}/crm?view=board`} className="text-blue-600 hover:underline">
                  Clear filters
                </Link>
              </p>
            </div>
          ) : (
            <CrmKanbanBoard
              tenantId={tenantId}
              stages={stages}
              initialCards={board.cards}
              total={board.total}
              truncated={board.truncated}
              clinics={scope.clinics}
              assignees={owners}
            />
          )}
        </section>
      ) : (
        <section className="space-y-0 rounded border border-gray-200 bg-white shadow-sm">
          {list!.total === 0 && !filtered ? (
            <div className="p-8 text-center text-sm text-gray-600">
              <p className="font-medium text-gray-800">No leads yet</p>
              <p className="mt-2">Create a lead below or seed data in Supabase to see rows here.</p>
            </div>
          ) : list!.total === 0 && filtered ? (
            <div className="p-8 text-center text-sm text-gray-600">
              <p className="font-medium text-gray-800">No leads match these filters</p>
              <p className="mt-2">Try clearing filters or widening your search.</p>
              <p className="mt-3">
                <Link href={`/fi-admin/${tenantId}/crm`} className="text-blue-600 hover:underline">
                  Clear filters
                </Link>
              </p>
            </div>
          ) : list!.items.length === 0 ? (
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
              <CrmLeadListTable tenantId={tenantId} items={list!.items} />
              <CrmLeadListPagination tenantId={tenantId} query={list!.query} total={list!.total} />
            </>
          )}
        </section>
      )}

      <CrmPipelinePanel stages={stages} />

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Open a lead by ID</h2>
        <p className="mb-3 text-sm text-gray-600">Jump directly when you already have a UUID.</p>
        <CrmLeadIdJump tenantId={tenantId} />
      </section>

      <CrmCreateLeadPanel
        tenantId={tenantId}
        owners={owners}
        organisations={scope.organisations}
        clinics={scope.clinics}
      />
    </div>
  );
}
