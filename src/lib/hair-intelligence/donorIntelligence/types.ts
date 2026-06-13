export const HIE_DONOR_SOURCE_SYSTEMS = ["fi_os", "hairaudit", "hair_longevity"] as const;
export type HieDonorSourceSystem = (typeof HIE_DONOR_SOURCE_SYSTEMS)[number];

export const HIE_DONOR_REGIONS = [
  "occipital",
  "left_parietal",
  "right_parietal",
  "nape",
  "beard",
  "body",
  "mixed",
  "unknown",
] as const;
export type HieDonorRegion = (typeof HIE_DONOR_REGIONS)[number];

export const HIE_DONOR_QUALITY_RATINGS = ["excellent", "good", "moderate", "poor", "unsafe", "unknown"] as const;
export type HieDonorQualityRating = (typeof HIE_DONOR_QUALITY_RATINGS)[number];

export const HIE_DONOR_DENSITY_BANDS = ["very_low", "low", "moderate", "high", "very_high", "unknown"] as const;
export type HieDonorDensityBand = (typeof HIE_DONOR_DENSITY_BANDS)[number];

export const HIE_DONOR_RISK_LEVELS = ["low", "moderate", "high", "unknown"] as const;
export type HieDonorRiskLevel = (typeof HIE_DONOR_RISK_LEVELS)[number];

export const HIE_SAFE_DONOR_CAPACITY_BANDS = [
  "under_1500",
  "1500_2500",
  "2500_4000",
  "4000_6000",
  "over_6000",
  "unknown",
] as const;
export type HieSafeDonorCapacityBand = (typeof HIE_SAFE_DONOR_CAPACITY_BANDS)[number];

export const HIE_LIFETIME_GRAFT_BUDGET_BANDS = ["under_3000", "3000_5000", "5000_7000", "over_7000", "unknown"] as const;
export type HieLifetimeGraftBudgetBand = (typeof HIE_LIFETIME_GRAFT_BUDGET_BANDS)[number];

export const HIE_EXTRACTION_CAUTION_LEVELS = ["low", "moderate", "high", "avoid", "unknown"] as const;
export type HieExtractionCautionLevel = (typeof HIE_EXTRACTION_CAUTION_LEVELS)[number];

export const HIE_DONOR_REVIEW_STATUSES = ["pending", "accepted", "corrected", "rejected"] as const;
export type HieDonorReviewStatus = (typeof HIE_DONOR_REVIEW_STATUSES)[number];

export type DonorAssessmentModelResult = {
  donor_region: HieDonorRegion;
  donor_quality_rating: HieDonorQualityRating;
  confidence_score: number;
  estimated_density_band: HieDonorDensityBand | null;
  miniaturisation_risk: HieDonorRiskLevel | null;
  retrograde_risk: HieDonorRiskLevel | null;
  overharvesting_risk: HieDonorRiskLevel | null;
  safe_donor_capacity_band: HieSafeDonorCapacityBand | null;
  lifetime_graft_budget_band: HieLifetimeGraftBudgetBand | null;
  extraction_caution_level: HieExtractionCautionLevel | null;
  clinical_observations: string;
  ai_notes: string;
};

export type HairIntelligenceDonorAssessmentInsert = {
  source_system: HieDonorSourceSystem;
  source_record_id: string | null;
  tenant_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  image_classification_id: string | null;
  hair_loss_classification_id: string | null;
  donor_region: HieDonorRegion;
  donor_quality_rating: HieDonorQualityRating;
  confidence_score: number;
  estimated_density_band: HieDonorDensityBand | null;
  miniaturisation_risk: HieDonorRiskLevel | null;
  retrograde_risk: HieDonorRiskLevel | null;
  overharvesting_risk: HieDonorRiskLevel | null;
  safe_donor_capacity_band: HieSafeDonorCapacityBand | null;
  lifetime_graft_budget_band: HieLifetimeGraftBudgetBand | null;
  extraction_caution_level: HieExtractionCautionLevel | null;
  clinical_observations: string | null;
  ai_notes: string | null;
  review_status: HieDonorReviewStatus;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  assessor_version: string | null;
};
