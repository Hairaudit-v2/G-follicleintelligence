import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  patientImageArchiveChangedKeys,
  patientImageDetailChangedKeys,
  type PatientImageEditableSnapshot,
} from "./patientImageChangedFields";
import type { PatientImagePatchBody } from "./patientImageApiSchemas";
import {
  normalizeFiAiHairState,
  normalizeFiAiImageCategory,
  normalizeFiAiImageReviewStatus,
  normalizeFiAiShaveState,
  normalizeFiAiSurgeryStage,
} from "@/src/lib/hair-intelligence/imageClassification/enumValidation";
import {
  assertAllowedPatientImageContentType,
  assertArchiveReasonLength,
  assertCaptionLength,
  assertPatientImageEditableStatus,
  assertPatientImageMetadataObject,
  normalizeImagingAnatomicalRegion,
  normalizeImagingLibraryAxis,
  normalizePatientImageCategory,
  PATIENT_IMAGES_BUCKET_DEFAULT,
} from "./patientImagePolicy";
import { buildPatientImageStoragePath, buildSafePatientImageFilename } from "./patientImagePaths";
import type {
  PatientImageProfileTile,
  PatientImageRow,
  PatientImageSignedDescriptor,
  PatientImageStatus,
  PatientImagesProfileBundle,
  CreatePatientImageUploadInput,
} from "./patientImageTypes";
import { publishPatientEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";
import { runPatientImagePostCapturePipeline } from "./patientImagePostCapturePipeline.server";
import type { PatientImagePostCaptureResult } from "./fiImageAttributionTypes";

const SIGNED_URL_TTL_SEC = 3600;
const ACTIVE_SIGNED_LIMIT = 50;
const ARCHIVED_LIST_LIMIT = 200;

export function mapRow(data: Record<string, unknown>): PatientImageRow {
  const meta = data.metadata;
  return {
    id: String(data.id),
    tenant_id: String(data.tenant_id),
    patient_id: String(data.patient_id),
    person_id: data.person_id != null ? String(data.person_id) : null,
    case_id: data.case_id != null ? String(data.case_id) : null,
    booking_id: data.booking_id != null ? String(data.booking_id) : null,
    lead_id: data.lead_id != null ? String(data.lead_id) : null,
    consultation_id: data.consultation_id != null ? String(data.consultation_id) : null,
    form_instance_id: data.form_instance_id != null ? String(data.form_instance_id) : null,
    image_category: normalizePatientImageCategory(data.image_category),
    image_status: (data.image_status === "archived" ? "archived" : "active") as PatientImageStatus,
    imaging_library_axis: normalizeImagingLibraryAxis(data.imaging_library_axis),
    clinic_id: data.clinic_id != null ? String(data.clinic_id) : null,
    captured_by_staff_id: data.captured_by_staff_id != null ? String(data.captured_by_staff_id) : null,
    device_type: data.device_type != null ? String(data.device_type) : null,
    anatomical_region: normalizeImagingAnatomicalRegion(data.anatomical_region),
    visit_type: data.visit_type != null ? String(data.visit_type) : null,
    follow_up_interval: data.follow_up_interval != null ? String(data.follow_up_interval) : null,
    imaging_protocol_template_slug:
      data.imaging_protocol_template_slug != null ? String(data.imaging_protocol_template_slug) : null,
    imaging_protocol_slot_slug:
      data.imaging_protocol_slot_slug != null ? String(data.imaging_protocol_slot_slug) : null,
    storage_bucket: String(data.storage_bucket ?? PATIENT_IMAGES_BUCKET_DEFAULT),
    storage_path: String(data.storage_path),
    original_filename: data.original_filename != null ? String(data.original_filename) : null,
    content_type: data.content_type != null ? String(data.content_type) : null,
    file_size_bytes:
      data.file_size_bytes != null && data.file_size_bytes !== ""
        ? Number(data.file_size_bytes)
        : null,
    caption: data.caption != null ? String(data.caption) : null,
    taken_at: data.taken_at != null ? String(data.taken_at) : null,
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {},
    uploaded_by_user_id: data.uploaded_by_user_id != null ? String(data.uploaded_by_user_id) : null,
    archived_at: data.archived_at != null ? String(data.archived_at) : null,
    archived_by_user_id: data.archived_by_user_id != null ? String(data.archived_by_user_id) : null,
    archive_reason: data.archive_reason != null ? String(data.archive_reason) : null,
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
    ai_image_category:
      data.ai_image_category != null && String(data.ai_image_category).trim()
        ? normalizeFiAiImageCategory(data.ai_image_category)
        : null,
    ai_image_category_confidence:
      data.ai_image_category_confidence != null && data.ai_image_category_confidence !== ""
        ? Number(data.ai_image_category_confidence)
        : null,
    ai_hair_state:
      data.ai_hair_state != null && String(data.ai_hair_state).trim() ? normalizeFiAiHairState(data.ai_hair_state) : null,
    ai_shave_state:
      data.ai_shave_state != null && String(data.ai_shave_state).trim()
        ? normalizeFiAiShaveState(data.ai_shave_state)
        : null,
    ai_surgery_stage:
      data.ai_surgery_stage != null && String(data.ai_surgery_stage).trim()
        ? normalizeFiAiSurgeryStage(data.ai_surgery_stage)
        : null,
    ai_image_ai_notes: data.ai_image_ai_notes != null ? String(data.ai_image_ai_notes) : null,
    ai_image_review_status: normalizeFiAiImageReviewStatus(data.ai_image_review_status ?? "pending"),
    ai_image_reviewed_by_staff_id:
      data.ai_image_reviewed_by_staff_id != null ? String(data.ai_image_reviewed_by_staff_id) : null,
    ai_image_reviewed_at: data.ai_image_reviewed_at != null ? String(data.ai_image_reviewed_at) : null,
    ai_image_classified_at: data.ai_image_classified_at != null ? String(data.ai_image_classified_at) : null,
    ai_image_classifier_version:
      data.ai_image_classifier_version != null ? String(data.ai_image_classifier_version) : null,
  };
}

async function assertPatientInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<{ person_id: string }> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, tenant_id, person_id")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || String((data as { tenant_id: string }).tenant_id) !== tid || String((data as { id: string }).id) !== pid) {
    throw new Error("Patient not found for tenant.");
  }
  return { person_id: String((data as { person_id: string }).person_id) };
}

