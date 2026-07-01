import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { publishSurgeryEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { parseAppointmentProcedureMetadata } from "@/src/lib/bookings/appointmentMetadata";
import {
  assertSurgeryOsTenantRowScope,
  type SurgeryOsAssignmentStatus,
  type SurgeryOsNoteKind,
  type SurgeryOsProcedureEventKind,
  type SurgeryOsSeverity,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import {
  assertSurgeryMajorPhaseTransition,
  assertTeamAssignmentStatusTransition,
  buildProcedureEventAuditMetadata,
  eventKindToSurgeryPatch,
  isSurgeryOsMajorPhase,
  majorPhaseToSurgeryPatch,
  parseTargetGraftsFromEstimate,
  resolveCurrentMajorPhase,
  type SurgeryOsAction,
  type SurgeryOsMajorPhase,
} from "@/src/lib/surgeryOs/surgeryOsPolicy";
import { assertGraftReconciliationForPhaseTransition } from "@/src/lib/surgeryOs/surgeryGraftMutations.server";
import { isMissingDatabaseRelationError } from "@/src/lib/surgeryOs/surgeryOsLoaderResilience";
import { syncLiveTheatreToCaseProcedure } from "@/src/lib/surgeryOs/liveTheatreCaseSync.server";
import { FI_BOOKINGS_CALENDAR_OVERLAP_SELECT } from "@/src/lib/bookings/calendarBookingOverlapSelect";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { ensureSurgeryStaffingFromBooking } from "@/src/lib/workforce-os/workforceEventAssignmentBridge.server";

export type SurgeryMutationRow = {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  case_id: string | null;
  booking_id: string | null;
  clinic_id: string | null;
  surgeon_fi_user_id: string | null;
  status: string;
  live_status: string;
  procedure_phase: string;
  target_grafts: number | null;
  scheduled_date: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
};

export type ProcedureEventRow = {
  id: string;
  tenant_id: string;
  surgery_id: string;
  event_kind: string;
  occurred_at: string;
  recorded_by_fi_user_id: string | null;
  metadata: Record<string, unknown>;
};

export type OperationalNoteRow = {
  id: string;
  tenant_id: string;
  surgery_id: string;
  note_kind: string;
  severity: string;
  body: string;
  recorded_at: string;
  recorded_by_fi_user_id: string | null;
};

export type TeamAssignmentRow = {
  id: string;
  tenant_id: string;
  surgery_id: string;
  fi_user_id: string;
  role: string;
  assignment_status: string;
};

function mapSurgeryRow(raw: Record<string, unknown>): SurgeryMutationRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: raw.patient_id != null ? String(raw.patient_id) : null,
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    booking_id: raw.booking_id != null ? String(raw.booking_id) : null,
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    surgeon_fi_user_id: raw.surgeon_fi_user_id != null ? String(raw.surgeon_fi_user_id) : null,
    status: String(raw.status),
    live_status: String(raw.live_status),
    procedure_phase: String(raw.procedure_phase),
    target_grafts: raw.target_grafts != null ? Number(raw.target_grafts) : null,
    scheduled_date: String(raw.scheduled_date),
    scheduled_start_at: raw.scheduled_start_at != null ? String(raw.scheduled_start_at) : null,
    scheduled_end_at: raw.scheduled_end_at != null ? String(raw.scheduled_end_at) : null,
    actual_start_at: raw.actual_start_at != null ? String(raw.actual_start_at) : null,
    actual_end_at: raw.actual_end_at != null ? String(raw.actual_end_at) : null,
  };
}

async function loadSurgeryForMutation(
  tenantId: string,
  surgeryId: string
): Promise<SurgeryMutationRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const sid = assertNonEmptyUuid(surgeryId, "surgeryId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgeries")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", sid)
    .maybeSingle();
  if (error) {
    if (isMissingDatabaseRelationError(error))
      throw new Error("SurgeryOS tables are not available.");
    throw new Error(error.message);
  }
  if (!data) throw new Error("Surgery not found.");
  const row = mapSurgeryRow(data as Record<string, unknown>);
  assertSurgeryOsTenantRowScope(tid, row.tenant_id, "fi_surgeries");
  return row;
}

