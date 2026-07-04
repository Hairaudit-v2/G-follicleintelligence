/**
 * FI-OUTCOME-INTELLIGENCE-GRAFT-TRAY-SUMMARY-1 — reviewed graft tray intelligence summary
 * and Outcome Intelligence fact mapping. Pure — no I/O.
 */

import type { ImagingAiJobStatus } from "./imagingAiAnalysisKinds";
import type {
  GraftTrayAiEstimateSummary,
  GraftTrayAiReviewAction,
  GraftTrayAiReviewStatus,
  GraftTrayConfidenceBand,
  GraftTrayImageQuality,
  GraftTrayMismatchBand,
} from "./graftTrayCountTypes";
import type { FiOutcomeConfidenceLevel } from "@/src/lib/fi-os/outcomeIntelligenceSignals";
import { deriveOutcomeConfidenceLevel } from "@/src/lib/fi-os/outcomeIntelligenceSignals";
import {
  buildGraftTrayAiReviewDisplayConfig,
  collectGraftTrayAiReviewWarnings,
  graftTrayAiRequiresStaffReview,
  resolveGraftTrayFinalAcceptedCount,
  type GraftTrayAiReviewAuditEntry,
  type GraftTrayAiReviewDisplayState,
} from "./graftTrayReviewUxCore";

export const GRAFT_TRAY_FINAL_COUNT_SOURCES = ["ai", "manual", "override"] as const;
export type GraftTrayFinalCountSource = (typeof GRAFT_TRAY_FINAL_COUNT_SOURCES)[number];

export type GraftTrayIntelligenceSummary = {
  estimateId: string;
  imageId: string;
  graftTrayLinkId: string | null;
  hasFinalCount: boolean;
  finalAcceptedCount: number | null;
  originalAiEstimate: number | null;
  manualCount: number | null;
  varianceDelta: number | null;
  mismatchBand: GraftTrayMismatchBand;
  confidenceBand: GraftTrayConfidenceBand;
  imageQuality: GraftTrayImageQuality;
  reviewDecision: GraftTrayAiReviewAction | null;
  reviewStatus: GraftTrayAiReviewStatus;
  displayState: GraftTrayAiReviewDisplayState;
  reviewerId: string | null;
  reviewerLabel: string | null;
  reviewedAt: string | null;
  finalCountSource: GraftTrayFinalCountSource | null;
  isReadOnly: boolean;
  supersededStaleJob: boolean;
  sourceImageHref: string | null;
  reviewAuditTrail: GraftTrayAiReviewAuditEntry[];
  warnings: string[];
};

export type GraftTrayIntelligenceSummaryInput = {
  estimate: GraftTrayAiEstimateSummary;
  auditTrail?: GraftTrayAiReviewAuditEntry[];
  reviewerLabel?: string | null;
  sourceImageHref?: string | null;
  estimateAnalysisJobId?: string | null;
  estimateAnalysisJobStatus?: ImagingAiJobStatus | null;
  hasNewerActiveJob?: boolean;
  allowCorrection?: boolean;
};

export type GraftTrayOutcomeIntelligenceFact = {
  fact_kind: "graft_tray_reviewed_count";
  source_table: "fi_imaging_graft_tray_ai_estimates";
  source_id: string;
  image_id: string;
  captured_at: string;
  confidence_level: FiOutcomeConfidenceLevel;
  metric_values: {
    graft_tray_final_count: number | null;
    graft_tray_ai_estimate: number | null;
    graft_tray_manual_count: number | null;
    graft_tray_variance_delta: number | null;
    graft_tray_mismatch_band: string;
    graft_tray_confidence_band: string;
    graft_tray_image_quality: string;
    graft_tray_final_count_source: string | null;
    graft_tray_review_complete: boolean;
    graft_tray_superseded_stale: boolean;
  };
};

const NON_FINAL_REVIEW_STATUSES: ReadonlySet<GraftTrayAiReviewStatus> = new Set([
  "pending_review",
  "rejected_ai",
  "retake_requested",
]);

export function resolveGraftTrayFinalCountSource(
  reviewStatus: GraftTrayAiReviewStatus
): GraftTrayFinalCountSource | null {
  switch (reviewStatus) {
    case "accepted_ai":
      return "ai";
    case "accepted_manual":
      return "manual";
    case "corrected":
      return "override";
    default:
      return null;
  }
}

export function isGraftTrayEstimateSupersededStale(input: {
  estimateAnalysisJobId: string | null;
  estimateAnalysisJobStatus: ImagingAiJobStatus | null;
  hasNewerActiveJob: boolean;
}): boolean {
  if (!input.estimateAnalysisJobId) return false;
  if (input.estimateAnalysisJobStatus !== "superseded") return false;
  return input.hasNewerActiveJob;
}

export function graftTrayReviewStatusHasFinalCount(
  reviewStatus: GraftTrayAiReviewStatus
): boolean {
  return !NON_FINAL_REVIEW_STATUSES.has(reviewStatus);
}

