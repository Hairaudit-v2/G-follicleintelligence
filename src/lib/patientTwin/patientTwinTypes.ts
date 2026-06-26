/**
 * PatientTwin V1 — **read contract only**.
 *
 * This DTO is a server-assembled projection for Follicle Intelligence modules. It is **not** a
 * writable source of truth and must not replace foundation tables, CRM rows, or case records.
 * Loaders aggregate existing tenant-scoped sources under the service role; consumers should treat
 * `warnings` as signals for partial coverage, not as errors.
 */

import type { HliPhotoProtocolClinicalContext, HliPhotoProtocolComplianceSummary } from "@/src/lib/hair-intelligence/photoProtocols/types";
import type { HairProgressionIntelligence } from "@/src/lib/hair-intelligence/hairProgressionIntelligence";

export const PATIENT_TWIN_VERSION = "patient-twin.v1" as const;

export const PATIENT_TWIN_LOADER_VERSION = "patient-twin-loader.v1" as const;

/** Machine-readable warning codes for automation and UI routing. */
export type PatientTwinWarningCode =
  | "missing_foundation_patient"
  | "unresolved_global_patient"
  | "duplicate_media_risk"
  | "missing_audit_linkage"
  | "missing_case_linkage"
  | "resolution_anomaly"
  | "generic";

export type PatientTwinWarning = {
  code: PatientTwinWarningCode;
  message: string;
};

export type PatientTwinPersonSection = {
  person_id: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  /** Structured DOB string when derivable from person / patient / HubSpot metadata. */
  date_of_birth: string | null;
  address: string | null;
  preferred_contact_method: "email" | "sms" | "both" | null;
  reminder_consent: boolean | null;
  lifecycle_stage: string | null;
  lead_status: string | null;
  stage_of_journey: string | null;
  import_batch_id: string | null;
  hubspot_record_id: string | null;
  /** Distinct source systems contributing identifiers or resolution rows for this twin. */
  source_labels: string[];
};

export type PatientTwinSourceIdRow = {
  source_system: string;
  source_patient_id: string;
};

export type PatientTwinIdentityResolutionSection = {
  foundation_patient_id: string | null;
  global_patient_id: string | null;
  source_ids: PatientTwinSourceIdRow[];
  duplicate_risk: boolean;
  resolution_warnings: string[];
};

export type PatientTwinCrmSection = {
  active_leads_count: number;
  latest_lead_status: string | null;
  latest_lead_stage_label: string | null;
  open_tasks_count: number;
  latest_activity_summary: string | null;
  primary_owner_email: string | null;
  primary_clinic_display_name: string | null;
  primary_organisation_name: string | null;
};

export type PatientTwinCaseMilestone = {
  event_kind: string;
  title: string | null;
  occurred_at: string;
};

export type PatientTwinCaseRow = {
  case_id: string;
  global_case_id: string | null;
  foundation_patient_id: string | null;
  global_patient_id: string | null;
  status: string;
  case_type: string | null;
  created_at: string;
  updated_at: string;
  clinic_display_name: string | null;
  organisation_name: string | null;
  latest_milestone: PatientTwinCaseMilestone | null;
};

export type PatientTwinAuditRollupSection = {
  reports_total: number;
  audits_total: number;
  reports_by_status: Record<string, number>;
  model_runs_total: number;
  model_runs_by_status: Record<string, number>;
  scorecards_total: number;
  latest_released_report: {
    report_id: string;
    case_id: string;
    version: number;
    released_at: string | null;
    created_at: string;
  } | null;
  /** Reserved for future normalised outcome signals; no inference in V1. */
  outcome_indicators: { placeholder: true };
};

export type PatientTwinMediaLatestItem = {
  asset_type: string | null;
  media_asset_id: string | null;
  legacy_upload_id: string | null;
  case_id: string | null;
  file_name: string | null;
  created_at: string | null;
};

export type PatientTwinMediaSection = {
  by_asset_type: Record<
    string,
    {
      count: number;
      latest: PatientTwinMediaLatestItem | null;
    }
  >;
};

export type PatientTwinImagingGalleryItem = {
  id: string;
  thumbnail_url: string;
  signed_expires_at: string;
  taken_at: string | null;
  created_at: string;
  ai_image_category: string | null;
  ai_image_category_confidence: number | null;
  ai_hair_state: string | null;
  ai_shave_state: string | null;
  ai_surgery_stage: string | null;
  ai_image_review_status: string;
  ai_image_ai_notes: string | null;
  ai_image_classified_at: string | null;
};

export type PatientTwinImagingGalleryUiSection = {
  key: string;
  title: string;
  items: PatientTwinImagingGalleryItem[];
};

export type PatientTwinImagingGallerySection = {
  items: PatientTwinImagingGalleryItem[];
  ui_sections: PatientTwinImagingGalleryUiSection[];
};

export type PatientTwinImagingSection = {
  active_image_total: number;
  by_library_axis: Record<string, number>;
  latest_captured_at: string | null;
  imaging_workspace_href: string;
  gallery: PatientTwinImagingGallerySection;
};

