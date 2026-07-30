/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — first-cohort event coverage (pure).
 * Do not claim events are wired unless production code emits them.
 */

import type { PilotEventImplementationStatus } from "./activationTypes";

export type PilotEventCoverageEntry = {
  eventKey: string;
  implementationStatus: PilotEventImplementationStatus;
  sourceWorkflow: string;
  triggerCondition: string;
  idempotencyRule: string;
  metricConsumer: string;
  knownLimitation?: string;
};

/**
 * Required first-cohort event set from 1B §13.
 * Statuses are honest: Control Centre audit views are wired; domain emitters
 * remain contract_only until separately hooked.
 */
export const PILOT_1B_REQUIRED_EVENT_COVERAGE: readonly PilotEventCoverageEntry[] = [
  {
    eventKey: "pilot_patient_candidate_added",
    implementationStatus: "contract_only",
    sourceWorkflow: "cohort_candidate_review",
    triggerCondition: "candidate_review_created",
    idempotencyRule: "tenant:programme:patient:candidate_added",
    metricConsumer: "candidatePipeline",
    knownLimitation: "Candidate write path not enabled in 1B read-only boundary",
  },
  {
    eventKey: "pilot_patient_preflight_started",
    implementationStatus: "contract_only",
    sourceWorkflow: "identity_finance_consent_preflight",
    triggerCondition: "preflight_evaluation_started",
    idempotencyRule: "tenant:programme:patient:preflight_started:evaluatedAt",
    metricConsumer: "preflightCoverage",
  },
  {
    eventKey: "pilot_patient_preflight_completed",
    implementationStatus: "contract_only",
    sourceWorkflow: "identity_finance_consent_preflight",
    triggerCondition: "preflight_evaluation_completed",
    idempotencyRule: "tenant:programme:patient:preflight_completed:evaluatedAt",
    metricConsumer: "preflightCoverage",
  },
  {
    eventKey: "pilot_patient_approved",
    implementationStatus: "contract_only",
    sourceWorkflow: "pilot_enrolment",
    triggerCondition: "enrolment_status→approved",
    idempotencyRule: "tenant:programme:enrolment:pilot_patient_approved",
    metricConsumer: "approvedPatients",
  },
  {
    eventKey: "pilot_patient_enrolled",
    implementationStatus: "contract_only",
    sourceWorkflow: "pilot_enrolment",
    triggerCondition: "candidate→enrolled",
    idempotencyRule: "tenant:programme:enrolment:pilot_patient_enrolled",
    metricConsumer: "enrolledPatients",
  },
  {
    eventKey: "pilot_patient_invited",
    implementationStatus: "contract_only",
    sourceWorkflow: "pilot_enrolment",
    triggerCondition: "invitation_issued",
    idempotencyRule: "tenant:programme:enrolment:pilot_patient_invited:invitedAt",
    metricConsumer: "invitedPatients",
    knownLimitation: "Invitations remain disabled until 1C governance",
  },
  {
    eventKey: "pilot_patient_activated",
    implementationStatus: "contract_only",
    sourceWorkflow: "patient_app_gateway",
    triggerCondition: "portal_activation",
    idempotencyRule: "tenant:programme:enrolment:pilot_patient_activated",
    metricConsumer: "activatedPatients",
  },
  {
    eventKey: "patient_action_created",
    implementationStatus: "contract_only",
    sourceWorkflow: "patient_journey_control",
    triggerCondition: "patient_action_insert",
    idempotencyRule: "tenant:actionId:patient_action_created",
    metricConsumer: "patientActionCompletionRate",
  },
  {
    eventKey: "patient_action_completed",
    implementationStatus: "contract_only",
    sourceWorkflow: "patient_journey_control",
    triggerCondition: "patient_action_completed",
    idempotencyRule: "tenant:actionId:patient_action_completed",
    metricConsumer: "patientActionCompletionRate",
  },
  {
    eventKey: "patient_action_overdue",
    implementationStatus: "wired_with_limitation",
    sourceWorkflow: "pilot_blocker_engine",
    triggerCondition: "blocker_derived_from_overdue_action",
    idempotencyRule: "tenant:fingerprint:blocker_opened",
    metricConsumer: "overduePatientActions",
    knownLimitation: "Derived via blockers; dedicated emitter still contract_only in domain",
  },
  {
    eventKey: "clinic_action_created",
    implementationStatus: "contract_only",
    sourceWorkflow: "patient_journey_control",
    triggerCondition: "clinic_action_insert",
    idempotencyRule: "tenant:actionId:clinic_action_created",
    metricConsumer: "clinicActionCompletionRate",
  },
  {
    eventKey: "clinic_action_completed",
    implementationStatus: "contract_only",
    sourceWorkflow: "patient_journey_control",
    triggerCondition: "clinic_action_completed",
    idempotencyRule: "tenant:actionId:clinic_action_completed",
    metricConsumer: "clinicActionCompletionRate",
  },
  {
    eventKey: "clinic_action_overdue",
    implementationStatus: "wired_with_limitation",
    sourceWorkflow: "pilot_blocker_engine",
    triggerCondition: "blocker_derived_from_overdue_clinic_action",
    idempotencyRule: "tenant:fingerprint:blocker_opened",
    metricConsumer: "overdueClinicActions",
  },
  {
    eventKey: "journey_milestone_started",
    implementationStatus: "contract_only",
    sourceWorkflow: "patient_journey_control",
    triggerCondition: "milestone_started",
    idempotencyRule: "tenant:milestoneId:started",
    metricConsumer: "journeyProgress",
  },
  {
    eventKey: "journey_milestone_completed",
    implementationStatus: "contract_only",
    sourceWorkflow: "patient_journey_control",
    triggerCondition: "milestone_completed",
    idempotencyRule: "tenant:milestoneId:completed",
    metricConsumer: "journeyCompletionRate",
  },
  {
    eventKey: "journey_milestone_blocked",
    implementationStatus: "wired_with_limitation",
    sourceWorkflow: "pilot_readiness_engine",
    triggerCondition: "readiness_blocked_on_milestone",
    idempotencyRule: "tenant:enrolment:readiness_blocked:evaluatedAtDay",
    metricConsumer: "blockedMilestones",
  },
  {
    eventKey: "quote_delivered",
    implementationStatus: "contract_only",
    sourceWorkflow: "crm_quotes",
    triggerCondition: "quote_delivered",
    idempotencyRule: "tenant:quoteId:quote_delivered",
    metricConsumer: "quoteFunnel",
  },
  {
    eventKey: "quote_viewed",
    implementationStatus: "contract_only",
    sourceWorkflow: "crm_quotes",
    triggerCondition: "quote_viewed",
    idempotencyRule: "tenant:quoteId:quote_viewed:day",
    metricConsumer: "quoteFunnel",
  },
  {
    eventKey: "quote_accepted",
    implementationStatus: "contract_only",
    sourceWorkflow: "crm_quotes",
    triggerCondition: "quote_accepted",
    idempotencyRule: "tenant:quoteId:quote_accepted",
    metricConsumer: "quoteFunnel",
  },
  {
    eventKey: "deposit_requested",
    implementationStatus: "contract_only",
    sourceWorkflow: "financial_os",
    triggerCondition: "deposit_requested",
    idempotencyRule: "tenant:invoiceId:deposit_requested",
    metricConsumer: "depositFunnel",
  },
  {
    eventKey: "payment_verified",
    implementationStatus: "contract_only",
    sourceWorkflow: "financial_os",
    triggerCondition: "manual_payment_verified",
    idempotencyRule: "tenant:paymentId:payment_verified",
    metricConsumer: "paymentVerification",
  },
  {
    eventKey: "payment_reconciliation_required",
    implementationStatus: "contract_only",
    sourceWorkflow: "financial_os",
    triggerCondition: "reconciliation_exception_opened",
    idempotencyRule: "tenant:exceptionId:payment_reconciliation_required",
    metricConsumer: "reconciliationBacklog",
  },
  {
    eventKey: "financial_clearance_achieved",
    implementationStatus: "contract_only",
    sourceWorkflow: "financial_os",
    triggerCondition: "clearance_state→cleared",
    idempotencyRule: "tenant:patientId:financial_clearance_achieved:snapshotId",
    metricConsumer: "financialClearanceAchieved",
  },
  {
    eventKey: "document_requested",
    implementationStatus: "contract_only",
    sourceWorkflow: "documents",
    triggerCondition: "document_requested",
    idempotencyRule: "tenant:packetSectionId:document_requested",
    metricConsumer: "documentCompletion",
  },
  {
    eventKey: "document_completed",
    implementationStatus: "contract_only",
    sourceWorkflow: "documents",
    triggerCondition: "document_completed",
    idempotencyRule: "tenant:packetSectionId:document_completed",
    metricConsumer: "documentCompletion",
  },
  {
    eventKey: "consent_completed",
    implementationStatus: "contract_only",
    sourceWorkflow: "consent",
    triggerCondition: "consent_completed",
    idempotencyRule: "tenant:consentId:consent_completed",
    metricConsumer: "consentCompletion",
  },
  {
    eventKey: "images_requested",
    implementationStatus: "not_required_for_initial_pathway",
    sourceWorkflow: "imaging_os",
    triggerCondition: "images_requested",
    idempotencyRule: "tenant:requestId:images_requested",
    metricConsumer: "imageCompletion",
    knownLimitation: "Quote-to-deposit pathway does not require imaging for entry",
  },
  {
    eventKey: "images_completed",
    implementationStatus: "not_required_for_initial_pathway",
    sourceWorkflow: "imaging_os",
    triggerCondition: "images_completed",
    idempotencyRule: "tenant:imageSetId:images_completed",
    metricConsumer: "imageCompletion",
  },
  {
    eventKey: "message_received",
    implementationStatus: "contract_only",
    sourceWorkflow: "reception_inbox",
    triggerCondition: "patient_message_received",
    idempotencyRule: "tenant:messageId:message_received",
    metricConsumer: "messageResponseRate",
  },
  {
    eventKey: "message_replied",
    implementationStatus: "contract_only",
    sourceWorkflow: "reception_inbox",
    triggerCondition: "staff_reply_sent",
    idempotencyRule: "tenant:messageId:message_replied",
    metricConsumer: "messageResponseRate",
  },
  {
    eventKey: "notification_sent",
    implementationStatus: "contract_only",
    sourceWorkflow: "notifications",
    triggerCondition: "notification_dispatch",
    idempotencyRule: "tenant:notificationId:notification_sent",
    metricConsumer: "notificationReliability",
  },
  {
    eventKey: "notification_delivered",
    implementationStatus: "contract_only",
    sourceWorkflow: "notifications",
    triggerCondition: "delivery_receipt",
    idempotencyRule: "tenant:notificationId:notification_delivered",
    metricConsumer: "notificationReliability",
  },
  {
    eventKey: "notification_failed",
    implementationStatus: "contract_only",
    sourceWorkflow: "notifications",
    triggerCondition: "delivery_failure",
    idempotencyRule: "tenant:notificationId:notification_failed",
    metricConsumer: "notificationReliability",
  },
  {
    eventKey: "readiness_blocked",
    implementationStatus: "wired_with_limitation",
    sourceWorkflow: "pilot_readiness_engine",
    triggerCondition: "overall_readiness=blocked",
    idempotencyRule: "tenant:enrolment:readiness_blocked:day",
    metricConsumer: "readinessDistribution",
  },
  {
    eventKey: "readiness_achieved",
    implementationStatus: "wired_with_limitation",
    sourceWorkflow: "pilot_readiness_engine",
    triggerCondition: "overall_readiness=ready",
    idempotencyRule: "tenant:enrolment:readiness_achieved:day",
    metricConsumer: "readinessDistribution",
  },
  {
    eventKey: "blocker_opened",
    implementationStatus: "wired",
    sourceWorkflow: "pilot_blocker_engine",
    triggerCondition: "blocker_persisted_open",
    idempotencyRule: "tenant:fingerprint:blocker_opened",
    metricConsumer: "openBlockers",
  },
  {
    eventKey: "blocker_escalated",
    implementationStatus: "wired",
    sourceWorkflow: "pilot_blocker_engine",
    triggerCondition: "escalation_level_increased",
    idempotencyRule: "tenant:fingerprint:blocker_escalated:level",
    metricConsumer: "escalatedBlockers",
  },
  {
    eventKey: "blocker_resolved",
    implementationStatus: "wired",
    sourceWorkflow: "pilot_blocker_engine",
    triggerCondition: "blocker_resolved",
    idempotencyRule: "tenant:fingerprint:blocker_resolved",
    metricConsumer: "resolvedBlockers",
  },
  {
    eventKey: "manual_channel_fallback_recorded",
    implementationStatus: "contract_only",
    sourceWorkflow: "pilot_control",
    triggerCondition: "staff_records_fallback",
    idempotencyRule: "tenant:fallbackId:manual_channel_fallback_recorded",
    metricConsumer: "manualFallbackRate",
  },
  {
    eventKey: "technical_error_detected",
    implementationStatus: "wired",
    sourceWorkflow: "pilot_control_api",
    triggerCondition: "evaluation_or_api_failure",
    idempotencyRule: "tenant:correlationId:technical_error_detected",
    metricConsumer: "technicalErrors",
  },
  // Control Centre audit (wired in 1A.4)
  {
    eventKey: "pilot_control_access_denied",
    implementationStatus: "wired",
    sourceWorkflow: "pilot_control_api",
    triggerCondition: "permission_or_tenant_denial",
    idempotencyRule: "tenant:correlationId:access_denied",
    metricConsumer: "accessDenials",
  },
];

