export const HIE_RECIPIENT_SOURCE_SYSTEMS = ["fi_os", "hairaudit", "hair_longevity"] as const;
export type HieRecipientSourceSystem = (typeof HIE_RECIPIENT_SOURCE_SYSTEMS)[number];

export const HIE_RECIPIENT_QUALITY_RATINGS = ["excellent", "good", "moderate", "poor", "unsuitable", "unknown"] as const;
export type HieRecipientQualityRating = (typeof HIE_RECIPIENT_QUALITY_RATINGS)[number];

export const HIE_RECIPIENT_RISK_LEVELS = ["low", "moderate", "high", "unknown"] as const;
export type HieRecipientRiskLevel = (typeof HIE_RECIPIENT_RISK_LEVELS)[number];

export const HIE_RECIPIENT_SURGICAL_TIMING_RISKS = ["low", "moderate", "high", "delay_recommended", "unknown"] as const;
export type HieRecipientSurgicalTimingRisk = (typeof HIE_RECIPIENT_SURGICAL_TIMING_RISKS)[number];

export const HIE_RECIPIENT_REVIEW_STATUSES = ["pending", "accepted", "corrected", "rejected"] as const;
export type HieRecipientReviewStatus = (typeof HIE_RECIPIENT_REVIEW_STATUSES)[number];

/** HLI `image_category` values used as recipient-area context (frontal / mid / vertex). */
export const HIE_RECIPIENT_AREA_IMAGE_CATEGORIES = ["front", "crown", "top", "left_profile", "right_profile"] as const;
export type HieRecipientAreaImageCategory = (typeof HIE_RECIPIENT_AREA_IMAGE_CATEGORIES)[number];

export type RecipientAssessmentModelResult = {
  recipient_quality_rating: HieRecipientQualityRating;
  confidence_score: number;
  diffuse_thinning_risk: HieRecipientRiskLevel | null;
  shock_loss_risk: HieRecipientRiskLevel | null;
  density_expectation_risk: HieRecipientRiskLevel | null;
  medication_stabilisation_needed: boolean;
  pathology_review_recommended: boolean;
  surgical_timing_risk: HieRecipientSurgicalTimingRisk | null;
  patient_expectation_risk: HieRecipientRiskLevel | null;
  documentation_gap_detected: boolean;
  review_topics: string[];
  candidacy_summary: string;
  ai_notes: string;
};

export type HairIntelligenceRecipientCandidacyReviewInsert = {
  source_system: HieRecipientSourceSystem;
  source_record_id: string | null;
  tenant_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  hair_loss_classification_id: string | null;
  donor_assessment_id: string | null;
  recipient_image_classification_id: string | null;
  progression_velocity: number | null;
  recipient_quality_rating: HieRecipientQualityRating;
  confidence_score: number;
  diffuse_thinning_risk: HieRecipientRiskLevel | null;
  shock_loss_risk: HieRecipientRiskLevel | null;
  density_expectation_risk: HieRecipientRiskLevel | null;
  medication_stabilisation_needed: boolean;
  pathology_review_recommended: boolean;
  surgical_timing_risk: HieRecipientSurgicalTimingRisk | null;
  patient_expectation_risk: HieRecipientRiskLevel | null;
  documentation_gap_detected: boolean;
  candidacy_summary: string | null;
  review_topics: string[];
  ai_notes: string | null;
  review_status: HieRecipientReviewStatus;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  assessor_version: string | null;
};