function parseUuidOpt(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(s)) throw new Error("Invalid UUID for optional link.");
  return s;
}

async function assertOptionalCaseForPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  caseId: string | null
): Promise<void> {
  if (!caseId) return;
  const { data, error } = await supabase
    .from("fi_cases")
    .select("id, tenant_id, foundation_patient_id")
    .eq("tenant_id", tenantId)
    .eq("id", caseId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || String((data as { foundation_patient_id: string | null }).foundation_patient_id) !== patientId) {
    throw new Error("Case not found for this patient.");
  }
}

async function assertOptionalBookingForPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  bookingId: string | null
): Promise<void> {
  if (!bookingId) return;
  const { data, error } = await supabase
    .from("fi_bookings")
    .select("id, tenant_id, patient_id")
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || String((data as { patient_id: string | null }).patient_id ?? "") !== patientId) {
    throw new Error("Booking not found for this patient.");
  }
}

async function assertOptionalLeadForPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  leadId: string | null
): Promise<void> {
  if (!leadId) return;
  const { data, error } = await supabase
    .from("fi_crm_leads")
    .select("id, tenant_id, patient_id")
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || String((data as { patient_id: string | null }).patient_id ?? "") !== patientId) {
    throw new Error("Lead not found for this patient.");
  }
}

async function assertOptionalConsultationForPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  consultationId: string | null
): Promise<void> {
  if (!consultationId) return;
  const { data, error } = await supabase
    .from("fi_consultations")
    .select("id, tenant_id, patient_id")
    .eq("tenant_id", tenantId)
    .eq("id", consultationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || String((data as { patient_id: string | null }).patient_id ?? "") !== patientId) {
    throw new Error("Consultation not found for this patient.");
  }
}

async function assertOptionalClinicForTenant(supabase: SupabaseClient, tenantId: string, clinicId: string | null): Promise<void> {
  if (!clinicId) return;
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("id", clinicId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Clinic not found for tenant.");
}

async function assertOptionalStaffForTenant(supabase: SupabaseClient, tenantId: string, staffId: string | null): Promise<void> {
  if (!staffId) return;
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("id", staffId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Staff member not found for tenant.");
}

function normalizeBoundedOptText(raw: string | null | undefined, max: number, label: string): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.length > max) throw new Error(`${label} must be at most ${max} characters.`);
  return s;
}

