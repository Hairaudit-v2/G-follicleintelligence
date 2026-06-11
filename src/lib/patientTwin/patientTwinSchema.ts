import { z } from "zod";
import { PATIENT_TWIN_VERSION } from "./patientTwinTypes";

const warningCodeSchema = z.enum([
  "missing_foundation_patient",
  "unresolved_global_patient",
  "duplicate_media_risk",
  "missing_audit_linkage",
  "missing_case_linkage",
  "resolution_anomaly",
  "generic",
]);

export const patientTwinWarningSchema = z.object({
  code: warningCodeSchema,
  message: z.string(),
});

export const patientTwinPersonSectionSchema = z.object({
  person_id: z.string().nullable(),
  display_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  source_labels: z.array(z.string()),
});

export const patientTwinSourceIdRowSchema = z.object({
  source_system: z.string(),
  source_patient_id: z.string(),
});

export const patientTwinIdentityResolutionSectionSchema = z.object({
  foundation_patient_id: z.string().uuid().nullable(),
  global_patient_id: z.string().uuid().nullable(),
  source_ids: z.array(patientTwinSourceIdRowSchema),
  duplicate_risk: z.boolean(),
  resolution_warnings: z.array(z.string()),
});

export const patientTwinCrmSectionSchema = z.object({
  active_leads_count: z.number().int().nonnegative(),
  latest_lead_status: z.string().nullable(),
  latest_lead_stage_label: z.string().nullable(),
  open_tasks_count: z.number().int().nonnegative(),
  latest_activity_summary: z.string().nullable(),
  primary_owner_email: z.string().nullable(),
  primary_clinic_display_name: z.string().nullable(),
  primary_organisation_name: z.string().nullable(),
});

export const patientTwinCaseMilestoneSchema = z.object({
  event_kind: z.string(),
  title: z.string().nullable(),
  occurred_at: z.string(),
});

export const patientTwinCaseRowSchema = z.object({
  case_id: z.string().uuid(),
  global_case_id: z.string().uuid().nullable(),
  foundation_patient_id: z.string().uuid().nullable(),
  global_patient_id: z.string().uuid().nullable(),
  status: z.string(),
  case_type: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  clinic_display_name: z.string().nullable(),
  organisation_name: z.string().nullable(),
  latest_milestone: patientTwinCaseMilestoneSchema.nullable(),
});

export const patientTwinAuditRollupSectionSchema = z.object({
  reports_total: z.number().int().nonnegative(),
  audits_total: z.number().int().nonnegative(),
  reports_by_status: z.record(z.string(), z.number().int().nonnegative()),
  model_runs_total: z.number().int().nonnegative(),
  model_runs_by_status: z.record(z.string(), z.number().int().nonnegative()),
  scorecards_total: z.number().int().nonnegative(),
  latest_released_report: z
    .object({
      report_id: z.string().uuid(),
      case_id: z.string().uuid(),
      version: z.number().int(),
      released_at: z.string().nullable(),
      created_at: z.string(),
    })
    .nullable(),
  outcome_indicators: z.object({ placeholder: z.literal(true) }),
});

export const patientTwinMediaLatestItemSchema = z.object({
  asset_type: z.string().nullable(),
  media_asset_id: z.string().uuid().nullable(),
  legacy_upload_id: z.string().uuid().nullable(),
  case_id: z.string().uuid().nullable(),
  file_name: z.string().nullable(),
  created_at: z.string().nullable(),
});

export const patientTwinMediaSectionSchema = z.object({
  by_asset_type: z.record(
    z.string(),
    z.object({
      count: z.number().int().nonnegative(),
      latest: patientTwinMediaLatestItemSchema.nullable(),
    })
  ),
});

export const patientTwinImagingSectionSchema = z.object({
  active_image_total: z.number().int().nonnegative(),
  by_library_axis: z.record(z.string(), z.number().int().nonnegative()),
  latest_captured_at: z.string().nullable(),
  imaging_workspace_href: z.string(),
});

export const patientTwinPathologyRequestRowSchema = z.object({
  id: z.string().uuid(),
  request_date: z.string(),
  template_used: z.string(),
  status: z.string(),
  emailed_to_patient_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  created_at: z.string(),
});

