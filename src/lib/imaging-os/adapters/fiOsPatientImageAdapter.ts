/**
 * ImagingOS — FI OS patient image upload adapter (Phase IM-2 + Phase 1 consolidation).
 * Maps patient image upload metadata to universal ingestion requests.
 */

import type { ImagingOsImageIngestionRequest } from "../intake";
import type { ImagingOsSourceSystem, ImagingOsUploadSurface } from "../types";

export type FiOsPatientImageAdapterInput = {
  tenant_id?: string;
  patient_id: string;
  image_id?: string;
  case_id?: string | null;
  consultation_id?: string | null;
  storage_bucket: string;
  storage_path: string;
  content_type?: string | null;
  size_bytes?: number | null;
  external_category?: string | null;
  capture_source?: string | null;
  protocol_template_slug?: string | null;
  protocol_slot_slug?: string | null;
  follow_up_interval?: string | null;
  visit_type?: string | null;
  anatomical_region?: string | null;
  captured_by_staff_id?: string | null;
  upload_surface?: ImagingOsUploadSurface;
  metadata?: Record<string, unknown>;
};

const FI_OS_CAPTURE_SOURCE_UPLOAD_SURFACE: Record<string, ImagingOsUploadSurface> = {
  imaging_os_wizard: "fi_guided_protocol",
  vie_capture_wizard: "fi_guided_protocol",
  patient_profile: "fi_patient_profile",
  patient_slide_over: "fi_patient_profile",
  profile_upload_form: "clinic_console",
  appointment_procedure: "fi_guided_protocol",
  appointment_procedure_admin_fallback: "clinic_console",
  unknown: "case_gallery",
};

export function resolveFiOsUploadSurface(captureSource?: string | null): ImagingOsUploadSurface {
  const key = String(captureSource ?? "")
    .trim()
    .toLowerCase();
  return FI_OS_CAPTURE_SOURCE_UPLOAD_SURFACE[key] ?? "case_gallery";
}

export function resolveFiOsSourceSystem(_captureSource?: string | null): ImagingOsSourceSystem {
  return "fi_os";
}

/** Build a universal ingestion request from FI OS patient image upload metadata. */
export function buildFiOsPatientImageIngestionRequest(
  input: FiOsPatientImageAdapterInput
): ImagingOsImageIngestionRequest {
  const captureSource = input.capture_source?.trim() || "unknown";
  const externalCategory =
    input.external_category?.trim() ||
    input.protocol_slot_slug?.trim() ||
    input.anatomical_region?.trim() ||
    undefined;

  return {
    source_system: resolveFiOsSourceSystem(captureSource),
    upload_surface: input.upload_surface ?? resolveFiOsUploadSurface(captureSource),
    ...(input.tenant_id ? { tenant_id: input.tenant_id } : {}),
    patient_id: input.patient_id,
    ...(input.case_id?.trim() ? { case_id: input.case_id.trim() } : {}),
    ...(input.consultation_id?.trim() ? { consultation_id: input.consultation_id.trim() } : {}),
    ...(input.image_id ? { external_image_id: input.image_id } : {}),
    storage_bucket: input.storage_bucket,
    storage_path: input.storage_path,
    ...(input.content_type ? { content_type: input.content_type } : {}),
    ...(input.size_bytes != null ? { size_bytes: input.size_bytes } : {}),
    ...(externalCategory ? { external_category: externalCategory } : {}),
    uploaded_by_actor_id: input.captured_by_staff_id?.trim() || undefined,
    uploaded_by_actor_type: input.captured_by_staff_id ? "staff" : "unknown",
    metadata: {
      capture_source: captureSource,
      ...(input.protocol_template_slug
        ? { protocol_template_slug: input.protocol_template_slug }
        : {}),
      ...(input.protocol_slot_slug ? { protocol_slot_slug: input.protocol_slot_slug } : {}),
      ...(input.follow_up_interval ? { follow_up_interval: input.follow_up_interval } : {}),
      ...(input.visit_type ? { visit_type: input.visit_type } : {}),
      ...(input.anatomical_region ? { anatomical_region: input.anatomical_region } : {}),
      ...(input.metadata ?? {}),
    },
  };
}