function normalizeTakenAt(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) throw new Error("Invalid taken_at timestamp.");
  return new Date(ms).toISOString();
}

export async function loadPatientImages(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientImageRow[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const { data, error } = await supabase
    .from("fi_patient_images")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("created_at", { ascending: false });
  if (error) {
    if (error.message?.includes("does not exist") || error.message?.includes("schema cache")) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function loadPatientImageForPatient(
  tenantId: string,
  patientId: string,
  imageId: string,
  client?: SupabaseClient
): Promise<PatientImageRow | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const iid = imageId.trim();
  const { data, error } = await supabase
    .from("fi_patient_images")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", iid)
    .maybeSingle();
  if (error) {
    if (error.message?.includes("does not exist") || error.message?.includes("schema cache")) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

function isMissingStorageObjectError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("object not found") ||
    m.includes("resource was not found") ||
    m.includes("the specified key does not exist")
  );
}

export async function createPatientImageSignedUrl(
  row: Pick<PatientImageRow, "id" | "storage_bucket" | "storage_path">,
  client?: SupabaseClient
): Promise<PatientImageSignedDescriptor | null> {
  const supabase = client ?? supabaseAdmin();
  const bucket = row.storage_bucket?.trim() || PATIENT_IMAGES_BUCKET_DEFAULT;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(row.storage_path, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) {
    if (isMissingStorageObjectError(error?.message)) return null;
    throw new Error(error?.message ?? "Could not create signed URL.");
  }
  const expiresAtIso = new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000).toISOString();
  return { imageId: row.id, url: data.signedUrl, expiresAtIso };
}

export async function createPatientImageSignedUrls(
  rows: readonly Pick<PatientImageRow, "id" | "storage_bucket" | "storage_path">[],
  client?: SupabaseClient
): Promise<Map<string, PatientImageSignedDescriptor>> {
  const out = new Map<string, PatientImageSignedDescriptor>();
  for (const r of rows) {
    const signed = await createPatientImageSignedUrl(r, client);
    if (signed) out.set(r.id, signed);
  }
  return out;
}

export async function loadPatientImagesProfileBundle(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientImagesProfileBundle> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();

  const [{ count: totalCount, error: totalErr }, { count: activeCount, error: activeErr }, { count: archivedCount, error: archErr }] =
    await Promise.all([
      supabase.from("fi_patient_images").select("*", { head: true, count: "exact" }).eq("tenant_id", tid).eq("patient_id", pid),
      supabase
        .from("fi_patient_images")
        .select("*", { head: true, count: "exact" })
        .eq("tenant_id", tid)
        .eq("patient_id", pid)
        .eq("image_status", "active"),
      supabase
        .from("fi_patient_images")
        .select("*", { head: true, count: "exact" })
        .eq("tenant_id", tid)
        .eq("patient_id", pid)
        .eq("image_status", "archived"),
    ]);

  const isMissingRel = (err: { message?: string } | null) =>
    Boolean(err?.message?.includes("does not exist") || err?.message?.includes("schema cache"));

  if (totalErr && !isMissingRel(totalErr)) throw new Error(totalErr.message);
  if (activeErr && !isMissingRel(activeErr)) throw new Error(activeErr.message);
  if (archErr && !isMissingRel(archErr)) throw new Error(archErr.message);

  if (isMissingRel(totalErr) || isMissingRel(activeErr) || isMissingRel(archErr)) {
    return {
      counts: { total: 0, active: 0, archived: 0 },
      activeWithSignedUrls: [],
      archived: [],
    };
  }

  const { data: activeRows, error: arErr } = await supabase
    .from("fi_patient_images")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("image_status", "active")
    .order("created_at", { ascending: false })
    .limit(ACTIVE_SIGNED_LIMIT);
  if (arErr) throw new Error(arErr.message);

  const { data: archivedRows, error: arrErr } = await supabase
    .from("fi_patient_images")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("image_status", "archived")
    .order("archived_at", { ascending: false })
    .limit(ARCHIVED_LIST_LIMIT);
  if (arrErr) throw new Error(arrErr.message);

  const activeMapped = (activeRows ?? []).map((r) => mapRow(r as Record<string, unknown>));
  const signedMap = await createPatientImageSignedUrls(
    activeMapped.map((m) => ({ id: m.id, storage_bucket: m.storage_bucket, storage_path: m.storage_path })),
    supabase
  );

  const activeWithSignedUrls: PatientImageProfileTile[] = activeMapped.flatMap((image) => {
    const signed = signedMap.get(image.id);
    if (!signed) return [];
    return [{ image, signed }];
  });

  return {
    counts: {
      total: totalCount ?? 0,
      active: activeCount ?? 0,
      archived: archivedCount ?? 0,
    },
    activeWithSignedUrls,
    archived: (archivedRows ?? []).map((r) => mapRow(r as Record<string, unknown>)),
  };
}

export type { CreatePatientImageUploadInput } from "./patientImageTypes";

export type CreatePatientImageRecordResult = {
  row: PatientImageRow;
  changed_keys: string[];
  attribution?: PatientImagePostCaptureResult;
};

export async function createPatientImageRecord(
  input: CreatePatientImageUploadInput,
  client?: SupabaseClient
): Promise<CreatePatientImageRecordResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const { person_id } = await assertPatientInTenant(supabase, tid, pid);

  const contentType = assertAllowedPatientImageContentType({
    name: input.file.name,
    type: input.file.type,
    size: input.file.size,
  });

  const caseId = parseUuidOpt(input.caseId);
  const bookingId = parseUuidOpt(input.bookingId);
  const leadId = parseUuidOpt(input.leadId);
  const consultationId = parseUuidOpt(input.consultationId);
  const clinicId = parseUuidOpt(input.clinicId);
  const capturedByStaffId = parseUuidOpt(input.capturedByStaffId);

  await assertOptionalCaseForPatient(supabase, tid, pid, caseId);
  await assertOptionalBookingForPatient(supabase, tid, pid, bookingId);
  await assertOptionalLeadForPatient(supabase, tid, pid, leadId);
  await assertOptionalConsultationForPatient(supabase, tid, pid, consultationId);
  await assertOptionalClinicForTenant(supabase, tid, clinicId);
  await assertOptionalStaffForTenant(supabase, tid, capturedByStaffId);

  const imageCategory = normalizePatientImageCategory(input.imageCategory);
  const imagingLibraryAxis = normalizeImagingLibraryAxis(input.imagingLibraryAxis);
  const anatomicalRegion = normalizeImagingAnatomicalRegion(input.anatomicalRegion);
  const deviceType = normalizeBoundedOptText(input.deviceType ?? null, 160, "device_type");
  const visitType = normalizeBoundedOptText(input.visitType ?? null, 160, "visit_type");
  const followUpInterval = normalizeBoundedOptText(input.followUpInterval ?? null, 64, "follow_up_interval");
  const imagingProtocolTemplateSlug = normalizeBoundedOptText(input.imagingProtocolTemplateSlug ?? null, 128, "protocol template");
  const imagingProtocolSlotSlug = normalizeBoundedOptText(input.imagingProtocolSlotSlug ?? null, 128, "protocol slot");
  const caption = assertCaptionLength(input.caption ?? null);
  const takenAt = normalizeTakenAt(input.takenAt ?? null);
  const metadata = assertPatientImageMetadataObject("metadata", input.metadata ?? {});

  const imageId = randomUUID();
  const safeName = buildSafePatientImageFilename(input.file.name);
  const storagePath = buildPatientImageStoragePath({
    tenantId: tid,
    patientId: pid,
    imageId,
    safeFilename: safeName,
  });
  const bucket = PATIENT_IMAGES_BUCKET_DEFAULT;

  const { error: uploadErr } = await supabase.storage.from(bucket).upload(storagePath, input.file, {
    contentType,
    upsert: false,
  });
  if (uploadErr) {
    throw new Error(`Storage upload failed: ${uploadErr.message}`);
  }

  const now = new Date().toISOString();
  const insert = {
    id: imageId,
    tenant_id: tid,
    patient_id: pid,
    person_id,
    case_id: caseId,
    booking_id: bookingId,
    lead_id: leadId,
    consultation_id: consultationId,
    image_category: imageCategory,
    image_status: "active" as const,
    imaging_library_axis: imagingLibraryAxis,
    clinic_id: clinicId,
    captured_by_staff_id: capturedByStaffId,
    device_type: deviceType,
    anatomical_region: anatomicalRegion,
    visit_type: visitType,
    follow_up_interval: followUpInterval,
    imaging_protocol_template_slug: imagingProtocolTemplateSlug,
    imaging_protocol_slot_slug: imagingProtocolSlotSlug,
    storage_bucket: bucket,
    storage_path: storagePath,
    original_filename: input.file.name || null,
    content_type: contentType,
    file_size_bytes: input.file.size,
    caption,
    taken_at: takenAt,
    metadata,
    uploaded_by_user_id: input.actingUserId ?? null,
    archived_at: null,
    archived_by_user_id: null,
    archive_reason: null,
    created_at: now,
    updated_at: now,
  };

  const { data: ins, error: insErr } = await supabase.from("fi_patient_images").insert(insert).select("*").single();
  if (insErr) {
    await supabase.storage.from(bucket).remove([storagePath]).catch(() => undefined);
    throw new Error(insErr.message);
  }

  const mappedRow = mapRow(ins as Record<string, unknown>);

  void publishPatientEvent({
    tenantId: input.tenantId.trim(),
    clinicId: mappedRow.clinic_id,
    eventType: "patient_images_uploaded",
    entityId: mappedRow.id,
    entityType: "image",
    eventMetadata: {
      patient_id: input.patientId.trim(),
      case_id: mappedRow.case_id,
      upload_count: 1,
      image_category: mappedRow.image_category,
    },
  });

  let attribution: PatientImagePostCaptureResult | undefined;
  let finalRow = mappedRow;

  try {
    const pipeline = await runPatientImagePostCapturePipeline(
      {
        ...input,
        imageId,
        safeFilename: safeName,
        contentType,
      },
      mappedRow,
      supabase
    );

    if (pipeline.quality_blocked) {
      await supabase.from("fi_patient_images").delete().eq("tenant_id", tid).eq("id", imageId);
      await supabase.storage.from(bucket).remove([storagePath]).catch(() => undefined);
      throw new Error(pipeline.quality.alert_message ?? "Image quality too low. Please retake photo.");
    }

    finalRow = mapRow(pipeline.updatedRow);
    attribution = {
      metadata_patch: pipeline.metadata_patch,
      quality: pipeline.quality,
      derivatives: pipeline.derivatives,
      classification: pipeline.classification,
      timeline_entry: pipeline.timeline_entry,
      watermark_applied: pipeline.watermark_applied,
      marketing_version_created: pipeline.marketing_version_created,
      quality_blocked: pipeline.quality_blocked,
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Image quality too low")) throw e;
    // Attribution pipeline is best-effort — preserve successful clinical upload.
  }

  return {
    row: finalRow,
    changed_keys: ["created"],
    ...(attribution ? { attribution } : {}),
  };
}

function editableSnapshotFromRow(row: PatientImageRow): PatientImageEditableSnapshot {
  return {
    image_category: row.image_category,
    caption: row.caption,
    taken_at: row.taken_at,
    metadata: row.metadata,
    imaging_library_axis: row.imaging_library_axis,
    clinic_id: row.clinic_id,
    captured_by_staff_id: row.captured_by_staff_id,
    device_type: row.device_type,
    anatomical_region: row.anatomical_region,
    visit_type: row.visit_type,
    follow_up_interval: row.follow_up_interval,
    imaging_protocol_template_slug: row.imaging_protocol_template_slug,
    imaging_protocol_slot_slug: row.imaging_protocol_slot_slug,
    consultation_id: row.consultation_id,
  };
}

export async function updatePatientImageDetails(
  params: {
    tenantId: string;
    patientId: string;
    imageId: string;
    patch: PatientImagePatchBody;
    request?: Request | null;
  },
  client?: SupabaseClient
): Promise<{ row: PatientImageRow; changed_keys: string[] }> {
  const supabase = client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const iid = params.imageId.trim();

  const existing = await loadPatientImageForPatient(tid, pid, iid, supabase);
  if (!existing) throw new Error("Image not found.");
  assertPatientImageEditableStatus(existing.image_status);

  const before = editableSnapshotFromRow(existing);
  const after: PatientImageEditableSnapshot = {
    image_category: params.patch.image_category !== undefined ? normalizePatientImageCategory(params.patch.image_category) : before.image_category,
    caption: params.patch.caption !== undefined ? assertCaptionLength(params.patch.caption) : before.caption,
    taken_at: params.patch.taken_at !== undefined ? normalizeTakenAt(params.patch.taken_at) : before.taken_at,
    metadata:
      params.patch.metadata !== undefined
        ? assertPatientImageMetadataObject("metadata", params.patch.metadata)
        : before.metadata,
    imaging_library_axis:
      params.patch.imaging_library_axis !== undefined
        ? normalizeImagingLibraryAxis(params.patch.imaging_library_axis)
        : before.imaging_library_axis,
    clinic_id: params.patch.clinic_id !== undefined ? parseUuidOpt(params.patch.clinic_id) : before.clinic_id,
    captured_by_staff_id:
      params.patch.captured_by_staff_id !== undefined ? parseUuidOpt(params.patch.captured_by_staff_id) : before.captured_by_staff_id,
    device_type: params.patch.device_type !== undefined ? normalizeBoundedOptText(params.patch.device_type, 160, "device_type") : before.device_type,
    anatomical_region:
      params.patch.anatomical_region !== undefined
        ? normalizeImagingAnatomicalRegion(params.patch.anatomical_region)
        : before.anatomical_region,
    visit_type: params.patch.visit_type !== undefined ? normalizeBoundedOptText(params.patch.visit_type, 160, "visit_type") : before.visit_type,
    follow_up_interval:
      params.patch.follow_up_interval !== undefined
        ? normalizeBoundedOptText(params.patch.follow_up_interval, 64, "follow_up_interval")
        : before.follow_up_interval,
    imaging_protocol_template_slug:
      params.patch.imaging_protocol_template_slug !== undefined
        ? normalizeBoundedOptText(params.patch.imaging_protocol_template_slug, 128, "protocol template")
        : before.imaging_protocol_template_slug,
    imaging_protocol_slot_slug:
      params.patch.imaging_protocol_slot_slug !== undefined
        ? normalizeBoundedOptText(params.patch.imaging_protocol_slot_slug, 128, "protocol slot")
        : before.imaging_protocol_slot_slug,
    consultation_id:
      params.patch.consultation_id !== undefined ? parseUuidOpt(params.patch.consultation_id) : before.consultation_id,
  };

  await assertOptionalConsultationForPatient(supabase, tid, pid, after.consultation_id);
  await assertOptionalClinicForTenant(supabase, tid, after.clinic_id);
  await assertOptionalStaffForTenant(supabase, tid, after.captured_by_staff_id);

  const changed_keys = patientImageDetailChangedKeys(before, after);
  if (changed_keys.length === 0) {
    return { row: existing, changed_keys: [] };
  }

  const upd = {
    image_category: after.image_category,
    caption: after.caption,
    taken_at: after.taken_at,
    metadata: after.metadata,
    imaging_library_axis: after.imaging_library_axis,
    clinic_id: after.clinic_id,
    captured_by_staff_id: after.captured_by_staff_id,
    device_type: after.device_type,
    anatomical_region: after.anatomical_region,
    visit_type: after.visit_type,
    follow_up_interval: after.follow_up_interval,
    imaging_protocol_template_slug: after.imaging_protocol_template_slug,
    imaging_protocol_slot_slug: after.imaging_protocol_slot_slug,
    consultation_id: after.consultation_id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("fi_patient_images")
    .update(upd)
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", iid)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { row: mapRow(data as Record<string, unknown>), changed_keys };
}

export async function archivePatientImage(
  params: {
    tenantId: string;
    patientId: string;
    imageId: string;
    archiveReason?: string | null;
    request?: Request | null;
  },
  client?: SupabaseClient
): Promise<{ row: PatientImageRow; changed_keys: string[] }> {
  const supabase = client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const iid = params.imageId.trim();

  const existing = await loadPatientImageForPatient(tid, pid, iid, supabase);
  if (!existing) throw new Error("Image not found.");
  if (existing.image_status === "archived") {
    return { row: existing, changed_keys: [] };
  }

  const actingUserId = await tryResolveFiUserIdForTenant(tid, params.request ?? null);
  const archiveReason = assertArchiveReasonLength(params.archiveReason ?? null);
  const archivedAt = new Date().toISOString();

  const upd = {
    image_status: "archived" as const,
    archived_at: archivedAt,
    archived_by_user_id: actingUserId,
    archive_reason: archiveReason,
    updated_at: archivedAt,
  };

  const { data, error } = await supabase
    .from("fi_patient_images")
    .update(upd)
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", iid)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return { row: mapRow(data as Record<string, unknown>), changed_keys: patientImageArchiveChangedKeys() };
}
