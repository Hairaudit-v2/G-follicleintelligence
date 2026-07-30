/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Shared domain contracts for clinic (1B) + HairAudit.
 *
 * Approval / rejection / regeneration / supersession / staleness / patient-visibility
 * rules live here so 1B can call the same services without duplicating provider/job/storage logic.
 */

import type {
  ClinicianReviewState,
  PatientVisibilityEligibility,
  ProjectionJobRecord,
  ProjectionJobStatus,
} from "./types";

export type ProjectionLifecycleTransition = {
  from: ProjectionJobStatus;
  to: ProjectionJobStatus;
};

const ALLOWED: Record<ProjectionJobStatus, ProjectionJobStatus[]> = {
  received: ["validated", "failed", "cancelled"],
  validated: ["queued", "failed", "cancelled"],
  queued: ["generating", "failed", "cancelled", "timed_out"],
  generating: ["completed", "failed", "timed_out", "cancelled"],
  completed: [],
  failed: [],
  timed_out: [],
  cancelled: [],
};

export function canTransitionProjectionJob(
  from: ProjectionJobStatus,
  to: ProjectionJobStatus
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: ProjectionJobStatus, to: ProjectionJobStatus): void {
  if (!canTransitionProjectionJob(from, to)) {
    throw new Error(`illegal_job_transition:${from}->${to}`);
  }
}

/** After successful generation, clinician review is required — never patient-visible. */
export function clinicianReviewStateAfterCompletion(): ClinicianReviewState {
  return "awaiting_review";
}

export function patientVisibilityAfterCompletion(): PatientVisibilityEligibility {
  return "eligible_after_approval";
}

export type ApproveProjectionCommand = {
  jobId: string;
  tenantId: string;
  clinicId: string;
  actorUserId: string;
  note?: string | null;
};

export type RejectProjectionCommand = {
  jobId: string;
  tenantId: string;
  clinicId: string;
  actorUserId: string;
  reasonCode: string;
  note?: string | null;
};

export type RegenerateProjectionCommand = {
  supersedesJobId: string;
  tenantId: string;
  clinicId: string;
  actorUserId: string;
};

export type MarkProjectionStaleCommand = {
  jobId: string;
  tenantId: string;
  reason: string;
};

/**
 * Domain rules for 1B — implemented as pure validators in 1A.
 * Persistence mutations for clinic UI arrive in FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1B.
 */
export function evaluateApprovalEligibility(job: ProjectionJobRecord): {
  ok: boolean;
  code?: string;
} {
  if (job.status !== "completed") return { ok: false, code: "not_completed" };
  if (job.clinicianReviewState !== "awaiting_review") {
    return { ok: false, code: "not_awaiting_review" };
  }
  if (job.patientVisibilityEligibility === "shared") {
    return { ok: false, code: "already_shared" };
  }
  return { ok: true };
}

export function evaluatePatientSharingEligibility(job: ProjectionJobRecord): {
  ok: boolean;
  code?: string;
} {
  if (job.clinicianReviewState !== "approved") return { ok: false, code: "not_approved" };
  if (job.staleReason) return { ok: false, code: "stale" };
  if (job.supersededByJobId) return { ok: false, code: "superseded" };
  return { ok: true };
}

export function applySupersession(
  prior: ProjectionJobRecord,
  nextJobId: string
): Pick<ProjectionJobRecord, "clinicianReviewState" | "supersededByJobId" | "staleReason"> {
  return {
    clinicianReviewState: "superseded",
    supersededByJobId: nextJobId,
    staleReason: "superseded_by_regeneration",
  };
}