async function insertProcedureEvent(input: {
  tenantId: string;
  surgeryId: string;
  eventKind: SurgeryOsProcedureEventKind;
  actorFiUserId: string | null;
  metadata: Record<string, unknown>;
  occurredAt?: string;
}): Promise<ProcedureEventRow> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgery_procedure_events")
    .insert({
      tenant_id: input.tenantId.trim(),
      surgery_id: input.surgeryId.trim(),
      event_kind: input.eventKind,
      recorded_by_fi_user_id: input.actorFiUserId,
      metadata: input.metadata,
      ...(input.occurredAt ? { occurred_at: input.occurredAt } : {}),
    })
    .select("id, tenant_id, surgery_id, event_kind, occurred_at, recorded_by_fi_user_id, metadata")
    .single();
  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    surgery_id: String(row.surgery_id),
    event_kind: String(row.event_kind),
    occurred_at: String(row.occurred_at),
    recorded_by_fi_user_id:
      row.recorded_by_fi_user_id != null ? String(row.recorded_by_fi_user_id) : null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
  };
}

async function applySurgeryStatePatch(
  tenantId: string,
  surgery: SurgeryMutationRow,
  patch: ReturnType<typeof majorPhaseToSurgeryPatch>,
  sourceAction: SurgeryOsAction,
  actorFiUserId: string | null,
  eventKind: SurgeryOsProcedureEventKind = "phase_transition",
  extraMetadata?: Record<string, unknown>
): Promise<{ surgery: SurgeryMutationRow; event: ProcedureEventRow }> {
  const update: Record<string, unknown> = {
    status: patch.status,
    procedure_phase: patch.procedurePhase,
    live_status: patch.liveStatus,
  };
  const now = new Date().toISOString();
  if (patch.setActualStart && !surgery.actual_start_at) update.actual_start_at = now;
  if (patch.setActualEnd) update.actual_end_at = now;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgeries")
    .update(update)
    .eq("tenant_id", tenantId.trim())
    .eq("id", surgery.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const updated = mapSurgeryRow(data as Record<string, unknown>);
  const metadata = buildProcedureEventAuditMetadata({
    sourceAction,
    previousStatus: surgery.status,
    newStatus: updated.status,
    previousPhase: surgery.procedure_phase,
    newPhase: updated.procedure_phase,
    previousLiveStatus: surgery.live_status,
    newLiveStatus: updated.live_status,
    extra: extraMetadata,
  });

  const event = await insertProcedureEvent({
    tenantId,
    surgeryId: surgery.id,
    eventKind,
    actorFiUserId,
    metadata,
  });

  return { surgery: updated, event };
}

function mapBookingRowForStaffingBridge(row: Record<string, unknown>): FiBookingRow {
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    person_id: row.person_id != null ? String(row.person_id) : null,
    patient_id: row.patient_id != null ? String(row.patient_id) : null,
    case_id: row.case_id != null ? String(row.case_id) : null,
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    room_id: row.room_id != null ? String(row.room_id) : null,
    room_required: row.room_required == null ? true : Boolean(row.room_required),
    assigned_staff_id: row.assigned_staff_id != null ? String(row.assigned_staff_id) : null,
    assigned_user_id: row.assigned_user_id != null ? String(row.assigned_user_id) : null,
    booking_type: String(row.booking_type ?? "surgery"),
    booking_status: String(row.booking_status ?? ""),
    title: row.title != null ? String(row.title) : null,
    description: row.description != null ? String(row.description) : null,
    start_at: String(row.start_at),
    end_at: String(row.end_at),
    timezone: row.timezone != null ? String(row.timezone) : null,
    location: row.location != null ? String(row.location) : null,
    metadata: meta,
    cancelled_at: row.cancelled_at != null ? String(row.cancelled_at) : null,
    cancelled_by_user_id:
      row.cancelled_by_user_id != null ? String(row.cancelled_by_user_id) : null,
    cancellation_reason: row.cancellation_reason != null ? String(row.cancellation_reason) : null,
    created_by_user_id: row.created_by_user_id != null ? String(row.created_by_user_id) : null,
    created_at: row.created_at != null ? String(row.created_at) : new Date().toISOString(),
    updated_at: row.updated_at != null ? String(row.updated_at) : new Date().toISOString(),
  };
}

