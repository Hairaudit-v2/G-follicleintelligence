/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B Governance Closure —
 * quote-to-deposit domain event builders (pure).
 *
 * Production emitters call these builders then persist via best-effort audit write.
 * Do not mark coverage as `wired` without production hook + tests.
 */

import {
  assertEventEmitsOnce,
  buildEventIdempotencyKey,
  eventPayloadHasSensitiveContent,
  rejectWrongTenantEvent,
} from "./eventCoverage";

export { buildEventIdempotencyKey };

export type PilotControlDomainEventActorType =
  | "patient"
  | "staff"
  | "system"
  | "integration";

export type PilotControlEvidenceClass =
  | "live_patient"
  | "synthetic_fixture"
  | "staff_test"
  | "smoke_test";

export type PilotControlDomainEvent = {
  eventId: string;
  eventType: string;
  tenantId: string;
  programmeId: string;
  enrolmentId?: string;
  patientId?: string;
  actorType: PilotControlDomainEventActorType;
  actorId?: string;
  actorRole?: string;
  sourceModule: string;
  sourceRecordId?: string;
  occurredAt: string;
  correlationId?: string;
  idempotencyKey: string;
  evidenceClass: PilotControlEvidenceClass;
};

export const PILOT_PATHWAY_SENSITIVE_KEYS = [
  "quoteNarrative",
  "quote_narrative",
  "paymentAmount",
  "payment_amount",
  "amount",
  "cardData",
  "card_data",
  "paymentToken",
  "payment_token",
  "patientMessage",
  "patient_message",
  "messageBody",
  "message_body",
  "clinicalDetail",
  "clinical_detail",
  "consentContent",
  "consent_content",
  "documentContent",
  "document_content",
  "imageLink",
  "image_link",
  "imageUrl",
  "image_url",
  "patientNotes",
  "patient_notes",
] as const;

/** Lifecycle events that must not fire for real patients until human gate completes. */
export const PILOT_HUMAN_GATED_LIFECYCLE_EVENTS = [
  "pilot_patient_enrolled",
  "pilot_patient_invited",
  "pilot_patient_activated",
] as const;

export type BuildDomainEventInput = {
  eventType: string;
  tenantId: string;
  programmeId: string;
  enrolmentId?: string;
  patientId?: string;
  actorType: PilotControlDomainEventActorType;
  actorId?: string;
  actorRole?: string;
  sourceModule: string;
  sourceRecordId?: string;
  occurredAt?: string;
  correlationId?: string;
  idempotencyKey: string;
  evidenceClass: PilotControlEvidenceClass;
  eventId?: string;
};

export function buildPilotControlDomainEvent(
  input: BuildDomainEventInput
): PilotControlDomainEvent {
  return {
    eventId: input.eventId ?? `evt_${input.idempotencyKey}`,
    eventType: input.eventType,
    tenantId: input.tenantId,
    programmeId: input.programmeId,
    enrolmentId: input.enrolmentId,
    patientId: input.patientId,
    actorType: input.actorType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    sourceModule: input.sourceModule,
    sourceRecordId: input.sourceRecordId,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    evidenceClass: input.evidenceClass,
  };
}

export function quoteDeliveredIdempotencyKey(
  quoteId: string,
  deliveryVersion: string | number
): string {
  return buildEventIdempotencyKey([
    "quote_delivered",
    quoteId,
    String(deliveryVersion),
  ]);
}

export function quoteViewedIdempotencyKey(
  quoteId: string,
  firstViewVersion: string | number
): string {
  return buildEventIdempotencyKey([
    "quote_viewed",
    quoteId,
    String(firstViewVersion),
  ]);
}

export function quoteAcceptedIdempotencyKey(
  quoteId: string,
  acceptanceId: string
): string {
  return buildEventIdempotencyKey(["quote_accepted", quoteId, acceptanceId]);
}

export function depositRequestedIdempotencyKey(
  invoiceOrDepositRequestId: string
): string {
  return buildEventIdempotencyKey([
    "deposit_requested",
    invoiceOrDepositRequestId,
  ]);
}

export function paymentVerifiedIdempotencyKey(
  paymentAllocationId: string,
  verificationVersion: string | number
): string {
  return buildEventIdempotencyKey([
    "payment_verified",
    paymentAllocationId,
    String(verificationVersion),
  ]);
}

export function financialClearanceIdempotencyKey(
  clearanceId: string,
  version: string | number
): string {
  return buildEventIdempotencyKey([
    "financial_clearance_achieved",
    clearanceId,
    String(version),
  ]);
}

