import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeFiUploadType } from "@/lib/fi/uploadTypes";
import { dualWriteFoundationFromFiEvent } from "@/src/lib/fi/foundation/dualWriteEvent";
import { dualWriteIiohrImagesToPatientLibrary } from "@/src/lib/fi/foundation/iiohrPatientImageDualWrite.server";
import {
  resolveIiohrExternalView,
  resolveIiohrImageStoragePath,
} from "@/src/lib/fi/foundation/iiohrPatientImageDualWriteCore";
import type { FiEventEnvelope, IiohrImagesUploadedPayload } from "@/src/types/fi-events";
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

/**
 * IIOHR academy image ingest handler.
 *
 * Until the IIOHR producer ships `iiohr.images.uploaded`, academy images may still
 * arrive via `hairaudit.images.uploaded` (see hairauditImagesUploaded handler).
 */

export type IiohrImagesUploadedResult = {
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

function mapIiohrViewToFiUploadType(payload: IiohrImagesUploadedPayload) {
  return normalizeFiUploadType(resolveIiohrExternalView(payload));
}

async function maybeDualWriteIiohrPatientImage(input: {
  tenantId: string;
  fiEventId: string;
  fiCaseId: string;
  envelope: FiEventEnvelope;
  globalCaseId?: string | null;
  storagePath?: string | null;
  fiUploadId?: string | null;
}): Promise<void> {
  try {
    await dualWriteIiohrImagesToPatientLibrary({
      tenantId: input.tenantId,
      fiEventId: input.fiEventId,
      fiCaseId: input.fiCaseId,
      envelope: input.envelope,
      globalCaseId: input.globalCaseId,
      fiUploadId: input.fiUploadId,
    });
  } catch (e: unknown) {
    console.error("[iiohr-images-uploaded] patient image dual-write failed", {
      tenantId: input.tenantId,
      fiEventId: input.fiEventId,
      fiCaseId: input.fiCaseId,
      storagePath: input.storagePath,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

function resolveSourceCaseId(
  envelope: FiEventEnvelope,
  payload: IiohrImagesUploadedPayload
): string {
  return (
    payload.academy_case_id?.trim() ||
    envelope.identifiers?.source_case_id?.trim() ||
    ""
  );
}

function resolveSourcePatientId(
  envelope: FiEventEnvelope,
  payload: IiohrImagesUploadedPayload
): string | null {
  return (
    envelope.identifiers?.source_patient_id?.trim() ||
    payload.patient_external_id?.trim() ||
    null
  );
}

async function handleIiohrImagesUploadedImpl(
  envelope: FiEventEnvelope
): Promise<IiohrImagesUploadedResult> {
  if (envelope.event_type !== "iiohr.images.uploaded") {
    throw new Error("handleIiohrImagesUploaded only supports iiohr.images.uploaded.");
  }

  const payloadResult = parseFiEventPayload(envelope.event_type, envelope.payload);
  if (!payloadResult.ok) {
    throw new Error(payloadResult.error);
  }

  const payload = payloadResult.data as IiohrImagesUploadedPayload;
  const sourceCaseId = resolveSourceCaseId(envelope, payload);
  if (!sourceCaseId) {
    throw new Error(
      "payload.academy_case_id or identifiers.source_case_id is required for iiohr.images.uploaded."
    );
  }

  const storagePath = resolveIiohrImageStoragePath(payload);
  if (!storagePath) {
    throw new Error("payload.storage_path or payload.image_url is required.");
  }

  const sourcePatientId = resolveSourcePatientId(envelope, payload);

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
      ? await loadLinkedUploadId(linked.fiCaseId, storagePath)
      : undefined;
    await dualWriteFoundationFromFiEvent({
      tenantId: envelope.tenant_id,
      fiEventId: eventLog.row.id,
      envelope,
      resolution: {
        fiCaseId: linked.fiCaseId,
        globalPatientId: linked.globalPatientId ?? null,
        globalCaseId: linked.globalCaseId,
      },
    });
    if (linked.fiCaseId) {
      await maybeDualWriteIiohrPatientImage({
        tenantId: envelope.tenant_id,
        fiEventId: eventLog.row.id,
        fiCaseId: linked.fiCaseId,
        envelope,
        globalCaseId: linked.globalCaseId,
        storagePath,
        fiUploadId: uploadId,
      });
    }
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
      ? await loadLinkedUploadId(linked.fiCaseId, storagePath)
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
    tenantId: envelope.tenant_id,
    eventId: eventLog.row.id,
    status: "processing",
  });

  try {
    const globalPatient = await resolveOrCreateGlobalPatient({
      tenantId: envelope.tenant_id,
      sourceSystem: envelope.source_system,
      sourcePatientId,
      metadataJson: sourcePatientId ? { academy_case_id: sourceCaseId } : undefined,
    });

    const globalCase = await resolveOrCreateGlobalCase({
      tenantId: envelope.tenant_id,
      sourceSystem: envelope.source_system,
      sourceCaseId,
      globalPatientId: globalPatient?.id ?? null,
      metadataJson: {
        event_type: envelope.event_type,
        academy_case_id: sourceCaseId,
      },
    });

    const fiCase = await ensureFiCase(supabaseAdmin(), {
      tenantId: envelope.tenant_id,
      sourceSystem: envelope.source_system,
      sourceCaseId,
      metadata: {
        event_type: envelope.event_type,
        academy_case_id: sourceCaseId,
        ...(sourcePatientId ? { source_patient_id: sourcePatientId } : {}),
        ...(payload.patient_id ? { foundation_patient_id: payload.patient_id } : {}),
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

    const uploadType = mapIiohrViewToFiUploadType(payload);
    const upload = await ensureUploadRecord(supabaseAdmin(), {
      tenantId: envelope.tenant_id,
      caseId: fiCase.id,
      type: uploadType,
      filename: payload.original_filename,
      storagePath,
      mimeType: payload.mime_type,
      sizeBytes: payload.size_bytes,
    });

    await linkEventToEntities({
      tenantId: envelope.tenant_id,
      eventId: eventLog.row.id,
      globalCaseId: linkedGlobalCase.id,
      fiCaseId: fiCase.id,
      globalPatientId: globalPatient?.id ?? null,
    });

    await dualWriteFoundationFromFiEvent({
      tenantId: envelope.tenant_id,
      fiEventId: eventLog.row.id,
      envelope,
      resolution: {
        fiCaseId: fiCase.id,
        globalPatientId: globalPatient?.id ?? null,
        globalCaseId: linkedGlobalCase.id,
      },
    });

    await maybeDualWriteIiohrPatientImage({
      tenantId: envelope.tenant_id,
      fiEventId: eventLog.row.id,
      fiCaseId: fiCase.id,
      envelope,
      globalCaseId: linkedGlobalCase.id,
      storagePath,
      fiUploadId: upload.id,
    });

    const submitDecision = await maybeSubmitCaseFromEvent({
      tenantId: envelope.tenant_id,
      fiCaseId: fiCase.id,
      sourceSystem: envelope.source_system,
      eventType: envelope.event_type,
      reason: "iiohr_images_uploaded",
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
          reason: "iiohr_images_uploaded",
        })
      : undefined;

    await markFiEventStatus({
      tenantId: envelope.tenant_id,
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
        ? "mapped_image_submitted_and_triggered"
        : submitDecision.submitted
          ? "mapped_image_and_submitted"
          : upload.created
            ? "mapped_image_only"
            : "reused_image_only",
      submitDecision,
      triggerDecision,
      message: triggerDecision?.triggered
        ? "IIOHR academy image ingested and FI pipeline triggered."
        : submitDecision.submitted
          ? "IIOHR academy image ingested and FI case submitted."
          : "IIOHR academy image ingested and FI readiness evaluated.",
    };
  } catch (e: unknown) {
    await attachFiEventError({
      tenantId: envelope.tenant_id,
      eventId: eventLog.row.id,
      errorText: e instanceof Error ? e.message : "Unexpected error.",
    });
    throw e;
  }
}

export async function handleIiohrImagesUploaded(input: {
  envelope: FiEventEnvelope;
}): Promise<IiohrImagesUploadedResult>;
export async function handleIiohrImagesUploaded(
  _supabase: SupabaseClient,
  envelope: FiEventEnvelope
): Promise<IiohrImagesUploadedResult>;
export async function handleIiohrImagesUploaded(
  inputOrSupabase: HandlerInput | SupabaseClient,
  legacyEnvelope?: FiEventEnvelope
): Promise<IiohrImagesUploadedResult> {
  const envelope = "envelope" in inputOrSupabase ? inputOrSupabase.envelope : legacyEnvelope;

  if (!envelope) {
    throw new Error("Missing envelope for handleIiohrImagesUploaded.");
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
      payloadResult.ok && linked.fiCaseId && "academy_case_id" in payloadResult.data
        ? await loadLinkedUploadId(
            linked.fiCaseId,
            resolveIiohrImageStoragePath(payloadResult.data) ?? ""
          )
        : undefined;

    await dualWriteFoundationFromFiEvent({
      tenantId: envelope.tenant_id,
      fiEventId: existing.id,
      envelope,
      resolution: {
        fiCaseId: linked.fiCaseId,
        globalPatientId: linked.globalPatientId ?? null,
        globalCaseId: linked.globalCaseId,
      },
    });

    if (linked.fiCaseId && payloadResult.ok && "academy_case_id" in payloadResult.data) {
      const storagePath = resolveIiohrImageStoragePath(payloadResult.data);
      await maybeDualWriteIiohrPatientImage({
        tenantId: envelope.tenant_id,
        fiEventId: existing.id,
        fiCaseId: linked.fiCaseId,
        envelope,
        globalCaseId: linked.globalCaseId,
        storagePath,
        fiUploadId: uploadId,
      });
    }

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

  return handleIiohrImagesUploadedImpl(envelope);
}