import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiEventEnvelope, HairAuditCaseSubmittedPayload } from "@/src/types/fi-events";
import {
  attachFiEventError,
  createFiEventIfNotExists,
  getExistingFiEventBySourceKey,
  markFiEventStatus,
} from "../idempotency";
import {
  attachFiCaseIdToGlobalCase,
  buildPlaceholderIntake,
  ensureFiCase,
  ensureFiIntake,
  linkEventToEntities,
  resolveOrCreateGlobalCase,
  resolveOrCreateGlobalPatient,
} from "../mapping";
import { parseFiEventPayload } from "../schema";
import { maybeSubmitCaseFromEvent, type FiSubmitDecision } from "../trigger";

export type HairAuditCaseSubmittedResult = {
  ok: boolean;
  eventId?: string;
  fiCaseId?: string;
  globalCaseId?: string;
  globalPatientId?: string | null;
  actionTaken: string;
  submitDecision?: FiSubmitDecision;
  message: string;
  pipeline?: undefined;
};

type HandlerInput = {
  envelope: FiEventEnvelope;
};

async function loadLinkedEntities(eventId: string): Promise<{
  fiCaseId?: string;
  globalCaseId?: string;
  globalPatientId?: string | null;
}> {
  const { data } = await supabaseAdmin()
    .from("fi_event_links")
    .select("fi_case_id, global_case_id, global_patient_id")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    fiCaseId: data?.fi_case_id ?? undefined,
    globalCaseId: data?.global_case_id ?? undefined,
    globalPatientId: data?.global_patient_id ?? null,
  };
}

