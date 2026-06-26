/**
 * VIE Phase 5 — Longitudinal comparison engine types.
 * Deterministic metadata-driven pairing; no AI vision yet.
 */

import type { VieCaptureAcceptanceStatus, VieCaptureFraming, VieProtocolSlug, VieSurgeryPhase } from "./vieProtocolTypes";

export const VIE_COMPARISON_ENGINE_VERSION = "vie-comparison.v1" as const;

export const VIE_COMPARISON_CATEGORIES = [
  "baseline_vs_follow_up",
  "pre_op_vs_post_op",
  "donor_before_vs_after_extraction",
  "recipient_before_vs_after_implantation",
  "graft_tray_documentation",
  "repair_review_progression",
  "treatment_progression",
] as const;

export type VieComparisonCategory = (typeof VIE_COMPARISON_CATEGORIES)[number];

export const VIE_JOURNEY_STAGES = [
  "baseline",
  "consultation",
  "planning",
  "surgery_day",
  "immediate_post_op",
  "follow_up_3m",
  "follow_up_6m",
  "follow_up_9m",
  "follow_up_12m",
  "repair_review",
] as const;

export type VieJourneyStage = (typeof VIE_JOURNEY_STAGES)[number];

export const VIE_COMPARISON_RECOMMENDED_USES = [
  "clinical_review",
  "patient_progress",
  "audit_evidence",
  "marketing_candidate",
  "training_case",
] as const;

export type VieComparisonRecommendedUse = (typeof VIE_COMPARISON_RECOMMENDED_USES)[number];

export const VIE_COMPARISON_CONFIDENCE_BANDS = ["high", "medium", "low"] as const;

export type VieComparisonConfidenceBand = (typeof VIE_COMPARISON_CONFIDENCE_BANDS)[number];

export type VieAngleMatchStatus = "pending_ai" | "pending_ai_vision";

export type VieFramingMatchStatus = "match" | "mismatch" | "unknown";

export const VIE_COMPARISON_REVIEW_STATUSES = ["suggested", "accepted", "dismissed"] as const;

export type VieComparisonReviewStatus = (typeof VIE_COMPARISON_REVIEW_STATUSES)[number];

/** Input row for the deterministic comparison engine. */
export type VieComparisonCaptureRecord = {
  patient_image_id: string;
  patient_id: string;
  case_id: string | null;
  anatomical_region: string;
  protocol_template_slug: string;
  protocol_slot_slug: string;
  framing: VieCaptureFraming;
  slot_family: string;
  journey_stage: VieJourneyStage;
  quality_score: number;
  quality_band: string;
  clinically_usable: boolean;
  acceptance_status: VieCaptureAcceptanceStatus;
  captured_at: string;
  follow_up_interval: string | null;
  visit_type: string | null;
  imaging_library_axis: string;
  surgery_phase: VieSurgeryPhase | null;
};

/** Generated comparison pair (engine output). */
export type VieComparisonPair = {
  comparison_id: string;
  patient_id: string;
  case_id: string | null;
  before_image_id: string;
  after_image_id: string;
  comparison_category: VieComparisonCategory;
  anatomical_region: string;
  slot_family: string;
  before_timepoint: VieJourneyStage;
  after_timepoint: VieJourneyStage;
  days_between: number;
  quality_match_score: number;
  angle_match_status: VieAngleMatchStatus;
  framing_match_status: VieFramingMatchStatus;
  confidence_band: VieComparisonConfidenceBand;
  recommended_use: VieComparisonRecommendedUse[];
  warnings: string[];
};

export type VieProgressionTimelineGroup = {
  anatomical_region: string;
  slot_family: string;
  framing: VieCaptureFraming;
  images: Array<{
    patient_image_id: string;
    journey_stage: VieJourneyStage;
    protocol_template_slug: string;
    protocol_slot_slug: string;
    captured_at: string;
    quality_score: number;
  }>;
};

export type VieProgressionTimelineStage = {
  stage: VieJourneyStage;
  label: string;
  groups: VieProgressionTimelineGroup[];
};

export type VieProgressionTimeline = {
  engine_version: typeof VIE_COMPARISON_ENGINE_VERSION;
  patient_id: string;
  stages: VieProgressionTimelineStage[];
};

export type VieComparisonReadinessSummary = {
  suggested_pairs_count: number;
  audit_ready_pairs_count: number;
  follow_up_progression_coverage: number;
  regions_without_comparison: string[];
  next_recommended_capture: {
    protocol_slug: VieProtocolSlug | null;
    slot_slug: string | null;
    label: string | null;
  };
};

export type VieSurgeryComparisonStatus = {
  donor_extraction_pair: "ready" | "partial" | "missing";
  graft_tray_pair: "ready" | "partial" | "missing";
  immediate_post_op_pair: "ready" | "partial" | "missing";
};

export type VieComparisonPairRow = VieComparisonPair & {
  id: string;
  tenant_id: string;
  review_status: VieComparisonReviewStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** Phase 6 — alignment enrichment for after image vs before reference. */
  alignment?: import("./vieAlignmentTypes").VieComparisonPairAlignment;
};
