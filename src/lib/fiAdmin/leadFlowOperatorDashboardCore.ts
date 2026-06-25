/**
 * LeadFlowOS Phase LF-4 — pure dashboard aggregation (no DB I/O).
 */

import {
  LEAD_PRIORITY_BANDS,
  PREDICTED_PROCEDURES,
  type LeadPriorityBand,
  type PredictedProcedure,
} from "@/src/lib/leadFlow/leadScoringEngine";
import type { FiLeadRow } from "@/src/lib/leadFlow/leadFlowFoundationTypes";
import type { LeadFlowQueueDiagnosticEvent } from "@/src/lib/leadFlow/leadFlowQueueDiagnostics.server";
import type {
  LeadFlowOperatorHighPriorityLead,
  LeadFlowOperatorPipelineColumn,
  LeadFlowOperatorPipelineLeadPreview,
  LeadFlowOperatorSanitizedFailedEvent,
  LeadFlowOperatorSummaryMetrics,
} from "@/src/lib/fiAdmin/leadFlowOperatorDashboardTypes";

export const LEADFLOW_OPERATOR_PIPELINE_STAGES = [
  { id: "new", label: "New", stage: "new" },
  { id: "contacted", label: "Contacted", stage: "contacted" },
  { id: "consultation_booked", label: "Consultation Scheduled", stage: "consultation_booked" },
  { id: "consultation_completed", label: "Consultation Completed", stage: "consultation_completed" },
  { id: "proposal_sent", label: "Quote Sent", stage: "proposal_sent" },
  { id: "won", label: "Procedure Booked", stage: "won" },
  { id: "lost", label: "Lost", stage: "lost" },
] as const;

const HIGH_PRIORITY_BANDS = new Set<string>(["high", "urgent"]);

export function formatLeadFlowOperatorName(lead: Pick<FiLeadRow, "first_name" | "last_name">): string {
  const parts = [lead.first_name?.trim(), lead.last_name?.trim()].filter(Boolean);
  if (parts.length === 0) return "Unnamed lead";
  return parts.join(" ");
}

export function formatLeadFlowOperatorContact(lead: Pick<FiLeadRow, "email" | "phone">): string | null {
  const email = lead.email?.trim();
  if (email) return email;
  const phone = lead.phone?.trim();
  return phone || null;
}

export function labelLeadFlowOperatorStage(stage: string | null | undefined): string {
  const match = LEADFLOW_OPERATOR_PIPELINE_STAGES.find((col) => col.stage === stage);
  if (match) return match.label;
  if (stage === "qualified") return "Qualified";
  if (stage === "nurture") return "Nurture";
  return stage?.trim() ? stage.replace(/_/g, " ") : "Unknown";
}

export function labelLeadFlowOperatorPriority(band: string | null | undefined): string {
  if (!band?.trim()) return "Unscored";
  const normalized = band.trim().toLowerCase();
  if (normalized === "urgent") return "Urgent";
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  return band;
}

export function labelLeadFlowOperatorPredictedProcedure(value: string | null | undefined): string {
  if (!value?.trim()) return "Unknown";
  switch (value.trim().toLowerCase()) {
    case "fue_transplant":
      return "FUE transplant";
    case "repair_case":
      return "Repair case";
    case "prp":
      return "PRP";
    case "exosomes":
      return "Exosomes";
    case "consultation_only":
      return "Consultation only";
    case "unknown":
      return "Unknown";
    default:
      return value.replace(/_/g, " ");
  }
}

