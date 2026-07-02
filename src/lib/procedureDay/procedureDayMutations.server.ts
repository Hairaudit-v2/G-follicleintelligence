import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import { appendProcedureDaySideEffects } from "./procedureDayAudit.server";
import {
  completeProcedureDaySessionWorkflow,
  dischargeProcedureDayPatientWorkflow,
} from "./procedureDayCompletion.server";
import type { ProcedureDayMutationActor } from "./procedureDayMutationAccess.server";
import {
  assertProcedureDayBookingScope,
  loadProcedureDaySessionForBooking,
} from "./procedureDaySessionLoaders.server";
import {
  applyGraftMetricIncrement,
  assertProcedureDayStageTransitionAllowed,
  deriveProcedureDayStageFromBooking,
  mergeProcedureDayMetrics,
  nextProcedureDayStage,
  type ProcedureDayWorkflowStage,
} from "./procedureDayWorkflowCore";
import type { ProcedureDaySessionRow } from "./procedureDayWorkflowTypes";

function metricKeyToMetadata(
  metric: string,
  value: unknown,
  current: Record<string, unknown>,
  increment?: number
): Record<string, unknown> {
  switch (metric) {
    case "grafts_extracted":
      return {
        graftsExtracted:
          increment != null
            ? applyGraftMetricIncrement(
                typeof current.graftsExtracted === "number" ? current.graftsExtracted : null,
                increment
              )
            : Number(value),
      };
    case "grafts_implanted":
      return {
        graftsImplanted:
          increment != null
            ? applyGraftMetricIncrement(
                typeof current.graftsImplanted === "number" ? current.graftsImplanted : null,
                increment
              )
            : Number(value),
      };
    case "hairs_counted":
      return {
        hairsCounted:
          increment != null
            ? applyGraftMetricIncrement(
                typeof current.hairsCounted === "number" ? current.hairsCounted : null,
                increment
              )
            : Number(value),
      };
    case "transection_rate":
      return { transectionRate: value === null ? null : Number(value) };
    case "punch_size":
      return { punchSize: value === null ? null : String(value) };
    case "extraction_method":
      return { extractionMethod: value === null ? null : String(value) };
    case "implantation_method":
      return { implantationMethod: value === null ? null : String(value) };
    case "medications_given":
      return { medicationsGiven: Array.isArray(value) ? value.map(String) : [] };
    case "adverse_events":
      return { adverseEvents: Array.isArray(value) ? value.map(String) : [] };
    case "notes":
      return { notes: value === null ? null : String(value) };
    default:
      return {};
  }
}

