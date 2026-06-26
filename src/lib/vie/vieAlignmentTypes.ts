/**
 * VIE Phase 6 — Same Angle Alignment Engine types.
 * Deterministic metadata-driven alignment; no computer vision yet.
 */

import type { VieCaptureFraming, VieCaptureGuideKind } from "./vieProtocolTypes";
import type { VieComparisonConfidenceBand, VieJourneyStage } from "./vieComparisonTypes";

export const VIE_ALIGNMENT_ENGINE_VERSION = "vie-alignment.v1" as const;

export const VIE_ALIGNMENT_STATUSES = [
  "excellent",
  "acceptable",
  "poor",
  "retake_recommended",
  "no_reference_available",
] as const;

export type VieAlignmentStatus = (typeof VIE_ALIGNMENT_STATUSES)[number];

export type VieCaptureOrientation = "landscape" | "portrait" | "square" | "unknown";

/** Placeholder until AI vision — real angle matching deferred. */
export type VieAngleMatchStatus = "pending_ai_vision";

export type VieAlignmentReferenceCandidate = {
  image_id: string;
  patient_id: string;
  anatomical_region: string;
  slot_family: string;
  framing: VieCaptureFraming;
  protocol_template_slug: string;
  protocol_slot_slug: string;
  quality_score: number;
  captured_at: string;
  visit_type: string | null;
  image_width: number | null;
  image_height: number | null;
  orientation: VieCaptureOrientation;
  capture_distance_hint: string | null;
  capture_guide: VieCaptureGuideKind | null;
  journey_stage: VieJourneyStage;
};

export type VieAlignmentCaptureInput = {
  image_id: string;
  patient_id: string;
  anatomical_region: string;
  slot_family: string;
  framing: VieCaptureFraming;
  protocol_template_slug: string;
  protocol_slot_slug: string;
  quality_score: number;
  captured_at: string;
  visit_type: string | null;
  image_width: number | null;
  image_height: number | null;
  orientation: VieCaptureOrientation;
  capture_distance_hint: string | null;
  capture_guide: VieCaptureGuideKind | null;
  journey_stage: VieJourneyStage;
};

export type VieSameAngleAlignmentResult = {
  engine_version: typeof VIE_ALIGNMENT_ENGINE_VERSION;
  alignment_score: number;
  alignment_status: VieAlignmentStatus;
  confidence_band: VieComparisonConfidenceBand;
  warnings: string[];
  reference_image_id: string | null;
  reference_captured_at: string | null;
  reference_slot_label: string | null;
  days_since_reference: number | null;
  angle_match_status: VieAngleMatchStatus;
  metadata: Record<string, unknown>;
};

export type VieCaptureStandardizationMetadata = {
  framing: VieCaptureFraming;
  capture_distance_hint: string | null;
  orientation: VieCaptureOrientation;
  alignment_score: number | null;
  reference_image_id: string | null;
};

export type VieCaptureReferenceGuidance = {
  has_reference: boolean;
  reference_image_id: string | null;
  reference_slot_label: string | null;
  days_since_reference: number | null;
  framing: VieCaptureFraming | null;
  capture_distance_hint: string | null;
  orientation: VieCaptureOrientation | null;
};

export type VieAlignmentResultRow = VieSameAngleAlignmentResult & {
  id: string;
  tenant_id: string;
  patient_id: string;
  image_id: string;
  anatomical_region: string;
  slot_family: string;
  created_at: string;
};

export type ViePatientTwinAlignmentSummary = {
  alignment_consistency_score: number;
  regions_with_poor_consistency: string[];
  standardized_evidence_coverage_percent: number;
  next_recommended_standardized_recapture: {
    slot_slug: string | null;
    slot_label: string | null;
    anatomical_region: string | null;
    reason: string | null;
  };
};

/** Enrichment for comparison pair display. */
export type VieComparisonPairAlignment = {
  alignment_score: number | null;
  alignment_status: VieAlignmentStatus | null;
  confidence_band: VieComparisonConfidenceBand | null;
  is_standardized_evidence: boolean;
};
