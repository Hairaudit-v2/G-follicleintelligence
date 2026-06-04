import Link from "next/link";
import {
  CrmActivityPanel,
  CrmLeadSummaryPanel,
  CrmMessagesPanel,
  CrmNotesPanel,
  CrmPipelinePanel,
} from "@/src/components/fi/crm/CrmDataPanels";
import { CrmLeadEditPanel } from "@/src/components/fi/crm/CrmLeadEditPanel";
import { CrmLeadSmokeForms } from "@/src/components/fi/crm/CrmLeadSmokeForms";
import { CrmLeadConversionPanel } from "@/src/components/fi/crm/CrmLeadConversionPanel";
import { CrmLeadCommunicationsWorkflow } from "@/src/components/fi/crm/CrmLeadCommunicationsWorkflow";
import { CrmLeadNotesWorkflow } from "@/src/components/fi/crm/CrmLeadNotesWorkflow";
import { CrmLeadTasksWorkflow } from "@/src/components/fi/crm/CrmLeadTasksWorkflow";
import { assertCrmShellPageAccess } from "@/src/lib/crm/crmShellAccess";
import { loadCrmShellLeadDetailPageData, loadCrmShellPipelineStages } from "@/src/lib/crm/crmShellLoaders";

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
  const [stages, detail] = await Promise.all([loadCrmShellPipelineStages(tenantId), loadCrmShellLeadDetailPageData(tenantId, leadId)]);

  if (!detail.lead) {
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
  const groupingNowIso = new Date().toISOString();

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
        <CrmLeadSummaryPanel lead={detail.lead} />
        <CrmPipelinePanel stages={stages} />
      </div>

      <CrmLeadEditPanel
        tenantId={tenantId}
        lead={detail.lead}
        owners={detail.owners}
        organisations={detail.organisations}
        clinics={detail.clinics}
      />

      <CrmLeadConversionPanel tenantId={tenantId} leadId={detail.lead.id} conversionState={detail.conversionState} />

      <CrmActivityPanel events={detail.events} />

      <CrmLeadNotesWorkflow tenantId={tenantId} leadId={detail.lead.id} leadNotes={detail.leadNotes} />

      <CrmLeadCommunicationsWorkflow tenantId={tenantId} leadId={detail.lead.id} leadCommunications={detail.leadCommunications} />

      <div className="grid gap-6 lg:grid-cols-3">
        <CrmLeadTasksWorkflow
          tenantId={tenantId}
          leadId={detail.lead.id}
          tasks={detail.tasks}
          assigneeOptions={detail.owners}
          groupingNowIso={groupingNowIso}
        />
        <CrmNotesPanel notes={detail.notes} />
        <CrmMessagesPanel messages={detail.messages} />
      </div>

      <CrmLeadSmokeForms tenantId={tenantId} leadId={detail.lead.id} stages={stageOpts} fiUserId={session.fiUserId} />
    </div>
  );
}