export type PatientTwinPhotoProtocolChecklistRow = {
  session_slot_id: string;
  slot_id: string;
  slot_slug: string;
  label: string;
  is_required: boolean;
  capture_guidance: string | null;
  quality_guidance: string | null;
  status: string;
  patient_image_id: string | null;
  ai_match_confidence: number | null;
  staff_note: string | null;
};

export type PatientTwinPhotoProtocolSection = {
  clinical_context: HliPhotoProtocolClinicalContext;
  template_slug: string;
  template_name: string;
  active_session_id: string | null;
  active_session_status: string | null;
  /** True when all required session slots are accepted or strongly captured (FI OS session only). */
  can_complete_session: boolean;
  compliance: HliPhotoProtocolComplianceSummary;
  checklist: PatientTwinPhotoProtocolChecklistRow[];
  unclassified_image_ids: string[];
};

/** Foundation timeline only (`fi_timeline_events`); CRM activity lives under `crm`. */
export type PatientTwinTimelineItem = {
  source_type: "fi_timeline_events";
  source_id: string;
  occurred_at: string;
  event_kind: string;
  title: string | null;
  case_id: string;
  patient_id: string | null;
};

export type PatientTwinTimelineSection = {
  order: "newest_first";
  items: PatientTwinTimelineItem[];
  item_cap: number;
};

/** MedicationOS read slice for Twin (bounded; no prescribing mutations). */
export type PatientTwinMedicationActiveItem = {
  plan_item_id: string;
  plan_id: string;
  plan_title: string;
  plan_type: string;
  canonical_code: string;
  display_name: string;
  role: string;
  dosing_summary: string | null;
  pathology_gate: string | null;
  sessions_planned: number | null;
  sessions_completed: number;
  prescription_id: string | null;
  prescription_item_id: string | null;
  /** Tables contributing to this row (for provenance badges in UI). */
  source_tables: readonly ["fi_patient_therapy_plan_items", "fi_medication_os_canonical"];
};

export type PatientTwinTherapyEventPreview = {
  id: string;
  event_type: string;
  occurred_at: string;
  title: string;
  canonical_code: string | null;
  plan_id: string | null;
  source_table: "fi_patient_therapy_events";
};

export type PatientTwinMedicationsSection = {
  active_plan_count: number;
  active_items: PatientTwinMedicationActiveItem[];
  therapy_events_preview: PatientTwinTherapyEventPreview[];
  active_item_cap: number;
  therapy_events_preview_cap: number;
};

/** Bounded structured fields only — no free-text clinical narrative. */
export type PatientTwinClinicalSection = {
  structured_profile: {
    norwood_scale: string | null;
    ludwig_scale: string | null;
    hairline_pattern: string | null;
    primary_concern: string | null;
    treatment_interest: string | null;
  } | null;
  /** MedicationOS therapy plans / items / recent events (read-only; empty when tables are empty or load fails). */
  medications: PatientTwinMedicationsSection;
  treatments: never[];
  blood_markers: never[];
};

export type PatientTwinHairLossClassificationRow = {
  id: string;
  source_record_id: string | null;
  classification_system: string;
  pattern_type: string;
  classification_grade: string;
  confidence_score: number;
  frontal_loss_score: number | null;
  temporal_recession_score: number | null;
  mid_scalp_score: number | null;
  crown_loss_score: number | null;
  diffuse_thinning_score: number | null;
  retrograde_pattern_detected: boolean;
  suspected_scarring_pattern: boolean;
  sex_classification: string | null;
  review_status: string;
  ai_notes: string | null;
  created_at: string;
};

export type PatientTwinHairLossSection = {
  latest: PatientTwinHairLossClassificationRow | null;
  recent: PatientTwinHairLossClassificationRow[];
  recent_cap: number;
};

export type PatientTwinDonorAssessmentRow = {
  id: string;
  source_record_id: string | null;
  donor_region: string;
  donor_quality_rating: string;
  confidence_score: number;
  estimated_density_band: string | null;
  miniaturisation_risk: string | null;
  retrograde_risk: string | null;
  overharvesting_risk: string | null;
  safe_donor_capacity_band: string | null;
  lifetime_graft_budget_band: string | null;
  extraction_caution_level: string | null;
  review_status: string;
  clinical_observations: string | null;
  ai_notes: string | null;
  created_at: string;
};

export type PatientTwinDonorSection = {
  latest: PatientTwinDonorAssessmentRow | null;
  recent: PatientTwinDonorAssessmentRow[];
  recent_cap: number;
};

export type PatientTwinRecipientCandidacyReviewRow = {
  id: string;
  source_record_id: string | null;
  recipient_quality_rating: string;
  confidence_score: number;
  diffuse_thinning_risk: string | null;
  shock_loss_risk: string | null;
  density_expectation_risk: string | null;
  medication_stabilisation_needed: boolean;
  pathology_review_recommended: boolean;
  surgical_timing_risk: string | null;
  patient_expectation_risk: string | null;
  documentation_gap_detected: boolean;
  review_topics: string[];
  candidacy_summary: string | null;
  review_status: string;
  ai_notes: string | null;
  created_at: string;
};

