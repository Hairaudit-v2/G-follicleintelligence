/**
 * VIE Phase 7 — Outcome Intelligence Engine types.
 * Evidence readiness and monitoring signals only — no AI vision or biological measurement.
 */

import type { VieComparisonConfidenceBand } from "./vieComparisonTypes";
import type { VieProtocolSlug } from "./vieProtocolTypes";

export const VIE_OUTCOME_ENGINE_VERSION = "vie-outcome.v1" as const;

export const VIE_OUTCOME_DOMAINS = [
  "recipient_growth",
  "donor_recovery",
  "hairline_maturation",
  "crown_progress",
  "surgical_healing",
  "documentation_readiness",
  "audit_evidence_quality",
] as const;

export type VieOutcomeDomain = (typeof VIE_OUTCOME_DOMAINS)[number];

export const VIE_OUTCOME_STATUSES = [
  "insufficient_evidence",
  "early_signal",
  "monitoring",
  "favourable",
  "concern",
  "audit_ready",
] as const;

export type VieOutcomeStatus = (typeof VIE_OUTCOME_STATUSES)[number];

export const VIE_OUTCOME_CONFIDENCE_BANDS = ["high", "medium", "low"] as const;

export type VieOutcomeConfidenceBand = (typeof VIE_OUTCOME_CONFIDENCE_BANDS)[number];

export type VieOutcomeNextRecommendedCapture = {
  protocol_slug: VieProtocolSlug | null;
  slot_slug: string | null;
  label: string | null;
};

export type VieOutcomeDomainSummary = {
  domain: VieOutcomeDomain;
  score: number;
  status: VieOutcomeStatus;
  evidence_count: number;
  best_comparison_pair_id: string | null;
  warnings: string[];
  next_recommended_capture: VieOutcomeNextRecommendedCapture;
};

export type VieOutcomeNextAction = {
  kind: "capture" | "clinical_review" | "alignment_recapture" | "comparison_review" | "audit_prep";
  label: string;
  priority: "high" | "medium" | "low";
  domain: VieOutcomeDomain | null;
};

/** Deterministic outcome summary — evidence readiness, not biological certainty. */
export type VieOutcomeSummary = {
  engine_version: typeof VIE_OUTCOME_ENGINE_VERSION;
  patient_id: string;
  case_id: string | null;
  overall_outcome_readiness_score: number;
  confidence_band: VieOutcomeConfidenceBand;
  domains: VieOutcomeDomainSummary[];
  audit_ready: boolean;
  clinical_review_recommended: boolean;
  warnings: string[];
  next_actions: VieOutcomeNextAction[];
  generated_at: string;
};

export type VieOutcomeSummaryRow = VieOutcomeSummary & {
  id: string;
  tenant_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Input pair for outcome scoring (comparison + optional alignment + review). */
export type VieOutcomeComparisonInput = {
  pair_id: string;
  comparison_category: string;
  anatomical_region: string;
  slot_family: string;
  before_timepoint: string;
  after_timepoint: string;
  quality_match_score: number;
  confidence_band: VieComparisonConfidenceBand;
  review_status: "suggested" | "accepted" | "dismissed";
  warnings: string[];
  recommended_use: string[];
  alignment_score: number | null;
  alignment_status: string | null;
  is_standardized_evidence: boolean;
};

/** Protocol completeness inputs for documentation readiness domains. */
export type VieOutcomeCompletenessInput = {
  consultation_percent: number;
  donor_documentation_percent: number;
  surgical_documentation_percent: number;
  follow_up_progression_coverage: number;
};

/** Whether a comparison pair contributes to outcome evidence (for ImagingOS UI). */
export type VieOutcomePairContribution = {
  contributes: boolean;
  domains: VieOutcomeDomain[];
  reason: string | null;
};