export function buildGraftTrayIntelligenceSummary(
  input: GraftTrayIntelligenceSummaryInput
): GraftTrayIntelligenceSummary {
  const { estimate } = input;
  const auditTrail = input.auditTrail ?? [];
  const supersededStaleJob = isGraftTrayEstimateSupersededStale({
    estimateAnalysisJobId: input.estimateAnalysisJobId ?? estimate.analysis_job_id ?? null,
    estimateAnalysisJobStatus: input.estimateAnalysisJobStatus ?? null,
    hasNewerActiveJob: input.hasNewerActiveJob ?? false,
  });

  const display = buildGraftTrayAiReviewDisplayConfig(estimate);
  const reviewedAt =
    estimate.reviewed_at ??
    auditTrail.filter((e) => e.review_status === estimate.review_status).at(-1)?.reviewed_at ??
    auditTrail.at(-1)?.reviewed_at ??
    null;
  const reviewerId =
    estimate.reviewed_by_fi_user_id ??
    auditTrail.filter((e) => e.review_status === estimate.review_status).at(-1)
      ?.reviewed_by_fi_user_id ??
    auditTrail.at(-1)?.reviewed_by_fi_user_id ??
    null;

  const rawFinalCount = resolveGraftTrayFinalAcceptedCount(estimate);
  const hasFinalCount =
    !supersededStaleJob &&
    graftTrayReviewStatusHasFinalCount(estimate.review_status) &&
    rawFinalCount != null;
  const finalAcceptedCount = hasFinalCount ? rawFinalCount : null;
  const finalCountSource = hasFinalCount
    ? resolveGraftTrayFinalCountSource(estimate.review_status)
    : null;
  const requiresStaffReview = graftTrayAiRequiresStaffReview(estimate);
  const isReadOnly =
    hasFinalCount && !input.allowCorrection && !requiresStaffReview && !supersededStaleJob;

  return {
    estimateId: estimate.estimate_id,
    imageId: estimate.image_id,
    graftTrayLinkId: estimate.graft_tray_link_id,
    hasFinalCount,
    finalAcceptedCount,
    originalAiEstimate: supersededStaleJob ? null : estimate.estimated_graft_count,
    manualCount: estimate.manual_graft_count,
    varianceDelta: estimate.delta,
    mismatchBand: estimate.mismatch_band,
    confidenceBand: estimate.confidence_band,
    imageQuality: estimate.image_quality,
    reviewDecision: estimate.reviewer_decision,
    reviewStatus: estimate.review_status,
    displayState: supersededStaleJob ? "estimate_pending" : display.state,
    reviewerId,
    reviewerLabel: input.reviewerLabel ?? null,
    reviewedAt,
    finalCountSource,
    isReadOnly,
    supersededStaleJob,
    sourceImageHref: input.sourceImageHref ?? null,
    reviewAuditTrail: auditTrail,
    warnings: supersededStaleJob
      ? [
          "Superseded AI job — awaiting fresh estimate before final count.",
          ...collectGraftTrayAiReviewWarnings(estimate),
        ]
      : collectGraftTrayAiReviewWarnings(estimate),
  };
}

export function buildSurgeryOsGraftTrayCaseIntelligenceSummary(input: {
  linkSummaries: GraftTrayIntelligenceSummary[];
}): {
  reviewedTrayCount: number;
  pendingReviewCount: number;
  supersededStaleCount: number;
  totalFinalAcceptedGrafts: number | null;
  hasSupersededStaleEstimate: boolean;
} {
  const reviewed = input.linkSummaries.filter((s) => s.hasFinalCount);
  const pending = input.linkSummaries.filter(
    (s) => !s.hasFinalCount && !s.supersededStaleJob && s.reviewStatus === "pending_review"
  );
  const supersededStale = input.linkSummaries.filter((s) => s.supersededStaleJob);
  const allReviewed =
    input.linkSummaries.length > 0 &&
    input.linkSummaries.every((s) => s.hasFinalCount || s.reviewStatus === "rejected_ai" || s.reviewStatus === "retake_requested");
  const totalFinalAcceptedGrafts = allReviewed
    ? reviewed.reduce((sum, s) => sum + (s.finalAcceptedCount ?? 0), 0)
    : null;

  return {
    reviewedTrayCount: reviewed.length,
    pendingReviewCount: pending.length,
    supersededStaleCount: supersededStale.length,
    totalFinalAcceptedGrafts,
    hasSupersededStaleEstimate: supersededStale.length > 0,
  };
}

export function mapGraftTrayIntelligenceToOutcomeFacts(
  summary: GraftTrayIntelligenceSummary
): GraftTrayOutcomeIntelligenceFact | null {
  if (!summary.hasFinalCount || summary.finalAcceptedCount == null) return null;

  const metricValues = {
    graft_tray_final_count: summary.finalAcceptedCount,
    graft_tray_ai_estimate: summary.originalAiEstimate,
    graft_tray_manual_count: summary.manualCount,
    graft_tray_variance_delta: summary.varianceDelta,
    graft_tray_mismatch_band: summary.mismatchBand,
    graft_tray_confidence_band: summary.confidenceBand,
    graft_tray_image_quality: summary.imageQuality,
    graft_tray_final_count_source: summary.finalCountSource,
    graft_tray_review_complete: true,
    graft_tray_superseded_stale: summary.supersededStaleJob,
  };

  return {
    fact_kind: "graft_tray_reviewed_count",
    source_table: "fi_imaging_graft_tray_ai_estimates",
    source_id: summary.estimateId,
    image_id: summary.imageId,
    captured_at: summary.reviewedAt ?? new Date(0).toISOString(),
    confidence_level: deriveOutcomeConfidenceLevel({
      sourceTable: "fi_imaging_graft_tray_ai_estimates",
      sourceId: summary.estimateId,
      metricValues,
    }),
    metric_values: metricValues,
  };
}