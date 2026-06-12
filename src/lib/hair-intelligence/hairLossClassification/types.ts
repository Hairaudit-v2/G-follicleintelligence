export const HIE_HAIR_LOSS_SOURCE_SYSTEMS = ["fi_os", "hairaudit", "hair_longevity"] as const;
export type HieHairLossSourceSystem = (typeof HIE_HAIR_LOSS_SOURCE_SYSTEMS)[number];

export const HIE_CLASSIFICATION_SYSTEMS = ["norwood", "ludwig", "sinclair", "olsen", "custom"] as const;
export type HieHairLossClassificationSystem = (typeof HIE_CLASSIFICATION_SYSTEMS)[number];

export const HIE_HAIR_LOSS_PATTERN_TYPES = [
  "male_pattern_baldness",
  "diffuse_male_pattern",
  "retrograde_alopecia",
  "female_pattern_loss",
  "diffuse_female_thinning",
  "traction_pattern",
  "frontal_fibrosing_pattern",
  "unknown",
] as const;
export type HieHairLossPatternType = (typeof HIE_HAIR_LOSS_PATTERN_TYPES)[number];

export const HIE_HAIR_LOSS_REVIEW_STATUSES = ["pending", "accepted", "corrected", "rejected"] as const;
export type HieHairLossReviewStatus = (typeof HIE_HAIR_LOSS_REVIEW_STATUSES)[number];

export const HIE_SEX_CLASSIFICATIONS = ["male", "female", "unknown"] as const;
export type HieSexClassification = (typeof HIE_SEX_CLASSIFICATIONS)[number];

/** Norwood Hamilton scale grades (male pattern). */
export const HIE_NORWOOD_GRADES = ["I", "II", "III", "III Vertex", "IV", "V", "VI", "VII", "unknown"] as const;
export type HieNorwoodGrade = (typeof HIE_NORWOOD_GRADES)[number];

export const HIE_LUDWIG_GRADES = ["I", "II", "III", "unknown"] as const;
export type HieLudwigGrade = (typeof HIE_LUDWIG_GRADES)[number];

export const HIE_SINCLAIR_GRADES = ["I", "II", "III", "IV", "V", "unknown"] as const;
export type HieSinclairGrade = (typeof HIE_SINCLAIR_GRADES)[number];

export const HIE_OLSEN_GRADES = ["mild", "moderate", "severe", "unknown"] as const;
export type HieOlsenGrade = (typeof HIE_OLSEN_GRADES)[number];

/** Normalised model output before persistence. */
export type HairLossClassificationModelResult = {
  sex_classification: HieSexClassification;
  classification_system: HieHairLossClassificationSystem;
  classification_grade: string;
  pattern_type: HieHairLossPatternType;
  confidence_score: number;
  frontal_loss_score: number | null;
  temporal_recession_score: number | null;
  mid_scalp_score: number | null;
  crown_loss_score: number | null;
  diffuse_thinning_score: number | null;
  retrograde_pattern_detected: boolean;
  suspected_scarring_pattern: boolean;
  notes: string;
};

export type HairIntelligenceHairLossClassificationInsert = {
  source_system: HieHairLossSourceSystem;
  source_record_id: string | null;
  tenant_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  image_classification_id: string | null;
  classification_system: HieHairLossClassificationSystem;
  pattern_type: HieHairLossPatternType;
  classification_grade: string;
  confidence_score: number;
  frontal_loss_score: number | null;
  temporal_recession_score: number | null;
  mid_scalp_score: number | null;
  crown_loss_score: number | null;
  diffuse_thinning_score: number | null;
  retrograde_pattern_detected: boolean;
  suspected_scarring_pattern: boolean;
  sex_classification: HieSexClassification | null;
  age_estimate_range: string | null;
  ai_notes: string | null;
  review_status: HieHairLossReviewStatus;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  classifier_version: string | null;
};

export type HairIntelligenceHairLossClassificationRow = HairIntelligenceHairLossClassificationInsert & {
  id: string;
  created_at: string;
  updated_at: string;
};
