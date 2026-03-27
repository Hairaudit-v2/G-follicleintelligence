import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeFiUploadType, type FiUploadType } from "@/lib/fi/uploadTypes";
import type { FiEventEnvelope, HairAuditImagesUploadedPayload } from "@/src/types/fi-events";
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

export type HairAuditImagesUploadedResult = {
  ok: boolean;
  eventId?: string;
  fiCaseId?: string;
  globalCaseId?: string;
  globalPatientId?: string | null;
  uploadIds?: string[];
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

async function loadLinkedUploadIds(
  fiCaseId: string,
  storagePaths: string[]
): Promise<string[]> {
  if (storagePaths.length === 0) return [];

  const { data } = await supabaseAdmin()
    .from("fi_uploads")
    .select("id, storage_path")
    .eq("case_id", fiCaseId)
    .in("storage_path", storagePaths);

  return (data ?? []).map((row) => row.id);
}

function mapHairAuditImageTypeToFiUploadType(type: string): FiUploadType {
  const normalized = String(type ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  const legacyAliases: Record<string, FiUploadType> = {
    frontal: "scalp_preop_front",
    front_view: "scalp_preop_front",
    preop_front: "scalp_preop_front",
    hairline: "scalp_preop_front",
    left_side: "scalp_sides_left",
    side_left: "scalp_sides_left",
    temporal_left: "scalp_sides_left",
    right_side: "scalp_sides_right",
    side_right: "scalp_sides_right",
    temporal_right: "scalp_sides_right",
    vertex: "scalp_crown",
    top: "scalp_crown",
    crown_view: "scalp_crown",
    rear: "donor_rear",
    back: "donor_rear",
    donor_back: "donor_rear",
    occipital: "donor_rear",
    post_op: "postop_day0",
    immediate_postop: "postop_day0",
    immediate_post_op: "postop_day0",
  };

  return legacyAliases[normalized] ?? normalizeFiUploadType(normalized);
}

async function handleHairAuditImagesUploadedImpl(
  envelope: FiEventEnvelope
): Promise<HairAuditImagesUploadedResult> {
  if (envelope.event_type !== "hairaudit.images.uploaded") {
    throw new Error("handleHairAuditImagesUploaded only supports hairaudit.images.uploaded.");
  }

  const payloadResult = parseFiEventPayload(envelope.event_type, envelope.payload);
  if (!payloadResult.ok) {
    throw new Error(payloadResult.error);
  }

  const sourceCaseId = envelope.identifiers?.source_case_id?.trim();
  if (!sourceCaseId) {
    throw new Error("identifiers.source_case_id is required for hairaudit.images.uploaded.");
  }

  const sourcePatientId = envelope.identifiers?.source_patient_id?.trim() || null;
  const payload = payloadResult.data as HairAuditImagesUploadedPayload;
  const storagePaths = payload.images.map((image) => image.storage_path);

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
    const uploadIds = linked.fiCaseId
      ? await loadLinkedUploadIds(linked.fiCaseId, storagePaths)
      : [];
    return {
      ok: true,
      eventId: eventLog.row.id,
      fiCaseId: linked.fiCaseId,
      globalCaseId: linked.globalCaseId,
      globalPatientId: linked.globalPatientId ?? null,
      uploadIds,
      actionTaken: "already_processed",
      message: "Event already processed.",
    };
  }

  if (!eventLog.created && eventLog.row.status === "processing") {
    const linked = await loadLinkedEntities(eventLog.row.id);
    const uploadIds = linked.fiCaseId
      ? await loadLinkedUploadIds(linked.fiCaseId, storagePaths)
      : [];
    return {
      ok: true,
      eventId: eventLog.row.id,
      fiCaseId: linked.fiCaseId,
      globalCaseId: linked.globalCaseId,
      globalPatientId: linked.globalPatientId ?? null,
      uploadIds,
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
      metadataJson: sourcePatientId ? { image_count: payload.images.length } : undefined,
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

    const uploads = [];
    for (const image of payload.images) {
      const upload = await ensureUploadRecord(supabaseAdmin(), {
        tenantId: envelope.tenant_id,
        caseId: fiCase.id,
        type: mapHairAuditImageTypeToFiUploadType(image.type),
        filename: image.filename,
        storagePath: image.storage_path,
        mimeType: image.mime_type,
        sizeBytes: image.size_bytes,
      });
      uploads.push(upload);
    }

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
      reason: "hairaudit_images_uploaded",
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
          reason: "hairaudit_images_uploaded",
        })
      : undefined;

    await markFiEventStatus({
      eventId: eventLog.row.id,
      status: "processed",
    });

    const createdCount = uploads.filter((upload) => upload.created).length;

    return {
      ok: true,
      eventId: eventLog.row.id,
      fiCaseId: fiCase.id,
      globalCaseId: linkedGlobalCase.id,
      globalPatientId: globalPatient?.id ?? null,
      uploadIds: uploads.map((upload) => upload.id),
      actionTaken: triggerDecision?.triggered
        ? "mapped_images_submitted_and_triggered"
        : submitDecision.submitted
          ? "mapped_images_and_submitted"
          : createdCount > 0
            ? "mapped_images_only"
            : "reused_images_only",
      submitDecision,
      triggerDecision,
      message: triggerDecision?.triggered
        ? "HairAudit images ingested and FI pipeline triggered."
        : submitDecision.submitted
          ? "HairAudit images ingested and FI case submitted."
          : "HairAudit images ingested and FI readiness evaluated.",
    };
  } catch (e: unknown) {
    await attachFiEventError({
      eventId: eventLog.row.id,
      errorText: e instanceof Error ? e.message : "Unexpected error.",
    });
    throw e;
  }
}

export async function handleHairAuditImagesUploaded(
  input: HandlerInput
): Promise<HairAuditImagesUploadedResult>;
export async function handleHairAuditImagesUploaded(
  _supabase: SupabaseClient,
  envelope: FiEventEnvelope
): Promise<HairAuditImagesUploadedResult>;
export async function handleHairAuditImagesUploaded(
  inputOrSupabase: HandlerInput | SupabaseClient,
  legacyEnvelope?: FiEventEnvelope
): Promise<HairAuditImagesUploadedResult> {
  const envelope =
    "envelope" in inputOrSupabase ? inputOrSupabase.envelope : legacyEnvelope;

  if (!envelope) {
    throw new Error("Missing envelope for handleHairAuditImagesUploaded.");
  }

  const existing = await getExistingFiEventBySourceKey({
    tenantId: envelope.tenant_id,
    sourceSystem: envelope.source_system,
    sourceEventId: envelope.source_event_id,
  });

  if (existing && ["processed", "ignored"].includes(existing.status)) {
    const linked = await loadLinkedEntities(existing.id);
    const payloadResult = parseFiEventPayload(envelope.event_type, envelope.payload);
    const uploadIds =
      payloadResult.ok && linked.fiCaseId && "images" in payloadResult.data
        ? await loadLinkedUploadIds(
            linked.fiCaseId,
            payloadResult.data.images.map((image) => image.storage_path)
          )
        : [];

    return {
      ok: true,
      eventId: existing.id,
      fiCaseId: linked.fiCaseId,
      globalCaseId: linked.globalCaseId,
      globalPatientId: linked.globalPatientId ?? null,
      uploadIds,
      actionTaken: "already_processed",
      message: "Event already processed.",
    };
  }

  return handleHairAuditImagesUploadedImpl(envelope);
}
