/**
 * FI-SURGERYOS-GRAFT-TRAY-AI-TYPES-1 — SurgeryOS view model for ImagingOS graft tray AI estimates.
 * Pure — consumes typed ImagingOS summaries; no duplicate parser logic.
 */

import type { GraftTrayAiEstimateSummary } from "@/src/lib/imaging-os/graftTrayCountTypes";
import type { SurgeryOsGraftTrayAiEstimateSummary } from "./surgeryOsBoardModel.types";

export function mapGraftTrayAiEstimateToSurgeryOsSummary(
  estimate: GraftTrayAiEstimateSummary
): SurgeryOsGraftTrayAiEstimateSummary {
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
  };
}