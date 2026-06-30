/**
 * MedicationOS → `fi_timeline_events` mirror helpers (v1).
 * Pure mapping + `createTherapyTimelineEvent` insert (called from MedicationOS mutations after therapy events append).
 *
 * Schema note: `fi_timeline_events.case_id` is NOT NULL — inserts require `caseId`.
 * Dedupe uses JSON `detail` keys `source_table` + `source_id` (no dedicated columns).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { PatientTherapyEventRow, PlanType, TherapyEventType } from "./medicationOsTypes";

// ---------- Pure mapping (also covered by unit tests) ----------

/** Documented low-signal types (not mirrored unless mapping is extended). */
export const LOW_SIGNAL_THERAPY_TIMELINE_TYPES = new Set<TherapyEventType>([
  "adherence_note",
  "plan_created",
  "plan_paused",
  "plan_resumed",
  "dose_changed",
  "therapy_stopped",
  "therapy_on_hold",
  "prescription_linked",
]);

export type TherapyTimelineKind =
  | "therapy.plan_activated"
  | "therapy.maintenance_started"
  | "therapy.procedure_session_completed"
  | "therapy.postop_protocol_completed"
  | "therapy.plan_completed"
  | "therapy.plan_stopped"
  | "therapy.pathology_gate_cleared"
  | "therapy.adverse_event";

/**
 * Maps a MedicationOS `fi_patient_therapy_events.event_type` to Twin foundation `event_kind`.
 * Returns null when the event should not produce a timeline row by v1 policy.
 */
export function mapTherapyEventToTimelineKind(
  eventType: TherapyEventType,
  planType?: PlanType | null
): TherapyTimelineKind | null {
  switch (eventType) {
    case "plan_activated":
      return "therapy.plan_activated";
    case "therapy_started":
      return "therapy.maintenance_started";
    case "session_completed":
      return "therapy.procedure_session_completed";
    case "plan_completed":
      return planType === "post_operative"
        ? "therapy.postop_protocol_completed"
        : "therapy.plan_completed";
    case "plan_cancelled":
    case "plan_superseded":
      return "therapy.plan_stopped";
    case "pathology_gate_cleared":
      return "therapy.pathology_gate_cleared";
    case "adverse_event":
      return "therapy.adverse_event";
    default:
      return null;
  }
}

export type TherapyTimelineDetailInput = {
  therapyEventId: string;
  plan_id: string | null;
  plan_item_id: string | null;
  canonical_code: string | null;
};

/**
 * Stable `fi_timeline_events.detail` payload for dedupe and Twin consumers.
 * Uses `source_table` + `source_id` (no dedicated columns on `fi_timeline_events` v1).
 */
export function buildTherapyTimelineDetail(
  input: TherapyTimelineDetailInput
): Record<string, unknown> {
  const id = input.therapyEventId.trim();
  return {
    source_table: "fi_patient_therapy_events",
    source_id: id,
    therapy_event_id: id,
    plan_id: input.plan_id?.trim() || null,
    plan_item_id: input.plan_item_id?.trim() || null,
    canonical_code: input.canonical_code?.trim() || null,
    medication_os: true,
  };
}

const TIMELINE_TITLE: Partial<Record<TherapyTimelineKind, string>> = {
  "therapy.plan_activated": "Therapy plan activated",
  "therapy.maintenance_started": "Maintenance therapy started",
  "therapy.procedure_session_completed": "Therapy session completed",
  "therapy.postop_protocol_completed": "Post-operative protocol completed",
  "therapy.plan_completed": "Therapy plan completed",
  "therapy.plan_stopped": "Therapy plan stopped",
  "therapy.pathology_gate_cleared": "Pathology gate cleared",
  "therapy.adverse_event": "Adverse event recorded",
};

export function defaultTitleForTherapyTimelineKind(kind: TherapyTimelineKind): string {
  return TIMELINE_TITLE[kind] ?? kind;
}

export function isLowSignalTherapyEventType(eventType: TherapyEventType): boolean {
  return LOW_SIGNAL_THERAPY_TIMELINE_TYPES.has(eventType);
}

// ---------- Insert helper ----------

export type TherapyEventMirrorInput = {
  id: string;
  event_type: TherapyEventType;
  occurred_at: string;
  plan_id: string | null;
  plan_item_id: string | null;
  canonical_code: string | null;
};

export type CreateTherapyTimelineEventInput = {
  tenantId: string;
  patientId: string;
  /**
   * Optional for callers; **required** for an actual `fi_timeline_events` insert because `case_id` is NOT NULL.
   * When missing, the helper returns `skipReason: "missing_case_id"` (no throw).
   */
  caseId?: string | null;
  therapyEvent: TherapyEventMirrorInput;
  /** Used only when `therapyEvent.event_type === "plan_completed"`. */
  planTypeForCompleted?: PlanType | null;
  title?: string | null;
  dryRun?: boolean;
};

export type CreateTherapyTimelineEventResult = {
  dryRun: boolean;
  timelineEventKind: TherapyTimelineKind | null;
  skipReason?: "missing_case_id" | "unmirrored_event_type" | "duplicate";
  timelineEventId?: string | null;
  created?: boolean;
  preview?: {
    tenant_id: string;
    case_id: string;
    patient_id: string;
    event_kind: string;
    title: string | null;
    detail: Record<string, unknown>;
    occurred_at: string;
  };
};

