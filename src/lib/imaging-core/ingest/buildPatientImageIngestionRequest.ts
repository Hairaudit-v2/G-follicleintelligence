/**
 * Imaging Core — route patient image context to the correct ImagingOS adapter (Phase 1).
 */

import { buildConsultationOsImageIngestionRequest } from "@/src/lib/imaging-os/adapters/consultationOsImageAdapter";
import { buildFiOsPatientImageIngestionRequest } from "@/src/lib/imaging-os/adapters/fiOsPatientImageAdapter";
import { buildFollowUpOutcomeImageIngestionRequest } from "@/src/lib/imaging-os/adapters/followUpOutcomeImageAdapter";
import { buildHairauditImageIngestionRequest } from "@/src/lib/imaging-os/adapters/hairauditImageAdapter";
import { buildHliImageIngestionRequest } from "@/src/lib/imaging-os/adapters/hliImageAdapter";
import { buildIiohrImageIngestionRequest } from "@/src/lib/imaging-os/adapters/iiohrImageAdapter";
import { buildPatientPortalImageIngestionRequest } from "@/src/lib/imaging-os/adapters/patientPortalImageAdapter";
import { buildSurgeryOsImageIngestionRequest } from "@/src/lib/imaging-os/adapters/surgeryOsImageAdapter";
import type { ImagingOsImageIngestionRequest } from "@/src/lib/imaging-os/intake";

export type PatientImageIngestionContext = {
  tenant_id?: string;
  patient_id: string;
  image_id: string;
  case_id?: string | null;
  consultation_id?: string | null;
  form_instance_id?: string | null;
  booking_id?: string | null;
  storage_bucket: string;
  storage_path: string;
  content_type?: string | null;
  size_bytes?: number | null;
  capture_source?: string | null;
  upload_source?: string | null;
  image_category?: string | null;
  protocol_template_slug?: string | null;
  protocol_slot_slug?: string | null;
  follow_up_interval?: string | null;
  visit_type?: string | null;
  anatomical_region?: string | null;
  external_category?: string | null;
  legacy_upload_type?: string | null;
  captured_by_staff_id?: string | null;
  procedure_day_id?: string | null;
  hairaudit_image_type?: string | null;
  hli_document_kind?: string | null;
  fi_event_id?: string | null;
  fi_upload_id?: string | null;
  metadata?: Record<string, unknown>;
};

