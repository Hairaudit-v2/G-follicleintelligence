import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveEffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { classifyFiPatientImageAndPersist } from "@/src/lib/hair-intelligence/imageClassification/adapters/fiOsPatientImageClassification.server";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";
import { publishImagingEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";
import { loadFiImageAttributionSettings } from "./fiImageAttributionSettings.server";
import {
  buildFiImageAiDatasetFields,
  buildFiImageMetadata,
  buildFiImageTimelineEntry,
  buildMarketingExportCaption,
  evaluateFiImageQuality,
  inferFiImageProcedureStage,
  mapToFiImageAttributionType,
  normalizeFiImageCaptureSource,
  normalizeFiImageCaptureType,
} from "./fiImageAttributionCore";
import type {
  FiImageDerivativeRef,
  FiImageMetadata,
  PatientImagePostCaptureResult,
} from "./fiImageAttributionTypes";
import { buildPatientImageDerivativeStoragePath } from "./patientImagePaths";
import { PATIENT_IMAGES_BUCKET_DEFAULT } from "./patientImagePolicy";
import type { CreatePatientImageUploadInput } from "./patientImageTypes";
import type { PatientImageRow } from "./patientImageTypes";
import {
  applyFiImageWatermarkOverlay,
  fetchLogoBuffer,
  fileToBuffer,
  probeImageDimensions,
} from "./fiImageWatermark.server";

export type RunPatientImagePostCapturePipelineInput = CreatePatientImageUploadInput & {
  imageId: string;
  safeFilename: string;
  contentType: string;
  captureSource?: unknown;
  captureType?: unknown;
  imageWidth?: number | null;
  imageHeight?: number | null;
};

export type PatientImagePostCapturePipelineOutcome = PatientImagePostCaptureResult & {
  updatedRow: Record<string, unknown>;
};

async function loadAttributionContext(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  clinicId: string | null,
  capturedByStaffId: string | null
): Promise<{
  patientFullName: string;
  personMetadata: Record<string, unknown>;
  patientMetadata: Record<string, unknown>;
  clinicName: string | null;
  practitionerName: string | null;
  brandingLogoUrl: string | null;
}> {
  const { data: patientRow, error: pErr } = await supabase
    .from("fi_patients")
    .select("id, metadata, person_id, primary_clinic_id")
    .eq("tenant_id", tenantId)
    .eq("id", patientId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!patientRow) throw new Error("Patient not found for tenant.");

  const personId = String((patientRow as { person_id: string }).person_id);
  const { data: personRow, error: personErr } = await supabase
    .from("fi_persons")
    .select("metadata")
    .eq("id", personId)
    .maybeSingle();
  if (personErr) throw new Error(personErr.message);

  const personMetadata =
    personRow && typeof (personRow as { metadata?: unknown }).metadata === "object"
      ? ((personRow as { metadata: Record<string, unknown> }).metadata ?? {})
      : {};
  const patientMetadata =
    typeof (patientRow as { metadata?: unknown }).metadata === "object"
      ? ((patientRow as { metadata: Record<string, unknown> }).metadata ?? {})
      : {};

  const identity = derivePatientIdentityContact({ personMetadata, patientMetadata });

  const effectiveClinicId =
    clinicId?.trim() ||
    ((patientRow as { primary_clinic_id?: string | null }).primary_clinic_id ?? null);

  let clinicName: string | null = null;
  if (effectiveClinicId) {
    const { data: clinicRow } = await supabase
      .from("fi_clinics")
      .select("display_name")
      .eq("tenant_id", tenantId)
      .eq("id", effectiveClinicId)
      .maybeSingle();
    clinicName = clinicRow
      ? String((clinicRow as { display_name?: string }).display_name ?? "").trim() || null
      : null;
  }

  let practitionerName: string | null = null;
  if (capturedByStaffId) {
    const { data: staffRow } = await supabase
      .from("fi_staff")
      .select("full_name, email")
      .eq("tenant_id", tenantId)
      .eq("id", capturedByStaffId)
      .maybeSingle();
    if (staffRow) {
      practitionerName =
        String((staffRow as { full_name?: string }).full_name ?? "").trim() ||
        String((staffRow as { email?: string }).email ?? "").trim() ||
        null;
    }
  }

  const branding = await resolveEffectiveBranding(
    { tenantId, clinicId: effectiveClinicId ?? undefined },
    supabase
  );

  return {
    patientFullName: identity.fullName,
    personMetadata,
    patientMetadata,
    clinicName: clinicName ?? branding.clinic_display_name ?? branding.brand_name,
    practitionerName,
    brandingLogoUrl: branding.logo_url,
  };
}

async function uploadDerivative(
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Derivative upload failed: ${error.message}`);
}

export async function runPatientImagePostCapturePipeline(
  input: RunPatientImagePostCapturePipelineInput,
  existingRow: PatientImageRow,
  client?: SupabaseClient
): Promise<PatientImagePostCapturePipelineOutcome> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const settings = await loadFiImageAttributionSettings(tid);
  const captureTimestamp = existingRow.taken_at ?? existingRow.created_at;
  const captureType = normalizeFiImageCaptureType(input.captureType);
  const captureSource = normalizeFiImageCaptureSource(input.captureSource);

  const ctx = await loadAttributionContext(
    supabase,
    tid,
    pid,
    existingRow.clinic_id,
    existingRow.captured_by_staff_id
  );

  const procedureStage = inferFiImageProcedureStage({
    visit_type: existingRow.visit_type,
    imaging_protocol_template_slug: existingRow.imaging_protocol_template_slug,
    image_category: existingRow.image_category,
    follow_up_interval: existingRow.follow_up_interval,
    imaging_library_axis: existingRow.imaging_library_axis,
  });

  let imageType = mapToFiImageAttributionType({
    anatomical_region: existingRow.anatomical_region,
    image_category: existingRow.image_category,
    protocol_slot_slug: existingRow.imaging_protocol_slot_slug,
  });

  const imageBuffer = await fileToBuffer(input.file);
  const probed =
    input.imageWidth != null && input.imageHeight != null
      ? { width: input.imageWidth, height: input.imageHeight }
      : await probeImageDimensions(imageBuffer);

  const { snapshot: quality } = evaluateFiImageQuality({
    width: probed.width,
    height: probed.height,
    size_bytes: input.file.size,
    content_type: input.contentType,
    image_type: imageType,
    metadata_hints:
      existingRow.metadata && typeof existingRow.metadata === "object"
        ? (existingRow.metadata as Record<string, unknown>)
        : {},
  });

  if (settings.block_upload_on_poor_quality && !quality.is_clinically_usable) {
    return {
      updatedRow: existingRow as unknown as Record<string, unknown>,
      metadata_patch: {},
      quality,
      derivatives: [],
      classification: null,
      timeline_entry: buildFiImageTimelineEntry({
        image_id: existingRow.id,
        capture_timestamp: captureTimestamp,
        procedure_stage: procedureStage,
        visit_type: existingRow.visit_type,
        follow_up_interval: existingRow.follow_up_interval,
        image_type: imageType,
      }),
      watermark_applied: false,
      marketing_version_created: false,
      quality_blocked: true,
    };
  }

  let classificationConfidence: number | null = null;
  if (settings.auto_classify_on_capture) {
    try {
      const classified = await classifyFiPatientImageAndPersist({
        tenantId: tid,
        patientImageId: existingRow.id,
        actorUserId: input.actingUserId ?? null,
        client: supabase,
      });
      classificationConfidence = classified.result.categoryConfidence;
      imageType = mapToFiImageAttributionType({
        ai_category: classified.result.category,
        anatomical_region: existingRow.anatomical_region,
        image_category: existingRow.image_category,
        protocol_slot_slug: existingRow.imaging_protocol_slot_slug,
      });
    } catch {
      // Classification is best-effort; original upload must succeed.
    }
  }

  const fiImageMetadata: FiImageMetadata = buildFiImageMetadata({
    patient_id: pid,
    patient_full_name: ctx.patientFullName,
    clinic_id: existingRow.clinic_id,
    clinic_name: ctx.clinicName,
    practitioner_id: existingRow.captured_by_staff_id,
    practitioner_name: ctx.practitionerName,
    capture_timestamp: captureTimestamp,
    capture_type: captureType,
    capture_source: captureSource,
    anatomical_region: existingRow.anatomical_region,
    visit_type: existingRow.visit_type,
    procedure_stage: procedureStage,
    image_type: imageType,
    image_type_confidence: classificationConfidence,
  });

  const timelineEntry = buildFiImageTimelineEntry({
    image_id: existingRow.id,
    capture_timestamp: captureTimestamp,
    procedure_stage: procedureStage,
    visit_type: existingRow.visit_type,
    follow_up_interval: existingRow.follow_up_interval,
    image_type: imageType,
  });

  const datasetFields = buildFiImageAiDatasetFields({
    patient_metadata: ctx.patientMetadata,
    person_metadata: ctx.personMetadata,
    age_years: derivePatientIdentityContact({
      personMetadata: ctx.personMetadata,
      patientMetadata: ctx.patientMetadata,
    }).ageYears,
  });

  const derivatives: FiImageDerivativeRef[] = [];
  let watermarkApplied = false;
  let marketingVersionCreated = false;
  const bucket = PATIENT_IMAGES_BUCKET_DEFAULT;
  const logoBuffer = settings.enable_watermark ? await fetchLogoBuffer(ctx.brandingLogoUrl) : null;

  if (settings.enable_watermark) {
    const watermarkedBuffer = await applyFiImageWatermarkOverlay({
      imageBuffer,
      contentType: input.contentType,
      clinicName: ctx.clinicName ?? "Clinic",
      captureDateLabel: fiImageMetadata.capture_date,
      patientName: ctx.patientFullName,
      opacity: settings.watermark_opacity,
      position: settings.watermark_position,
      includePatientName: settings.enable_patient_name_overlay,
      mode: "clinical_watermark",
      logoBuffer,
    });
    const watermarkedPath = buildPatientImageDerivativeStoragePath({
      tenantId: tid,
      patientId: pid,
      imageId: input.imageId,
      safeFilename: input.safeFilename,
      variant: "watermarked",
    });
    await uploadDerivative(supabase, bucket, watermarkedPath, watermarkedBuffer, input.contentType);
    derivatives.push({
      storage_bucket: bucket,
      storage_path: watermarkedPath,
      content_type: input.contentType,
      variant: "watermarked_marketing",
      created_at: new Date().toISOString(),
    });
    watermarkApplied = true;
  }

  if (settings.enable_marketing_export) {
    const marketingCaption = buildMarketingExportCaption({
      clinic_name: ctx.clinicName,
      procedure_stage: procedureStage,
      follow_up_interval: existingRow.follow_up_interval,
      visit_type: existingRow.visit_type,
    });
    const marketingBuffer = await applyFiImageWatermarkOverlay({
      imageBuffer,
      contentType: input.contentType,
      clinicName: ctx.clinicName ?? "Clinic",
      captureDateLabel: fiImageMetadata.capture_date,
      marketingHeadline: marketingCaption.headline,
      marketingSubline: marketingCaption.subline,
      opacity: settings.watermark_opacity,
      position: settings.watermark_position,
      includePatientName: false,
      mode: "marketing_export",
      logoBuffer,
    });
    const marketingPath = buildPatientImageDerivativeStoragePath({
      tenantId: tid,
      patientId: pid,
      imageId: input.imageId,
      safeFilename: input.safeFilename,
      variant: "marketing",
    });
    await uploadDerivative(supabase, bucket, marketingPath, marketingBuffer, input.contentType);
    derivatives.push({
      storage_bucket: bucket,
      storage_path: marketingPath,
      content_type: input.contentType,
      variant: "marketing_export",
      created_at: new Date().toISOString(),
    });
    marketingVersionCreated = true;
  }

  const metadataPatch: Record<string, unknown> = {
    fi_image_metadata: fiImageMetadata,
    fi_image_quality: quality,
    fi_image_derivatives: derivatives,
    fi_image_timeline: timelineEntry,
    fi_ai_dataset_fields: datasetFields,
    fi_image_attribution_engine_version: fiImageMetadata.attribution_engine_version,
  };

  const mergedMetadata = {
    ...(existingRow.metadata ?? {}),
    ...metadataPatch,
  };

  const now = new Date().toISOString();
  const { data: updated, error: upErr } = await supabase
    .from("fi_patient_images")
    .update({
      metadata: mergedMetadata,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", existingRow.id)
    .select("*")
    .single();
  if (upErr) throw new Error(upErr.message);

  void publishImagingEvent({
    tenantId: tid,
    clinicId: existingRow.clinic_id,
    eventType: "photo_capture_completed",
    entityId: existingRow.id,
    entityType: "image",
    eventMetadata: {
      tenant_id: tid,
      clinic_id: existingRow.clinic_id,
      patient_id: pid,
      practitioner_id: existingRow.captured_by_staff_id,
      image_type: imageType,
      ai_confidence_score: classificationConfidence,
      watermark_applied: watermarkApplied,
      marketing_version_created: marketingVersionCreated,
      capture_source: captureSource,
      quality_score: quality.quality_score,
      quality_status: quality.quality_status,
    },
  });

  return {
    updatedRow: updated as Record<string, unknown>,
    metadata_patch: metadataPatch,
    quality,
    derivatives,
    classification: { image_type: imageType, confidence: classificationConfidence },
    timeline_entry: timelineEntry,
    watermark_applied: watermarkApplied,
    marketing_version_created: marketingVersionCreated,
    quality_blocked: false,
  };
}
