import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { CrmCreateLeadPanel } from "@/src/components/fi/crm/CrmCreateLeadPanel";
import { CrmLeadIdJump } from "@/src/components/fi/crm/CrmLeadIdJump";
import { CrmPipelinePanel } from "@/src/components/fi/crm/CrmDataPanels";
import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import type { LeadFlowDashboardPayload } from "@/src/lib/fiAdmin/leadFlowDashboardTypes";
import { summarizeHubspotDiagnostics } from "@/src/lib/fiAdmin/leadFlowPresentation";
import type { CrmShellClinicOption, CrmShellOrgOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";

export function LeadFlowSystemDiagnostics({
  tenantId,
  payload,
  owners,
  scope,
  showDiagnosticsExpanded = false,
  sessionLabel,
}: {
  tenantId: string;
  payload: LeadFlowDashboardPayload;
  owners: CrmShellUserPickerOption[];
  scope: { organisations: CrmShellOrgOption[]; clinics: CrmShellClinicOption[] };
  showDiagnosticsExpanded?: boolean;
  sessionLabel?: string;
}) {
  const base = `/fi-admin/${tenantId}`;
  const { crmPipelineStages, crmPipelineLeadVolume, hubspotImport } = payload;
  const funnelStages = crmPipelineStages
    .filter((s) => !s.is_won && !s.is_lost)
    .sort((a, b) => a.sort_order - b.sort_order);
  const activeTotal =
    Object.values(crmPipelineLeadVolume.activeByStageId).reduce((sum, n) => sum + n, 0) +
    crmPipelineLeadVolume.activeUnassignedStage +
    crmPipelineLeadVolume.activeOtherPipelineStage;

  return (
    <details
      className="rounded-2xl border border-white/[0.08] bg-[#0c1220]/60 backdrop-blur-sm"
      open={showDiagnosticsExpanded}
    >
      <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Operators</p>
            <h2 className="mt-1 text-lg font-semibold text-[#F8FAFC]">System diagnostics</h2>
            <p className="mt-1 max-w-3xl text-sm text-[#94A3B8]">
              For platform operators only. These checks support lead integrity and external imports without affecting
              day-to-day conversion workflows.
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-[#22C1FF]/80">
            {showDiagnosticsExpanded ? "Collapse" : "Expand"}
          </span>
        </div>
      </summary>

      <div className="space-y-6 border-t border-white/[0.06] px-5 py-5 sm:px-6 sm:py-6">
        {sessionLabel ? (
          <p className="text-xs text-[#64748B]">
            Session: <span className="text-[#94A3B8]">{sessionLabel}</span>
          </p>
        ) : null}

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="CRM pipeline volume"
            description="Active lead counts by stage (fi_crm_leads, non-terminal statuses)."
            className="mb-3"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Active leads" value={activeTotal} />
            <StatCard label="No stage" value={crmPipelineLeadVolume.activeUnassignedStage} />
            <StatCard label="Other stages" value={crmPipelineLeadVolume.activeOtherPipelineStage} />
            <StatCard label="Funnel stages" value={funnelStages.length} />
          </div>
          {funnelStages.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-sm">
              {funnelStages.map((stage) => (
                <li key={stage.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] px-3 py-2">
                  <span className="text-[#CBD5E1]">
                    {stage.label}{" "}
                    <span className="text-xs text-[#64748B]">({stage.slug})</span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[#94A3B8]">
                    {crmPipelineLeadVolume.activeByStageId[stage.id] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="HubSpot import status"
            description="Latest fi_import_batches row and staging table counts."
            className="mb-3"
          />
          <p className="text-sm text-[#94A3B8]">{summarizeHubspotDiagnostics(hubspotImport)}</p>
          {hubspotImport.latestBatch ? (
            <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-[#94A3B8] sm:grid-cols-2">
              <div>
                <dt className="text-[#64748B]">Batch status</dt>
                <dd className="font-mono text-[#CBD5E1]">{hubspotImport.latestBatch.status}</dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Staging rows</dt>
                <dd className="font-mono text-[#CBD5E1]">{hubspotImport.stagingRowCount}</dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Duplicate emails (dry-run)</dt>
                <dd className="font-mono text-[#CBD5E1]">{hubspotImport.duplicateEmailCount}</dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Duplicate phones (dry-run)</dt>
                <dd className="font-mono text-[#CBD5E1]">{hubspotImport.duplicatePhoneCount}</dd>
              </div>
            </dl>
          ) : null}
          <p className="mt-3">
            <Link href={`${base}/settings/imports/hubspot`} className="text-sm font-semibold text-[#22C1FF] hover:underline">
              Open HubSpot import centre →
            </Link>
          </p>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader title="Pipeline stage reference" description="fi_crm_pipeline_stages for this tenant scope." className="mb-3" />
          <div className="rounded-xl border border-white/[0.06] bg-[#081020]/50 p-3">
            <CrmPipelinePanel stages={crmPipelineStages} />
          </div>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader title="Open lead by ID" description="Direct UUID jump for operator support." className="mb-3" />
          <CrmLeadIdJump tenantId={tenantId} />
        </DashboardCard>

        {showDiagnosticsExpanded ? (
          <div id="fi-os-crm-create-lead" className="scroll-mt-24">
            <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
              <SectionHeader
                title="Create lead (operator)"
                description="Server-action lead capture for testing and imports."
                className="mb-3"
              />
              <CrmCreateLeadPanel
                tenantId={tenantId}
                owners={owners}
                organisations={scope.organisations}
                clinics={scope.clinics}
              />
            </DashboardCard>
          </div>
        ) : null}

        <p className="flex items-center gap-2 text-xs text-[#64748B]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#22C1FF]/70" aria-hidden />
          Diagnostics are read-only observability — clinic conversion workflows are unaffected.
        </p>
      </div>
    </details>
  );
}