export function labelLeadFlowOperatorActivityType(activityType: string): string {
  return activityType
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sanitizeLeadFlowOperatorErrorMessage(message: string | null | undefined): string | null {
  if (!message?.trim()) return null;
  return message
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [redacted]")
    .replace(/[Aa]uthorization:\s*\S+/g, "Authorization: [redacted]")
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token": "[redacted]"')
    .replace(/"refresh_token"\s*:\s*"[^"]+"/gi, '"refresh_token": "[redacted]"')
    .trim();
}

export function sanitizeLeadFlowOperatorFailedEvent(
  event: LeadFlowQueueDiagnosticEvent
): LeadFlowOperatorSanitizedFailedEvent {
  return {
    id: event.id,
    provider: event.provider,
    eventType: event.event_type,
    externalId: event.external_id,
    errorMessage: sanitizeLeadFlowOperatorErrorMessage(event.error_message),
    retryCount: event.retry_count,
    createdAt: event.created_at,
  };
}

export function summarizeLeadFlowOperatorActivityMetadata(
  activityType: string,
  metadata: Record<string, unknown>
): string {
  const type = activityType.trim().toLowerCase();
  if (type === "stage_changed") {
    const from = metadata.from_stage != null ? labelLeadFlowOperatorStage(String(metadata.from_stage)) : "—";
    const to = metadata.to_stage != null ? labelLeadFlowOperatorStage(String(metadata.to_stage)) : "—";
    return `Moved from ${from} to ${to}`;
  }
  if (type === "score_updated") {
    const prev = metadata.previous_score;
    const next = metadata.next_score;
    if (prev != null && next != null) return `Score updated from ${prev} to ${next}`;
    return "Lead score updated";
  }
  if (type === "priority_band_changed") {
    const from = metadata.from_band != null ? labelLeadFlowOperatorPriority(String(metadata.from_band)) : "—";
    const to = metadata.to_band != null ? labelLeadFlowOperatorPriority(String(metadata.to_band)) : "—";
    return `Priority changed from ${from} to ${to}`;
  }
  if (type === "predicted_procedure_changed") {
    const from = metadata.from_procedure != null ? labelLeadFlowOperatorPredictedProcedure(String(metadata.from_procedure)) : "—";
    const to = metadata.to_procedure != null ? labelLeadFlowOperatorPredictedProcedure(String(metadata.to_procedure)) : "—";
    return `Predicted procedure changed from ${from} to ${to}`;
  }
  if (type === "lead_created") return "New lead captured";
  if (type === "lead_updated") return "Lead details updated";
  if (type === "consultant_assigned") return "Consultant assigned";
  if (type === "external_event_processed") {
    const provider = metadata.provider != null ? String(metadata.provider) : "external source";
    return `Processed inbound event from ${provider}`;
  }
  if (type === "note_added") return "Note added";
  if (type === "communication_logged") return "Communication logged";
  return "Activity recorded";
}

function comparePipelineLeads(a: FiLeadRow, b: FiLeadRow): number {
  const scoreDiff = (b.lead_score ?? 0) - (a.lead_score ?? 0);
  if (scoreDiff !== 0) return scoreDiff;
  return String(b.updated_at).localeCompare(String(a.updated_at));
}

function toPipelinePreview(lead: FiLeadRow): LeadFlowOperatorPipelineLeadPreview {
  return {
    id: lead.id,
    name: formatLeadFlowOperatorName(lead),
    procedureInterest: lead.procedure_interest,
    priorityBand: lead.priority_band,
    leadScore: lead.lead_score ?? 0,
  };
}

export function buildLeadFlowOperatorSummaryMetrics(
  leads: FiLeadRow[],
  failedIngestionEvents: number
): LeadFlowOperatorSummaryMetrics {
  let newLeads = 0;
  let highUrgentPriorityLeads = 0;
  let consultationBooked = 0;
  let quoteSent = 0;
  let procedureBooked = 0;

  for (const lead of leads) {
    const stage = String(lead.current_stage ?? "").trim().toLowerCase();
    const band = String(lead.priority_band ?? "").trim().toLowerCase();
    if (stage === "new") newLeads += 1;
    if (HIGH_PRIORITY_BANDS.has(band)) highUrgentPriorityLeads += 1;
    if (stage === "consultation_booked") consultationBooked += 1;
    if (stage === "proposal_sent") quoteSent += 1;
    if (stage === "won") procedureBooked += 1;
  }

  return {
    totalLeads: leads.length,
    newLeads,
    highUrgentPriorityLeads,
    consultationBooked,
    quoteSent,
    procedureBooked,
    failedIngestionEvents,
  };
}

export function buildLeadFlowOperatorPipelineColumns(leads: FiLeadRow[]): LeadFlowOperatorPipelineColumn[] {
  const byStage = new Map<string, FiLeadRow[]>();
  for (const col of LEADFLOW_OPERATOR_PIPELINE_STAGES) {
    byStage.set(col.stage, []);
  }

  for (const lead of leads) {
    const stage = String(lead.current_stage ?? "").trim().toLowerCase();
    const bucket = byStage.get(stage);
    if (bucket) bucket.push(lead);
  }

  return LEADFLOW_OPERATOR_PIPELINE_STAGES.map((col) => {
    const stageLeads = [...(byStage.get(col.stage) ?? [])].sort(comparePipelineLeads);
    return {
      id: col.id,
      label: col.label,
      stage: col.stage,
      count: stageLeads.length,
      topLeads: stageLeads.slice(0, 5).map(toPipelinePreview),
    };
  });
}

export function buildLeadFlowOperatorPriorityCounts(leads: FiLeadRow[]): Record<LeadPriorityBand, number> {
  const counts = Object.fromEntries(LEAD_PRIORITY_BANDS.map((band) => [band, 0])) as Record<
    LeadPriorityBand,
    number
  >;

  for (const lead of leads) {
    const band = String(lead.priority_band ?? "").trim().toLowerCase();
    if ((LEAD_PRIORITY_BANDS as readonly string[]).includes(band)) {
      counts[band as LeadPriorityBand] += 1;
    } else {
      counts.low += 1;
    }
  }

  return counts;
}

export function buildLeadFlowOperatorPredictedProcedureCounts(
  leads: FiLeadRow[]
): Record<PredictedProcedure, number> {
  const counts = Object.fromEntries(PREDICTED_PROCEDURES.map((proc) => [proc, 0])) as Record<
    PredictedProcedure,
    number
  >;

  for (const lead of leads) {
    const proc = String(lead.predicted_procedure ?? "").trim().toLowerCase();
    if ((PREDICTED_PROCEDURES as readonly string[]).includes(proc)) {
      counts[proc as PredictedProcedure] += 1;
    } else {
      counts.unknown += 1;
    }
  }

  return counts;
}

export function selectLeadFlowOperatorHighPriorityLeads(
  leads: FiLeadRow[],
  limit = 25
): LeadFlowOperatorHighPriorityLead[] {
  return [...leads]
    .filter((lead) => HIGH_PRIORITY_BANDS.has(String(lead.priority_band ?? "").trim().toLowerCase()))
    .sort((a, b) => {
      const scoreDiff = (b.lead_score ?? 0) - (a.lead_score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return String(b.updated_at).localeCompare(String(a.updated_at));
    })
    .slice(0, limit)
    .map((lead) => ({
      id: lead.id,
      name: formatLeadFlowOperatorName(lead),
      contact: formatLeadFlowOperatorContact(lead),
      procedureInterest: lead.procedure_interest,
      source: lead.lead_source,
      stage: String(lead.current_stage ?? ""),
      stageLabel: labelLeadFlowOperatorStage(lead.current_stage),
      score: lead.lead_score ?? 0,
      priority: lead.priority_band,
      priorityLabel: labelLeadFlowOperatorPriority(lead.priority_band),
      predictedProcedure: lead.predicted_procedure,
      predictedProcedureLabel: labelLeadFlowOperatorPredictedProcedure(lead.predicted_procedure),
      updatedAt: lead.updated_at,
    }));
}
