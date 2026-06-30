"use client";

import { useMemo } from "react";
import { parseCrmLeadOpportunitySnapshot } from "@/src/lib/crm/crmLeadOpportunityMeta";
import { suggestNextStageAfterAppointmentComplete } from "@/src/lib/crm/crmLeadStageSuggestions";
import type { AppointmentCompletionLeadOpts } from "@/src/lib/crm/appointmentCompletionLeadClient";
import type { FiCrmLeadRow, FiCrmPipelineStageRow } from "@/src/lib/crm/types";
import { appointmentCardClass } from "./appointmentSharedStyles";

export function defaultAppointmentCompletionLeadOpts(
  lead: FiCrmLeadRow,
  pipelineStages: FiCrmPipelineStageRow[],
  bookingType: string
): AppointmentCompletionLeadOpts {
  const suggested = suggestNextStageAfterAppointmentComplete(pipelineStages, lead, bookingType);
  return {
    advanceStage: Boolean(suggested),
    toStageId: suggested,
    treatmentValue: "",
    conversionProbability: "",
  };
}

export function AppointmentCompletionLeadWorkflow({
  lead,
  pipelineStages,
  bookingType,
  value,
  onChange,
  disabled,
}: {
  lead: FiCrmLeadRow;
  pipelineStages: FiCrmPipelineStageRow[];
  bookingType: string;
  value: AppointmentCompletionLeadOpts;
  onChange: (next: AppointmentCompletionLeadOpts) => void;
  disabled?: boolean;
}) {
  const opportunity = useMemo(
    () => parseCrmLeadOpportunitySnapshot(lead, pipelineStages),
    [lead, pipelineStages]
  );
  const suggestedStageId = useMemo(
    () => suggestNextStageAfterAppointmentComplete(pipelineStages, lead, bookingType),
    [pipelineStages, lead, bookingType]
  );

  const sortedStages = useMemo(
    () => [...pipelineStages].sort((a, b) => a.sort_order - b.sort_order),
    [pipelineStages]
  );

  return (
    <section className={`${appointmentCardClass} border-emerald-100 bg-emerald-500/10`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-300">On completion — update lead</h3>
      <p className="mt-1 text-xs text-slate-400">
        Optional CRM updates when you mark this appointment complete. Current stage: {opportunity.stageLabel}.
      </p>

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={value.advanceStage}
          disabled={disabled || !suggestedStageId}
          onChange={(e) =>
            onChange({
              ...value,
              advanceStage: e.target.checked,
              toStageId: e.target.checked ? value.toStageId || suggestedStageId : value.toStageId,
            })
          }
        />
        Advance lead stage
      </label>
      {value.advanceStage ? (
        <select
          className="mt-2 w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
          value={value.toStageId ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, toStageId: e.target.value || null })}
        >
          <option value="">Select stage…</option>
          {sortedStages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
              {s.is_won ? " (won)" : ""}
              {s.is_lost ? " (lost)" : ""}
            </option>
          ))}
        </select>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block text-xs text-slate-400">
          Treatment value
          <input
            type="text"
            className="mt-1 w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
            placeholder={opportunity.treatmentValueLabel ?? "e.g. 8500"}
            value={value.treatmentValue}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, treatmentValue: e.target.value })}
          />
        </label>
        <label className="block text-xs text-slate-400">
          Conversion probability
          <input
            type="text"
            className="mt-1 w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
            placeholder={opportunity.conversionProbabilityLabel ?? "e.g. 65%"}
            value={value.conversionProbability}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, conversionProbability: e.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
