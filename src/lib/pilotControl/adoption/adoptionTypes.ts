/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.6 — adoption event + metric contracts (pure).
 */

import type { PilotControlActorType, PilotControlEventKind } from "../pilotControlContracts";
import type { PilotEvidenceSourceClass } from "../readiness/cohortReadinessSummary";

export const PILOT_ADOPTION_METRIC_VERSION = "1A.6.0" as const;

export const PILOT_METRIC_CONFIDENCE = [
  "live_verified",
  "live_partial",
  "synthetic_only",
  "snapshot_derived",
  "insufficient_evidence",
  "source_unavailable",
] as const;

export type PilotMetricConfidence = (typeof PILOT_METRIC_CONFIDENCE)[number];

export type PilotMetric<T> = {
  value: T;
  confidence: PilotMetricConfidence;
  numerator?: number;
  denominator?: number;
  source: string[];
  evaluatedAt: string;
  warning?: string;
};

export type PilotAdoptionEvent = {
  eventId: string;
  eventType: string;
  tenantId: string;
  programmeId: string;
  enrolmentId?: string;
  patientId?: string;
  actorType: PilotControlActorType;
  actorId?: string;
  actorRole?: string;
  sourceModule: string;
  sourceRecordId?: string;
  occurredAt: string;
  correlationId?: string;
  idempotencyKey?: string;
  metadataClass?: string;
  evidenceClass?: PilotEvidenceSourceClass;
  /** Ingestion timestamp when distinct from event time. */
  ingestedAt?: string;
};

/** Sensitive payload keys that must never appear on adoption events. */
export const PILOT_ADOPTION_FORBIDDEN_PAYLOAD_KEYS = [
  "clinicalNotes",
  "clinical_notes",
  "pathologyValue",
  "pathology_value",
  "medication",
  "cardNumber",
  "card_number",
  "paymentToken",
  "payment_token",
  "messageBody",
  "message_body",
  "messageContent",
  "documentContent",
  "document_content",
  "imageUrl",
  "image_url",
  "accessToken",
  "access_token",
  "secret",
  "password",
] as const;

export const MANUAL_CHANNEL_FALLBACK_CLASSES = [
  "phone",
  "email",
  "sms",
  "spreadsheet",
  "paper",
  "external_messaging",
  "manual_finance",
  "manual_scheduling",
  "other",
] as const;

export type ManualChannelFallbackClass = (typeof MANUAL_CHANNEL_FALLBACK_CLASSES)[number];

/** Extended event kinds beyond 1A.1 freeze — additive for 1A.6 adoption coverage. */
export const PILOT_ADOPTION_EXTENDED_EVENT_KINDS = [
  "patient_action_overdue",
  "clinic_action_overdue",
  "journey_milestone_blocked",
  "quote_accepted",
  "payment_reconciliation_required",
  "pathology_reviewed",
  "images_requested",
  "images_reviewed",
  "notification_delivered",
  "readiness_evaluated",
  "blocker_opened",
  "blocker_escalated",
  "blocker_resolved",
  "manual_channel_fallback_recorded",
  "workflow_abandoned",
] as const;

export type PilotAdoptionExtendedEventKind =
  (typeof PILOT_ADOPTION_EXTENDED_EVENT_KINDS)[number];

export type PilotAdoptionEventKind =
  | PilotControlEventKind
  | PilotAdoptionExtendedEventKind;

export type PilotExpansionRecommendation =
  | "not_started"
  | "insufficient_evidence"
  | "continue_current_scope"
  | "hold_expansion"
  | "pause_pilot"
  | "eligible_for_governance_review";

export type RealPatientPilotGate = {
  technicalAcceptance: boolean;
  migrationsApplied: boolean;
  tenantIsolationProven: boolean;
  roleMatrixProven: boolean;
  identityIntegrityProven: boolean;
  financeIntegrityProven: boolean;
  consentControlsProven: boolean;
  clinicalGovernanceApproved: boolean;
  privacyApproved: boolean;
  operationalSopApproved: boolean;
  staffTrainingCompleted: boolean;
  supportCoverageConfirmed: boolean;
  incidentResponseConfirmed: boolean;
  rollbackConfirmed: boolean;
  pilotCohortApproved: boolean;
  directorApproval: boolean;
  eligible: boolean;
  blockers: string[];
};

export type PilotHealthDimensionState =
  | "healthy"
  | "attention"
  | "unhealthy"
  | "insufficient_evidence";

export type PilotHealthDimension = {
  state: PilotHealthDimensionState;
  reasonCodes: string[];
  metricKeys: string[];
  evaluatedAt: string;
};

export function metricNumber(
  value: number | null,
  args: {
    confidence: PilotMetricConfidence;
    numerator?: number;
    denominator?: number;
    source: string[];
    evaluatedAt: string;
    warning?: string;
  }
): PilotMetric<number | null> {
  return {
    value,
    confidence: args.confidence,
    numerator: args.numerator,
    denominator: args.denominator,
    source: args.source,
    evaluatedAt: args.evaluatedAt,
    warning: args.warning,
  };
}

/** Rate = numerator/denominator; zero denominator → null. */
export function computeRateMetric(
  numerator: number,
  denominator: number,
  args: {
    source: string[];
    evaluatedAt: string;
    confidence?: PilotMetricConfidence;
    warning?: string;
  }
): PilotMetric<number | null> {
  if (denominator <= 0) {
    return metricNumber(null, {
      confidence: args.confidence ?? "insufficient_evidence",
      numerator,
      denominator,
      source: args.source,
      evaluatedAt: args.evaluatedAt,
      warning: args.warning ?? "zero_denominator",
    });
  }
  return metricNumber(numerator / denominator, {
    confidence: args.confidence ?? "live_verified",
    numerator,
    denominator,
    source: args.source,
    evaluatedAt: args.evaluatedAt,
    warning: args.warning,
  });
}

export function assertAdoptionEventSafe(event: PilotAdoptionEvent): {
  ok: boolean;
  rejectedKeys: string[];
} {
  const rejectedKeys: string[] = [];
  const bag = event as unknown as Record<string, unknown>;
  for (const key of PILOT_ADOPTION_FORBIDDEN_PAYLOAD_KEYS) {
    if (key in bag && bag[key] != null) rejectedKeys.push(key);
  }
  if (!event.tenantId?.trim()) {
    return { ok: false, rejectedKeys: [...rejectedKeys, "tenantId"] };
  }
  return { ok: rejectedKeys.length === 0, rejectedKeys };
}
