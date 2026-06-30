"use client";

import type { FiCrmLeadRow, FiCrmLeadStageHistoryRow, FiCrmPipelineStageRow } from "@/src/lib/crm/types";
import { crmLeadCardClass, crmStageLabel } from "./crmSharedStyles";

export type LeadStageSectionProps = {
  lead: FiCrmLeadRow;
  stages: FiCrmPipelineStageRow[];
  stageHistory: FiCrmLeadStageHistoryRow[];
  canMutate: boolean;
  stageBusy?: boolean;
  stageErr?: string | null;
  historyLimit?: number;
  onStageChange?: (toStageId: string) => void | Promise<void>;
};

export function LeadStageSection({
  lead,
  stages,
  stageHistory,
  canMutate,
  stageBusy = false,
  stageErr = null,
  historyLimit = 12,
  onStageChange,
}: LeadStageSectionProps) {
  return (
    <>
      <section className={crmLeadCardClass}>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Pipeline</h3>
        <dl className="grid gap-1 text-xs text-slate-300">
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Status</dt>
            <dd>{lead.status}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Stage</dt>
            <dd>{crmStageLabel(lead.current_stage_id, stages)}</dd>
          </div>
        </dl>
      </section>

      {canMutate ? (
        <section className={crmLeadCardClass}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Change stage</h3>
          <select
            className="w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
            value={lead.current_stage_id ?? ""}
            disabled={stageBusy}
            onChange={(e) => {
              const v = e.target.value;
              if (!v || !onStageChange) return;
              void onStageChange(v);
            }}
          >
            <option value="">Select stage…</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {stageErr ? <p className="mt-1 text-xs text-rose-300">{stageErr}</p> : null}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-slate-400">Recent stage history</summary>
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs text-slate-300">
              {stageHistory.slice(0, historyLimit).map((h) => (
                <li key={h.id} className="border-l-2 border-white/[0.08] pl-2">
                  <time className="text-gray-500">{h.changed_at}</time>
                  <p>
                    {crmStageLabel(h.from_stage_id, stages)} → {crmStageLabel(h.to_stage_id, stages)}
                  </p>
                  <p className="text-gray-500">{h.source}</p>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : (
        <p className="rounded border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          Your role can view this lead but not change CRM data here.
        </p>
      )}
    </>
  );
}