export function notificationDeliveredIdempotencyKey(
  notificationId: string,
  providerEventId: string
): string {
  return buildEventIdempotencyKey([
    "notification_delivered",
    notificationId,
    providerEventId,
  ]);
}

export function blockerOpenedIdempotencyKey(
  blockerFingerprint: string,
  occurrenceId: string
): string {
  return buildEventIdempotencyKey([
    "blocker_opened",
    blockerFingerprint,
    occurrenceId,
  ]);
}

export function blockerResolvedIdempotencyKey(
  blockerId: string,
  resolutionVersion: string | number
): string {
  return buildEventIdempotencyKey([
    "blocker_resolved",
    blockerId,
    String(resolutionVersion),
  ]);
}

export function decideDomainEventEmission(args: {
  existingKeys: readonly string[];
  nextKey: string;
  eventTenantId: string;
  expectedTenantId: string;
  eventType: string;
  /** When false, human-gated lifecycle events are rejected. */
  humanInviteGateComplete?: boolean;
  automaticPolling?: boolean;
}): {
  emit: boolean;
  reason?: string;
  duplicate?: boolean;
} {
  if (args.automaticPolling) {
    return { emit: false, reason: "automatic_polling_suppressed" };
  }

  const tenant = rejectWrongTenantEvent({
    eventTenantId: args.eventTenantId,
    expectedTenantId: args.expectedTenantId,
  });
  if (!tenant.accepted) {
    return { emit: false, reason: "wrong_tenant" };
  }

  if (
    (PILOT_HUMAN_GATED_LIFECYCLE_EVENTS as readonly string[]).includes(
      args.eventType
    ) &&
    !args.humanInviteGateComplete
  ) {
    return { emit: false, reason: "human_invite_gate_incomplete" };
  }

  const once = assertEventEmitsOnce(args.existingKeys, args.nextKey);
  if (once.duplicate) {
    return { emit: false, duplicate: true, reason: "idempotent_replay" };
  }
  return { emit: true };
}

/**
 * Financial clearance must derive from canonical clearance — not unallocated payments.
 */
export function mayEmitFinancialClearance(args: {
  clearanceState: string | null | undefined;
  paymentAllocated: boolean;
  clearanceId: string | null | undefined;
}): { emit: boolean; reason?: string } {
  if (!args.paymentAllocated) {
    return { emit: false, reason: "unallocated_payment" };
  }
  if (!args.clearanceId) {
    return { emit: false, reason: "missing_clearance_id" };
  }
  const state = String(args.clearanceState ?? "").toLowerCase();
  const cleared =
    state === "financially_cleared" ||
    state === "cleared" ||
    state === "paid_in_full" ||
    state === "deposit_ready";
  if (!cleared) {
    return { emit: false, reason: "clearance_not_achieved" };
  }
  return { emit: true };
}

export function mayEmitPaymentVerified(args: {
  allocationId: string | null | undefined;
  allocationMatched: boolean;
}): { emit: boolean; reason?: string } {
  if (!args.allocationId) {
    return { emit: false, reason: "missing_allocation" };
  }
  if (!args.allocationMatched) {
    return { emit: false, reason: "allocation_not_matched" };
  }
  return { emit: true };
}

/** First-view rule: only emit when canonical first_viewed_at transitions null → set. */
export function mayEmitQuoteView(args: {
  previousFirstViewedAt: string | null | undefined;
  nextFirstViewedAt: string | null | undefined;
}): { emit: boolean; reason?: string } {
  if (args.previousFirstViewedAt) {
    return { emit: false, reason: "already_viewed" };
  }
  if (!args.nextFirstViewedAt) {
    return { emit: false, reason: "view_not_recorded" };
  }
  return { emit: true };
}

export function scrubDomainEventPayload(
  payload: Record<string, unknown>
): {
  safe: Record<string, unknown>;
  stripped: string[];
} {
  const stripped = eventPayloadHasSensitiveContent(
    payload,
    PILOT_PATHWAY_SENSITIVE_KEYS
  );
  const safe: Record<string, unknown> = { ...payload };
  for (const k of stripped) {
    delete safe[k];
  }
  return { safe, stripped };
}

export function classifySyntheticEvidence(
  evidenceClass: PilotControlEvidenceClass
): boolean {
  return (
    evidenceClass === "synthetic_fixture" ||
    evidenceClass === "staff_test" ||
    evidenceClass === "smoke_test"
  );
}
