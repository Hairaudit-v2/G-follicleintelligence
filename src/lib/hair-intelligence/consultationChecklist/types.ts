export const HIE_CONSULTATION_CHECKLIST_SOURCE_SYSTEMS = ["fi_os", "hairaudit", "hair_longevity"] as const;
export type HieConsultationChecklistSourceSystem = (typeof HIE_CONSULTATION_CHECKLIST_SOURCE_SYSTEMS)[number];

export const HIE_CONSULTATION_CHECKLIST_STATUSES = ["generated", "reviewed", "approved", "archived"] as const;
export type HieConsultationChecklistStatus = (typeof HIE_CONSULTATION_CHECKLIST_STATUSES)[number];

export const HIE_CONSULTATION_PRIORITY_LEVELS = ["low", "moderate", "high", "urgent"] as const;
export type HieConsultationPriorityLevel = (typeof HIE_CONSULTATION_PRIORITY_LEVELS)[number];

export const HIE_CONSULTATION_CONSENT_COMPLEXITY_LEVELS = ["standard", "moderate", "high", "complex", "unknown"] as const;
export type HieConsultationConsentComplexityLevel = (typeof HIE_CONSULTATION_CONSENT_COMPLEXITY_LEVELS)[number];

export const HIE_CONSULTATION_REVIEW_STATUSES = ["pending", "accepted", "corrected", "rejected"] as const;
export type HieConsultationReviewStatus = (typeof HIE_CONSULTATION_REVIEW_STATUSES)[number];

export type ConsultationChecklistModelResult = {
  confidence_score: number;
  priority_level: HieConsultationPriorityLevel;
  medication_discussion_required: boolean;
  stabilisation_discussion_required: boolean;
  donor_preservation_discussion_required: boolean;
  expectation_management_required: boolean;
  consent_complexity_level: HieConsultationConsentComplexityLevel | null;
  documentation_required: boolean;
  follow_up_required: boolean;
  delay_recommended: boolean;
  checklist_items: string[];
  risk_flags: string[];
  consultation_summary: string;
  ai_notes: string;
};

export type HairIntelligenceConsultationChecklistInsert = {
  source_system: HieConsultationChecklistSourceSystem;
  source_record_id: string | null;
  tenant_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  hair_loss_classification_id: string | null;
  donor_assessment_id: string | null;
  recipient_review_id: string | null;
  confidence_score: number;
  checklist_status: HieConsultationChecklistStatus;
  priority_level: HieConsultationPriorityLevel;
  medication_discussion_required: boolean;
  stabilisation_discussion_required: boolean;
  donor_preservation_discussion_required: boolean;
  expectation_management_required: boolean;
  consent_complexity_level: HieConsultationConsentComplexityLevel | null;
  documentation_required: boolean;
  follow_up_required: boolean;
  delay_recommended: boolean;
  consultation_summary: string | null;
  checklist_items: string[];
  risk_flags: string[];
  ai_notes: string | null;
  review_status: HieConsultationReviewStatus;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  generator_version: string | null;
};

export type GenerateConsultationChecklistParams = {
  source_system: HieConsultationChecklistSourceSystem;
  source_record_id: string | null;
  tenant_id: string | null;
  patient_id: string | null;
  case_id: string | null;
};

export type GenerateConsultationChecklistOutcome = {
  result: ConsultationChecklistModelResult;
  generatorVersion: string;
  usedOpenAi: boolean;
  persisted: { id: string };
};
