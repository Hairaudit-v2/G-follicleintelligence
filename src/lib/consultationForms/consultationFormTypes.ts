/**
 * ConsultationOS Forms Engine — schema types (Stage 1).
 * Field values are stored per instance in JSONB (`fi_consultation_form_instances.values`).
 */

import type { BodyAreaMapViewId } from "./bodyAreaMapModel";

export type { BodyAreaMapViewId } from "./bodyAreaMapModel";

export type ConsultationFormTemplateVersionStatus = "draft" | "published" | "archived";

export type ConsultationFormInstanceStatus = "draft" | "submitted" | "locked";

export type ConsultationFormChannel = "pre_arrival" | "in_room" | "staff_amendment" | "telehealth";

/** Supported field renderers / persistence kinds (Stage 1 + placeholders for later stages). */
export type ConsultationFormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "multi_select"
  | "radio"
  | "checkbox_group"
  | "clinical_note"
  | "voice_note"
  | "body_area_map"
  | "image_upload"
  | "diagnosis_picker"
  | "treatment_recommendation"
  | "quote_builder";

export type ConsultationFormOptionSetId =
  | "norwood_scale"
  | "ludwig_scale"
  | "sinclair_scale"
  | "donor_quality"
  | "hair_calibre"
  | "scalp_condition"
  | "shedding_severity"
  | "medication_tolerance"
  | "treatment_interest"
  | "budget_range"
  | "urgency"
  | "medical_risk_flags"
  | "surgical_outcome_type"
  | "hair_loss_onset_pattern"
  | "family_history_pattern"
  | "previous_treatment_types"
  | "consultation_priority"
  | "yes_no_unsure";

export type ConsultationFormOption = {
  value: string;
  label: string;
};

export type ConsultationFormConditionOperator =
  | "equals"
  | "notEquals"
  | "isEmpty"
  | "isNotEmpty"
  | "in"
  | "notIn"
  /** Current value is an array (e.g. multi_select) and intersects `value: string[]`. */
  | "containsAny";

export type ConsultationFormCondition = {
  fieldId: string;
  operator: ConsultationFormConditionOperator;
  /** For `equals` / `notEquals` / `in` / `notIn`. */
  value?: unknown;
};

export type ConsultationFormField = {
  id: string;
  label: string;
  description?: string;
  type: ConsultationFormFieldType;
  required?: boolean;
  placeholder?: string;
  /** Resolve options from shared catalog (client + server). */
  optionSet?: ConsultationFormOptionSetId;
  /** Inline options (override or when not using optionSet). */
  options?: ConsultationFormOption[];
  /** When absent or evaluates true, the field is shown. */
  showWhen?: ConsultationFormCondition;
  /** For number fields. */
  min?: number;
  max?: number;
  step?: number;
  /** When `type` is `body_area_map`, limits which wireframe tabs are shown (defaults to all views). */
  bodyAreaMapViews?: BodyAreaMapViewId[];
};

export type ConsultationFormPersistenceContext = {
  tenantId: string;
  consultationId: string;
  formInstanceId: string;
  patientId: string | null;
  caseId: string | null;
};

export type ConsultationFormSection = {
  id: string;
  title: string;
  description?: string;
  fields: ConsultationFormField[];
};

export type ConsultationFormSchema = {
  /** Monotonic schema revision for migrations / debugging (not DB template version). */
  schemaRevision?: number;
  sections: ConsultationFormSection[];
};

export type ConsultationFormTemplate = {
  id: string;
  tenant_id: string | null;
  slug: string;
  name: string;
  treatment_program: string;
  description: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ConsultationFormTemplateVersion = {
  id: string;
  template_id: string;
  version: number;
  status: ConsultationFormTemplateVersionStatus;
  schema: ConsultationFormSchema;
  ui_layout: Record<string, unknown>;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsultationFormInstance = {
  id: string;
  tenant_id: string;
  consultation_id: string;
  template_version_id: string;
  channel: ConsultationFormChannel;
  status: ConsultationFormInstanceStatus;
  values: Record<string, unknown>;
  computed: Record<string, unknown>;
  started_at: string;
  submitted_at: string | null;
  submitted_by_user_id: string | null;
  /** Stage 4: clinician finalized completion (distinct from submit). */
  completed_at: string | null;
  completed_by_user_id: string | null;
  /** Rules-based completion summary JSON (`rules_v1`). */
  completion_summary: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Instance row joined with template metadata for UI. */
export type ConsultationFormInstanceWithTemplate = ConsultationFormInstance & {
  template: Pick<ConsultationFormTemplate, "id" | "slug" | "name" | "treatment_program">;
  template_version: Pick<ConsultationFormTemplateVersion, "id" | "version" | "status" | "schema">;
};