export function summariseEventCoverage(
  entries: readonly PilotEventCoverageEntry[] = PILOT_1B_REQUIRED_EVENT_COVERAGE
): {
  sufficientForInitialPathway: boolean;
  wiredCount: number;
  contractOnlyCount: number;
  notRequiredCount: number;
  blockers: string[];
  warnings: string[];
} {
  const wiredCount = entries.filter(
    (e) => e.implementationStatus === "wired" || e.implementationStatus === "wired_with_limitation"
  ).length;
  const contractOnlyCount = entries.filter(
    (e) => e.implementationStatus === "contract_only"
  ).length;
  const notRequiredCount = entries.filter(
    (e) => e.implementationStatus === "not_required_for_initial_pathway"
  ).length;
  const sourceUnavailable = entries.filter(
    (e) => e.implementationStatus === "source_unavailable"
  );

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (sourceUnavailable.length > 0) {
    blockers.push(
      ...sourceUnavailable.map((e) => `event_source_unavailable:${e.eventKey}`)
    );
  }

  // Sufficient when pathway-required events are at least contract_only or wired,
  // and critical control/audit events are wired.
  const criticalWired = ["blocker_opened", "technical_error_detected", "pilot_control_access_denied"];
  for (const key of criticalWired) {
    const entry = entries.find((e) => e.eventKey === key);
    if (!entry || (entry.implementationStatus !== "wired" && entry.implementationStatus !== "wired_with_limitation")) {
      blockers.push(`critical_event_not_wired:${key}`);
    }
  }

  if (contractOnlyCount > 0) {
    warnings.push(`contract_only_events:${contractOnlyCount}`);
  }

  return {
    sufficientForInitialPathway: blockers.length === 0,
    wiredCount,
    contractOnlyCount,
    notRequiredCount,
    blockers,
    warnings,
  };
}

/** Pure idempotent event key helper for acceptance proofs. */
export function buildEventIdempotencyKey(parts: readonly string[]): string {
  return parts.map((p) => String(p).trim()).filter(Boolean).join(":");
}

export function assertEventEmitsOnce(
  existingKeys: readonly string[],
  nextKey: string
): { emit: boolean; duplicate: boolean } {
  if (existingKeys.includes(nextKey)) {
    return { emit: false, duplicate: true };
  }
  return { emit: true, duplicate: false };
}

export function rejectWrongTenantEvent(args: {
  eventTenantId: string;
  expectedTenantId: string;
}): { accepted: boolean; reason?: string } {
  if (args.eventTenantId !== args.expectedTenantId) {
    return { accepted: false, reason: "wrong_tenant" };
  }
  return { accepted: true };
}

export function classifyEventEvidence(args: {
  isSynthetic: boolean;
}): "live" | "synthetic" {
  return args.isSynthetic ? "synthetic" : "live";
}

export function eventPayloadHasSensitiveContent(
  payload: Record<string, unknown>,
  forbiddenKeys: readonly string[]
): string[] {
  return forbiddenKeys.filter((k) => k in payload && payload[k] != null);
}
