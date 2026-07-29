import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildPatientImageStoragePath } from "@/src/lib/patientImages/patientImagePaths";
import {
  PATIENT_IMAGES_BUCKET_DEFAULT,
} from "@/src/lib/patientImages/patientImagePolicy";
import {
  registerPreuploadedPatientImageRecord,
} from "@/src/lib/patientImages/patientImagesServer";
import type { PatientImageRow } from "@/src/lib/patientImages/patientImageTypes";
import { assertPatientTrialConsentRecorded } from "@/src/lib/patients/patientConsentGate.server";
import { isPatientPortalImagingEnabled } from "@/src/lib/patientPortal/patientPortalImagingEnabled";

import { writePatientGatewayAudit } from "./patientGatewayAudit.server";
import { patientGatewayDeny } from "./patientGatewayGateCore";
import {
  mapPatientGatewayImageSlot,
  parsePatientGatewayImageSlot,
} from "./patientGatewayImageSlots";
import {
  extensionForMimeType,
  mapPatientImageRowToGatewayListItem,
  validatePatientGatewayUploadIntentInput,
  type PatientGatewayImageListItem,
} from "./patientGatewayImagesCore";
import { assertOwnedImageRow } from "./patientGatewayOwnershipCore";
import type { PatientGatewayContext, PatientGatewayDeny } from "./patientGatewayTypes";
import {
  PATIENT_GATEWAY_SIGNED_READ_TTL_SEC,
  assertStoragePathMatchesIntent,
  assertUploadIntentOwnedByContext,
  resolvePatientGatewayUploadIntentSecret,
  signPatientGatewayUploadIntent,
  verifyPatientGatewayUploadIntent,
} from "./patientGatewayUploadIntentCore";

function mapRow(data: Record<string, unknown>): PatientImageRow {
  // Lightweight mapping for list — reuse fields needed by DTO mapper.
  return {
    id: String(data.id),
    tenant_id: String(data.tenant_id),
    patient_id: String(data.patient_id),
    person_id: data.person_id != null ? String(data.person_id) : null,
    case_id: null,
    booking_id: null,
    lead_id: null,
    consultation_id: null,
    form_instance_id: null,
    image_category: String(data.image_category ?? "other") as PatientImageRow["image_category"],
    image_status: String(data.image_status ?? "active") as PatientImageRow["image_status"],
    patient_portal_release_status:
      String(data.patient_portal_release_status ?? "held") === "released" ? "released" : "held",
    portal_released_at: null,
    portal_released_by_fi_user_id: null,
    imaging_library_axis: String(
      data.imaging_library_axis ?? "general_clinical"
    ) as PatientImageRow["imaging_library_axis"],
    clinic_id: null,
    captured_by_staff_id: null,
    device_type: null,
    anatomical_region: null,
    visit_type: data.visit_type != null ? String(data.visit_type) : null,
    follow_up_interval: null,
    imaging_protocol_template_slug:
      data.imaging_protocol_template_slug != null
        ? String(data.imaging_protocol_template_slug)
        : null,
    imaging_protocol_slot_slug:
      data.imaging_protocol_slot_slug != null ? String(data.imaging_protocol_slot_slug) : null,
    storage_bucket: String(data.storage_bucket ?? PATIENT_IMAGES_BUCKET_DEFAULT),
    storage_path: String(data.storage_path ?? ""),
    original_filename: null,
    content_type: null,
    file_size_bytes: null,
    caption: null,
    taken_at: data.taken_at != null ? String(data.taken_at) : null,
    metadata: {},
    uploaded_by_user_id: null,
    archived_at: null,
    archived_by_user_id: null,
    archive_reason: null,
    created_at: String(data.created_at ?? new Date().toISOString()),
    updated_at: String(data.updated_at ?? new Date().toISOString()),
    ai_image_category: null,
    ai_image_category_confidence: null,
    ai_hair_state: null,
    ai_shave_state: null,
    ai_surgery_stage: null,
    ai_image_ai_notes: null,
    ai_image_review_status: "unreviewed",
    ai_image_reviewed_by_staff_id: null,
    ai_image_reviewed_at: null,
    ai_image_classified_at: null,
    ai_image_classifier_version: null,
  };
}

