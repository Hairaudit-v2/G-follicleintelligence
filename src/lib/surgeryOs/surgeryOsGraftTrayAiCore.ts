/**
 * FI-SURGERYOS-GRAFT-TRAY-AI-TYPES-1 — SurgeryOS view model for ImagingOS graft tray AI estimates.
 * FI-OUTCOME-INTELLIGENCE-GRAFT-TRAY-SUMMARY-1 — intelligence summary mapping for SurgeryOS payloads.
 * Pure — consumes typed ImagingOS summaries; no duplicate parser logic.
 */

import type { GraftTrayAiEstimateSummary } from "@/src/lib/imaging-os/graftTrayCountTypes";
import {
  buildGraftTrayIntelligenceSummary,
  buildSurgeryOsGraftTrayCaseIntelligenceSummary,
  type GraftTrayIntelligenceSummary,
} from "@/src/lib/imaging-os/graftTrayIntelligenceSummaryCore";
import {
  buildGraftTrayAiReviewDisplayConfig,
  collectGraftTrayAiReviewWarnings,
  graftTrayAiRequiresStaffReview,
  resolveGraftTrayFinalAcceptedCount,
  type GraftTrayAiReviewAuditEntry,
} from "@/src/lib/imaging-os/graftTrayReviewUxCore";
import type { ImagingAiJobStatus } from "@/src/lib/imaging-os/imagingAiAnalysisKinds";
import type {
  SurgeryOsGraftTrayAiEstimateSummary,
  SurgeryOsGraftTrayCaseIntelligenceSummary,
  SurgeryOsGraftTrayIntelligenceSummary,
} from "./surgeryOsBoardModel.types";

export function mapGraftTrayAiEstimateToSurgeryOsSummary(
  estimate: GraftTrayAiEstimateSummary
): SurgeryOsGraftTrayAiEstimateSummary {
  const display = buildGraftTrayAiReviewDisplayConfig(estimate);
  return {
    estimateId: estimate.estimate_id,
    estimatedGraftCount: estimate.estimated_graft_count,
    manualGraftCount: estimate.manual_graft_count,
    mismatchBand: estimate.mismatch_band,
    delta: estimate.delta,
    confidence: estimate.confidence,
    confidenceBand: estimate.confidence_band,
    reviewStatus: estimate.review_status,
    reviewerDecision: estimate.reviewer_decision,
    correctedCount: estimate.corrected_count,
    provider: estimate.provider,
    displayState: display.state,
    displayLabel: display.label,
    requiresStaffReview: graftTrayAiRequiresStaffReview(estimate),
    finalAcceptedCount: resolveGraftTrayFinalAcceptedCount(estimate),
    reviewWarnings: collectGraftTrayAiReviewWarnings(estimate),
  };
}

export function mapGraftTrayIntelligenceToSurgeryOsSummary(
  summary: GraftTrayIntelligenceSummary
): SurgeryOsGraftTrayIntelligenceSummary {
  return {
    estimateId: summary.estimateId,
    imageId: summary.imageId,
    graftTrayLinkId: summary.graftTrayLinkId,
    hasFinalCount: summary.hasFinalCount,
    finalAcceptedCount: summary.finalAcceptedCount,
    originalAiEstimate: summary.originalAiEstimate,
    manualCount: summary.manualCount,
    varianceDelta: summary.varianceDelta,
    mismatchBand: summary.mismatchBand,
    confidenceBand: summary.confidenceBand,
    imageQuality: summary.imageQuality,
    reviewDecision: summary.reviewDecision,
    reviewStatus: summary.reviewStatus,
    displayState: summary.displayState,
    reviewerId: summary.reviewerId,
    reviewerLabel: summary.reviewerLabel,
    reviewedAt: summary.reviewedAt,
    finalCountSource: summary.finalCountSource,
    isReadOnly: summary.isReadOnly,
    supersededStaleJob: summary.supersededStaleJob,
    sourceImageHref: summary.sourceImageHref,
    reviewAuditTrail: summary.reviewAuditTrail,
    warnings: summary.warnings,
  };
}

export function buildSurgeryOsGraftTrayIntelligenceSummary(input: {
  estimate: GraftTrayAiEstimateSummary;
  auditTrail?: GraftTrayAiReviewAuditEntry[];
  reviewerLabel?: string | null;
  sourceImageHref?: string | null;
  estimateAnalysisJobStatus?: ImagingAiJobStatus | null;
  hasNewerActiveJob?: boolean;
  allowCorrection?: boolean;
}): SurgeryOsGraftTrayIntelligenceSummary {
  return mapGraftTrayIntelligenceToSurgeryOsSummary(buildGraftTrayIntelligenceSummary(input));
}

export function buildSurgeryOsGraftTrayCaseIntelligence(input: {
  linkSummaries: SurgeryOsGraftTrayIntelligenceSummary[];
}): SurgeryOsGraftTrayCaseIntelligenceSummary {
  const rollup = buildSurgeryOsGraftTrayCaseIntelligenceSummary({
    linkSummaries: input.linkSummaries.map((link) => ({
      estimateId: link.estimateId,
      imageId: link.imageId,
      graftTrayLinkId: link.graftTrayLinkId,
      hasFinalCount: link.hasFinalCount,
      finalAcceptedCount: link.finalAcceptedCount,
      originalAiEstimate: link.originalAiEstimate,
      manualCount: link.manualCount,
      varianceDelta: link.varianceDelta,
      mismatchBand: link.mismatchBand,
      confidenceBand: link.confidenceBand,
      imageQuality: link.imageQuality,
      reviewDecision: link.reviewDecision,
      reviewStatus: link.reviewStatus,
      displayState: link.displayState,
      reviewerId: link.reviewerId,
      reviewerLabel: link.reviewerLabel,
      reviewedAt: link.reviewedAt,
      finalCountSource: link.finalCountSource,
      isReadOnly: link.isReadOnly,
      supersededStaleJob: link.supersededStaleJob,
      sourceImageHref: link.sourceImageHref,
      reviewAuditTrail: link.reviewAuditTrail,
      warnings: link.warnings,
    })),
  });
  return {
    reviewedTrayCount: rollup.reviewedTrayCount,
    pendingReviewCount: rollup.pendingReviewCount,
    supersededStaleCount: rollup.supersededStaleCount,
    totalFinalAcceptedGrafts: rollup.totalFinalAcceptedGrafts,
    hasSupersededStaleEstimate: rollup.hasSupersededStaleEstimate,
  };
}
