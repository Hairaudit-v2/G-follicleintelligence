/**
 * FI-IMAGING-GRAFT-TRAY-REVIEW-UX-1 — staff review display states, safety gates, and audit trail.
 */

import type {
  GraftTrayAiEstimateSummary,
  GraftTrayAiReviewAction,
  GraftTrayAiReviewStatus,
  GraftTrayConfidenceBand,
  GraftTrayImageQuality,
  GraftTrayMismatchBand,
} from "./graftTrayCountTypes";

export const GRAFT_TRAY_AI_REVIEW_DISPLAY_STATES = [
  "estimate_pending",
  "estimate_ready",
  "mismatch_with_manual",
  "accepted_ai",
  "accepted_manual",
  "overridden_by_staff",
  "rejected_needs_recount",
  "retake_requested",
  "low_confidence_review",
] as const;

export type GraftTrayAiReviewDisplayState = (typeof GRAFT_TRAY_AI_REVIEW_DISPLAY_STATES)[number];

export type GraftTrayAiReviewAuditEntry = {
  reviewed_at: string;
  reviewed_by_fi_user_id: string | null;
  decision: GraftTrayAiReviewAction;
  review_status: GraftTrayAiReviewStatus;
  previous_ai_estimate: number | null;
  previous_manual_count: number | null;
  final_accepted_count: number | null;
  staff_note: string | null;
};

export type GraftTrayAiReviewDisplayTone = "neutral" | "info" | "success" | "warning" | "danger";

export type GraftTrayAiReviewDisplayConfig = {
  state: GraftTrayAiReviewDisplayState;
  label: string;
  detail: string;
  tone: GraftTrayAiReviewDisplayTone;
  requiresStaffReview: boolean;
  warnings: string[];
  finalAcceptedCount: number | null;
};

export type GraftTrayAiReviewEstimateInput = Pick<
  GraftTrayAiEstimateSummary,
  | "estimated_graft_count"
  | "manual_graft_count"
  | "mismatch_band"
  | "delta"
  | "confidence_band"
  | "image_quality"
  | "assessable"
  | "review_status"
  | "corrected_count"
>;

const DISPLAY_LABELS: Record<GraftTrayAiReviewDisplayState, string> = {
  estimate_pending: "AI estimate pending",
  estimate_ready: "AI estimate ready for review",
  mismatch_with_manual: "AI/manual count mismatch",
  accepted_ai: "AI estimate accepted",
  accepted_manual: "Manual count accepted",
  overridden_by_staff: "Overridden by staff",
  rejected_needs_recount: "Rejected — needs recount",
  retake_requested: "Image quality issue — retake requested",
  low_confidence_review: "Low confidence — review required",
};

const DISPLAY_TONES: Record<GraftTrayAiReviewDisplayState, GraftTrayAiReviewDisplayTone> = {
  estimate_pending: "neutral",
  estimate_ready: "info",
  mismatch_with_manual: "warning",
  accepted_ai: "success",
  accepted_manual: "success",
  overridden_by_staff: "info",
  rejected_needs_recount: "danger",
  retake_requested: "danger",
  low_confidence_review: "warning",
};

export function graftTrayAiRequiresStaffReview(
  estimate: Pick<GraftTrayAiEstimateSummary, "review_status"> | null
): boolean {
  return estimate?.review_status === "pending_review";
}

export function resolveGraftTrayFinalAcceptedCount(
  estimate: Pick<
    GraftTrayAiEstimateSummary,
    "review_status" | "estimated_graft_count" | "manual_graft_count" | "corrected_count"
  >
): number | null {
  switch (estimate.review_status) {
    case "accepted_ai":
      return estimate.estimated_graft_count;
    case "accepted_manual":
      return estimate.manual_graft_count;
    case "corrected":
      return estimate.corrected_count;
    case "pending_review":
    case "rejected_ai":
    case "retake_requested":
    default:
      return null;
  }
}

export function graftTrayAiHasLowConfidenceSignal(input: {
  confidence_band: GraftTrayConfidenceBand;
  image_quality: GraftTrayImageQuality;
}): boolean {
  return input.confidence_band === "low" || input.image_quality === "insufficient";
}

export function graftTrayAiHasMismatchSignal(
  mismatch_band: GraftTrayMismatchBand
): boolean {
  return (
    mismatch_band === "minor_mismatch" ||
    mismatch_band === "material_mismatch" ||
    mismatch_band === "unable_to_assess" ||
    mismatch_band === "image_not_assessable"
  );
}

export function collectGraftTrayAiReviewWarnings(
  estimate: GraftTrayAiReviewEstimateInput
): string[] {
  const warnings: string[] = [];
  if (graftTrayAiHasLowConfidenceSignal(estimate)) {
    warnings.push("Low AI confidence — staff confirmation required before use.");
  }
  if (estimate.image_quality === "marginal") {
    warnings.push("Image quality is marginal — verify tray visibility before accepting.");
  }
  if (graftTrayAiHasMismatchSignal(estimate.mismatch_band)) {
    warnings.push(
      `AI estimate differs from manual count (${estimate.mismatch_band.replace(/_/g, " ")}).`
    );
  }
  if (estimate.mismatch_band === "manual_count_missing") {
    warnings.push("No confirmed manual tray count available for comparison.");
  }
  if (!estimate.assessable || estimate.estimated_graft_count == null) {
    warnings.push("AI could not produce a reliable graft count from this image.");
  }
  if (graftTrayAiRequiresStaffReview(estimate)) {
    warnings.push("AI estimate is not final until staff review completes.");
  }
  return [...new Set(warnings)];
}

