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
  converted_person_id: string | null;
  converted_case_id: string | null;
  converted_at: string | null;
  converted_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Lead + person/patient/case context for conversion UI (Stage 2L). */
export type CrmLeadConversionState = {
  lead: FiCrmLeadRow;
  person: { id: string; metadata: Record<string, unknown> } | null;
  patient: { id: string; person_id: string } | null;
  case: { id: string; status: string } | null;
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

/** Kanban card row = shell list item plus batch-enriched CRM / clinical signals. */
export type CrmKanbanLeadCard = CrmShellLeadListItem & {
  clinicalSummaryLine: string | null;
  norwoodScale: string | null;
  ludwigScale: string | null;
  primaryConcernLine: string | null;
  daysInStage: number | null;
  stageEnteredAtIso: string | null;
  lastActivityAtIso: string;
  overdueTaskCount: number;
  isHighValue: boolean;
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
  lead_id: string | null;
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

/** Internal lead notes (`fi_crm_lead_notes`, Stage 2J). */
export type FiCrmLeadNoteRow = {
  id: string;
  tenant_id: string;
  lead_id: string;
  author_user_id: string | null;
  note_body: string;
  note_visibility: string;
  is_pinned: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Lead contact log (`fi_crm_lead_communications`, Stage 2K). */
export type FiCrmLeadCommunicationRow = {
  id: string;
  tenant_id: string;
  lead_id: string;
  actor_user_id: string | null;
  communication_type: string;
  direction: string;
  outcome: string | null;
  subject: string | null;
  preview: string | null;
  external_message_id: string | null;
  external_thread_id: string | null;
  contact_at: string;
  next_follow_up_at: string | null;
  metadata: JsonObject;
  archived_at: string | null;
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
export type CrmShellUserPickerOption = {
  id: string;
  email: string | null;
  /** When row is from `fi_staff` (scheduling pickers). */
  full_name?: string | null;
  staff_role?: string | null;
  mobile?: string | null;
  calendar_color?: string | null;
  fi_user_id?: string | null;
  /** Staff IANA zone for interpreting `working_hours` (optional). */
  default_timezone?: string | null;
  /** `fi_staff.working_hours` — e.g. `{ weekly: { mon: { start, end, enabled } } }`. */
  working_hours?: Record<string, unknown> | null;
  /** When set on `fi_staff`, overrides calendar column visibility by role. */
  calendar_visible?: boolean | null;
  is_active?: boolean;
};

/** FI Admin CRM shell: organisation row for lead scope picker (Stage 2G). */
export type CrmShellOrgOption = { id: string; name: string };

/** FI Admin CRM shell: clinic row for lead scope picker (Stage 2G). */
export type CrmShellClinicOption = {
  id: string;
  display_name: string;
  organisation_id: string | null;
  /** `fi_clinics.metadata` — country/locale hints for display (not required for pickers). */
  metadata?: Record<string, unknown> | null;
};

/** Scope used for lazy pipeline seeding and stage resolution. */
export type CrmPipelineScope = {
  tenantId: string;
  organisationId?: string | null;
  clinicId?: string | null;
  pipelineKey?: string;
};