async function maybeWireSurgeryStaffingFromBooking(input: {
  tenantId: string;
  surgeryId: string;
  bookingId: string;
  actorFiUserId: string | null;
}): Promise<void> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("fi_bookings")
      .select(`${FI_BOOKINGS_CALENDAR_OVERLAP_SELECT}, created_at, updated_at, created_by_user_id`)
      .eq("tenant_id", input.tenantId.trim())
      .eq("id", input.bookingId.trim())
      .maybeSingle();
    if (error || !data) return;
    await ensureSurgeryStaffingFromBooking({
      tenantId: input.tenantId,
      surgeryId: input.surgeryId,
      booking: mapBookingRowForStaffingBridge(data as Record<string, unknown>),
      assignedBy: input.actorFiUserId,
    });
  } catch {
    /* staffing bridge must not block surgery creation */
  }
}

export async function createSurgeryFromBooking(input: {
  tenantId: string;
  bookingId: string;
  actorFiUserId: string | null;
}): Promise<{ surgery: SurgeryMutationRow; created: boolean }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId").trim();
  const bookingId = assertNonEmptyUuid(input.bookingId, "bookingId").trim();
  const supabase = supabaseAdmin();

  const { data: existing, error: existErr } = await supabase
    .from("fi_surgeries")
    .select("*")
    .eq("tenant_id", tid)
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (existErr && !isMissingDatabaseRelationError(existErr)) throw new Error(existErr.message);
  if (existing) {
    const row = mapSurgeryRow(existing as Record<string, unknown>);
    assertSurgeryOsTenantRowScope(tid, row.tenant_id, "fi_surgeries");
    await maybeWireSurgeryStaffingFromBooking({
      tenantId: tid,
      surgeryId: row.id,
      bookingId,
      actorFiUserId: input.actorFiUserId,
    });
    return { surgery: row, created: false };
  }

  const { data: booking, error: bookErr } = await supabase
    .from("fi_bookings")
    .select(
      "id, tenant_id, patient_id, case_id, clinic_id, assigned_user_id, booking_type, booking_status, start_at, end_at, metadata"
    )
    .eq("tenant_id", tid)
    .eq("id", bookingId)
    .maybeSingle();
  if (bookErr) throw new Error(bookErr.message);
  if (!booking) throw new Error("Booking not found.");

  const b = booking as Record<string, unknown>;
  assertSurgeryOsTenantRowScope(tid, String(b.tenant_id), "fi_bookings");

  const bookingType = String(b.booking_type ?? "");
  if (bookingType !== "surgery")
    throw new Error("Only surgery bookings can be synced to SurgeryOS.");

  const bookingStatus = String(b.booking_status ?? "");
  if (!["confirmed", "scheduled", "arrived"].includes(bookingStatus)) {
    throw new Error(`Booking status "${bookingStatus}" is not eligible for surgery sync.`);
  }

  const meta =
    b.metadata && typeof b.metadata === "object" && !Array.isArray(b.metadata)
      ? (b.metadata as Record<string, unknown>)
      : {};
  const procedureMeta = parseAppointmentProcedureMetadata(meta);
  const surgeonId =
    procedureMeta.surgeon_user_id ??
    (b.assigned_user_id != null ? String(b.assigned_user_id) : null);
  const targetGrafts = parseTargetGraftsFromEstimate(procedureMeta.graft_count_estimate);
  const startAt = String(b.start_at);
  const scheduledDate = startAt.slice(0, 10);

  const insertRow = {
    tenant_id: tid,
    patient_id: b.patient_id != null ? String(b.patient_id) : null,
    case_id: b.case_id != null ? String(b.case_id) : null,
    booking_id: bookingId,
    clinic_id: b.clinic_id != null ? String(b.clinic_id) : null,
    surgeon_fi_user_id: surgeonId,
    status: "scheduled",
    live_status: "waiting",
    procedure_phase: "pre_op",
    target_grafts: targetGrafts,
    scheduled_date: scheduledDate,
    scheduled_start_at: startAt,
    scheduled_end_at: b.end_at != null ? String(b.end_at) : null,
    metadata: {
      procedure_type: bookingType,
      technique: procedureMeta.technique,
      synced_from_booking_at: new Date().toISOString(),
    },
  };

  const { data: created, error: insertErr } = await supabase
    .from("fi_surgeries")
    .insert(insertRow)
    .select("*")
    .single();
  if (insertErr) {
    if (insertErr.code === "23505") {
      const { data: raced } = await supabase
        .from("fi_surgeries")
        .select("*")
        .eq("tenant_id", tid)
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (raced) {
        const surgery = mapSurgeryRow(raced as Record<string, unknown>);
        await maybeWireSurgeryStaffingFromBooking({
          tenantId: tid,
          surgeryId: surgery.id,
          bookingId,
          actorFiUserId: input.actorFiUserId,
        });
        return { surgery, created: false };
      }
    }
    throw new Error(insertErr.message);
  }

  const surgery = mapSurgeryRow(created as Record<string, unknown>);
  await insertProcedureEvent({
    tenantId: tid,
    surgeryId: surgery.id,
    eventKind: "phase_transition",
    actorFiUserId: input.actorFiUserId,
    metadata: buildProcedureEventAuditMetadata({
      sourceAction: "create_from_booking",
      previousStatus: "",
      newStatus: surgery.status,
      previousPhase: "",
      newPhase: surgery.procedure_phase,
      previousLiveStatus: "",
      newLiveStatus: surgery.live_status,
      extra: { booking_id: bookingId },
    }),
  });

  await maybeWireSurgeryStaffingFromBooking({
    tenantId: tid,
    surgeryId: surgery.id,
    bookingId,
    actorFiUserId: input.actorFiUserId,
  });

  return { surgery, created: true };
}

