/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — activation decision records (pure).
 * Approvals name real actors; never inferred from role membership or test results.
 */

import type {
  PilotActivationDecisionOutcome,
  PilotActivationDecisionRecord,
  PilotActivationDecisionType,
  PilotActivationState,
} from "./activationTypes";

export type CreateActivationDecisionInput = {
  id: string;
  programmeId: string;
  tenantId: string;
  decisionType: PilotActivationDecisionType;
  decisionState: PilotActivationState;
  decisionVersion: number;
  requestedAt: string;
  requestedBy: string | null;
};

export function createActivationDecisionDraft(
  input: CreateActivationDecisionInput
): PilotActivationDecisionRecord {
  const now = input.requestedAt;
  return {
    id: input.id,
    programmeId: input.programmeId,
    tenantId: input.tenantId,
    decisionType: input.decisionType,
    decisionState: input.decisionState,
    decisionVersion: input.decisionVersion,
    requestedAt: input.requestedAt,
    requestedBy: input.requestedBy,
    clinicalApproved: false,
    clinicalApprovedBy: null,
    clinicalApprovedAt: null,
    privacyApproved: false,
    privacyApprovedBy: null,
    privacyApprovedAt: null,
    operationsApproved: false,
    operationsApprovedBy: null,
    operationsApprovedAt: null,
    technicalApproved: false,
    technicalApprovedBy: null,
    technicalApprovedAt: null,
    directorApproved: false,
    directorApprovedBy: null,
    directorApprovedAt: null,
    cohortApproved: false,
    cohortApprovedBy: null,
    cohortApprovedAt: null,
    supportConfirmed: false,
    rollbackConfirmed: false,
    incidentResponseConfirmed: false,
    staffTrainingConfirmed: false,
    decision: "pending",
    decisionReason: null,
    blockersJson: [],
    createdAt: now,
    updatedAt: now,
  };
}

export type ApprovalAxis =
  | "clinical"
  | "privacy"
  | "operations"
  | "technical"
  | "director"
  | "cohort";

/**
 * Record a named human approval. Rejects empty actor ids and refuses to
 * invent approvals from roles or automated signals.
 */
export function recordNamedApproval(
  record: PilotActivationDecisionRecord,
  axis: ApprovalAxis,
  args: { approvedBy: string; approvedAt: string }
):
  | { ok: true; record: PilotActivationDecisionRecord }
  | { ok: false; reason: string } {
  if (record.decision !== "pending") {
    return { ok: false, reason: "decision_already_finalised" };
  }
  const actor = args.approvedBy?.trim();
  if (!actor) {
    return { ok: false, reason: "named_actor_required" };
  }

  const next = { ...record, updatedAt: args.approvedAt };
  switch (axis) {
    case "clinical":
      next.clinicalApproved = true;
      next.clinicalApprovedBy = actor;
      next.clinicalApprovedAt = args.approvedAt;
      break;
    case "privacy":
      next.privacyApproved = true;
      next.privacyApprovedBy = actor;
      next.privacyApprovedAt = args.approvedAt;
      break;
    case "operations":
      next.operationsApproved = true;
      next.operationsApprovedBy = actor;
      next.operationsApprovedAt = args.approvedAt;
      break;
    case "technical":
      next.technicalApproved = true;
      next.technicalApprovedBy = actor;
      next.technicalApprovedAt = args.approvedAt;
      break;
    case "director":
      next.directorApproved = true;
      next.directorApprovedBy = actor;
      next.directorApprovedAt = args.approvedAt;
      break;
    case "cohort":
      next.cohortApproved = true;
      next.cohortApprovedBy = actor;
      next.cohortApprovedAt = args.approvedAt;
      break;
  }
  return { ok: true, record: next };
}

export function finaliseActivationDecision(
  record: PilotActivationDecisionRecord,
  args: {
    decision: Exclude<PilotActivationDecisionOutcome, "pending">;
    decisionReason: string;
    at: string;
  }
):
  | { ok: true; record: PilotActivationDecisionRecord }
  | { ok: false; reason: string } {
  if (record.decision !== "pending") {
    return { ok: false, reason: "decision_already_finalised" };
  }
  if (!args.decisionReason?.trim()) {
    return { ok: false, reason: "decision_reason_required" };
  }
  if (args.decision === "approved") {
    const missing: string[] = [];
    if (!record.clinicalApproved) missing.push("clinical");
    if (!record.privacyApproved) missing.push("privacy");
    if (!record.operationsApproved) missing.push("operations");
    if (!record.technicalApproved) missing.push("technical");
    if (!record.directorApproved) missing.push("director");
    if (!record.cohortApproved) missing.push("cohort");
    if (!record.supportConfirmed) missing.push("support");
    if (!record.rollbackConfirmed) missing.push("rollback");
    if (!record.incidentResponseConfirmed) missing.push("incident_response");
    if (!record.staffTrainingConfirmed) missing.push("staff_training");
    if (missing.length > 0) {
      return { ok: false, reason: `missing_approvals:${missing.join(",")}` };
    }
  }

  return {
    ok: true,
    record: {
      ...record,
      decision: args.decision,
      decisionReason: args.decisionReason.trim(),
      updatedAt: args.at,
    },
  };
}

/** Approval timestamps are immutable after final decision. */
export function isApprovalTimestampImmutable(
  record: PilotActivationDecisionRecord
): boolean {
  return record.decision !== "pending";
}

/**
 * New governance review → new version / occurrence. Never mutate a
 * rejected or deferred decision into an approval.
 */
export function nextDecisionVersion(
  existing: readonly { decisionVersion: number }[]
): number {
  if (existing.length === 0) return 1;
  return Math.max(...existing.map((e) => e.decisionVersion)) + 1;
}

export function rejectedDecisionRemainsAuditable(
  history: readonly PilotActivationDecisionRecord[]
): boolean {
  return history.some((d) => d.decision === "rejected" || d.decision === "deferred");
}
