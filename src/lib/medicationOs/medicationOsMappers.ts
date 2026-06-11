import {
  type MedicationOsCanonicalRow,
  type PatientTherapyEventPreview,
  type PatientTherapyEventRow,
  type PatientTherapyPlanItemRow,
  type PatientTherapyPlanRow,
  PLAN_ITEM_ROLES,
  PLAN_SOURCES,
  PLAN_STATUSES,
  PLAN_TYPES,
  THERAPY_EVENT_TYPES,
  THERAPY_TRACKS,
  type ActiveTherapyItemSummary,
  type ActiveTherapyPlanSummary,
  type PlanItemRole,
  type PlanSource,
  type PlanStatus,
  type PlanType,
  type TherapyEventType,
  type TherapyTrack,
} from "./medicationOsTypes";

function asObjectRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function isMember<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export function parseTherapyTrack(value: unknown): TherapyTrack {
  return isMember(value, THERAPY_TRACKS) ? value : "maintenance";
}

export function parsePlanType(value: unknown): PlanType {
  return isMember(value, PLAN_TYPES) ? value : "maintenance";
}

export function parsePlanStatus(value: unknown): PlanStatus {
  return isMember(value, PLAN_STATUSES) ? value : "draft";
}

export function parsePlanSource(value: unknown): PlanSource {
  return isMember(value, PLAN_SOURCES) ? value : "manual";
}

export function parsePlanItemRole(value: unknown): PlanItemRole {
  return isMember(value, PLAN_ITEM_ROLES) ? value : "continuous";
}

export function parseTherapyEventType(value: unknown): TherapyEventType {
  return isMember(value, THERAPY_EVENT_TYPES) ? value : "plan_created";
}