export async function transitionSurgeryPhase(input: {
  tenantId: string;
  surgeryId: string;
  toPhase: string;
  actorFiUserId: string | null;
}): Promise<{ surgery: SurgeryMutationRow; event: ProcedureEventRow }> {
  if (!isSurgeryOsMajorPhase(input.toPhase)) {
    throw new Error(`Invalid target phase: ${input.toPhase}.`);
  }
  const toPhase = input.toPhase as SurgeryOsMajorPhase;
  const surgery = await loadSurgeryForMutation(input.tenantId, input.surgeryId);
  const fromPhase = resolveCurrentMajorPhase({
    status: surgery.status,
    procedurePhase: surgery.procedure_phase,
  });
  assertSurgeryMajorPhaseTransition(fromPhase, toPhase);
  await assertGraftReconciliationForPhaseTransition({
    tenantId: input.tenantId,
    surgeryId: input.surgeryId,
    toPhase,
  });

  const patch = majorPhaseToSurgeryPatch(toPhase);
  return applySurgeryStatePatch(
    input.tenantId,
    surgery,
    patch,
    "transition_phase",
    input.actorFiUserId,
    "phase_transition",
    {
      from_major_phase: fromPhase,
      to_major_phase: toPhase,
    }
  );
}

export async function logSurgeryProcedureEvent(input: {
  tenantId: string;
  surgeryId: string;
  eventKind: SurgeryOsProcedureEventKind;
  actorFiUserId: string | null;
  customLabel?: string | null;
  customBody?: string | null;
  occurredAt?: string | null;
}): Promise<{ surgery: SurgeryMutationRow; event: ProcedureEventRow }> {
  const surgery = await loadSurgeryForMutation(input.tenantId, input.surgeryId);
  const statePatch = eventKindToSurgeryPatch(input.eventKind);

  const metadata = buildProcedureEventAuditMetadata({
    sourceAction: "log_event",
    previousStatus: surgery.status,
    newStatus: statePatch?.status ?? surgery.status,
    previousPhase: surgery.procedure_phase,
    newPhase: statePatch?.procedurePhase ?? surgery.procedure_phase,
    previousLiveStatus: surgery.live_status,
    newLiveStatus: statePatch?.liveStatus ?? surgery.live_status,
    extra: {
      ...(input.customLabel ? { custom_label: input.customLabel } : {}),
      ...(input.customBody ? { custom_body: input.customBody } : {}),
    },
  });

  if (statePatch) {
    const merged = {
      status: statePatch.status ?? surgery.status,
      procedurePhase: statePatch.procedurePhase ?? surgery.procedure_phase,
      liveStatus: statePatch.liveStatus ?? surgery.live_status,
      setActualStart: statePatch.setActualStart,
      setActualEnd: statePatch.setActualEnd,
    };
    const result = await applySurgeryStatePatch(
      input.tenantId,
      surgery,
      merged as ReturnType<typeof majorPhaseToSurgeryPatch>,
      "log_event",
      input.actorFiUserId,
      input.eventKind,
      metadata
    );
    if (input.occurredAt) {
      const supabase = supabaseAdmin();
      await supabase
        .from("fi_surgery_procedure_events")
        .update({ occurred_at: input.occurredAt })
        .eq("id", result.event.id);
      result.event.occurred_at = input.occurredAt;
    }
    if (input.eventKind === "procedure_completed") {
      void publishSurgeryEvent({
        tenantId: input.tenantId,
        clinicId: result.surgery.clinic_id ?? null,
        eventType: "surgery_completed",
        entityId: input.surgeryId,
        entityType: "surgery",
        eventMetadata: {
          surgery_id: input.surgeryId,
          procedure_event_id: result.event.id,
          actor_fi_user_id: input.actorFiUserId,
        },
        occurredAt: input.occurredAt ?? result.event.occurred_at,
      });
      void syncLiveTheatreToCaseProcedure({
        tenantId: input.tenantId,
        surgeryId: input.surgeryId,
        trigger: "procedure_completed",
        actorFiUserId: input.actorFiUserId,
      });
    }
    return result;
  }

  const event = await insertProcedureEvent({
    tenantId: input.tenantId,
    surgeryId: surgery.id,
    eventKind: input.eventKind,
    actorFiUserId: input.actorFiUserId,
    metadata,
    occurredAt: input.occurredAt ?? undefined,
  });
  return { surgery, event };
}

