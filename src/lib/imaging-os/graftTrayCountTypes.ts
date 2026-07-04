/**
 * IMAGING-AI-GRAFT-PILOT-1 — graft tray AI count estimate types (staff-only).
 */

export const GRAFT_TRAY_COUNT_ESTIMATE_VERSION = "graft_tray_count_estimate_v1" as const;

export const GRAFT_TRAY_AI_PROVIDERS = ["stub", "openai_vision", "unavailable"] as const;
export type GraftTrayAiProviderName = (typeof GRAFT_TRAY_AI_PROVIDERS)[number];

export const GRAFT_TRAY_MISMATCH_BANDS = [
  "within_tolerance",
  "minor_mismatch",
  "material_mismatch",
  "unable_to_assess",
  "manual_count_missing",
  "image_not_assessable",
] as const;
export type GraftTrayMismatchBand = (typeof GRAFT_TRAY_MISMATCH_BANDS)[number];

export const GRAFT_TRAY_AI_REVIEW_STATUSES = [
  "pending_review",
  "accepted_ai",
  "accepted_manual",
  "corrected",
  "rejected_ai",
  "retake_requested",
] as const;
export type GraftTrayAiReviewStatus = (typeof GRAFT_TRAY_AI_REVIEW_STATUSES)[number];

export const GRAFT_TRAY_AI_REVIEW_ACTIONS = [
  "accept_ai_estimate",
  "accept_manual_count",
  "correct_count",
  "reject_ai_estimate",
  "request_retake",
] as const;
export type GraftTrayAiReviewAction = (typeof GRAFT_TRAY_AI_REVIEW_ACTIONS)[number];

export const GRAFT_TRAY_CONFIDENCE_BANDS = ["high", "medium", "low", "unknown"] as const;
export type GraftTrayConfidenceBand = (typeof GRAFT_TRAY_CONFIDENCE_BANDS)[number];

export const GRAFT_TRAY_IMAGE_QUALITIES = [
  "suitable",
  "marginal",
  "insufficient",
  "unknown",
] as const;
export type GraftTrayImageQuality = (typeof GRAFT_TRAY_IMAGE_QUALITIES)[number];

export const GRAFT_TRAY_MANUAL_COUNT_SOURCES = [
  "confirmed_tray_latest",
  "confirmed_tray_total",
  "graft_session_extracted",
  "missing",
] as const;
export type GraftTrayManualCountSource = (typeof GRAFT_TRAY_MANUAL_COUNT_SOURCES)[number];

export const GRAFT_TRAY_AI_REVIEW_REASONS = [
  "graft_tray_ai_count_needs_review",
  "graft_tray_ai_manual_mismatch",
  "graft_tray_ai_unable_to_assess",
  "graft_tray_ai_manual_count_missing",
  "graft_tray_ai_quality_insufficient",
  "graft_tray_ai_material_mismatch",
] as const;
export type GraftTrayAiReviewReason = (typeof GRAFT_TRAY_AI_REVIEW_REASONS)[number];

export type GraftTrayAiEstimateRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  image_id: string;
  graft_tray_link_id: string | null;
  surgery_id: string | null;
  estimated_graft_count: number | null;
  manual_graft_count: number | null;
  manual_count_source: GraftTrayManualCountSource | null;
  corrected_graft_count: number | null;
  delta: number | null;
  mismatch_band: GraftTrayMismatchBand;
  confidence: number;
  confidence_band: GraftTrayConfidenceBand;
  image_quality: GraftTrayImageQuality;
  assessable: boolean;
  review_status: GraftTrayAiReviewStatus;
  reviewer_decision: GraftTrayAiReviewAction | null;
  reviewed_by_fi_user_id: string | null;
  reviewed_at: string | null;
  analysis_job_id: string | null;
  provider: GraftTrayAiProviderName;
  provider_version: string;
  review_reasons: unknown;
  created_at: string;
  updated_at: string;
};

export type GraftTrayCountEstimateResult = {
  estimated_graft_count: number | null;
  confidence: number;
  confidence_band: GraftTrayConfidenceBand;
  image_quality: GraftTrayImageQuality;
  assessable: boolean;
  uncertainty_notes: string[];
  provider: GraftTrayAiProviderName;
  provider_version: string;
  raw_provider_metadata: Record<string, unknown>;
  recommended_review_reason: GraftTrayAiReviewReason;
};

export type ManualGraftCountSnapshot = {
  manual_count: number | null;
  manual_count_source: GraftTrayManualCountSource;
  graft_count_event_id: string | null;
  graft_session_id: string | null;
};

export type GraftTrayCountComparison = {
  mismatch_band: GraftTrayMismatchBand;
  delta: number | null;
  tolerance_percent: number;
  review_reasons: GraftTrayAiReviewReason[];
};

export type GraftTrayAiEstimateSummary = {
  estimate_id: string;
  image_id: string;
  graft_tray_link_id: string | null;
  estimated_graft_count: number | null;
  manual_graft_count: number | null;
  manual_count_source: GraftTrayManualCountSource;
  mismatch_band: GraftTrayMismatchBand;
  delta: number | null;
  confidence: number;
  confidence_band: GraftTrayConfidenceBand;
  image_quality: GraftTrayImageQuality;
  assessable: boolean;
  review_status: GraftTrayAiReviewStatus;
  reviewer_decision: GraftTrayAiReviewAction | null;
  reviewed_by_fi_user_id: string | null;
  reviewed_at: string | null;
  analysis_job_id: string | null;
  corrected_count: number | null;
  provider: GraftTrayAiProviderName;
  provider_version: string;
  generated_at: string;
};