export function toMedicationOsCanonicalRow(raw: Record<string, unknown>): MedicationOsCanonicalRow {
  return {
    id: String(raw.id ?? ""),
    tenant_id: String(raw.tenant_id ?? ""),
    canonical_code: String(raw.canonical_code ?? "").trim(),
    display_name: String(raw.display_name ?? "").trim(),
    therapy_track: parseTherapyTrack(raw.therapy_track),
    default_route: raw.default_route != null ? String(raw.default_route) : null,
    catalogue_id: raw.catalogue_id != null ? String(raw.catalogue_id) : null,
    active: Boolean(raw.active),
    metadata: asObjectRecord(raw.metadata),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export function toPatientTherapyPlanRow(raw: Record<string, unknown>): PatientTherapyPlanRow {
  return {
    id: String(raw.id ?? ""),
    tenant_id: String(raw.tenant_id ?? ""),
    patient_id: String(raw.patient_id ?? ""),
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    consultation_id: raw.consultation_id != null ? String(raw.consultation_id) : null,
    surgery_plan_id: raw.surgery_plan_id != null ? String(raw.surgery_plan_id) : null,
    plan_type: parsePlanType(raw.plan_type),
    title: String(raw.title ?? "").trim(),
    status: parsePlanStatus(raw.status),
    source: parsePlanSource(raw.source),
    valid_from: raw.valid_from != null ? String(raw.valid_from) : null,
    valid_until: raw.valid_until != null ? String(raw.valid_until) : null,
    surgery_anchor_date: raw.surgery_anchor_date != null ? String(raw.surgery_anchor_date) : null,
    metadata: asObjectRecord(raw.metadata),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export function toPatientTherapyPlanItemRow(raw: Record<string, unknown>): PatientTherapyPlanItemRow {
  return {
    id: String(raw.id ?? ""),
    tenant_id: String(raw.tenant_id ?? ""),
    plan_id: String(raw.plan_id ?? ""),
    canonical_code: String(raw.canonical_code ?? "").trim(),
    role: parsePlanItemRole(raw.role),
    dosing_summary: raw.dosing_summary != null ? String(raw.dosing_summary) : null,
    sessions_planned:
      raw.sessions_planned != null && raw.sessions_planned !== "" ? Number(raw.sessions_planned) : null,
    sessions_completed: Number(raw.sessions_completed ?? 0),
    day_offset_start: raw.day_offset_start != null && raw.day_offset_start !== "" ? Number(raw.day_offset_start) : null,
    day_offset_end: raw.day_offset_end != null && raw.day_offset_end !== "" ? Number(raw.day_offset_end) : null,
    pathology_gate: raw.pathology_gate != null ? String(raw.pathology_gate) : null,
    prescription_id: raw.prescription_id != null ? String(raw.prescription_id) : null,
    prescription_item_id: raw.prescription_item_id != null ? String(raw.prescription_item_id) : null,
    sort_order: Number(raw.sort_order ?? 0),
    metadata: asObjectRecord(raw.metadata),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export function toPatientTherapyEventRow(raw: Record<string, unknown>): PatientTherapyEventRow {
  return {
    id: String(raw.id ?? ""),
    tenant_id: String(raw.tenant_id ?? ""),
    patient_id: String(raw.patient_id ?? ""),
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    consultation_id: raw.consultation_id != null ? String(raw.consultation_id) : null,
    plan_id: raw.plan_id != null ? String(raw.plan_id) : null,
    plan_item_id: raw.plan_item_id != null ? String(raw.plan_item_id) : null,
    prescription_id: raw.prescription_id != null ? String(raw.prescription_id) : null,
    prescription_item_id: raw.prescription_item_id != null ? String(raw.prescription_item_id) : null,
    pathology_request_id: raw.pathology_request_id != null ? String(raw.pathology_request_id) : null,
    pathology_result_id: raw.pathology_result_id != null ? String(raw.pathology_result_id) : null,
    event_type: parseTherapyEventType(raw.event_type),
    canonical_code: raw.canonical_code != null ? String(raw.canonical_code) : null,
    occurred_at: String(raw.occurred_at ?? ""),
    actor_user_id: raw.actor_user_id != null ? String(raw.actor_user_id) : null,
    detail: asObjectRecord(raw.detail),
    metadata: asObjectRecord(raw.metadata),
    created_at: String(raw.created_at ?? ""),
  };
}

const EVENT_TITLE: Record<TherapyEventType, string> = {
  plan_created: "Therapy plan created",
  plan_activated: "Therapy plan activated",
  plan_paused: "Therapy plan paused",
  plan_resumed: "Therapy plan resumed",
  plan_completed: "Therapy plan completed",
  plan_cancelled: "Therapy plan cancelled",
  plan_superseded: "Therapy plan superseded",
  therapy_started: "Therapy started",
  therapy_stopped: "Therapy stopped",
  dose_changed: "Dose changed",
  session_completed: "Session completed",
  pathology_gate_cleared: "Pathology gate cleared",
  therapy_on_hold: "Therapy on hold",
  adverse_event: "Adverse event recorded",
  adherence_note: "Adherence note",
  prescription_linked: "Prescription linked",
};

export function therapyEventPreviewTitle(eventType: TherapyEventType): string {
  return EVENT_TITLE[eventType] ?? eventType;
}

export function toPatientTherapyEventPreview(row: PatientTherapyEventRow): PatientTherapyEventPreview {
  return {
    id: row.id,
    event_type: row.event_type,
    occurred_at: row.occurred_at,
    title: therapyEventPreviewTitle(row.event_type),
    canonical_code: row.canonical_code,
    plan_id: row.plan_id,
  };
}

/**
 * Build a denormalised summary of **active** therapy plans and items for Twin-style cards.
 * `displayNameByCanonicalCode` should map `canonical_code` → tenant display label (from `fi_medication_os_canonical` or fallback).
 */
export function buildActiveTherapyPlanSummary(params: {
  activePlans: PatientTherapyPlanRow[];
  itemsByPlanId: Map<string, PatientTherapyPlanItemRow[]>;
  displayNameByCanonicalCode: Map<string, string>;
}): ActiveTherapyPlanSummary {
  const plans = params.activePlans.map((plan) => {
    const items = (params.itemsByPlanId.get(plan.id) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
    const mapped: ActiveTherapyItemSummary[] = items.map((it) => ({
      planItemId: it.id,
      planId: plan.id,
      canonical_code: it.canonical_code,
      display_name: params.displayNameByCanonicalCode.get(it.canonical_code) ?? it.canonical_code,
      role: it.role,
      dosing_summary: it.dosing_summary,
      pathology_gate: it.pathology_gate,
      sessions_planned: it.sessions_planned,
      sessions_completed: it.sessions_completed,
    }));
    return {
      planId: plan.id,
      title: plan.title,
      plan_type: plan.plan_type,
      valid_until: plan.valid_until,
      surgery_anchor_date: plan.surgery_anchor_date,
      items: mapped,
    };
  });
  return {
    active_plan_count: plans.length,
    plans,
  };
}
