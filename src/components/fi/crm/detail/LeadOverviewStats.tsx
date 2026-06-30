import type { CrmLeadNextAction } from "@/src/lib/crm/crmLeadNextAction";
import type { CrmLeadOpportunitySnapshot } from "@/src/lib/crm/crmLeadOpportunityMeta";
import { crmLeadCardClass } from "../shared";

export function LeadOverviewStats({
  opportunity,
  nextAction,
  openTaskCount,
  pendingReminderCount,
}: {
  opportunity: CrmLeadOpportunitySnapshot;
  nextAction: CrmLeadNextAction;
  openTaskCount: number;
  pendingReminderCount: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className={crmLeadCardClass}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Treatment value</p>
        <p className="mt-1 text-lg font-semibold text-slate-100">{opportunity.treatmentValueLabel ?? "—"}</p>
        <p className="mt-1 text-xs text-gray-500">From lead metadata when set</p>
      </div>
      <div className={crmLeadCardClass}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Conversion probability</p>
        <p className="mt-1 text-lg font-semibold text-slate-100">{opportunity.conversionProbabilityLabel ?? "—"}</p>
        <p className="mt-1 text-xs text-gray-500">
          Stage: {opportunity.stageLabel}
          {opportunity.isWonStage ? " · won" : ""}
          {opportunity.isLostStage ? " · lost" : ""}
        </p>
      </div>
      <div className={crmLeadCardClass}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Next action</p>
        <p className="mt-1 text-sm font-medium text-slate-100">{nextAction.label}</p>
        {nextAction.atIso ? (
          <p className="mt-1 text-xs text-gray-500">{nextAction.atIso}</p>
        ) : (
          <p className="mt-1 text-xs text-gray-500 capitalize">
            {nextAction.kind === "appointment" ? "upcoming visit" : nextAction.kind}
          </p>
        )}
      </div>
      <div className={crmLeadCardClass}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Workload</p>
        <p className="mt-1 text-lg font-semibold text-slate-100">
          {openTaskCount} <span className="text-sm font-normal text-slate-400">open tasks</span>
        </p>
        <p className="mt-1 text-xs text-gray-500">{pendingReminderCount} pending reminders</p>
      </div>
    </div>
  );
}
