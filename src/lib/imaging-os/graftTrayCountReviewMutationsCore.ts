/**
 * FI-IMAGING-GRAFT-TRAY-REVIEW-UX-1 — pure graft tray AI review mutation helpers.
 */

import { mapReviewActionToStatus } from "./graftTrayCountProviderCore";
import type { GraftTrayAiEstimateRow } from "./graftTrayCountTypes";
import type { GraftTrayAiReviewAction } from "./graftTrayCountTypes";
import {
  appendGraftTrayReviewAuditTrail,
  buildGraftTrayReviewAuditEntry,
  resolveGraftTrayFinalAcceptedCount,
} from "./graftTrayReviewUxCore";
import { mapEstimateRowToSummary } from "./graftTrayAiEstimateRowParser";

export function resolveCorrectedCountForReviewAction(input: {
  action: GraftTrayAiReviewAction;
  correctedCount?: number | null;
}): number | null {
  if (input.action !== "correct_count") return null;
  if (
    input.correctedCount == null ||
    !Number.isFinite(input.correctedCount) ||
    input.correctedCount < 0
  ) {
    throw new Error("A non-negative corrected count is required.");
  }
  return Math.round(input.correctedCount);
}

export function resolveGraftTrayLinkStatusAfterReview(input: {
  action: GraftTrayAiReviewAction;
  mismatchBand: GraftTrayAiEstimateRow["mismatch_band"];
}): { status: "linked" | "review_required" | "mismatch_flagged"; reviewRequired: boolean } {
  if (input.action === "reject_ai_estimate" || input.action === "request_retake") {
    return { status: "review_required", reviewRequired: true };
  }
  if (input.action === "accept_ai_estimate" && input.mismatchBand === "material_mismatch") {
    return { status: "mismatch_flagged", reviewRequired: false };
  }
  if (input.action === "accept_manual_count" || input.action === "accept_ai_estimate") {
    return { status: "linked", reviewRequired: false };
  }
  return { status: "linked", reviewRequired: true };
}

export function buildGraftTrayEstimateReviewMetadata(input: {
  estimate: GraftTrayAiEstimateRow;
  action: GraftTrayAiReviewAction;
  reviewedByUserId: string | null;
  reviewedAt: string;
  correctedCount: number | null;
  staffNote?: string | null;
  existingMetadata?: Record<string, unknown>;
}): Record<string, unknown> {
  const reviewStatus = mapReviewActionToStatus(input.action);
  const finalAcceptedCount = resolveGraftTrayFinalAcceptedCount({
    review_status: reviewStatus,
    estimated_graft_count: input.estimate.estimated_graft_count,
    manual_graft_count: input.estimate.manual_graft_count,
    corrected_count: input.correctedCount,
  });
  const auditEntry = buildGraftTrayReviewAuditEntry({
    reviewedAt: input.reviewedAt,
    reviewedByUserId: input.reviewedByUserId,
    action: input.action,
    reviewStatus,
    previousAiEstimate: input.estimate.estimated_graft_count,
    previousManualCount: input.estimate.manual_graft_count,
    finalAcceptedCount,
    staffNote: input.staffNote,
  });
  const priorEstimateMeta =
    input.existingMetadata && typeof input.existingMetadata === "object"
      ? input.existingMetadata
      : {};
  const priorAudit = appendGraftTrayReviewAuditTrail(
    (priorEstimateMeta as Record<string, unknown>).review_audit_trail,
    auditEntry
  );

  return {
    staff_note: input.staffNote?.trim() || null,
    original_ai_estimate: input.estimate.estimated_graft_count,
    review_audit_trail: priorAudit,
  };
}

export function buildGraftTrayImageMetadataReviewPatch(input: {
  estimate: GraftTrayAiEstimateRow;
  action: GraftTrayAiReviewAction;
  reviewedByUserId: string | null;
  reviewedAt: string;
  correctedCount: number | null;
  staffNote?: string | null;
  existingMetadata: Record<string, unknown>;
  staffReviewMetadata: Record<string, unknown>;
}): Record<string, unknown> {
  const reviewStatus = mapReviewActionToStatus(input.action);
  const updatedSummary = mapEstimateRowToSummary({
    ...input.estimate,
    review_status: reviewStatus,
    reviewer_decision: input.action,
    corrected_graft_count: input.correctedCount,
  });
  const finalAcceptedCount = resolveGraftTrayFinalAcceptedCount({
    review_status: reviewStatus,
    estimated_graft_count: input.estimate.estimated_graft_count,
    manual_graft_count: input.estimate.manual_graft_count,
    corrected_count: input.correctedCount,
  });
  const auditEntry = buildGraftTrayReviewAuditEntry({
    reviewedAt: input.reviewedAt,
    reviewedByUserId: input.reviewedByUserId,
    action: input.action,
    reviewStatus,
    previousAiEstimate: input.estimate.estimated_graft_count,
    previousManualCount: input.estimate.manual_graft_count,
    finalAcceptedCount,
    staffNote: input.staffNote,
  });
  const graftTrayReviewReasons =
    input.action === "request_retake"
      ? ["graft_tray_ai_quality_insufficient", "retake_required"]
      : [];

  return {
    ...input.staffReviewMetadata,
    graft_tray_ai_estimate: updatedSummary,
    graft_tray_ai_review_audit: appendGraftTrayReviewAuditTrail(
      input.existingMetadata.graft_tray_ai_review_audit,
      auditEntry
    ),
    graft_tray_review_reasons:
      graftTrayReviewReasons.length > 0
        ? graftTrayReviewReasons
        : (input.existingMetadata.graft_tray_review_reasons ?? []),
  };
}