export const patientTwinPathologyResultRowSchema = z.object({
  id: z.string().uuid(),
  result_date: z.string(),
  provider_name: z.string().nullable(),
  status: z.string(),
  pathology_request_id: z.string().uuid().nullable(),
  marker_count: z.number().int().nonnegative(),
  abnormal_marker_count: z.number().int().nonnegative(),
  source_type: z.string(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
});

export const patientTwinPathologyAiInterpretationSummarySchema = z.object({
  id: z.string().uuid(),
  pathology_result_id: z.string().uuid(),
  status: z.string(),
  hair_loss_relevance_score: z.number().nullable(),
  surgical_readiness_score: z.number().nullable(),
  main_contributors: z.array(z.string()),
  overview_snippet: z.string().nullable(),
  created_at: z.string(),
  reviewed_at: z.string().nullable(),
});

export const patientTwinPathologySectionSchema = z.object({
  requests: z.array(patientTwinPathologyRequestRowSchema),
  results: z.array(patientTwinPathologyResultRowSchema),
  item_cap: z.number().int().positive(),
  results_item_cap: z.number().int().positive(),
  abnormal_markers_total: z.number().int().nonnegative(),
  last_result_reviewed_at: z.string().nullable(),
  latest_ai_interpretation: patientTwinPathologyAiInterpretationSummarySchema.nullable(),
});

export const patientTwinTimelineItemSchema = z.object({
  source_type: z.literal("fi_timeline_events"),
  source_id: z.string().uuid(),
  occurred_at: z.string(),
  event_kind: z.string(),
  title: z.string().nullable(),
  case_id: z.string().uuid(),
  patient_id: z.string().uuid().nullable(),
});

export const patientTwinTimelineSectionSchema = z.object({
  order: z.literal("newest_first"),
  items: z.array(patientTwinTimelineItemSchema),
  item_cap: z.number().int().positive(),
});

export const patientTwinMedicationActiveItemSchema = z.object({
  plan_item_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  plan_title: z.string(),
  plan_type: z.string(),
  canonical_code: z.string(),
  display_name: z.string(),
  role: z.string(),
  dosing_summary: z.string().nullable(),
  pathology_gate: z.string().nullable(),
  sessions_planned: z.number().int().nullable(),
  sessions_completed: z.number().int(),
  prescription_id: z.string().uuid().nullable(),
  prescription_item_id: z.string().uuid().nullable(),
  source_tables: z.tuple([z.literal("fi_patient_therapy_plan_items"), z.literal("fi_medication_os_canonical")]),
});

export const patientTwinTherapyEventPreviewSchema = z.object({
  id: z.string().uuid(),
  event_type: z.string(),
  occurred_at: z.string(),
  title: z.string(),
  canonical_code: z.string().nullable(),
  plan_id: z.string().uuid().nullable(),
  source_table: z.literal("fi_patient_therapy_events"),
});

export const patientTwinMedicationsSectionSchema = z.object({
  active_plan_count: z.number().int().min(0),
  active_items: z.array(patientTwinMedicationActiveItemSchema).max(80),
  therapy_events_preview: z.array(patientTwinTherapyEventPreviewSchema).max(100),
  active_item_cap: z.number().int().positive(),
  therapy_events_preview_cap: z.number().int().positive(),
});

export const patientTwinClinicalSectionSchema = z.object({
  structured_profile: z
    .object({
      norwood_scale: z.string().nullable(),
      ludwig_scale: z.string().nullable(),
      hairline_pattern: z.string().nullable(),
      primary_concern: z.string().nullable(),
      treatment_interest: z.string().nullable(),
    })
    .nullable(),
  medications: patientTwinMedicationsSectionSchema,
  treatments: z.array(z.never()),
  blood_markers: z.array(z.never()),
});

export const patientTwinIntelligenceSectionSchema = z.object({
  risk_score: z.null(),
  predicted_outcome: z.null(),
  model_outputs: z.array(z.never()),
});

export const patientTwinProvenanceSectionSchema = z.object({
  generated_at: z.string(),
  loader_version: z.string(),
  source_views_used: z.array(z.string()),
  source_tables_used: z.array(z.string()),
  completeness_score: z.number().int().min(0).max(100),
});

const completenessMissingAreaSchema = z.enum([
  "identity",
  "crm",
  "case",
  "audit",
  "media",
  "clinical",
  "timeline",
  "outcome",
]);

export const patientTwinCompletenessSectionSchema = z.object({
  score: z.number().int().min(0).max(100),
  band: z.enum(["poor", "partial", "good", "excellent"]),
  missing: z.array(
    z.object({
      area: completenessMissingAreaSchema,
      label: z.string(),
      severity: z.enum(["info", "warning", "important"]),
    })
  ),
  strengths: z.array(
    z.object({
      area: z.string(),
      label: z.string(),
    })
  ),
  recommended_actions: z.array(
    z.object({
      label: z.string(),
      reason: z.string(),
      priority: z.enum(["low", "medium", "high"]),
    })
  ),
});

export const patientTwinV1Schema = z.object({
  version: z.literal(PATIENT_TWIN_VERSION),
  tenant_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  person: patientTwinPersonSectionSchema,
  identity_resolution: patientTwinIdentityResolutionSectionSchema,
  crm: patientTwinCrmSectionSchema,
  cases: z.array(patientTwinCaseRowSchema),
  audits: patientTwinAuditRollupSectionSchema,
  media: patientTwinMediaSectionSchema,
  imaging: patientTwinImagingSectionSchema,
  pathology: patientTwinPathologySectionSchema,
  timeline: patientTwinTimelineSectionSchema,
  clinical: patientTwinClinicalSectionSchema,
  intelligence: patientTwinIntelligenceSectionSchema,
  provenance: patientTwinProvenanceSectionSchema,
  warnings: z.array(patientTwinWarningSchema),
  completeness: patientTwinCompletenessSectionSchema,
});

export function validatePatientTwinV1(data: unknown) {
  return patientTwinV1Schema.safeParse(data);
}
