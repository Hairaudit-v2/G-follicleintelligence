/**
 * FI-TRICHOSCOPY-1B — consultation integration types (pure).
 * Findings are assessment support, not FiOS diagnoses.
 */

export const TRICHOSCOPY_INDICATION_CODES = [
  "suspected_androgenetic_alopecia",
  "diffuse_shedding",
  "suspected_telogen_effluvium",
  "suspected_alopecia_areata",
  "suspected_scarring_alopecia",
  "inflammatory_scalp_condition",
  "unexplained_density_reduction",
  "donor_area_assessment",
  "treatment_response_baseline",
  "treatment_response_follow_up",
  "diagnostic_uncertainty",
  "clinician_concern",
  "patient_requested_assessment",
  "other",
] as const;

export type TrichoscopyIndicationCode = (typeof TRICHOSCOPY_INDICATION_CODES)[number];

export const TRICHOSCOPY_CONSULTATION_STATUSES = [
  "not_required",
  "recommended",
  "required_before_treatment",
  "already_available",
  "requested",
  "in_progress",
  "ready_for_review",
  "reviewed",
  "insufficient",
  "superseded",
  "withdrawn",
  "failed",
  "deferred",
] as const;

export type TrichoscopyConsultationStatus = (typeof TRICHOSCOPY_CONSULTATION_STATUSES)[number];

export const TRICHOSCOPY_REQUEST_MODES = [
  "new_assessment",
  "link_existing",
  "repeat_assessment",
  "additional_evidence",
] as const;

export type TrichoscopyRequestMode = (typeof TRICHOSCOPY_REQUEST_MODES)[number];

export const TRICHOSCOPY_ACKNOWLEDGEMENT_STATES = [
  "not_reviewed",
  "acknowledged",
  "accepted_into_assessment",
  "accepted_with_qualification",
  "not_clinically_significant",
  "disagreed",
  "requires_more_evidence",
  "escalated",
  "superseded",
] as const;

export type TrichoscopyAcknowledgementState = (typeof TRICHOSCOPY_ACKNOWLEDGEMENT_STATES)[number];

/** States that explicitly accept a finding into the FiOS consultation assessment. */
export const TRICHOSCOPY_ACCEPTANCE_ACK_STATES: readonly TrichoscopyAcknowledgementState[] = [
  "accepted_into_assessment",
  "accepted_with_qualification",
];

export const TRICHOSCOPY_FINDING_DOMAINS = [
  "evidence_quality",
  "hair_follicular",
  "scalp_inflammatory",
  "distribution_pattern",
  "donor",
  "interpretation",
  "safety_escalation",
  "limitation",
  "other",
] as const;

export type TrichoscopyFindingDomain = (typeof TRICHOSCOPY_FINDING_DOMAINS)[number];

export const TRICHOSCOPY_DECISION_KINDS = [
  "primary_diagnosis",
  "differential_diagnosis",
  "working_diagnosis",
  "diagnosis_under_investigation",
  "exclusion",
  "investigation",
  "treatment",
  "referral",
  "biopsy_consideration",
  "escalation",
  "monitoring",
  "follow_up_trichoscopy",
  "defer_treatment",
  "patient_communication",
] as const;

export type TrichoscopyDecisionKind = (typeof TRICHOSCOPY_DECISION_KINDS)[number];

/** Decision kinds that require clinical acceptance of findings (never auto-created from HLI). */
export const TRICHOSCOPY_DIAGNOSIS_DECISION_KINDS: readonly TrichoscopyDecisionKind[] = [
  "primary_diagnosis",
  "differential_diagnosis",
  "working_diagnosis",
  "diagnosis_under_investigation",
  "exclusion",
];

export const TRICHOSCOPY_INVESTIGATION_CATEGORIES = [
  "full_blood_count",
  "iron_studies",
  "ferritin",
  "thyroid_function",
  "vitamin_d",
  "vitamin_b12",
  "zinc",
  "hormone_profile",
  "androgen_assessment",
  "autoimmune_investigation",
  "inflammatory_markers",
  "clinician_defined_test",
  "dermatology_review",
  "biopsy_consideration",
] as const;

export type TrichoscopyInvestigationCategory = (typeof TRICHOSCOPY_INVESTIGATION_CATEGORIES)[number];

export const TRICHOSCOPY_CONSULTATION_READINESS_STATES = [
  "no_trichoscopy_requirement",
  "requirement_unresolved",
  "request_pending",
  "evidence_incomplete",
  "review_required",
  "escalation_unresolved",
  "decision_documented",
  "ready_to_complete",
] as const;

export type TrichoscopyConsultationReadinessState =
  (typeof TRICHOSCOPY_CONSULTATION_READINESS_STATES)[number];

export const TRICHOSCOPY_FAILURE_KINDS = [
  "hli_unavailable",
  "request_not_delivered",
  "request_rejected",
  "signature_failure",
  "patient_link_missing",
  "evidence_incomplete",
  "assessment_processing_delay",
  "assessment_withdrawn",
  "reconciliation_mismatch",
  "stale_local_status",
  "unsupported_payload_version",
] as const;

export type TrichoscopyFailureKind = (typeof TRICHOSCOPY_FAILURE_KINDS)[number];

export type TrichoscopyIndicationInput = {
  indicationCodes: TrichoscopyIndicationCode[];
  clinicianNote?: string | null;
  urgency?: "routine" | "priority" | "urgent";
  anatomicalRegions?: string[];
  waitForTreatmentPlanning?: boolean;
  medicalReviewRequired?: boolean;
  patientConsentCapture?: boolean;
  patientConsentTransfer?: boolean;
  symptoms?: string | null;
  onsetProgression?: string | null;
  knownDiagnoses?: string | null;
  currentTreatments?: string | null;
  relevantMedications?: string | null;
  recentProcedures?: string | null;
  availableBloodResultsSummary?: string | null;
  clinicianQuestion?: string | null;
};

export type NormalisedTrichoscopyFinding = {
  findingDomain: TrichoscopyFindingDomain;
  findingCode: string;
  observedRegion?: string | null;
  severity?: string | null;
  extent?: string | null;
  confidence?: number | null;
  evidenceQuality?: string | null;
  supportingEvidenceRefs?: unknown[];
  alternativeInterpretations?: unknown[];
  limitations?: string[];
  recommendedNextStep?: string | null;
  isSignificant: boolean;
  isEscalation: boolean;
  hliFindingId?: string | null;
  rawPayload?: Record<string, unknown>;
};

export type ConsultationTrichoscopyCardSummary = {
  consultationStatus: TrichoscopyConsultationStatus;
  readinessState: TrichoscopyConsultationReadinessState;
  blocking: boolean;
  blockingReasonCodes: string[];
  assessmentDate?: string | null;
  requestingClinicianLabel?: string | null;
  assessmentSource?: string | null;
  evidenceQuality?: string | null;
  significantFindingsCount: number;
  unresolvedActionCount: number;
  evidencePackVersion?: string | null;
  lastSyncedAt?: string | null;
  pinnedPackVersion?: string | null;
  failureKind?: TrichoscopyFailureKind | null;
  integrationMessage?: string | null;
};

export const PATIENT_SAFE_TRICHOSCOPY_FRAMING =
  "Trichoscopy was used to examine the scalp and hair in greater detail. The findings have been reviewed alongside your history, photographs, symptoms, and clinical assessment. They are one part of the overall consultation and should not be interpreted independently.";