function normalizeCaptureSource(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isFollowUpTemplate(templateSlug: string | null | undefined): boolean {
  return normalizeCaptureSource(templateSlug) === "follow_up_review";
}

/**
 * Select adapter and build universal ingestion request from patient image context.
 */
export function buildPatientImageIngestionRequest(
  input: PatientImageIngestionContext
): ImagingOsImageIngestionRequest {
  const captureSource = normalizeCaptureSource(input.capture_source);
  const uploadSource = normalizeCaptureSource(input.upload_source);
  const sharedMetadata = {
    ...(input.fi_event_id ? { fi_event_id: input.fi_event_id } : {}),
    ...(input.fi_upload_id ? { fi_upload_id: input.fi_upload_id } : {}),
    ...(input.metadata ?? {}),
  };

  if (uploadSource === "hairaudit" || captureSource === "hairaudit") {
    return buildHairauditImageIngestionRequest({
      tenant_id: input.tenant_id,
      case_id: input.case_id?.trim() || input.patient_id,
      external_image_id: input.fi_upload_id?.trim() || input.image_id,
      storage_bucket: input.storage_bucket,
      storage_path: input.storage_path,
      content_type: input.content_type,
      size_bytes: input.size_bytes,
      external_category: input.hairaudit_image_type?.trim() || input.external_category?.trim() || "other",
      legacy_upload_type: input.legacy_upload_type,
      patient_id: input.patient_id,
      metadata: sharedMetadata,
    });
  }

  if (uploadSource === "hair_longevity" || captureSource === "hli") {
    return buildHliImageIngestionRequest({
      patient_id: input.patient_id,
      external_image_id: input.fi_upload_id?.trim() || input.image_id,
      external_category:
        input.hli_document_kind?.trim() || input.external_category?.trim() || "supporting_docs",
      storage_bucket: input.storage_bucket,
      storage_path: input.storage_path,
      upload_surface: "internal_api",
      metadata: {
        legacy_upload_type: input.legacy_upload_type,
        ...sharedMetadata,
      },
    });
  }

  if (captureSource === "iiohr_academy" || uploadSource === "iiohr") {
    return buildIiohrImageIngestionRequest({
      tenant_id: input.tenant_id,
      case_id: input.case_id?.trim() || input.patient_id,
      external_image_id: input.image_id,
      storage_bucket: input.storage_bucket,
      storage_path: input.storage_path,
      content_type: input.content_type,
      size_bytes: input.size_bytes,
      external_category: input.external_category?.trim() || input.hairaudit_image_type?.trim() || "other",
      legacy_upload_type: input.legacy_upload_type,
      patient_id: input.patient_id,
      metadata: sharedMetadata,
    });
  }

  if (captureSource === "consultation_os" || input.consultation_id?.trim()) {
    return buildConsultationOsImageIngestionRequest({
      tenant_id: input.tenant_id ?? "",
      patient_id: input.patient_id,
      image_id: input.image_id,
      case_id: input.case_id,
      consultation_id: input.consultation_id?.trim() || "",
      form_instance_id: input.form_instance_id,
      storage_bucket: input.storage_bucket,
      storage_path: input.storage_path,
      content_type: input.content_type,
      size_bytes: input.size_bytes,
      external_category: input.external_category ?? input.image_category,
      anatomical_region: input.anatomical_region,
      captured_by_staff_id: input.captured_by_staff_id,
      metadata: sharedMetadata,
    });
  }

  if (captureSource === "surgery_os") {
    return buildSurgeryOsImageIngestionRequest({
      tenant_id: input.tenant_id ?? "",
      patient_id: input.patient_id,
      image_id: input.image_id,
      case_id: input.case_id,
      booking_id: input.booking_id,
      storage_bucket: input.storage_bucket,
      storage_path: input.storage_path,
      content_type: input.content_type,
      size_bytes: input.size_bytes,
      protocol_template_slug: input.protocol_template_slug,
      protocol_slot_slug: input.protocol_slot_slug,
      procedure_day_id: input.procedure_day_id,
      captured_by_staff_id: input.captured_by_staff_id,
      metadata: sharedMetadata,
    });
  }

  if (
    captureSource === "follow_up_outcome" ||
    ((captureSource === "vie_capture_wizard" || captureSource === "imaging_os_wizard") &&
      isFollowUpTemplate(input.protocol_template_slug))
  ) {
    return buildFollowUpOutcomeImageIngestionRequest({
      tenant_id: input.tenant_id ?? "",
      patient_id: input.patient_id,
      image_id: input.image_id,
      case_id: input.case_id,
      storage_bucket: input.storage_bucket,
      storage_path: input.storage_path,
      content_type: input.content_type,
      size_bytes: input.size_bytes,
      protocol_template_slug: input.protocol_template_slug,
      protocol_slot_slug: input.protocol_slot_slug,
      follow_up_interval: input.follow_up_interval,
      visit_type: input.visit_type,
      captured_by_staff_id: input.captured_by_staff_id,
      metadata: sharedMetadata,
    });
  }

  if (captureSource === "patient_portal") {
    return buildPatientPortalImageIngestionRequest({
      tenant_id: input.tenant_id ?? "",
      patient_id: input.patient_id,
      image_id: input.image_id,
      case_id: input.case_id,
      storage_bucket: input.storage_bucket,
      storage_path: input.storage_path,
      content_type: input.content_type,
      size_bytes: input.size_bytes,
      external_category: input.external_category ?? input.image_category,
      protocol_template_slug: input.protocol_template_slug,
      protocol_slot_slug: input.protocol_slot_slug,
      follow_up_interval: input.follow_up_interval,
      metadata: sharedMetadata,
    });
  }

  return buildFiOsPatientImageIngestionRequest({
    tenant_id: input.tenant_id,
    patient_id: input.patient_id,
    image_id: input.image_id,
    case_id: input.case_id,
    consultation_id: input.consultation_id,
    storage_bucket: input.storage_bucket,
    storage_path: input.storage_path,
    content_type: input.content_type,
    size_bytes: input.size_bytes,
    external_category: input.external_category ?? input.image_category,
    capture_source: captureSource || "unknown",
    protocol_template_slug: input.protocol_template_slug,
    protocol_slot_slug: input.protocol_slot_slug,
    follow_up_interval: input.follow_up_interval,
    visit_type: input.visit_type,
    anatomical_region: input.anatomical_region,
    captured_by_staff_id: input.captured_by_staff_id,
    metadata: sharedMetadata,
  });
}