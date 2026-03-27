import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeFiUploadType } from "@/lib/fi/uploadTypes";
import type { FiEventEnvelope, HliDocumentUploadedPayload } from "@/src/types/fi-events";
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
  ensureUploadRecord,
  linkEventToEntities,
  resolveOrCreateGlobalCase,
  resolveOrCreateGlobalPatient,
} from "../mapping";
import { parseFiEventPayload } from "../schema";
import {
  maybeSubmitCaseFromEvent,
  maybeTriggerPipelineFromEvent,
  type FiSubmitDecision,
  type FiTriggerDecision,
} from "../trigger";

export type HliDocumentUploadedResult = {
  ok: boolean;
  eventId?: string;
  fiCaseId?: string;
  globalCaseId?: string;
  globalPatientId?: string | null;
  uploadId?: string;
  actionTaken: string;
  submitDecision?: FiSubmitDecision;
  triggerDecision?: FiTriggerDecision;
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

async function loadLinkedUploadId(
  fiCaseId: string,
  storagePath: string
): Promise<string | undefined> {
  const { data } = await supabaseAdmin()
    .from("fi_uploads")
    .select("id")
    .eq("case_id", fiCaseId)
    .eq("storage_path", storagePath)
    .maybeSingle();

  return data?.id ?? undefined;
}

function mapHliDocumentKindToFiUploadType(kind: HliDocumentUploadedPayload["document"]["kind"]) {
  return normalizeFiUploadType(kind);
}

async function handleHliDocumentUploadedImpl(
  envelope: FiEventEnvelope
): Promise<HliDocumentUploadedResult> {
  if (envelope.event_type !== "hli.document.uploaded") {
    throw new Error("handleHliDocumentUploaded only supports hli.document.uploaded.");
  }

  const payloadResult = parseFiEventPayload(envelope.event_type, envelope.payload);
  if (!payloadResult.ok) {
    throw new Error(payloadResult.error);
  }

  const sourceCaseId = envelope.identifiers?.source_case_id?.trim();
  if (!sourceCaseId) {
    throw new Error("identifiers.source_case_id is required for hli.document.uploaded.");
  }

  const sourcePatientId = envelope.identifiers?.source_patient_id?.trim() || null;
  const payload = payloadResult.data as HliDocumentUploadedPayload;
  const document = payload.document;

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
    const uploadId = linked.fiCaseId
      ? await loadLinkedUploadId(linked.fiCaseId, document.storage_path)
      : undefined;
    return {
      ok: true,
      eventId: eventLog.row.id,
      fiCaseId: linked.fiCaseId,
      globalCaseId: linked.globalCaseId,
      globalPatientId: linked.globalPatientId ?? null,
      uploadId,
      actionTaken: "already_processed",
      message: "Event already processed.",
    };
  }

  if (!eventLog.created && eventLog.row.status === "processing") {
    const linked = await loadLinkedEntities(eventLog.row.id);
    const uploadId = linked.fiCaseId
      ? await loadLinkedUploadId(linked.fiCaseId, document.storage_path)
      : undefined;
    return {
      ok: true,
      eventId: eventLog.row.id,
      fiCaseId: linked.fiCaseId,
      globalCaseId: linked.globalCaseId,
      globalPatientId: linked.globalPatientId ?? null,
      uploadId,
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
      metadataJson: sourcePatientId ? { document_kind: document.kind } : undefined,
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

    await ensureFiIntake(supabaseAdmin(), {
      tenantId: envelope.tenant_id,
      caseId: fiCase.id,
      intake: buildPlaceholderIntake(envelope.source_system, sourceCaseId),
    });

    const uploadType = mapHliDocumentKindToFiUploadType(document.kind);
    const upload = await ensureUploadRecord(supabaseAdmin(), {
      tenantId: envelope.tenant_id,
      caseId: fiCase.id,
      type: uploadType,
      filename: document.filename,
      storagePath: document.storage_path,
      mimeType: document.mime_type,
      sizeBytes: document.size_bytes,
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
      reason: "hli_document_uploaded",
    });

    const shouldAttemptTrigger =
      submitDecision.reason === "submitted" ||
      submitDecision.reason === "already_submitted_or_beyond";

    const triggerDecision = shouldAttemptTrigger
      ? await maybeTriggerPipelineFromEvent({
          tenantId: envelope.tenant_id,
          fiCaseId: fiCase.id,
          sourceSystem: envelope.source_system,
          eventType: envelope.event_type,
          reason: "hli_document_uploaded",
        })
      : undefined;

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
      uploadId: upload.id,
      actionTaken: triggerDecision?.triggered
        ? "mapped_document_submitted_and_triggered"
        : submitDecision.submitted
          ? "mapped_document_and_submitted"
          : upload.created
            ? "mapped_document_only"
            : "reused_document_only",
      submitDecision,
      triggerDecision,
      message: triggerDecision?.triggered
        ? "HLI document ingested and FI pipeline triggered."
        : submitDecision.submitted
          ? "HLI document ingested and FI case submitted."
          : "HLI document ingested and FI readiness evaluated.",
    };
  } catch (e: unknown) {
    await attachFiEventError({
      eventId: eventLog.row.id,
      errorText: e instanceof Error ? e.message : "Unexpected error.",
    });
    throw e;
  }
}

export async function handleHliDocumentUploaded(input: {
  envelope: FiEventEnvelope;
}): Promise<HliDocumentUploadedResult>;
export async function handleHliDocumentUploaded(
  _supabase: SupabaseClient,
  envelope: FiEventEnvelope
): Promise<HliDocumentUploadedResult>;
export async function handleHliDocumentUploaded(
  inputOrSupabase: HandlerInput | SupabaseClient,
  legacyEnvelope?: FiEventEnvelope
): Promise<HliDocumentUploadedResult> {
  const envelope =
    "envelope" in inputOrSupabase ? inputOrSupabase.envelope : legacyEnvelope;

  if (!envelope) {
    throw new Error("Missing envelope for handleHliDocumentUploaded.");
  }

  const existing = await getExistingFiEventBySourceKey({
    tenantId: envelope.tenant_id,
    sourceSystem: envelope.source_system,
    sourceEventId: envelope.source_event_id,
  });

  if (existing && ["processed", "ignored"].includes(existing.status)) {
    const linked = await loadLinkedEntities(existing.id);
    const payloadResult = parseFiEventPayload(envelope.event_type, envelope.payload);
    const uploadId =
      payloadResult.ok && linked.fiCaseId && "document" in payloadResult.data
        ? await loadLinkedUploadId(linked.fiCaseId, payloadResult.data.document.storage_path)
        : undefined;

    return {
      ok: true,
      eventId: existing.id,
      fiCaseId: linked.fiCaseId,
      globalCaseId: linked.globalCaseId,
      globalPatientId: linked.globalPatientId ?? null,
      uploadId,
      actionTaken: "already_processed",
      message: "Event already processed.",
    };
  }

  return handleHliDocumentUploadedImpl(envelope);
}