async function createSignedReadUrl(
  bucket: string,
  path: string,
  client: SupabaseClient
): Promise<{ url: string; expiresAtIso: string } | null> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, PATIENT_GATEWAY_SIGNED_READ_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return {
    url: data.signedUrl,
    expiresAtIso: new Date(Date.now() + PATIENT_GATEWAY_SIGNED_READ_TTL_SEC * 1000).toISOString(),
  };
}

export async function listPatientGatewayImages(
  ctx: PatientGatewayContext,
  options?: { limit?: number; supabase?: SupabaseClient; writeAudit?: boolean }
): Promise<{ ok: true; images: PatientGatewayImageListItem[] } | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  if (!isPatientPortalImagingEnabled()) {
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "images_list_denied",
        outcome: "deny",
        code: "imaging_disabled",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "image",
      });
    }
    return patientGatewayDeny("imaging_disabled", 403, "Patient imaging is not enabled.");
  }

  const supabase = options?.supabase ?? supabaseAdmin();
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 100);

  const { data, error } = await supabase
    .from("fi_patient_images")
    .select(
      "id, tenant_id, patient_id, image_category, image_status, patient_portal_release_status, imaging_protocol_slot_slug, imaging_library_axis, storage_bucket, storage_path, taken_at, created_at, updated_at, visit_type, imaging_protocol_template_slug"
    )
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .eq("image_status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "images_list_denied",
        outcome: "deny",
        code: "misconfigured",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "image",
      });
    }
    return patientGatewayDeny("misconfigured", 500, "Could not load images.");
  }

  const images: PatientGatewayImageListItem[] = [];
  for (const raw of data ?? []) {
    const row = mapRow(raw as Record<string, unknown>);
    const ownership = assertOwnedImageRow(ctx, {
      tenant_id: row.tenant_id,
      patient_id: row.patient_id,
    });
    if (ownership) {
      if (writeAudit) {
        writePatientGatewayAudit({
          action: "ownership_denied",
          outcome: "deny",
          code: "ownership_denied",
          authUserId: ctx.authUserId,
          patientId: ctx.patientId,
          tenantId: ctx.tenantId,
          resourceKind: "image",
          resourceId: row.id,
        });
      }
      return ownership;
    }
    const signed = await createSignedReadUrl(row.storage_bucket, row.storage_path, supabase);
    images.push(mapPatientImageRowToGatewayListItem(row, signed));
  }

  if (writeAudit) {
    writePatientGatewayAudit({
      action: "images_list_success",
      outcome: "allow",
      authUserId: ctx.authUserId,
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      resourceKind: "image",
    });
  }

  return { ok: true, images };
}

export type PatientGatewayUploadIntentResponse = {
  ok: true;
  intentToken: string;
  uploadUrl: string;
  uploadToken: string | null;
  expiresAt: string;
  imageId: string;
  headers: Record<string, string>;
};

