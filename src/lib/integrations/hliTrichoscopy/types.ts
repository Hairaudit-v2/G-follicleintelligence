/**
 * FI-TRICHOSCOPY-1A — shared types for FiOS ↔ HLI trichoscopy integration.
 */

import type {
  TrichoscopyCapability,
  TrichoscopyCapabilityTier,
  TrichoscopyEntitlementStatus,
} from "@/src/lib/platform/entitlements/trichoscopyCapabilities";

export const HLI_TRICHOSCOPY_MODULE_KEY = "hli_trichoscopy" as const;

export type FiosTrichoscopyPurpose =
  | "consultation"
  | "treatment_baseline"
  | "treatment_followup"
  | "donor_assessment"
  | "recipient_assessment"
  | "pre_surgery"
  | "revision_review"
  | "procedure_day"
  | "post_surgery"
  | "scalp_review"
  | "custom";

export type FiosTrichoscopyStatus =
  | "not_requested"
  | "requested"
  | "linked"
  | "capture_due"
  | "capture_in_progress"
  | "capture_complete"
  | "analysis_pending"
  | "review_pending"
  | "confirmed"
  | "confirmed_with_limitations"
  | "repeat_capture_required"
  | "medical_review_required"
  | "completed"
  | "cancelled"
  | "integration_error";

export type FiosTrichoscopyRequest = {
  tenantId: string;
  fiosPatientId: string;
  fiosCaseId?: string;
  consultationId?: string;
  treatmentPlanId?: string;
  surgeryCaseId?: string;
  purpose: FiosTrichoscopyPurpose;
  requestedSites?: string[];
  clinicalQuestion?: string;
  targetDate?: string;
  urgency?: "routine" | "priority";
  requestedByUserId: string;
};

export type HliTrichoscopyRequestResponse = {
  requestId: string;
  hliPatientReference: string;
  hliIntakeId?: string;
  episodeId: string;
  purpose: string;
  requiredSites: string[];
  optionalSites?: string[];
  captureProtocolVersion: string;
  captureUrl?: string;
  status: string;
  createdAt: string;
};

export type HliEntitlementContext = {
  moduleKey: "hli_trichoscopy";
  capability: TrichoscopyCapability;
  entitlementTier: TrichoscopyCapabilityTier | string;
  entitlementStatus: Extract<TrichoscopyEntitlementStatus, "active" | "trial" | "grace_period">;
  tenantId: string;
};

export type HliTrichoscopyEventEnvelope = {
  eventId: string;
  eventType: string;
  eventVersion: string;
  occurredAt: string;
  tenantReference: string;
  patientReference: string;
  episodeId?: string;
  sessionId?: string;
  assessmentId?: string;
  evidencePackId?: string;
  status?: string;
  limitationCodes?: string[];
  idempotencyKey: string;
  safetyAssertions?: {
    assertsDiagnosis?: false;
    assertsTreatmentCausation?: false;
    approvesSurgery?: false;
    independentlyCalculatesGraftEstimate?: false;
    assignsSurgicalFault?: false;
  };
};

export type FiosTrichoscopyReadiness = {
  state:
    | "not_required"
    | "required_not_started"
    | "capture_incomplete"
    | "analysis_pending"
    | "clinical_review_pending"
    | "confirmed"
    | "confirmed_with_limitations"
    | "repeat_capture_required"
    | "medical_review_required"
    | "integration_error";
  blocking: boolean;
  blockingReasonCodes: string[];
  nextAction?: string;
};

export type ImportedEvidencePackState = "active" | "superseded" | "withdrawn";

export const SUPPORTED_HLI_TRICHOSCOPY_EVENTS = [
  "trichoscopy.session_created",
  "trichoscopy.session_captured",
  "trichoscopy.capture_quality_assessed",
  "trichoscopy.analysis_ready",
  "trichoscopy.observation_confirmed",
  "trichoscopy.metric_confirmed",
  "trichoscopy.comparison_ready",
  "trichoscopy.longitudinal_change_confirmed",
  "trichoscopy.response_assessment_confirmed",
  "trichoscopy.repeat_capture_requested",
  "trichoscopy.medical_review_requested",
  "trichoscopy.surgical_evidence_ready",
  "trichoscopy.patient_report_published",
] as const;

export type SupportedHliTrichoscopyEvent = (typeof SUPPORTED_HLI_TRICHOSCOPY_EVENTS)[number];

export const EVIDENCE_PACK_TYPES = [
  "hli-trichoscopy-consultation-v1",
  "hli-trichoscopy-treatment-baseline-v1",
  "hli-trichoscopy-longitudinal-v1",
  "hli-trichoscopy-treatment-response-v1",
  "hli-trichoscopy-surgical-planning-v1",
] as const;

export type HliEvidencePackType = (typeof EVIDENCE_PACK_TYPES)[number];
