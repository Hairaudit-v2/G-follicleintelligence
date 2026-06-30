/**
 * MedicationOS v1 read model types (aligned with `fi_medication_os_*` / `fi_patient_therapy_*` tables).
 * @see docs/design/medication-os-v1.md
 * @see supabase/migrations/20260719120001_fi_medication_os_v1.sql
 */

export const THERAPY_TRACKS = ["maintenance", "procedural", "post_operative"] as const;
export type TherapyTrack = (typeof THERAPY_TRACKS)[number];

export const PLAN_TYPES = ["maintenance", "peri_procedural", "post_operative", "mixed"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const PLAN_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
  "cancelled",
  "superseded",
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_SOURCES = [
  "manual",
  "consultation_completion",
  "surgery_postop_bundle",
  "pathology_review",
  "import",
] as const;
export type PlanSource = (typeof PLAN_SOURCES)[number];

export const PLAN_ITEM_ROLES = [
  "continuous",
  "taper",
  "course",
  "prn",
  "procedural_session",
  "supplement",
] as const;
export type PlanItemRole = (typeof PLAN_ITEM_ROLES)[number];

export const THERAPY_EVENT_TYPES = [
  "plan_created",
  "plan_activated",
  "plan_paused",
  "plan_resumed",
  "plan_completed",
  "plan_cancelled",
  "plan_superseded",
  "therapy_started",
  "therapy_stopped",
  "dose_changed",
  "session_completed",
  "pathology_gate_cleared",
  "therapy_on_hold",
  "adverse_event",
  "adherence_note",
  "prescription_linked",
] as const;
export type TherapyEventType = (typeof THERAPY_EVENT_TYPES)[number];

export type MedicationOsCanonicalRow = {
  id: string;
  tenant_id: string;
  canonical_code: string;
  display_name: string;
  therapy_track: TherapyTrack;
  default_route: string | null;
  catalogue_id: string | null;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PatientTherapyPlanRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  case_id: string | null;
  consultation_id: string | null;
  surgery_plan_id: string | null;
  plan_type: PlanType;
  title: string;
  status: PlanStatus;
  source: PlanSource;
  valid_from: string | null;
  valid_until: string | null;
  surgery_anchor_date: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PatientTherapyPlanItemRow = {
  id: string;
  tenant_id: string;
  plan_id: string;
  canonical_code: string;
  role: PlanItemRole;
  dosing_summary: string | null;
  sessions_planned: number | null;
  sessions_completed: number;
  day_offset_start: number | null;
  day_offset_end: number | null;
  pathology_gate: string | null;
  prescription_id: string | null;
  prescription_item_id: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PatientTherapyEventRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  case_id: string | null;
  consultation_id: string | null;
  plan_id: string | null;
  plan_item_id: string | null;
  prescription_id: string | null;
  prescription_item_id: string | null;
  pathology_request_id: string | null;
  pathology_result_id: string | null;
  event_type: TherapyEventType;
  canonical_code: string | null;
  occurred_at: string;
  actor_user_id: string | null;
  detail: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Plan header plus ordered line items (stable read shape for UI and APIs). */
export type MedicationOsTherapyPlanBundle = {
  plan: PatientTherapyPlanRow;
  items: PatientTherapyPlanItemRow[];
};

export type ActiveTherapyItemSummary = {
  planItemId: string;
  planId: string;
  canonical_code: string;
  display_name: string;
  role: PlanItemRole;
  dosing_summary: string | null;
  pathology_gate: string | null;
  sessions_planned: number | null;
  sessions_completed: number;
  prescription_id: string | null;
  prescription_item_id: string | null;
};

export type ActiveTherapyPlanSummary = {
  active_plan_count: number;
  plans: Array<{
    planId: string;
    title: string;
    plan_type: PlanType;
    valid_until: string | null;
    surgery_anchor_date: string | null;
    items: ActiveTherapyItemSummary[];
  }>;
};

export type PatientTherapyEventPreview = {
  id: string;
  event_type: TherapyEventType;
  occurred_at: string;
  title: string;
  canonical_code: string | null;
  plan_id: string | null;
};

/** Input line for draft plan create/update (canonical_code validated against tenant vocabulary). */
export type DraftTherapyPlanItemInput = {
  canonical_code: string;
  role: PlanItemRole;
  dosing_summary?: string | null;
  sessions_planned?: number | null;
  sessions_completed?: number;
  day_offset_start?: number | null;
  day_offset_end?: number | null;
  pathology_gate?: string | null;
  sort_order?: number;
  metadata?: Record<string, unknown>;
};

export type LoadTherapyPlansOptions = {
  /** Max plans to return (clamped 1–200). Default 100. */
  limit?: number;
  /** When set, only plans whose `status` is in this list. */
  statusIn?: PlanStatus[];
  /** When true (default), load and attach `fi_patient_therapy_plan_items` per plan. */
  includeItems?: boolean;
};

export type LoadTherapyEventsOptions = {
  /** Max events (clamped 1–500). Default 50. */
  limit?: number;
  /** When set, only events whose `event_type` is in this list. */
  eventTypeIn?: TherapyEventType[];
};

/** Shared PostgREST select fragments for loaders. */
export const MEDICATION_OS_CANONICAL_SELECT =
  "id, tenant_id, canonical_code, display_name, therapy_track, default_route, catalogue_id, active, metadata, created_at, updated_at" as const;

export const PATIENT_THERAPY_PLAN_SELECT =
  "id, tenant_id, patient_id, case_id, consultation_id, surgery_plan_id, plan_type, title, status, source, valid_from, valid_until, surgery_anchor_date, metadata, created_at, updated_at" as const;

export const PATIENT_THERAPY_PLAN_ITEM_SELECT =
  "id, tenant_id, plan_id, canonical_code, role, dosing_summary, sessions_planned, sessions_completed, day_offset_start, day_offset_end, pathology_gate, prescription_id, prescription_item_id, sort_order, metadata, created_at, updated_at" as const;

export const PATIENT_THERAPY_EVENT_SELECT =
  "id, tenant_id, patient_id, case_id, consultation_id, plan_id, plan_item_id, prescription_id, prescription_item_id, pathology_request_id, pathology_result_id, event_type, canonical_code, occurred_at, actor_user_id, detail, metadata, created_at" as const;