export async function addSurgeryOperationalNote(input: {
  tenantId: string;
  surgeryId: string;
  noteKind: SurgeryOsNoteKind;
  body: string;
  severity?: SurgeryOsSeverity;
  actorFiUserId: string | null;
}): Promise<OperationalNoteRow> {
  await loadSurgeryForMutation(input.tenantId, input.surgeryId);
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgery_operational_notes")
    .insert({
      tenant_id: input.tenantId.trim(),
      surgery_id: input.surgeryId.trim(),
      note_kind: input.noteKind,
      body: input.body.trim(),
      severity: input.severity ?? "info",
      recorded_by_fi_user_id: input.actorFiUserId,
    })
    .select(
      "id, tenant_id, surgery_id, note_kind, severity, body, recorded_at, recorded_by_fi_user_id"
    )
    .single();
  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    surgery_id: String(row.surgery_id),
    note_kind: String(row.note_kind),
    severity: String(row.severity),
    body: String(row.body),
    recorded_at: String(row.recorded_at),
    recorded_by_fi_user_id:
      row.recorded_by_fi_user_id != null ? String(row.recorded_by_fi_user_id) : null,
  };
}

export async function updateSurgeryTeamStatus(input: {
  tenantId: string;
  assignmentId: string;
  status: SurgeryOsAssignmentStatus;
  actorFiUserId: string | null;
}): Promise<TeamAssignmentRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId").trim();
  const aid = assertNonEmptyUuid(input.assignmentId, "assignmentId").trim();
  const supabase = supabaseAdmin();

  const { data: existing, error: loadErr } = await supabase
    .from("fi_surgery_team_assignments")
    .select("id, tenant_id, surgery_id, fi_user_id, role, assignment_status")
    .eq("tenant_id", tid)
    .eq("id", aid)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) throw new Error("Team assignment not found.");

  const row = existing as TeamAssignmentRow;
  assertSurgeryOsTenantRowScope(tid, row.tenant_id, "fi_surgery_team_assignments");
  assertTeamAssignmentStatusTransition(
    row.assignment_status as SurgeryOsAssignmentStatus,
    input.status
  );

  const { data: updated, error: updateErr } = await supabase
    .from("fi_surgery_team_assignments")
    .update({ assignment_status: input.status })
    .eq("tenant_id", tid)
    .eq("id", aid)
    .select("id, tenant_id, surgery_id, fi_user_id, role, assignment_status")
    .single();
  if (updateErr) throw new Error(updateErr.message);

  const surgery = await loadSurgeryForMutation(tid, row.surgery_id);
  await insertProcedureEvent({
    tenantId: tid,
    surgeryId: row.surgery_id,
    eventKind: "custom",
    actorFiUserId: input.actorFiUserId,
    metadata: buildProcedureEventAuditMetadata({
      sourceAction: "update_team_status",
      previousStatus: row.assignment_status,
      newStatus: input.status,
      previousPhase: surgery.procedure_phase,
      newPhase: surgery.procedure_phase,
      previousLiveStatus: surgery.live_status,
      newLiveStatus: surgery.live_status,
      extra: {
        assignment_id: aid,
        fi_user_id: row.fi_user_id,
        team_role: row.role,
        custom_label: "Team status updated",
      },
    }),
  });

  return updated as TeamAssignmentRow;
}
