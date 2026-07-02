import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { appendPatientTimelineEvent } from "@/src/lib/integrations/hubspot/appendPatientTimelineEvent.server";

import type { ProcedureDayWorkflowStage } from "./procedureDayWorkflowCore";

export async function appendProcedureDaySideEffects(
  input: {
    tenantId: string;
    patientId: string;
    caseId?: string | null;
    bookingId: string;
    sessionId: string;
    eventType: string;
    title: string;
    description?: string | null;
    fromStage?: ProcedureDayWorkflowStage | null;
    toStage?: ProcedureDayWorkflowStage | null;
    payload?: Record<string, unknown>;
    actorFiUserId?: string | null;
  },
  client: SupabaseClient
): Promise<void> {
  const now = new Date().toISOString();
  const detail = {
    booking_id: input.bookingId,
    session_id: input.sessionId,
    event_type: input.eventType,
    from_stage: input.fromStage ?? null,
    to_stage: input.toStage ?? null,
    actor_fi_user_id: input.actorFiUserId ?? null,
    ...(input.payload ?? {}),
  };

  await appendPatientTimelineEvent(client, {
    tenantId: input.tenantId,
    patientId: input.patientId,
    personId: null,
    crmLeadId: null,
    source: "fi_procedure_day_board",
    eventType: "procedure_day_workflow",
    eventTimestamp: now,
    title: input.title,
    description: input.description ?? input.title,
    dedupeKey: `procedure-day:${input.sessionId}:${input.eventType}:${now.slice(0, 19)}`,
    metadata: detail,
  });

  await appendCrmActivityEvent(
    {
      tenantId: input.tenantId,
      patientId: input.patientId,
      caseId: input.caseId ?? null,
      activityKind: "procedure_day.workflow",
      title: input.title,
      detail,
      occurredAt: now,
    },
    client
  );
}