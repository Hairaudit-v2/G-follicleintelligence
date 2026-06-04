import Link from "next/link";
import {
  CrmActivityPanel,
  CrmLeadSummaryPanel,
  CrmMessagesPanel,
  CrmNotesPanel,
  CrmPipelinePanel,
  CrmTasksPanel,
} from "@/src/components/fi/crm/CrmDataPanels";
import { CrmLeadSmokeForms } from "@/src/components/fi/crm/CrmLeadSmokeForms";
import { assertCrmShellPageAccess } from "@/src/lib/crm/crmShellAccess";
import { loadCrmShellLeadBundle, loadCrmShellPipelineStages } from "@/src/lib/crm/crmShellLoaders";

export const metadata = {
  title: "CRM lead",
  robots: { index: false, follow: false },
};

export default async function CrmLeadShellPage({
  params,
}: {
  params: Promise<{ tenantId: string; leadId: string }>;
}) {
  const { tenantId, leadId } = await params;
  const session = await assertCrmShellPageAccess(tenantId);
  const [stages, bundle] = await Promise.all([loadCrmShellPipelineStages(tenantId), loadCrmShellLeadBundle(tenantId, leadId)]);

  if (!bundle.lead) {
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

  const stageOpts = stages.map((s) => ({ id: s.id, label: s.label, slug: s.slug }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Lead (shell)</h1>
          <p className="text-sm text-gray-600">
            <Link href={`/fi-admin/${tenantId}/crm`} className="text-blue-600 hover:underline">
              ← Leads
            </Link>
            {" · "}
            <Link href={`/fi-admin/${tenantId}/cases`} className="text-blue-600 hover:underline">
              Cases
            </Link>
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <CrmLeadSummaryPanel lead={bundle.lead} />
        <CrmPipelinePanel stages={stages} />
      </div>

      <CrmActivityPanel events={bundle.events} />

      <div className="grid gap-6 lg:grid-cols-3">
        <CrmTasksPanel tasks={bundle.tasks} />
        <CrmNotesPanel notes={bundle.notes} />
        <CrmMessagesPanel messages={bundle.messages} />
      </div>

      <CrmLeadSmokeForms tenantId={tenantId} leadId={bundle.lead.id} stages={stageOpts} fiUserId={session.fiUserId} />
    </div>
  );
}