/** Explicit skip before any timeline Supabase call (policy). */
export type TherapyTimelineMirrorLowSignal = {
  dryRun: false;
  timelineEventKind: null;
  skipReason: "low_signal";
};

/** Timeline mirror failed unexpectedly; parent mutation should still succeed. */
export type TherapyTimelineMirrorError = {
  dryRun: false;
  timelineEventKind: null;
  skipReason: "mirror_error";
  errorMessage: string;
};

export type TherapyTimelineMirrorOutcome =
  | CreateTherapyTimelineEventResult
  | TherapyTimelineMirrorLowSignal
  | TherapyTimelineMirrorError;

export type MirrorTherapyEventRowInput = {
  tenantId: string;
  patientId: string;
  /** Optional override (e.g. plan.case_id); otherwise uses `row.case_id`. */
  caseId?: string | null;
  /** Passed when `row.event_type === "plan_completed"` for post-op vs generic completion mapping. */
  planTypeForCompleted?: PlanType | null;
  row: Pick<
    PatientTherapyEventRow,
    "id" | "event_type" | "occurred_at" | "plan_id" | "plan_item_id" | "canonical_code" | "case_id"
  >;
};

/**
 * Best-effort mirror of a persisted `fi_patient_therapy_events` row into `fi_timeline_events`.
 * Never throws: failures become `skipReason: "mirror_error"`.
 */
export async function mirrorTherapyEventRowToTimeline(
  supabase: SupabaseClient,
  input: MirrorTherapyEventRowInput
): Promise<TherapyTimelineMirrorOutcome> {
  if (isLowSignalTherapyEventType(input.row.event_type)) {
    return { dryRun: false, timelineEventKind: null, skipReason: "low_signal" };
  }
  const effectiveCaseId = input.caseId?.trim() || input.row.case_id?.trim() || null;
  try {
    return await createTherapyTimelineEvent(supabase, {
      tenantId: input.tenantId,
      patientId: input.patientId,
      caseId: effectiveCaseId,
      planTypeForCompleted:
        input.row.event_type === "plan_completed" ? (input.planTypeForCompleted ?? null) : null,
      therapyEvent: {
        id: input.row.id,
        event_type: input.row.event_type,
        occurred_at: input.row.occurred_at,
        plan_id: input.row.plan_id,
        plan_item_id: input.row.plan_item_id,
        canonical_code: input.row.canonical_code,
      },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return { dryRun: false, timelineEventKind: null, skipReason: "mirror_error", errorMessage };
  }
}

/**
 * Idempotent insert into `fi_timeline_events` for high-signal MedicationOS therapy events.
 * Prefer `mirrorTherapyEventRowToTimeline` from mutations (handles low-signal + errors).
 *
 * Dedupes on `tenant_id` + `case_id` + `event_kind` + `detail ⊇ { source_table, source_id }`.
 */
export async function createTherapyTimelineEvent(
  supabase: SupabaseClient,
  input: CreateTherapyTimelineEventInput
): Promise<CreateTherapyTimelineEventResult> {
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const dryRun = Boolean(input.dryRun);
  const caseId = input.caseId?.trim() || null;

  const kind = mapTherapyEventToTimelineKind(
    input.therapyEvent.event_type,
    input.therapyEvent.event_type === "plan_completed" ? (input.planTypeForCompleted ?? null) : null
  );

  if (!kind) {
    return { dryRun, timelineEventKind: null, skipReason: "unmirrored_event_type" };
  }

  if (!caseId) {
    return { dryRun, timelineEventKind: kind, skipReason: "missing_case_id" };
  }

  const detail = buildTherapyTimelineDetail({
    therapyEventId: input.therapyEvent.id,
    plan_id: input.therapyEvent.plan_id,
    plan_item_id: input.therapyEvent.plan_item_id,
    canonical_code: input.therapyEvent.canonical_code,
  });

  const title = input.title?.trim() || defaultTitleForTherapyTimelineKind(kind);
  const occurredAt = input.therapyEvent.occurred_at.trim() || new Date().toISOString();

  const preview = {
    tenant_id: tid,
    case_id: caseId,
    patient_id: pid,
    event_kind: kind,
    title,
    detail,
    occurred_at: occurredAt,
  };

  const dedupePayload = {
    source_table: "fi_patient_therapy_events",
    source_id: input.therapyEvent.id.trim(),
  };

  const { data: existing, error: dupErr } = await supabase
    .from("fi_timeline_events")
    .select("id")
    .eq("tenant_id", tid)
    .eq("case_id", caseId)
    .eq("event_kind", kind)
    .contains("detail", dedupePayload)
    .maybeSingle();

  if (dupErr) throw new Error(dupErr.message);
  if (existing?.id) {
    return {
      dryRun,
      timelineEventKind: kind,
      skipReason: "duplicate",
      timelineEventId: String((existing as { id: string }).id),
      created: false,
      preview,
    };
  }

  if (dryRun) {
    return { dryRun: true, timelineEventKind: kind, preview, created: false };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("fi_timeline_events")
    .insert({
      tenant_id: tid,
      case_id: caseId,
      patient_id: pid,
      organisation_id: null,
      event_kind: kind,
      title,
      detail,
      occurred_at: occurredAt,
      fi_event_id: null,
    })
    .select("id")
    .single();

  if (insErr) throw new Error(insErr.message);
  const timelineEventId = String((inserted as { id: string }).id);
  return {
    dryRun: false,
    timelineEventKind: kind,
    timelineEventId,
    created: true,
    preview,
  };
}