export async function createPatientGatewayUploadIntent(
  ctx: PatientGatewayContext,
  body: { category?: unknown; mimeType?: unknown; fileSize?: unknown },
  options?: { supabase?: SupabaseClient; writeAudit?: boolean; nowMs?: number }
): Promise<PatientGatewayUploadIntentResponse | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  const deny = (d: PatientGatewayDeny): PatientGatewayDeny => {
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "upload_intent_denied",
        outcome: "deny",
        code: d.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "image",
      });
    }
    return d;
  };

  if (!isPatientPortalImagingEnabled()) {
    return deny(patientGatewayDeny("imaging_disabled", 403, "Patient imaging is not enabled."));
  }

  const validated = validatePatientGatewayUploadIntentInput({
    category: body.category,
    mimeType: body.mimeType,
    fileSize: body.fileSize,
  });
  if (!validated.ok) {
    return deny(patientGatewayDeny(validated.code, 400, validated.message));
  }

  try {
    await assertPatientTrialConsentRecorded(ctx.tenantId, ctx.patientId);
  } catch {
    return deny(
      patientGatewayDeny(
        "consent_required",
        403,
        "Record patient photography and treatment consent before continuing."
      )
    );
  }

  const secret = resolvePatientGatewayUploadIntentSecret();
  if (!secret) {
    return deny(
      patientGatewayDeny("misconfigured", 500, "Upload intent signing is not configured.")
    );
  }

  const supabase = options?.supabase ?? supabaseAdmin();
  const imageId = randomUUID();
  const intentId = randomUUID();
  const ext = extensionForMimeType(validated.mimeType);
  const safeFilename = `gateway-upload.${ext}`;
  const storagePath = buildPatientImageStoragePath({
    tenantId: ctx.tenantId,
    patientId: ctx.patientId,
    imageId,
    safeFilename,
  });
  const bucket = validated.bucket;

  const { data: signedUpload, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(storagePath);

  if (signErr || !signedUpload?.signedUrl) {
    return deny(
      patientGatewayDeny("misconfigured", 500, "Could not create signed upload capability.")
    );
  }

  const nowMs = options?.nowMs ?? Date.now();
  const intentToken = signPatientGatewayUploadIntent(
    {
      intentId,
      imageId,
      tenantId: ctx.tenantId,
      patientId: ctx.patientId,
      authUserId: ctx.authUserId,
      slot: validated.slot,
      mimeType: validated.mimeType,
      fileSize: validated.fileSize,
      bucket,
      storagePath,
    },
    secret,
    nowMs
  );

  const payload = verifyPatientGatewayUploadIntent(intentToken, secret, nowMs);
  if (!payload.ok) {
    return deny(patientGatewayDeny("misconfigured", 500, "Could not sign upload intent."));
  }

  if (writeAudit) {
    writePatientGatewayAudit({
      action: "upload_intent_created",
      outcome: "allow",
      authUserId: ctx.authUserId,
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      resourceKind: "image",
      resourceId: imageId,
    });
  }

  return {
    ok: true,
    intentToken,
    uploadUrl: signedUpload.signedUrl,
    uploadToken: signedUpload.token ?? null,
    expiresAt: new Date(payload.payload.exp).toISOString(),
    imageId,
    headers: {
      "Content-Type": validated.mimeType,
    },
  };
}

export type PatientGatewayUploadCompleteResponse = {
  ok: true;
  imageId: string;
  status: "held";
};

