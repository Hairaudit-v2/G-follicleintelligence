/**
 * FI-IMAGING-AI-REVIEW-OPS-1 — operator health buckets and safe replay guards.
 */

import type { ImagingAiAnalysisKind, ImagingAiJobStatus } from "./imagingAiAnalysisKinds";
import type { GraftTrayAiReviewStatus } from "./graftTrayCountTypes";
import { graftTrayAiHasLowConfidenceSignal } from "./graftTrayReviewUxCore";

export const IMAGING_AI_REVIEW_OPS_BUCKETS = [
  "queued",
  "running",
  "stale_running",
  "completed_awaiting_review",
  "failed",
  "low_confidence",
  "provider_unavailable",
  "requires_staff_review",
  "superseded",
] as const;

export type ImagingAiReviewOpsBucket = (typeof IMAGING_AI_REVIEW_OPS_BUCKETS)[number];

export const IMAGING_AI_REVIEW_OPS_DEFAULT_KIND: ImagingAiAnalysisKind = "graft_tray_count_estimate";

/** Running jobs older than this are considered stale for operator requeue. */
export const IMAGING_AI_STALE_RUNNING_MS = 15 * 60 * 1000;

const GRAFT_TRAY_REPLAY_BLOCKED_STATUSES: ReadonlySet<GraftTrayAiReviewStatus> = new Set([
  "accepted_ai",
  "accepted_manual",
  "corrected",
  "rejected_ai",
  "retake_requested",
]);

export type ImagingAiReviewOpsJobSnapshot = {
  jobId: string;
  analysisKind: ImagingAiAnalysisKind;
  jobStatus: ImagingAiJobStatus;
  attemptCount: number;
  lastError: string | null;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  provider: string | null;
  graftTrayReviewStatus: GraftTrayAiReviewStatus | null;
  supersedeReason: string | null;
};

export type ImagingAiReviewOpsJobView = ImagingAiReviewOpsJobSnapshot & {
  tenantId: string;
  patientImageId: string;
  patientId: string | null;
  buckets: ImagingAiReviewOpsBucket[];
  reviewHref: string | null;
  imagingHref: string | null;
  replayBlockedReason: string | null;
};

export function readImagingAiJobAttemptCount(
  requestPayload: Record<string, unknown> | null | undefined
): number {
  const raw = requestPayload?.attempt_count;
  return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
}

