import Link from "next/link";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export function OperationsCrmPipelineSnapshot(props: {
  base: string;
  showCrmNav: boolean;
  data: Pick<TenantOperationalDashboard, "crmPipelineStages" | "crmPipelineLeadVolume" | "staleLeads">;
}) {
  const { base, showCrmNav, data } = props;
  const crmHref = showCrmNav ? `${base}/crm` : `${base}/calendar`;
  const staleTotal = data.staleLeads.length;

  const funnelStages = data.crmPipelineStages
    .filter((s) => !s.is_won && !s.is_lost)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="ops-crm-pipeline-heading">
      <SectionHeader
        id="ops-crm-pipeline-heading"
        kicker="CRM"
        title="CRM pipeline snapshot"
        description="Active lead volume by pipeline stage (non-terminal lead statuses)."
        className="mb-4"
      />
      <p className="mb-3 text-xs text-slate-500">
        Stale leads: <span className="font-mono text-slate-300">{staleTotal}</span>
      </p>
      {funnelStages.length === 0 ? (
        <p className="text-sm text-slate-500">No active pipeline stages loaded for this tenant.</p>
      ) : (
        <ul className="space-y-2">
          {funnelStages.map((stage) => {
            const n = data.crmPipelineLeadVolume.activeByStageId[stage.id] ?? 0;
            return (
              <li key={stage.id}>
                <Link
                  href={crmHref}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
                    n > 0
                      ? "border-cyan-500/15 bg-cyan-500/[0.04] hover:border-cyan-400/35"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-cyan-500/25",
                  )}
                >
                  <span className="min-w-0 truncate font-medium text-slate-200">{stage.label}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-lg px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
                      n > 0 ? "bg-cyan-500/12 text-cyan-100" : "bg-white/[0.04] text-slate-500",
                    )}
                  >
                    {n}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {(data.crmPipelineLeadVolume.activeUnassignedStage > 0 || data.crmPipelineLeadVolume.activeOtherPipelineStage > 0) ? (
        <div className="mt-3 space-y-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
          {data.crmPipelineLeadVolume.activeUnassignedStage > 0 ? (
            <p>
              No stage:{" "}
              <span className="font-mono font-semibold text-slate-200">
                {data.crmPipelineLeadVolume.activeUnassignedStage}
              </span>
            </p>
          ) : null}
          {data.crmPipelineLeadVolume.activeOtherPipelineStage > 0 ? (
            <p>
              Other pipeline stages:{" "}
              <span className="font-mono font-semibold text-slate-200">
                {data.crmPipelineLeadVolume.activeOtherPipelineStage}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="mt-3 text-xs text-slate-500">
        Open{" "}
        <Link className="text-cyan-400/90 underline-offset-2 hover:underline" href={crmHref}>
          LeadFlow
        </Link>{" "}
        for full pipeline and tasks.
      </p>
    </DashboardCard>
  );
}
