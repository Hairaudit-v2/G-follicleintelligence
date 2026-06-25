/**
 * LeadFlowOS Phase LF-1 — pure foundation (no DB I/O).
 * Deterministic enums, validation, and payload builders for fi_leads / fi_lead_activity / fi_external_events.
 */

import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";

export const FI_LEAD_EXTERNAL_PROVIDERS = [
  "hubspot",
  "meta_ads",
  "google_ads",
  "website",
  "referral",
  "zapier",
  "manual",
] as const;
export type FiLeadExternalProvider = (typeof FI_LEAD_EXTERNAL_PROVIDERS)[number];

export const FI_LEAD_EXTERNAL_EVENT_STATUSES = [
  "pending",
  "processing",
  "processed",
  "failed",
  "retrying",
  "skipped",
] as const;
export type FiLeadExternalEventStatus = (typeof FI_LEAD_EXTERNAL_EVENT_STATUSES)[number];

export const FI_LEAD_CURRENT_STAGES = [
  "new",
  "contacted",
  "qualified",
  "consultation_booked",
  "consultation_completed",
  "proposal_sent",
  "won",
  "lost",
  "nurture",
] as const;
export type FiLeadCurrentStage = (typeof FI_LEAD_CURRENT_STAGES)[number];

export const FI_LEAD_ACTIVITY_TYPES = [
  "lead_created",
  "lead_updated",
  "stage_changed",
  "score_updated",
  "priority_band_changed",
  "predicted_procedure_changed",
  "consultant_assigned",
  "external_event_processed",
  "note_added",
  "communication_logged",
] as const;
export type FiLeadActivityType = (typeof FI_LEAD_ACTIVITY_TYPES)[number];

export const FI_LEAD_TERMINAL_STAGES: readonly FiLeadCurrentStage[] = ["won", "lost"];

const ALLOWED_STAGE_TRANSITIONS: Record<FiLeadCurrentStage, readonly FiLeadCurrentStage[]> = {
  new: ["contacted", "qualified", "nurture", "lost"],
  contacted: ["qualified", "consultation_booked", "nurture", "lost"],
  qualified: ["consultation_booked", "proposal_sent", "nurture", "lost"],
  consultation_booked: ["consultation_completed", "lost", "nurture"],
  consultation_completed: ["proposal_sent", "won", "lost", "nurture"],
  proposal_sent: ["won", "lost", "nurture"],
  won: [],
  lost: ["nurture"],
  nurture: ["contacted", "qualified", "lost"],
};

export function isFiLeadExternalProvider(v: string): v is FiLeadExternalProvider {
  return (FI_LEAD_EXTERNAL_PROVIDERS as readonly string[]).includes(v);
}

export function isFiLeadExternalEventStatus(v: string): v is FiLeadExternalEventStatus {
  return (FI_LEAD_EXTERNAL_EVENT_STATUSES as readonly string[]).includes(v);
}

export function isFiLeadCurrentStage(v: string): v is FiLeadCurrentStage {
  return (FI_LEAD_CURRENT_STAGES as readonly string[]).includes(v);
}

export function isFiLeadActivityType(v: string): v is FiLeadActivityType {
  return (FI_LEAD_ACTIVITY_TYPES as readonly string[]).includes(v);
}

export function clampLeadScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeLeadPhoneDigits(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export function normalizeLeadEmail(email: string | null | undefined): string | null {
  return normalizeEmail(email ?? null);
}

export function canTransitionLeadStage(from: FiLeadCurrentStage, to: FiLeadCurrentStage): boolean {
  if (from === to) return true;
  return ALLOWED_STAGE_TRANSITIONS[from].includes(to);
}

export function assertLeadStageTransition(from: string, to: string): FiLeadCurrentStage {
  if (!isFiLeadCurrentStage(from)) {
    throw new Error(`Invalid lead stage: ${from}`);
  }
  if (!isFiLeadCurrentStage(to)) {
    throw new Error(`Invalid lead stage: ${to}`);
  }
  if (!canTransitionLeadStage(from, to)) {
    throw new Error(`Lead stage transition not allowed: ${from} → ${to}`);
  }
  return to;
}

export function buildLeadStageChangedActivityMetadata(input: {
  fromStage: string;
  toStage: string;
  reason?: string | null;
  source?: string | null;
}): Record<string, unknown> {
  return {
    from_stage: input.fromStage,
    to_stage: input.toStage,
    ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
    ...(input.source?.trim() ? { source: input.source.trim() } : {}),
  };
}

export function buildLeadScoreUpdatedActivityMetadata(input: {
  previousScore: number;
  nextScore: number;
  previousConversionProbability?: number;
  nextConversionProbability?: number;
  source?: string | null;
}): Record<string, unknown> {
  return {
    previous_score: clampLeadScore(input.previousScore),
    next_score: clampLeadScore(input.nextScore),
    ...(input.previousConversionProbability != null
      ? { previous_conversion_probability: clampLeadScore(input.previousConversionProbability) }
      : {}),
    ...(input.nextConversionProbability != null
      ? { next_conversion_probability: clampLeadScore(input.nextConversionProbability) }
      : {}),
    ...(input.source?.trim() ? { source: input.source.trim() } : {}),
  };
}

export function buildPriorityBandChangedActivityMetadata(input: {
  fromBand: string;
  toBand: string;
  leadScore?: number;
  source?: string | null;
}): Record<string, unknown> {
  return {
    from_priority_band: input.fromBand,
    to_priority_band: input.toBand,
    ...(input.leadScore != null ? { lead_score: clampLeadScore(input.leadScore) } : {}),
    ...(input.source?.trim() ? { source: input.source.trim() } : {}),
  };
}

export function buildPredictedProcedureChangedActivityMetadata(input: {
  fromProcedure: string;
  toProcedure: string;
  source?: string | null;
}): Record<string, unknown> {
  return {
    from_predicted_procedure: input.fromProcedure,
    to_predicted_procedure: input.toProcedure,
    ...(input.source?.trim() ? { source: input.source.trim() } : {}),
  };
}

export function buildExternalEventProcessedActivityMetadata(input: {
  externalEventId: string;
  provider: string;
  eventType: string;
  externalId?: string | null;
}): Record<string, unknown> {
  return {
    external_event_id: input.externalEventId,
    provider: input.provider,
    event_type: input.eventType,
    ...(input.externalId?.trim() ? { external_id: input.externalId.trim() } : {}),
  };
}

export function externalEventIdempotencyKey(input: {
  tenantId: string;
  provider: string;
  externalId: string | null | undefined;
}): string | null {
  const externalId = input.externalId?.trim();
  if (!externalId) return null;
  return `${input.tenantId.trim()}::${input.provider.trim()}::${externalId}`;
}