export function readImagingAiJobSupersedeReason(
  requestPayload: Record<string, unknown> | null | undefined
): string | null {
  const raw = requestPayload?.superseded_reason;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

export function deriveImagingAiJobStartedAt(input: {
  jobStatus: ImagingAiJobStatus;
  updatedAt: string;
}): string | null {
  return input.jobStatus === "running" ? input.updatedAt : null;
}

export function isStaleRunningImagingAiJob(input: {
  jobStatus: ImagingAiJobStatus;
  updatedAt: string;
  nowMs?: number;
  staleThresholdMs?: number;
}): boolean {
  if (input.jobStatus !== "running") return false;
  const threshold = input.staleThresholdMs ?? IMAGING_AI_STALE_RUNNING_MS;
  const updatedMs = Date.parse(input.updatedAt);
  if (!Number.isFinite(updatedMs)) return false;
  return (input.nowMs ?? Date.now()) - updatedMs >= threshold;
}

export function graftTrayReviewBlocksAiReplay(
  reviewStatus: GraftTrayAiReviewStatus | null | undefined
): boolean {
  if (!reviewStatus) return false;
  return GRAFT_TRAY_REPLAY_BLOCKED_STATUSES.has(reviewStatus);
}

export function resolveGraftTrayReplayBlockedReason(
  reviewStatus: GraftTrayAiReviewStatus | null | undefined
): string | null {
  if (!graftTrayReviewBlocksAiReplay(reviewStatus)) return null;
  return `Staff-reviewed estimate (${reviewStatus?.replace(/_/g, " ")}) cannot be overwritten by replay.`;
}

export function classifyImagingAiReviewOpsBuckets(input: {
  analysisKind: ImagingAiAnalysisKind;
  jobStatus: ImagingAiJobStatus;
  updatedAt: string;
  provider: string | null;
  graftTrayReviewStatus: GraftTrayAiReviewStatus | null;
  nowMs?: number;
}): ImagingAiReviewOpsBucket[] {
  const buckets: ImagingAiReviewOpsBucket[] = [];

  if (input.jobStatus === "queued") buckets.push("queued");
  if (input.jobStatus === "running") {
    buckets.push("running");
    if (isStaleRunningImagingAiJob({ jobStatus: input.jobStatus, updatedAt: input.updatedAt, nowMs: input.nowMs })) {
      buckets.push("stale_running");
    }
  }
  if (input.jobStatus === "failed") buckets.push("failed");
  if (input.jobStatus === "superseded") buckets.push("superseded");

  if (input.analysisKind === "graft_tray_count_estimate") {
    if (input.jobStatus === "completed" && input.graftTrayReviewStatus === "pending_review") {
      buckets.push("completed_awaiting_review", "requires_staff_review");
    }
    if (
      input.graftTrayReviewStatus === "pending_review" &&
      input.jobStatus !== "superseded"
    ) {
      if (!buckets.includes("requires_staff_review")) buckets.push("requires_staff_review");
    }
    if (input.provider === "unavailable" || input.provider === "stub") {
      buckets.push("provider_unavailable");
    }
    if (
      input.graftTrayReviewStatus === "pending_review" &&
      input.provider &&
      input.provider !== "unavailable"
    ) {
      // low-confidence surfaced via linked estimate metadata in loader
    }
  }

  return [...new Set(buckets)];
}

export function applyGraftTrayLowConfidenceBucket(
  buckets: ImagingAiReviewOpsBucket[],
  estimate: {
    confidence_band: "high" | "medium" | "low" | "unknown";
    image_quality: "suitable" | "marginal" | "insufficient" | "unknown";
    review_status: GraftTrayAiReviewStatus;
  } | null
): ImagingAiReviewOpsBucket[] {
  if (!estimate || estimate.review_status !== "pending_review") return buckets;
  if (!graftTrayAiHasLowConfidenceSignal(estimate)) return buckets;
  return buckets.includes("low_confidence") ? buckets : [...buckets, "low_confidence"];
}

export function canRetryFailedImagingAiJob(input: {
  jobStatus: ImagingAiJobStatus;
  analysisKind: ImagingAiAnalysisKind;
  graftTrayReviewStatus: GraftTrayAiReviewStatus | null;
}): { allowed: boolean; reason: string | null } {
  if (input.jobStatus !== "failed") {
    return { allowed: false, reason: "Only failed jobs can be retried." };
  }
  const blocked = resolveGraftTrayReplayBlockedReason(input.graftTrayReviewStatus);
  if (input.analysisKind === "graft_tray_count_estimate" && blocked) {
    return { allowed: false, reason: blocked };
  }
  return { allowed: true, reason: null };
}

export function canRequeueStaleImagingAiJob(input: {
  jobStatus: ImagingAiJobStatus;
  updatedAt: string;
  analysisKind: ImagingAiAnalysisKind;
  graftTrayReviewStatus: GraftTrayAiReviewStatus | null;
  nowMs?: number;
}): { allowed: boolean; reason: string | null } {
  if (!isStaleRunningImagingAiJob({
    jobStatus: input.jobStatus,
    updatedAt: input.updatedAt,
    nowMs: input.nowMs,
  })) {
    return { allowed: false, reason: "Job is not a stale running job." };
  }
  const blocked = resolveGraftTrayReplayBlockedReason(input.graftTrayReviewStatus);
  if (input.analysisKind === "graft_tray_count_estimate" && blocked) {
    return { allowed: false, reason: blocked };
  }
  return { allowed: true, reason: null };
}

export function canMarkImagingAiJobIgnored(input: {
  jobStatus: ImagingAiJobStatus;
  analysisKind: ImagingAiAnalysisKind;
  graftTrayReviewStatus: GraftTrayAiReviewStatus | null;
}): { allowed: boolean; reason: string | null } {
  if (input.jobStatus === "superseded") {
    return { allowed: false, reason: "Job is already superseded." };
  }
  const blocked = resolveGraftTrayReplayBlockedReason(input.graftTrayReviewStatus);
  if (input.analysisKind === "graft_tray_count_estimate" && blocked) {
    return { allowed: false, reason: blocked };
  }
  return { allowed: true, reason: null };
}

export function buildImagingAiReviewOpsJobView(input: {
  tenantId: string;
  patientImageId: string;
  patientId: string | null;
  snapshot: ImagingAiReviewOpsJobSnapshot;
  estimate: {
    confidence_band: "high" | "medium" | "low" | "unknown";
    image_quality: "suitable" | "marginal" | "insufficient" | "unknown";
    review_status: GraftTrayAiReviewStatus;
    provider: string;
  } | null;
  nowMs?: number;
}): ImagingAiReviewOpsJobView {
  const buckets = applyGraftTrayLowConfidenceBucket(
    classifyImagingAiReviewOpsBuckets({
      analysisKind: input.snapshot.analysisKind,
      jobStatus: input.snapshot.jobStatus,
      updatedAt: input.snapshot.updatedAt,
      provider: input.estimate?.provider ?? input.snapshot.provider,
      graftTrayReviewStatus: input.snapshot.graftTrayReviewStatus,
      nowMs: input.nowMs,
    }),
    input.estimate
  );

  const replayBlockedReason = resolveGraftTrayReplayBlockedReason(input.snapshot.graftTrayReviewStatus);
  const reviewHref =
    input.snapshot.graftTrayReviewStatus === "pending_review" && input.patientId
      ? `/fi-admin/${input.tenantId}/imaging/review`
      : null;
  const imagingHref = input.patientId
    ? `/fi-admin/${input.tenantId}/patients/${input.patientId}/imaging?image=${input.patientImageId}`
    : null;

  return {
    ...input.snapshot,
    tenantId: input.tenantId,
    patientImageId: input.patientImageId,
    patientId: input.patientId,
    buckets,
    reviewHref,
    imagingHref,
    replayBlockedReason,
  };
}