export type PatientTwinRecipientCandidacySection = {
  latest: PatientTwinRecipientCandidacyReviewRow | null;
  recent: PatientTwinRecipientCandidacyReviewRow[];
  recent_cap: number;
};

export type PatientTwinConsultationChecklistRow = {
  id: string;
  source_record_id: string | null;
  priority_level: string;
  checklist_status: string;
  confidence_score: number;
  medication_discussion_required: boolean;
  stabilisation_discussion_required: boolean;
  donor_preservation_discussion_required: boolean;
  expectation_management_required: boolean;
  consent_complexity_level: string | null;
  documentation_required: boolean;
  follow_up_required: boolean;
  delay_recommended: boolean;
  checklist_items: string[];
  risk_flags: string[];
  consultation_summary: string | null;
  review_status: string;
  ai_notes: string | null;
  created_at: string;
};

export type PatientTwinConsultationChecklistSection = {
  latest: PatientTwinConsultationChecklistRow | null;
  recent: PatientTwinConsultationChecklistRow[];
  recent_cap: number;
};

export type PatientTwinHairProgressionSection = HairProgressionIntelligence;

export type PatientTwinIntelligenceSection = {
  risk_score: null;
  predicted_outcome: null;
  model_outputs: never[];
  /** HIE Stage 9A — shared hair loss pattern classifications for this patient. */
  hair_loss: PatientTwinHairLossSection;
  /** HIE Stage 9B — longitudinal velocity, stability, therapy contrast, forecast, cohort context. */
  hair_progression: PatientTwinHairProgressionSection;
  /** HIE Stage 9C — donor-zone quality / capacity band estimates (image-based). */
  donor: PatientTwinDonorSection;
  /** HIE Stage 9D — recipient-area candidacy review signals (clinician topics only). */
  recipient_candidacy: PatientTwinRecipientCandidacySection;
  /** HIE Stage 10 — surgeon consultation checklist topics (discussion preparation only). */
  consultation_checklist: PatientTwinConsultationChecklistSection;
};

export type PatientTwinCompletenessMissingArea =
  | "identity"
  | "crm"
  | "case"
  | "audit"
  | "media"
  | "clinical"
  | "timeline"
  | "outcome";

export type PatientTwinCompletenessSection = {
  score: number;
  band: "poor" | "partial" | "good" | "excellent";
  missing: Array<{
    area: PatientTwinCompletenessMissingArea;
    label: string;
    severity: "info" | "warning" | "important";
  }>;
  strengths: Array<{
    area: string;
    label: string;
  }>;
  recommended_actions: Array<{
    label: string;
    reason: string;
    priority: "low" | "medium" | "high";
  }>;
};

export type PatientTwinProvenanceSection = {
  generated_at: string;
  loader_version: string;
  source_views_used: string[];
  source_tables_used: string[];
  /** Mirrors `completeness.score` for API consumers that only read provenance. */
  completeness_score: number;
};

export type PatientTwinPathologyRequestRow = {
  id: string;
  request_date: string;
  template_used: string;
  status: string;
  emailed_to_patient_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

export type PatientTwinPathologyResultRow = {
  id: string;
  result_date: string;
  provider_name: string | null;
  status: string;
  pathology_request_id: string | null;
  marker_count: number;
  abnormal_marker_count: number;
  source_type: string;
  reviewed_at: string | null;
  created_at: string;
};

export type PatientTwinPathologyAiInterpretationSummary = {
  id: string;
  pathology_result_id: string;
  status: string;
  hair_loss_relevance_score: number | null;
  surgical_readiness_score: number | null;
  main_contributors: string[];
  overview_snippet: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type PatientTwinPathologySection = {
  requests: PatientTwinPathologyRequestRow[];
  results: PatientTwinPathologyResultRow[];
  item_cap: number;
  results_item_cap: number;
  abnormal_markers_total: number;
  last_result_reviewed_at: string | null;
  latest_ai_interpretation: PatientTwinPathologyAiInterpretationSummary | null;
};

export type PatientTwinV1 = {
  version: typeof PATIENT_TWIN_VERSION;
  tenant_id: string;
  patient_id: string;
  person: PatientTwinPersonSection;
  identity_resolution: PatientTwinIdentityResolutionSection;
  crm: PatientTwinCrmSection;
  cases: PatientTwinCaseRow[];
  audits: PatientTwinAuditRollupSection;
  media: PatientTwinMediaSection;
  imaging: PatientTwinImagingSection;
  /** Stage 8B — Smart Clinical Photography Protocol (HLI) read model for Twin. */
  photo_protocol: PatientTwinPhotoProtocolSection | null;
  /** VIE Phase 1 — protocol-driven imaging completeness + capture intelligence stubs. */
  vie: import("@/src/lib/vie/viePatientTwinSection.server").PatientTwinVieSection | null;
  pathology: PatientTwinPathologySection;
  timeline: PatientTwinTimelineSection;
  clinical: PatientTwinClinicalSection;
  intelligence: PatientTwinIntelligenceSection;
  provenance: PatientTwinProvenanceSection;
  warnings: PatientTwinWarning[];
  completeness: PatientTwinCompletenessSection;
};