export async function completePatientGatewayUpload(
  ctx: PatientGatewayContext,
  body: { intentToken?: unknown; storagePath?: unknown },
  options?: { supabase?: SupabaseClient; writeAudit?: boolean; nowMs?: number }
): Promise<PatientGatewayUploadCompleteResponse | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  const deny = (
    d: PatientGatewayDeny,
    action: "upload_completion_denied" | "upload_replay_denied" | "ownership_denied" = "upload_completion_denied"
  ): PatientGatewayDeny => {
    if (writeAudit) {
      writePatientGatewayAudit({
        action,
        outcome: "deny",
        code: d.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "image",
      });
    }
    return d;
  };

  if (!isPatientPortalImagingEnabled()) {
    return deny(patientGatewayDeny("imaging_disabled", 403, "Patient imaging is not enabled."));
  }

  const secret = resolvePatientGatewayUploadIntentSecret();
  if (!secret) {
    return deny(
      patientGatewayDeny("misconfigured", 500, "Upload intent signing is not configured.")
    );
  }

  const token = String(body.intentToken ?? "").trim();
  if (!token) {
    return deny(patientGatewayDeny("intent_invalid", 400, "Upload intent token is required."));
  }

  const verified = verifyPatientGatewayUploadIntent(token, secret, options?.nowMs ?? Date.now());
  if (!verified.ok) {
    if (verified.reason === "expired") {
      return deny(patientGatewayDeny("intent_expired", 403, "Upload intent has expired."));
    }
    return deny(patientGatewayDeny("intent_invalid", 403, "Upload intent is invalid."));
  }

  const intent = verified.payload;
  const ownership = assertUploadIntentOwnedByContext(intent, ctx);
  if (ownership === "wrong_tenant") {
    return deny(patientGatewayDeny("wrong_tenant", 403, "Not authorized for this clinic."));
  }
  if (ownership === "ownership") {
    return deny(
      patientGatewayDeny("ownership_denied", 403, "Upload intent does not belong to this patient."),
      "ownership_denied"
    );
  }

  const claimedPath =
    body.storagePath == null || body.storagePath === ""
      ? null
      : String(body.storagePath);
  if (!assertStoragePathMatchesIntent(intent, claimedPath)) {
    return deny(
      patientGatewayDeny("path_mismatch", 403, "Storage path does not match the issued intent.")
    );
  }

  // Client must never select an arbitrary path — ignore empty, reject mismatch above.
  if (claimedPath && claimedPath !== intent.storagePath) {
    return deny(patientGatewayDeny("path_mismatch", 403, "Storage path tampering detected."));
  }

  const supabase = options?.supabase ?? supabaseAdmin();

  const { data: existingById } = await supabase
    .from("fi_patient_images")
    .select("id, tenant_id, patient_id, storage_path")
    .eq("tenant_id", ctx.tenantId)
    .eq("id", intent.imageId)
    .maybeSingle();

  if (existingById) {
    return deny(
      patientGatewayDeny("intent_replay", 409, "Upload intent has already been completed."),
      "upload_replay_denied"
    );
  }

  const { data: existingByPath } = await supabase
    .from("fi_patient_images")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("storage_path", intent.storagePath)
    .maybeSingle();
  if (existingByPath) {
    return deny(
      patientGatewayDeny("intent_replay", 409, "Upload has already been registered."),
      "upload_replay_denied"
    );
  }

  const { data: probe, error: probeErr } = await supabase.storage
    .from(intent.bucket)
    .createSignedUrl(intent.storagePath, 60);
  if (probeErr || !probe?.signedUrl) {
    return deny(
      patientGatewayDeny("storage_missing", 409, "Uploaded object was not found in storage.")
    );
  }

  const slot = parsePatientGatewayImageSlot(intent.slot);
  if (!slot) {
    return deny(patientGatewayDeny("invalid_category", 403, "Upload intent category is invalid."));
  }
  const mapping = mapPatientGatewayImageSlot(slot);

  try {
    const registered = await registerPreuploadedPatientImageRecord(
      {
        tenantId: ctx.tenantId,
        patientId: ctx.patientId,
        imageId: intent.imageId,
        storageBucket: intent.bucket,
        storagePath: intent.storagePath,
        contentType: intent.mimeType,
        fileSizeBytes: intent.fileSize,
        originalFilename: `gateway-upload.${extensionForMimeType(intent.mimeType)}`,
        imageCategory: mapping.imageCategory,
        imagingLibraryAxis: mapping.imagingLibraryAxis,
        anatomicalRegion: mapping.anatomicalRegion,
        visitType: mapping.visitType,
        imagingProtocolTemplateSlug: mapping.protocolTemplateSlug,
        imagingProtocolSlotSlug: mapping.protocolSlotSlug,
        captureSource: mapping.captureSource,
        // Patient auth users are not fi_users rows; uploaded_by_user_id FKs fi_users.
        actingUserId: null,
        metadata: {
          patient_portal: true,
          patient_gateway_v1: true,
          capture_source: mapping.captureSource,
          upload_intent_id: intent.intentId,
          protocol_slot_slug: mapping.protocolSlotSlug,
          actor_auth_user_id: ctx.authUserId,
        },
      },
      supabase
    );

    if (writeAudit) {
      writePatientGatewayAudit({
        action: "upload_completed",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "image",
        resourceId: registered.row.id,
      });
    }

    return { ok: true, imageId: registered.row.id, status: "held" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not register upload.";
    console.error("[patient_gateway_images] complete failed", {
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      authUserId: ctx.authUserId,
      imageId: intent.imageId,
      message: msg,
    });
    if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("storage")) {
      return deny(patientGatewayDeny("storage_missing", 409, msg));
    }
    return deny(patientGatewayDeny("misconfigured", 500, "Could not complete upload."));
  }
}
