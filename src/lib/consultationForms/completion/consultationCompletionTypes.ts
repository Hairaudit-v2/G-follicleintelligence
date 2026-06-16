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
  /** Pathway 2 (hair-loss-treatment-consultation) — populated by HLI completion rules. */
  hairLossPatternTypeLabel?: string;
  bloodAnalysisRecommended?: boolean;
  treatmentPriorityLabel?: string;
  treatmentTimelineLabel?: string;
  hliPathwayRecommendedLabel?: string;
  /** Pathway 3 (female-hair-loss-consultation) — structured snapshot for chart / twin handoff. */
  femaleHairLossCompletionSnapshot?: {
    patternLabel: string;
    durationLabel: string;
    sheddingLabel: string;
    femaleScaleSummary: string;
    hormonalSystemicSummary: string;
    ferritinLabel: string;
    thyroidLabel: string;
    bloodPathologySummary: string;
    treatmentPathwayLabel: string;
    followUpUrgencyLabel: string;
  };
  /** Pathway 4 (hair-transplant-repair-consultation) — repair audit + routing snapshot. */
  repairConsultationCompletionSnapshot?: {
    priorSurgeryHistoryLine: string;
    mainRepairConcernLabel: string;
    donorRecipientRiskLine: string;
    correctiveOptionsLabels: string[];
    hairauditRecommended: boolean;
    surgeryosPlanningRecommended: boolean;
    followUpUrgencyLabel: string;
  };
};

export type ConsultationCompletionInput = {
  consultationId: string;
  formInstanceId: string;
  templateSlug: string;
  values: Record<string, unknown>;
  completedAt: string;
  completedByUserId?: string | null;
};