async function handleHairAuditCaseSubmittedImpl(
  envelope: FiEventEnvelope
): Promise<HairAuditCaseSubmittedResult> {
  if (envelope.event_type !== "hairaudit.case.submitted") {
    throw new Error("handleHairAuditCaseSubmitted only supports hairaudit.case.submitted.");
  }

  const payloadResult = parseFiEventPayload(envelope.event_type, envelope.payload);
  if (!payloadResult.ok) {
    throw new Error(payloadResult.error);
  }

  const sourceCaseId = envelope.identifiers?.source_case_id?.trim();
  if (!sourceCaseId) {
    throw new Error("identifiers.source_case_id is required for hairaudit.case.submitted.");
  }

  const sourcePatientId = envelope.identifiers?.source_patient_id?.trim() || null;
  const caseSeed = payloadResult.data.case as HairAuditCaseSubmittedPayload["case"];

  const eventLog = await createFiEventIfNotExists({
    tenantId: envelope.tenant_id,
    eventType: envelope.event_type,
    sourceSystem: envelope.source_system,
    sourceEventId: envelope.source_event_id,
    occurredAt: envelope.occurred_at,
    payloadJson: envelope.payload,
  });

  if (!eventLog.created && ["processed", "ignored"].includes(eventLog.row.status)) {
    const linked = await loadLinkedEntities(eventLog.row.id);
    return {
      ok: true,
      eventId: eventLog.row.id,
      fiCaseId: linked.fiCaseId,
      globalCaseId: linked.globalCaseId,
      globalPatientId: linked.globalPatientId ?? null,
      actionTaken: "already_processed",
      message: "Event already processed.",
    };
  }

  if (!eventLog.created && eventLog.row.status === "processing") {
    const linked = await loadLinkedEntities(eventLog.row.id);
    return {
      ok: true,
      eventId: eventLog.row.id,
      fiCaseId: linked.fiCaseId,
      globalCaseId: linked.globalCaseId,
      globalPatientId: linked.globalPatientId ?? null,
      actionTaken: "already_processing",
      message: "Event is already being processed.",
    };
  }

  await markFiEventStatus({
    eventId: eventLog.row.id,
    status: "processing",
  });

  try {
    const globalPatient = await resolveOrCreateGlobalPatient({
      tenantId: envelope.tenant_id,
      sourceSystem: envelope.source_system,
      sourcePatientId,
      metadataJson: sourcePatientId
        ? {
            ...(caseSeed.patient_name ? { patient_name: caseSeed.patient_name } : {}),
            ...(caseSeed.email ? { email: caseSeed.email } : {}),
          }
        : undefined,
    });

    const globalCase = await resolveOrCreateGlobalCase({
      tenantId: envelope.tenant_id,
      sourceSystem: envelope.source_system,
      sourceCaseId,
      globalPatientId: globalPatient?.id ?? null,
      metadataJson: {
        event_type: envelope.event_type,
      },
    });

    const fiCase = await ensureFiCase(supabaseAdmin(), {
      tenantId: envelope.tenant_id,
      sourceSystem: envelope.source_system,
      sourceCaseId,
      metadata: {
        event_type: envelope.event_type,
        ...(sourcePatientId ? { source_patient_id: sourcePatientId } : {}),
      },
    });

    const linkedGlobalCase = await attachFiCaseIdToGlobalCase({
      globalCaseId: globalCase.id,
      fiCaseId: fiCase.id,
    });

    const intake = buildPlaceholderIntake(envelope.source_system, sourceCaseId, {
      full_name: caseSeed.patient_name,
      email: caseSeed.email,
      dob: caseSeed.dob,
      sex: caseSeed.sex,
      country: caseSeed.country ?? null,
      primary_concern: caseSeed.primary_concern ?? null,
      selections:
        caseSeed.selections && !Array.isArray(caseSeed.selections)
          ? caseSeed.selections
          : undefined,
      notes: caseSeed.notes,
    });

    await ensureFiIntake(supabaseAdmin(), {
      tenantId: envelope.tenant_id,
      caseId: fiCase.id,
      intake,
    });

    await linkEventToEntities({
      eventId: eventLog.row.id,
      globalCaseId: linkedGlobalCase.id,
      fiCaseId: fiCase.id,
      globalPatientId: globalPatient?.id ?? null,
    });

    const submitDecision = await maybeSubmitCaseFromEvent({
      tenantId: envelope.tenant_id,
      fiCaseId: fiCase.id,
      sourceSystem: envelope.source_system,
      eventType: envelope.event_type,
      reason: "hairaudit_case_submitted",
    });

    await markFiEventStatus({
      eventId: eventLog.row.id,
      status: "processed",
    });

    return {
      ok: true,
      eventId: eventLog.row.id,
      fiCaseId: fiCase.id,
      globalCaseId: linkedGlobalCase.id,
      globalPatientId: globalPatient?.id ?? null,
      actionTaken: submitDecision.submitted
        ? "mapped_case_and_submitted"
        : "mapped_case_only",
      submitDecision,
      message: submitDecision.submitted
        ? "HairAudit case ingested and FI case submitted."
        : "HairAudit case ingested and FI readiness evaluated.",
    };
  } catch (e: unknown) {
    await attachFiEventError({
      eventId: eventLog.row.id,
      errorText: e instanceof Error ? e.message : "Unexpected error.",
    });
    throw e;
  }
}

export async function handleHairAuditCaseSubmitted(
  input: HandlerInput
): Promise<HairAuditCaseSubmittedResult>;
export async function handleHairAuditCaseSubmitted(
  _supabase: SupabaseClient,
  envelope: FiEventEnvelope
): Promise<HairAuditCaseSubmittedResult>;
export async function handleHairAuditCaseSubmitted(
  inputOrSupabase: HandlerInput | SupabaseClient,
  legacyEnvelope?: FiEventEnvelope
): Promise<HairAuditCaseSubmittedResult> {
  const envelope =
    "envelope" in inputOrSupabase ? inputOrSupabase.envelope : legacyEnvelope;

  if (!envelope) {
    throw new Error("Missing envelope for handleHairAuditCaseSubmitted.");
  }

  const existing = await getExistingFiEventBySourceKey({
    tenantId: envelope.tenant_id,
    sourceSystem: envelope.source_system,
    sourceEventId: envelope.source_event_id,
  });

  if (existing && ["processed", "ignored"].includes(existing.status)) {
    const linked = await loadLinkedEntities(existing.id);
    return {
      ok: true,
      eventId: existing.id,
      fiCaseId: linked.fiCaseId,
      globalCaseId: linked.globalCaseId,
      globalPatientId: linked.globalPatientId ?? null,
      actionTaken: "already_processed",
      message: "Event already processed.",
    };
  }

  return handleHairAuditCaseSubmittedImpl(envelope);
}
