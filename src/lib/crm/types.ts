/**
 * CRM foundation types (Stage 2C). Mirrors `fi_crm_*` columns; use with service-role Supabase only.
 */

export type JsonObject = Record<string, unknown>;

export const DEFAULT_CRM_PIPELINE_KEY = "hair_restoration_default" as const;

/** Default `source_system` for `resolveOrCreatePerson` when creating leads from CRM server paths. */
export const CRM_DEFAULT_PERSON_SOURCE_SYSTEM = "fi_crm" as const;

export type FiCrmPipelineStageRow = {
  id: string;
  tenant_id: string;
  organisation_id: string | null;
  clinic_id: string | null;
  pipeline_key: string;
  slug: string;
  label: string;
  sort_order: number;
  is_entry: boolean;
  is_won: boolean;
  is_lost: boolean;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
};

export type FiCrmLeadRow = {
  id: string;
  tenant_id: string;
  organisation_id: string | null;
  clinic_id: string | null;
  person_id: string;
  patient_id: string | null;
  case_id: string | null;
  current_stage_id: string | null;
  primary_owner_user_id: string | null;
  status: string;
  priority: string | null;
  summary: string | null;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
};

/** One row in the FI Admin CRM lead index list (Stage 2F). */
export type CrmShellLeadListItem = {
  lead: FiCrmLeadRow;
  stage: { id: string; slug: string; label: string; sort_order: number } | null;
  person: { id: string; metadata: Record<string, unknown> } | null;
  owner: { id: string; email: string | null } | null;
  patient: { id: string } | null;
};

export type CrmShellLeadListPage = {
  items: CrmShellLeadListItem[];
  total: number;
};

export type FiCrmLeadStageHistoryRow = {
  id: string;
  tenant_id: string;
  lead_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  changed_at: string;
  changed_by: string | null;
  reason: string | null;
  source: string;
  fi_timeline_event_id: string | null;
  metadata: JsonObject;
};

export type FiCrmActivityEventRow = {
  id: string;
  tenant_id: string;
  lead_id: string;
  activity_kind: string;
  title: string | null;
  detail: JsonObject;
  occurred_at: string;
  created_at: string;
  fi_timeline_event_id: string | null;
  patient_id: string | null;
  case_id: string | null;
};

export type FiCrmTaskRow = {
  id: string;
  tenant_id: string;
  lead_id: string;
  patient_id: string | null;
  case_id: string | null;
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  due_at: string | null;
  completed_at: string | null;
  assignee_user_id: string | null;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
};

export type FiCrmNoteRow = {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  author_user_id: string | null;
  visibility: string;
  body: string;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
};

export type FiCrmMessageRow = {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  channel: string;
  direction: string;
  subject: string | null;
  body_preview: string | null;
  body_storage_ref: string | null;
  external_thread_id: string | null;
  external_message_id: string | null;
  sent_at: string | null;
  received_at: string | null;
  metadata: JsonObject;
  created_at: string;
};

/** FI Admin CRM shell: tenant user row for owner filter dropdown (Stage 2F). */
export type CrmShellUserPickerOption = { id: string; email: string | null };

/** Scope used for lazy pipeline seeding and stage resolution. */
export type CrmPipelineScope = {
  tenantId: string;
  organisationId?: string | null;
  clinicId?: string | null;
  pipelineKey?: string;
};