async function insertProcedureDayEvent(
  input: {
    tenantId: string;
    sessionId: string;
    bookingId: string;
    patientId: string;
    eventType: string;
    fromStage?: ProcedureDayWorkflowStage | null;
    toStage?: ProcedureDayWorkflowStage | null;
    payload?: Record<string, unknown>;
    actorFiUserId?: string | null;
  }
): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("fi_procedure_day_events").insert({
    tenant_id: input.tenantId,
    session_id: input.sessionId,
    booking_id: input.bookingId,
    patient_id: input.patientId,
    event_type: input.eventType,
    from_stage: input.fromStage ?? null,
    to_stage: input.toStage ?? null,
    payload: input.payload ?? {},
    actor_user_id: input.actorFiUserId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function startProcedureDaySession(
  tenantId: string,
  bookingId: string,
  actor: ProcedureDayMutationActor
): Promise<ProcedureDaySessionRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const scope = await assertProcedureDayBookingScope(tid, bookingId);
  const existing = await loadProcedureDaySessionForBooking(tid, scope.bookingId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const initialStage = deriveProcedureDayStageFromBooking({
    bookingStatus: scope.bookingStatus,
  });
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_procedure_day_sessions")
    .insert({
      tenant_id: tid,
      booking_id: scope.bookingId,
      patient_id: scope.patientId,
      case_id: scope.caseId,
      current_stage: initialStage === "scheduled" ? "arrived" : initialStage,
      started_at: now,
      metadata: {},
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const session = {
    id: String((data as { id: string }).id),
    tenantId: tid,
    bookingId: scope.bookingId,
    patientId: scope.patientId,
    caseId: scope.caseId,
    currentStage: (initialStage === "scheduled" ? "arrived" : initialStage) as ProcedureDayWorkflowStage,
    startedAt: now,
    completedAt: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };

  await insertProcedureDayEvent({
    tenantId: tid,
    sessionId: session.id,
    bookingId: scope.bookingId,
    patientId: scope.patientId,
    eventType: "session_started",
    fromStage: "scheduled",
    toStage: session.currentStage,
    actorFiUserId: actor.actorFiUserId,
  });

  await appendProcedureDaySideEffects(
    {
      tenantId: tid,
      patientId: scope.patientId,
      caseId: scope.caseId,
      bookingId: scope.bookingId,
      sessionId: session.id,
      eventType: "session_started",
      title: "Procedure day session started",
      fromStage: "scheduled",
      toStage: session.currentStage,
      actorFiUserId: actor.actorFiUserId,
    },
    supabase
  );

  return session;
}

export async function advanceProcedureDayStage(
  tenantId: string,
  bookingId: string,
  actor: ProcedureDayMutationActor,
  toStage?: ProcedureDayWorkflowStage
): Promise<ProcedureDaySessionRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  await assertProcedureDayBookingScope(tid, bookingId);
  let session = await loadProcedureDaySessionForBooking(tid, bookingId);
  if (!session) {
    session = await startProcedureDaySession(tid, bookingId, actor);
  }

  const target = toStage ?? nextProcedureDayStage(session.currentStage);
  if (!target) throw new Error("Procedure is already at the final stage.");
  assertProcedureDayStageTransitionAllowed(session.currentStage, target);

  const now = new Date().toISOString();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_procedure_day_sessions")
    .update({ current_stage: target, updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", session.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await insertProcedureDayEvent({
    tenantId: tid,
    sessionId: session.id,
    bookingId: session.bookingId,
    patientId: session.patientId,
    eventType: "stage_advanced",
    fromStage: session.currentStage,
    toStage: target,
    actorFiUserId: actor.actorFiUserId,
  });

  await appendProcedureDaySideEffects(
    {
      tenantId: tid,
      patientId: session.patientId,
      caseId: session.caseId,
      bookingId: session.bookingId,
      sessionId: session.id,
      eventType: "stage_advanced",
      title: `Procedure stage: ${target}`,
      fromStage: session.currentStage,
      toStage: target,
      actorFiUserId: actor.actorFiUserId,
    },
    supabase
  );

  const raw = data as Record<string, unknown>;
  return {
    ...session,
    currentStage: target,
    updatedAt: now,
    startedAt: raw.started_at != null ? String(raw.started_at) : session.startedAt,
    completedAt: raw.completed_at != null ? String(raw.completed_at) : session.completedAt,
  };
}

export async function recordProcedureDayMetric(
  tenantId: string,
  bookingId: string,
  actor: ProcedureDayMutationActor,
  input: {
    metric: string;
    value: unknown;
    increment?: number;
  }
): Promise<ProcedureDaySessionRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  await assertProcedureDayBookingScope(tid, bookingId);
  let session = await loadProcedureDaySessionForBooking(tid, bookingId);
  if (!session) {
    session = await startProcedureDaySession(tid, bookingId, actor);
  }

  const patch = metricKeyToMetadata(
    input.metric,
    input.value,
    session.metadata,
    input.increment
  );
  const metadata = mergeProcedureDayMetrics(session.metadata, patch);
  const now = new Date().toISOString();
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_procedure_day_sessions")
    .update({ metadata, updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", session.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await insertProcedureDayEvent({
    tenantId: tid,
    sessionId: session.id,
    bookingId: session.bookingId,
    patientId: session.patientId,
    eventType: "metric_recorded",
    fromStage: session.currentStage,
    toStage: session.currentStage,
    payload: { metric: input.metric, ...patch },
    actorFiUserId: actor.actorFiUserId,
  });

  await appendProcedureDaySideEffects(
    {
      tenantId: tid,
      patientId: session.patientId,
      caseId: session.caseId,
      bookingId: session.bookingId,
      sessionId: session.id,
      eventType: "metric_recorded",
      title: `Surgical metric recorded: ${input.metric}`,
      fromStage: session.currentStage,
      toStage: session.currentStage,
      actorFiUserId: actor.actorFiUserId,
      payload: patch,
    },
    supabase
  );

  void data;
  return { ...session, metadata, updatedAt: now };
}

export async function completeProcedureDaySession(
  tenantId: string,
  bookingId: string,
  actor: ProcedureDayMutationActor,
  input?: { postOpSummary?: string | null; createFollowUpTask?: boolean }
) {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  await assertProcedureDayBookingScope(tid, bookingId);
  let session = await loadProcedureDaySessionForBooking(tid, bookingId);
  if (!session) {
    session = await startProcedureDaySession(tid, bookingId, actor);
  }
  if (session.currentStage !== "post_op" && session.currentStage !== "discharged") {
    if (session.currentStage !== "quality_check") {
      throw new Error("Advance to post-op or quality check before completing.");
    }
  }

  return completeProcedureDaySessionWorkflow({
    tenantId: tid,
    session,
    actorFiUserId: actor.actorFiUserId,
    postOpSummary: input?.postOpSummary,
    createFollowUpTask: input?.createFollowUpTask ?? true,
  });
}

export async function dischargeProcedureDayPatient(
  tenantId: string,
  bookingId: string,
  actor: ProcedureDayMutationActor,
  dischargeNotes?: string | null
) {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  await assertProcedureDayBookingScope(tid, bookingId);
  let session = await loadProcedureDaySessionForBooking(tid, bookingId);
  if (!session) {
    session = await startProcedureDaySession(tid, bookingId, actor);
  }

  return dischargeProcedureDayPatientWorkflow({
    tenantId: tid,
    session,
    actorFiUserId: actor.actorFiUserId,
    dischargeNotes,
  });
}