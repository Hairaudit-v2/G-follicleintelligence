import Link from "next/link";

import { LeadFlowDashboard } from "@/src/components/fi-admin/leadflow/LeadFlowDashboard";
import { CrmCreateLeadPanel } from "@/src/components/fi/crm/CrmCreateLeadPanel";
import { CrmKanbanBoard } from "@/src/components/fi/crm/CrmKanbanBoard";
import { CrmLeadIndexViewTabs } from "@/src/components/fi/crm/CrmLeadIndexViewTabs";
import { CrmLeadListFilters } from "@/src/components/fi/crm/CrmLeadListFilters";
import { CrmLeadListPagination } from "@/src/components/fi/crm/CrmLeadListPagination";
import { CrmLeadListTable } from "@/src/components/fi/crm/CrmLeadListTable";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { getCrmShellPageSession } from "@/src/lib/crm/crmShellAccess";
import {
  loadCrmShellLeadsBoardIndex,
  loadCrmShellLeadsIndex,
  loadCrmShellPipelineStages,
  loadCrmShellScopePickerOptions,
  loadCrmShellUserPickerOptions,
} from "@/src/lib/crm/crmShellLoaders";
import {
  attachSearchPattern,
  buildCrmLeadListHref,
  crmLeadListHasActiveFilters,
  parseCrmLeadListQuery,
  parsedCrmLeadListToHrefQuery,
} from "@/src/lib/crm/crmLeadListQuery";
import { canViewDashboardSystemDiagnostics } from "@/src/lib/fi-os/dashboardSystemDiagnosticsAccess.server";
import { loadLeadFlowDashboardPayload } from "@/src/lib/fiAdmin/leadFlowDashboardLoader.server";
import { escapeIlikePattern } from "@/src/lib/fi/foundation/search";

export const metadata = {
  title: "LeadFlow",
  description:
    "Consultation conversion, follow-up priority, booking readiness, and revenue opportunity across every enquiry.",
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
  const isList = parsed.view === "list";
  const isWorkspace = parsed.view === "workspace";

  const [stages, owners, scope, showDiagnosticsExpanded] = await Promise.all([
    loadCrmShellPipelineStages(tenantId),
    loadCrmShellUserPickerOptions(tenantId),
    loadCrmShellScopePickerOptions(tenantId),
    canViewDashboardSystemDiagnostics(tenantId),
  ]);

  if (isWorkspace) {
    const payload = await loadLeadFlowDashboardPayload(tenantId);
    return (
      <LeadFlowDashboard
        tenantId={tenantId}
        payload={payload}
        owners={owners}
        scope={scope}
        query={parsed}
        showDiagnosticsExpanded={showDiagnosticsExpanded}
        sessionLabel={`${session.role}`}
      />
    );
  }

  const [list, board] = await Promise.all([
    isList ? loadCrmShellLeadsIndex(tenantId, sp) : Promise.resolve(null),
    isBoard ? loadCrmShellLeadsBoardIndex(tenantId, sp) : Promise.resolve(null),
  ]);

  const query = isBoard && board ? board.query : list!.query;
  const filtered = crmLeadListHasActiveFilters(query);
  const firstPageHref = buildCrmLeadListHref(tenantId, { ...parsedCrmLeadListToHrefQuery(query), page: 1 });
  const base = `/fi-admin/${tenantId}`;

  return (
    <div className={`mx-auto space-y-6 py-6 ${isBoard ? "max-w-[100rem] px-3 sm:px-4" : "max-w-[88rem] px-3 sm:px-4"}`}>
      <DashboardCard elevated className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">LeadFlow</p>
            <h1 className="text-2xl font-semibold tracking-tight text-[#F8FAFC] sm:text-3xl">
              {isBoard ? "Conversion board view" : "Lead index"}
            </h1>
            <p className="max-w-2xl text-sm text-[#94A3B8]">
              {isBoard
                ? "Stage-based kanban for pipeline management — return to Workspace for conversion priorities."
                : "Full lead table with filters — return to Workspace for follow-up priorities and booking readiness."}
            </p>
            <Link href={base} className="inline-block text-sm font-medium text-[#22C1FF] hover:underline">
              ← Back to LeadFlow workspace
            </Link>
          </div>
          <CrmLeadIndexViewTabs tenantId={tenantId} query={query} variant="dark" />
        </div>
      </DashboardCard>

      <CrmLeadListFilters tenantId={tenantId} stages={stages} owners={owners} query={query} />

      {isBoard && board ? (
        <DashboardCard className="p-3 sm:p-4">
          {board.total === 0 && !filtered ? (
            <div className="p-8 text-center text-sm text-[#94A3B8]">
              <p className="font-medium text-[#F8FAFC]">No leads yet</p>
              <p className="mt-2">Create a lead from the workspace or seed data to see cards here.</p>
            </div>
          ) : board.total === 0 && filtered ? (
            <div className="p-8 text-center text-sm text-[#94A3B8]">
              <p className="font-medium text-[#F8FAFC]">No leads match these filters</p>
              <p className="mt-2">Try clearing filters or widening your search.</p>
              <p className="mt-3">
                <Link href={`${base}/crm?view=board`} className="text-[#22C1FF] hover:underline">
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
            />
          )}
        </DashboardCard>
      ) : (
        <DashboardCard className="overflow-hidden p-0">
          {list!.total === 0 && !filtered ? (
            <div className="p-8 text-center text-sm text-[#94A3B8]">
              <p className="font-medium text-[#F8FAFC]">No leads yet</p>
              <p className="mt-2">Create a lead from the workspace or seed data to see rows here.</p>
            </div>
          ) : list!.total === 0 && filtered ? (
            <div className="p-8 text-center text-sm text-[#94A3B8]">
              <p className="font-medium text-[#F8FAFC]">No leads match these filters</p>
              <p className="mt-2">Try clearing filters or widening your search.</p>
              <p className="mt-3">
                <Link href={`${base}/crm?view=list`} className="text-[#22C1FF] hover:underline">
                  Clear filters
                </Link>
              </p>
            </div>
          ) : list!.items.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#94A3B8]">
              <p className="font-medium text-[#F8FAFC]">No leads on this page</p>
              <p className="mt-2">Try going to the first page or loosening filters.</p>
              <p className="mt-3">
                <Link href={firstPageHref} className="text-[#22C1FF] hover:underline">
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
        </DashboardCard>
      )}

      <section id="fi-os-crm-create-lead" className="scroll-mt-24">
        <DashboardCard className="p-4 sm:p-5">
          <SectionHeader title="Create lead" description="Capture a new enquiry directly from the lead index." className="mb-3" />
          <CrmCreateLeadPanel
            tenantId={tenantId}
            owners={owners}
            organisations={scope.organisations}
            clinics={scope.clinics}
          />
        </DashboardCard>
      </section>
    </div>
  );
}