export function resolveGraftTrayAiReviewDisplayState(
  estimate: GraftTrayAiReviewEstimateInput | null
): GraftTrayAiReviewDisplayState {
  if (!estimate) return "estimate_pending";

  switch (estimate.review_status) {
    case "accepted_ai":
      return "accepted_ai";
    case "accepted_manual":
      return "accepted_manual";
    case "corrected":
      return "overridden_by_staff";
    case "rejected_ai":
      return "rejected_needs_recount";
    case "retake_requested":
      return "retake_requested";
    case "pending_review":
      if (!estimate.assessable || estimate.estimated_graft_count == null) {
        return "estimate_pending";
      }
      if (graftTrayAiHasLowConfidenceSignal(estimate)) {
        return "low_confidence_review";
      }
      if (graftTrayAiHasMismatchSignal(estimate.mismatch_band)) {
        return "mismatch_with_manual";
      }
      return "estimate_ready";
    default:
      return "estimate_pending";
  }
}

export function buildGraftTrayAiReviewDisplayConfig(
  estimate: GraftTrayAiReviewEstimateInput | null
): GraftTrayAiReviewDisplayConfig {
  const state = resolveGraftTrayAiReviewDisplayState(estimate);
  const warnings = estimate ? collectGraftTrayAiReviewWarnings(estimate) : [];
  const requiresStaffReview = estimate ? graftTrayAiRequiresStaffReview(estimate) : true;
  const finalAcceptedCount = estimate ? resolveGraftTrayFinalAcceptedCount(estimate) : null;

  let detail = DISPLAY_LABELS[state];
  if (estimate?.manual_graft_count != null && estimate.estimated_graft_count != null) {
    detail = `${detail} · AI ${estimate.estimated_graft_count} vs manual ${estimate.manual_graft_count}`;
  } else if (estimate?.estimated_graft_count != null) {
    detail = `${detail} · AI estimate ${estimate.estimated_graft_count}`;
  }

  return {
    state,
    label: DISPLAY_LABELS[state],
    detail,
    tone: DISPLAY_TONES[state],
    requiresStaffReview,
    warnings,
    finalAcceptedCount,
  };
}

export function buildGraftTrayReviewAuditEntry(input: {
  reviewedAt: string;
  reviewedByUserId: string | null;
  action: GraftTrayAiReviewAction;
  reviewStatus: GraftTrayAiReviewStatus;
  previousAiEstimate: number | null;
  previousManualCount: number | null;
  finalAcceptedCount: number | null;
  staffNote?: string | null;
}): GraftTrayAiReviewAuditEntry {
  return {
    reviewed_at: input.reviewedAt,
    reviewed_by_fi_user_id: input.reviewedByUserId,
    decision: input.action,
    review_status: input.reviewStatus,
    previous_ai_estimate: input.previousAiEstimate,
    previous_manual_count: input.previousManualCount,
    final_accepted_count: input.finalAcceptedCount,
    staff_note: input.staffNote?.trim() || null,
  };
}

export function appendGraftTrayReviewAuditTrail(
  existing: unknown,
  entry: GraftTrayAiReviewAuditEntry
): GraftTrayAiReviewAuditEntry[] {
  const prior = parseGraftTrayReviewAuditTrail(existing);
  return [...prior, entry];
}

export function parseGraftTrayReviewAuditTrail(value: unknown): GraftTrayAiReviewAuditEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: GraftTrayAiReviewAuditEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const decision = row.decision;
    const reviewStatus = row.review_status;
    const reviewedAt = row.reviewed_at;
    if (typeof decision !== "string" || typeof reviewStatus !== "string" || typeof reviewedAt !== "string") {
      continue;
    }
    entries.push({
      reviewed_at: reviewedAt,
      reviewed_by_fi_user_id:
        typeof row.reviewed_by_fi_user_id === "string" ? row.reviewed_by_fi_user_id : null,
      decision: decision as GraftTrayAiReviewAction,
      review_status: reviewStatus as GraftTrayAiReviewStatus,
      previous_ai_estimate:
        typeof row.previous_ai_estimate === "number" && Number.isFinite(row.previous_ai_estimate)
          ? Math.trunc(row.previous_ai_estimate)
          : row.previous_ai_estimate === null
            ? null
            : null,
      previous_manual_count:
        typeof row.previous_manual_count === "number" && Number.isFinite(row.previous_manual_count)
          ? Math.trunc(row.previous_manual_count)
          : row.previous_manual_count === null
            ? null
            : null,
      final_accepted_count:
        typeof row.final_accepted_count === "number" && Number.isFinite(row.final_accepted_count)
          ? Math.trunc(row.final_accepted_count)
          : row.final_accepted_count === null
            ? null
            : null,
      staff_note: typeof row.staff_note === "string" ? row.staff_note : null,
    });
  }
  return entries;
}