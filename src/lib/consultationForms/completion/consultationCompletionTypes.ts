/**
 * ConsultationOS Stage 4 — rules-based consultation completion summary (no AI).
 */

export const CONSULTATION_OUTCOME_TYPES = [
  "proceed_surgery",
  "proceed_prp",
  "proceed_exosomes",
  "medical_management",
  "needs_blood_tests",
  "not_suitable",
  "review_later",
  "undecided",
] as const;

export type ConsultationOutcomeType = (typeof CONSULTATION_OUTCOME_TYPES)[number];

export const CONSULTATION_SUITABILITY_STATUSES = [
  "suitable",
  "suitable_with_caution",
  "not_suitable",
  "needs_review",
  "not_assessed",
] as const;

export type ConsultationSuitabilityStatus = (typeof CONSULTATION_SUITABILITY_STATUSES)[number];

export type ConsultationCompletionAreaMapHighlight = {
  view: string;
  label: string;
  severity: string;
};

export type ConsultationCompletionSummary = {
  consultationId: string;
  formInstanceId: string;
  templateSlug: string;
  completedAt: string;
  outcomeType: ConsultationOutcomeType;
  primaryConcern: string;
  diagnosisImpression: string;
  surgicalSuitability: ConsultationSuitabilityStatus;
  medicalSuitability: ConsultationSuitabilityStatus;
  recommendedProcedure: string;
  estimatedGraftsMin: number | null;
  estimatedGraftsMax: number | null;
  recommendedZones: string[];
  recommendedTreatments: string[];
  pathologyRecommended: boolean;
  pathologyReason: string;
  quoteNotes: string;
  followUpRequired: boolean;
  followUpReason: string;
  riskFlags: string[];
  areaMapHighlights: ConsultationCompletionAreaMapHighlight[];
  clinicianNotesPreview: string;
  source: "rules_v1";
};

export type ConsultationCompletionInput = {
  consultationId: string;
  formInstanceId: string;
  templateSlug: string;
  values: Record<string, unknown>;
  completedAt: string;
  completedByUserId?: string | null;
};
