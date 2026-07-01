import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { appendPatientTimelineEvent } from "@/src/lib/integrations/hubspot/appendPatientTimelineEvent.server";
import {
  isPatientJourneyTransitionAllowed,
  type PatientJourneyState,
  type PatientJourneyTransitionReason,
  PATIENT_JOURNEY_STATE_LABELS,
} from "./patientJourneyStateCore";

export type PatientJourneyStateRow = {
  id: string;
  tenantId: string;
  patientId: string;
  currentState: PatientJourneyState;
  previousState: PatientJourneyState | null;
  lastTransitionAt: string;
  transitionReason: string;
  manuallyOverriddenBy: string | null;
  overrideExpiresAt: string | null;
  derivedState: PatientJourneyState | null;
};

function mapRow(raw: Record<string, unknown>): PatientJourneyStateRow {
  return {
    id: String(raw.id),
    tenantId: String(raw.tenant_id),
    patientId: String(raw.patient_id),
    currentState: String(raw.current_state) as PatientJourneyState,
    previousState: raw.previous_state != null ? (String(raw.previous_state) as PatientJourneyState) : null,
    lastTransitionAt: String(raw.last_transition_at),
    transitionReason: String(raw.transition_reason),
    manuallyOverriddenBy:
      raw.manually_overridden_by != null ? String(raw.manually_overridden_by) : null,
    overrideExpiresAt: raw.override_expires_at != null ? String(raw.override_expires_at) : null,
    derivedState: raw.derived_state != null ? (String(raw.derived_state) as PatientJourneyState) : null,
  };
}

async function assertPatientBelongsToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("id", patientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Patient not found for this tenant.");
  const rowTenant = String((data as { tenant_id?: string }).tenant_id ?? "").trim();
  if (rowTenant && rowTenant !== tenantId) {
    throw new Error("Patient does not belong to this tenant.");
  }
}

export async function loadPatientJourneyStateRow(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientJourneyStateRow | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const pid = assertNonEmptyUuid(patientId, "patientId").trim();
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patient_journey_states")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01") return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export type ApplyPatientJourneyTransitionInput = {
  tenantId: string;
  patientId: string;
  toState: PatientJourneyState;
  reason: PatientJourneyTransitionReason | string;
  source: "automatic" | "manual";
  actorFiUserId?: string | null;
  derivedState?: PatientJourneyState | null;
  leadId?: string | null;
  caseId?: string | null;
  overrideExpiresAt?: string | null;
  detail?: Record<string, unknown>;
  client?: SupabaseClient;
};

export async function applyPatientJourneyTransition(
  input: ApplyPatientJourneyTransitionInput
): Promise<{ changed: boolean; row: PatientJourneyStateRow }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId").trim();
  const pid = assertNonEmptyUuid(input.patientId, "patientId").trim();
  const supabase = input.client ?? supabaseAdmin();
  await assertPatientBelongsToTenant(supabase, tid, pid);

  const existing = await loadPatientJourneyStateRow(tid, pid, supabase);
  const fromState = existing?.currentState ?? null;

  if (fromState && fromState === input.toState) {
    if (existing) return { changed: false, row: existing };
  }

  if (fromState && !isPatientJourneyTransitionAllowed(fromState, input.toState, input.source === "manual")) {
    throw new Error(`Transition from ${fromState} to ${input.toState} is not allowed.`);
  }

  const now = new Date().toISOString();
  const upsertPayload = {
    tenant_id: tid,
    patient_id: pid,
    current_state: input.toState,
    previous_state: fromState,
    last_transition_at: now,
    transition_reason: input.reason,
    manually_overridden_by: input.source === "manual" ? (input.actorFiUserId ?? null) : null,
    override_expires_at: input.overrideExpiresAt ?? null,
    derived_state: input.derivedState ?? null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("fi_patient_journey_states")
    .upsert(upsertPayload, { onConflict: "tenant_id,patient_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("fi_patient_journey_transition_log").insert({
    tenant_id: tid,
    patient_id: pid,
    from_state: fromState,
    to_state: input.toState,
    transition_reason: input.reason,
    source: input.source,
    actor_fi_user_id: input.actorFiUserId ?? null,
    detail: input.detail ?? {},
  });

  const title = `Journey: ${PATIENT_JOURNEY_STATE_LABELS[input.toState]}`;
  const timelineDetail = {
    from_state: fromState,
    to_state: input.toState,
    reason: input.reason,
    source: input.source,
    ...(input.detail ?? {}),
  };

  await appendPatientTimelineEvent(supabase, {
    tenantId: tid,
    patientId: pid,
    personId: null,
    crmLeadId: input.leadId ?? null,
    source: "fi_patient_journey_engine",
    eventType: "patient_journey_transition",
    eventTimestamp: now,
    title,
    description: input.reason,
    dedupeKey: `journey:${pid}:${input.toState}:${now.slice(0, 16)}`,
    metadata: timelineDetail,
  });

  if (input.leadId || pid) {
    await appendCrmActivityEvent(
      {
        tenantId: tid,
        leadId: input.leadId ?? null,
        patientId: pid,
        caseId: input.caseId ?? null,
        activityKind: "patient.journey_transition",
        title,
        detail: timelineDetail,
        occurredAt: now,
      },
      supabase
    );
  }

  return { changed: true, row: mapRow(data as Record<string, unknown>) };
}