/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — cohort candidate review workflow (pure).
 * No candidate may become approved through a batch or inferred process.
 */

import { RECOMMENDED_INITIAL_PILOT_COHORT } from "../adoption/realPatientPilotGate";
import {
  EVOLVED_INITIAL_PATHWAY_LOCK,
  PILOT_CANDIDATE_REVIEW_STATUSES,
  type PilotCandidateReviewStatus,
  type PilotCohortCandidateReview,
  type PilotInitialPathway,
} from "./activationTypes";

const STATUS_SET = new Set<string>(PILOT_CANDIDATE_REVIEW_STATUSES);

export function isPilotCandidateReviewStatus(
  value: unknown
): value is PilotCandidateReviewStatus {
  return typeof value === "string" && STATUS_SET.has(value);
}

const ALLOWED: Record<
  PilotCandidateReviewStatus,
  readonly PilotCandidateReviewStatus[]
> = {
  candidate: ["preflight_in_progress", "excluded", "withdrawn", "deferred"],
  preflight_in_progress: [
    "eligible_for_clinical_review",
    "excluded",
    "deferred",
    "withdrawn",
  ],
  eligible_for_clinical_review: [
    "eligible_for_governance_review",
    "excluded",
    "deferred",
    "withdrawn",
  ],
  eligible_for_governance_review: ["approved", "excluded", "deferred", "withdrawn"],
  approved: ["enrolled", "withdrawn", "excluded"],
  enrolled: ["withdrawn"],
  deferred: ["candidate", "preflight_in_progress", "withdrawn", "excluded"],
  excluded: [],
  withdrawn: [],
};

export function canTransitionCandidateStatus(
  from: PilotCandidateReviewStatus,
  to: PilotCandidateReviewStatus
): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}

export type CandidateTechnicalPreflightInput = {
  identityEligible: boolean;
  financeEligible: boolean;
  consentEligible: boolean;
  complexIdentity: boolean;
  disputedFinance: boolean;
  criticalClinicalBlocker: boolean;
  namedOperationalOwner: boolean;
  namedClinicalOwner: boolean;
  isSyntheticOrSmoke: boolean;
  pathway: PilotInitialPathway;
  pathwayLocked: PilotInitialPathway;
};

export type CandidateTechnicalPreflightResult = {
  pass: boolean;
  statusHint: PilotCandidateReviewStatus;
  reasons: string[];
};

/**
 * Technical preflight only — never bulk-approves. Human clinical + governance
 * remain mandatory before approved/enrolled.
 */
export function evaluateCandidateTechnicalPreflight(
  input: CandidateTechnicalPreflightInput
): CandidateTechnicalPreflightResult {
  const reasons: string[] = [];

  if (input.isSyntheticOrSmoke) reasons.push("synthetic_or_smoke_excluded");
  if (input.complexIdentity) reasons.push("complex_identity_excluded");
  if (input.disputedFinance) reasons.push("disputed_finance_deferred");
  if (input.criticalClinicalBlocker) reasons.push("critical_clinical_blocker_excluded");
  if (!input.namedOperationalOwner) reasons.push("named_operational_owner_required");
  if (!input.namedClinicalOwner) reasons.push("named_clinical_owner_required");
  if (input.pathway !== input.pathwayLocked) reasons.push("pathway_not_locked");
  if (!input.identityEligible) reasons.push("identity_preflight_failed");
  if (!input.financeEligible) reasons.push("finance_preflight_failed");
  if (!input.consentEligible) reasons.push("consent_preflight_failed");

  if (reasons.includes("complex_identity_excluded") || reasons.includes("synthetic_or_smoke_excluded")) {
    return { pass: false, statusHint: "excluded", reasons };
  }
  if (reasons.includes("critical_clinical_blocker_excluded")) {
    return { pass: false, statusHint: "excluded", reasons };
  }
  if (reasons.includes("disputed_finance_deferred")) {
    return { pass: false, statusHint: "deferred", reasons };
  }
  if (reasons.length > 0) {
    return { pass: false, statusHint: "deferred", reasons };
  }

  return {
    pass: true,
    statusHint: "eligible_for_clinical_review",
    reasons: [],
  };
}

export function approveCandidateIndividually(args: {
  review: PilotCohortCandidateReview;
  approvedBy: string;
  at: string;
  reason: string;
}):
  | { ok: true; review: PilotCohortCandidateReview }
  | { ok: false; reason: string } {
  if (!args.approvedBy?.trim()) {
    return { ok: false, reason: "named_approver_required" };
  }
  if (!args.reason?.trim()) {
    return { ok: false, reason: "decision_reason_required" };
  }
  if (!canTransitionCandidateStatus(args.review.status, "approved")) {
    return { ok: false, reason: "transition_not_allowed" };
  }
  if (!args.review.operationalOwnerUserId) {
    return { ok: false, reason: "named_operational_owner_required" };
  }
  if (
    args.review.identityPreflightEligible !== true ||
    args.review.financePreflightEligible !== true ||
    args.review.consentPreflightEligible !== true
  ) {
    return { ok: false, reason: "preflight_incomplete" };
  }
  if (args.review.clinicalReviewPassed !== true) {
    return { ok: false, reason: "clinical_review_required" };
  }

  return {
    ok: true,
    review: {
      ...args.review,
      status: "approved",
      decision: "approved",
      decisionReason: args.reason.trim(),
      approvedBy: args.approvedBy.trim(),
      decidedAt: args.at,
      updatedAt: args.at,
    },
  };
}

/** Bulk approval is forbidden for the initial cohort. */
export function bulkApproveCandidates(_ids: readonly string[]): {
  ok: false;
  reason: "bulk_approval_forbidden";
} {
  return { ok: false, reason: "bulk_approval_forbidden" };
}

export function enforceApprovedCohortLimit(args: {
  currentlyApprovedOrEnrolled: number;
  additionalApprovals: number;
  maxPatients?: number;
}): { ok: boolean; reason?: string } {
  const max = args.maxPatients ?? RECOMMENDED_INITIAL_PILOT_COHORT.maxPatients;
  if (args.currentlyApprovedOrEnrolled + args.additionalApprovals > max) {
    return { ok: false, reason: `cohort_limit_exceeded:${max}` };
  }
  return { ok: true };
}

export function defaultPathwayLock(): PilotInitialPathway {
  return EVOLVED_INITIAL_PATHWAY_LOCK;
}
