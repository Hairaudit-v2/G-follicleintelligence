import type { FiCrmLeadRow, FiCrmPipelineStageRow } from "./types";

function stageLabel(stageId: string | null, stages: FiCrmPipelineStageRow[]): string {
  if (!stageId) return "—";
  return stages.find((s) => s.id === stageId)?.label ?? `${stageId.slice(0, 8)}…`;
}

export type CrmLeadOpportunitySnapshot = {
  treatmentValueLabel: string | null;
  conversionProbabilityLabel: string | null;
  opportunityNotes: string | null;
  sourceSystem: string | null;
  sourceLeadId: string | null;
  stageLabel: string;
  isWonStage: boolean;
  isLostStage: boolean;
};

function metaString(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = metadata[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

/** Reads optional commercial fields from `fi_crm_leads.metadata` (shell convention). */
export function parseCrmLeadOpportunitySnapshot(
  lead: FiCrmLeadRow,
  stages: FiCrmPipelineStageRow[]
): CrmLeadOpportunitySnapshot {
  const metadata = lead.metadata ?? {};
  const stage = stages.find((s) => s.id === lead.current_stage_id);
  const treatmentRaw = metaString(metadata, [
    "treatment_value",
    "treatment_value_gbp",
    "estimated_value",
    "deal_value",
  ]);
  const treatmentValueLabel = treatmentRaw
    ? treatmentRaw.startsWith("£") || treatmentRaw.startsWith("$")
      ? treatmentRaw
      : `£${treatmentRaw}`
    : null;

  const probRaw = metaString(metadata, ["conversion_probability", "win_probability", "close_probability"]);
  const conversionProbabilityLabel = probRaw
    ? probRaw.endsWith("%")
      ? probRaw
      : `${probRaw}%`
    : null;

  return {
    treatmentValueLabel,
    conversionProbabilityLabel,
    opportunityNotes: metaString(metadata, ["opportunity_notes", "opportunity_summary", "deal_notes"]),
    sourceSystem: metaString(metadata, ["source_system", "crm_source_system"]),
    sourceLeadId: metaString(metadata, ["source_lead_id", "external_lead_id"]),
    stageLabel: stageLabel(lead.current_stage_id, stages),
    isWonStage: Boolean(stage?.is_won),
    isLostStage: Boolean(stage?.is_lost),
  };
}
