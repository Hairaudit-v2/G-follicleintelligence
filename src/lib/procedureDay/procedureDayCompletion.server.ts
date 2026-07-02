import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createCrmTask } from "@/src/lib/crm/tasks";
import { applyPatientJourneyTransition } from "@/src/lib/patientJourney/patientJourneyStateMutations.server";
import { upsertProcedureDayForCase } from "@/src/lib/cases/procedureDayUpdate";

import { appendProcedureDaySideEffects } from "./procedureDayAudit.server";
import type { ProcedureDaySessionRow } from "./procedureDayWorkflowTypes";

export type ProcedureDayCompletionResult = {
  sessionId: string;
  journeyChanged: boolean;
  followUpTaskId: string | null;
  postOpSummary: string;
};

export async function completeProcedureDaySessionWorkflow(
  input: {
    tenantId: string;
    session: ProcedureDaySessionRow;
    actorFiUserId: string | null;
    postOpSummary?: string | null;
    createFollowUpTask?: boolean;
  },
  client?: SupabaseClient
): Promise<ProcedureDayCompletionResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const now = new Date().toISOString();
  const summary =
    input.postOpSummary?.trim() ||
    `Procedure completed on ${now.slice(0, 10)}. Post-op handoff recorded on Procedure Day Board.`;

  const metadata = {
    ...input.session.metadata,
    post_op_summary: summary,
    completed_at: now,
  };

  const { error: updErr } = await supabase
    .from("fi_procedure_day_sessions")
    .update({
      current_stage: "completed",
      completed_at: now,
      metadata,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", input.session.id);
  if (updErr) throw new Error(updErr.message);

  await supabase.from("fi_procedure_day_events").insert({
    tenant_id: tid,
    session_id: input.session.id,
    booking_id: input.session.bookingId,
    patient_id: input.session.patientId,
    event_type: "procedure_completed",
    from_stage: input.session.currentStage,
    to_stage: "completed",
    payload: { post_op_summary: summary },
    actor_user_id: input.actorFiUserId,
  });

  await appendProcedureDaySideEffects(
    {
      tenantId: tid,
      patientId: input.session.patientId,
      caseId: input.session.caseId,
      bookingId: input.session.bookingId,
      sessionId: input.session.id,
      eventType: "procedure_completed",
      title: "Procedure completed",
      description: summary,
      fromStage: input.session.currentStage,
      toStage: "completed",
      actorFiUserId: input.actorFiUserId,
      payload: { post_op_summary: summary },
    },
    supabase
  );

  const journey = await applyPatientJourneyTransition({
    tenantId: tid,
    patientId: input.session.patientId,
    toState: "procedure_completed",
    reason: "procedure_completed",
    source: "automatic",
    actorFiUserId: input.actorFiUserId,
    caseId: input.session.caseId,
    detail: {
      booking_id: input.session.bookingId,
      session_id: input.session.id,
    },
    client: supabase,
  });

  if (input.session.caseId) {
    try {
      const meta = input.session.metadata;
      await upsertProcedureDayForCase(
        {
          tenantId: tid,
          caseId: input.session.caseId,
          patch: {
            procedure_status: "completed",
            finish_time: now,
            grafts_extracted:
              typeof meta.graftsExtracted === "number" ? meta.graftsExtracted : undefined,
            grafts_implanted:
              typeof meta.graftsImplanted === "number" ? meta.graftsImplanted : undefined,
            hairs_implanted: typeof meta.hairsCounted === "number" ? meta.hairsCounted : undefined,
            punch_size: typeof meta.punchSize === "string" ? meta.punchSize : undefined,
            extraction_method:
              typeof meta.extractionMethod === "string" ? meta.extractionMethod : undefined,
            implantation_method:
              typeof meta.implantationMethod === "string" ? meta.implantationMethod : undefined,
            completion_summary: summary,
          },
        },
        supabase
      );
    } catch {
      /* non-blocking — existing case record sync is best-effort */
    }
  }

  let followUpTaskId: string | null = null;
  if (input.createFollowUpTask) {
    const { data: patient } = await supabase
      .from("fi_patients")
      .select("id, lead_id")
      .eq("tenant_id", tid)
      .eq("id", input.session.patientId)
      .maybeSingle();
    const leadId = (patient as { lead_id?: string | null } | null)?.lead_id?.trim();
    if (leadId) {
      const dueAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const task = await createCrmTask(
        {
          tenantId: tid,
          leadId,
          title: "Post-procedure follow-up",
          description: summary,
          taskType: "follow_up",
          status: "open",
          dueAt,
          patientId: input.session.patientId,
          caseId: input.session.caseId,
          metadata: {
            source: "procedure_day_board",
            booking_id: input.session.bookingId,
            session_id: input.session.id,
          },
        },
        supabase
      );
      followUpTaskId = task.id;
    }
  }

  return {
    sessionId: input.session.id,
    journeyChanged: journey.changed,
    followUpTaskId,
    postOpSummary: summary,
  };
}

export async function dischargeProcedureDayPatientWorkflow(
  input: {
    tenantId: string;
    session: ProcedureDaySessionRow;
    actorFiUserId: string | null;
    dischargeNotes?: string | null;
  },
  client?: SupabaseClient
): Promise<{ sessionId: string }> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const now = new Date().toISOString();
  const notes = input.dischargeNotes?.trim() || "Patient discharged from clinic.";
  const metadata = {
    ...input.session.metadata,
    discharge_notes: notes,
    discharged_at: now,
  };

  const { error: updErr } = await supabase
    .from("fi_procedure_day_sessions")
    .update({
      current_stage: "discharged",
      metadata,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", input.session.id);
  if (updErr) throw new Error(updErr.message);

  await supabase.from("fi_procedure_day_events").insert({
    tenant_id: tid,
    session_id: input.session.id,
    booking_id: input.session.bookingId,
    patient_id: input.session.patientId,
    event_type: "patient_discharged",
    from_stage: input.session.currentStage,
    to_stage: "discharged",
    payload: { discharge_notes: notes },
    actor_user_id: input.actorFiUserId,
  });

  await appendProcedureDaySideEffects(
    {
      tenantId: tid,
      patientId: input.session.patientId,
      caseId: input.session.caseId,
      bookingId: input.session.bookingId,
      sessionId: input.session.id,
      eventType: "patient_discharged",
      title: "Patient discharged",
      description: notes,
      fromStage: input.session.currentStage,
      toStage: "discharged",
      actorFiUserId: input.actorFiUserId,
    },
    supabase
  );

  return { sessionId: input.session.id };
}