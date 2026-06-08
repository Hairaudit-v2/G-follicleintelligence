/**
 * PatientTwin V1 — **read contract only**.
 *
 * This DTO is a server-assembled projection for Follicle Intelligence modules. It is **not** a
 * writable source of truth and must not replace foundation tables, CRM rows, or case records.
 * Loaders aggregate existing tenant-scoped sources under the service role; consumers should treat
 * `warnings` as signals for partial coverage, not as errors.
 */

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
  /** Only when present as a structured string on `fi_persons.metadata` (same rule as patient profile UI). */
  date_of_birth: string | null;
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

/** Bounded structured fields only — no free-text clinical narrative. */
export type PatientTwinClinicalSection = {
  structured_profile: {
    norwood_scale: string | null;
    ludwig_scale: string | null;
    hairline_pattern: string | null;
    primary_concern: string | null;
    treatment_interest: string | null;
  } | null;
  /** Reserved until a structured medication list exists; narrative fields are intentionally omitted. */
  medications: null;
  treatments: never[];
  blood_markers: never[];
};

export type PatientTwinIntelligenceSection = {
  risk_score: null;
  predicted_outcome: null;
  model_outputs: never[];
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
  pathology: PatientTwinPathologySection;
  timeline: PatientTwinTimelineSection;
  clinical: PatientTwinClinicalSection;
  intelligence: PatientTwinIntelligenceSection;
  provenance: PatientTwinProvenanceSection;
  warnings: PatientTwinWarning[];
  completeness: PatientTwinCompletenessSection;
};
