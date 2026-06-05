import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CrmLeadDetailPageView } from "@/src/components/fi/crm/detail/CrmLeadDetailPageView";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import { parseCrmLeadDetailTab } from "@/src/lib/crm/crmLeadDetailTabs";
import { parseCrmLeadPreviewSearchParam } from "@/src/lib/crm/crmLeadPreviewQuery";
import { loadCrmShellLeadDetailPagePayload } from "@/src/lib/crm/crmShellLoaders";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; leadId: string }>;
}): Promise<Metadata> {
  const { tenantId, leadId } = await params;
  const payload = await loadCrmShellLeadDetailPagePayload(tenantId, leadId);
  const lead = payload?.detail.lead;
  const title = lead ? leadTitleFromRow(lead.summary, lead.id) : "CRM lead";
  return {
    title: `${title} · CRM`,
    robots: { index: false, follow: false },
  };
}

export default async function CrmLeadShellPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; leadId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId, leadId } = await params;
  const sp = (await searchParams) ?? {};
  const previewLeadId = parseCrmLeadPreviewSearchParam(sp.preview);
  const activeTab = parseCrmLeadDetailTab(sp.tab);
  const payload = await loadCrmShellLeadDetailPagePayload(tenantId, leadId);

  if (!payload?.detail.lead) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-6">
        <h1 className="text-lg font-semibold text-gray-900">Lead not found</h1>
        <p className="text-sm text-gray-600">
          No lead <code className="font-mono text-xs">{leadId}</code> for this tenant, or it was deleted.
        </p>
        <Link href={`/fi-admin/${tenantId}/crm`} className="text-sm text-blue-600 hover:underline">
          ← Leads
        </Link>
      </div>
    );
  }

  const groupingNowIso = new Date().toISOString();

  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl animate-pulse space-y-4 py-6" aria-busy="true" aria-hidden />}>
      <CrmLeadDetailPageView
        tenantId={tenantId}
        leadId={leadId}
        initialPayload={payload}
        activeTab={activeTab}
        previewLeadId={previewLeadId}
        groupingNowIso={groupingNowIso}
      />
    </Suspense>
  );
}
