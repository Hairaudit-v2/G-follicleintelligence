/**
 * ImagingOS — ConsultationOS form image upload adapter (Phase 1 consolidation).
 */

import type { ImagingOsImageIngestionRequest } from "../intake";

export type ConsultationOsImageAdapterInput = {
  tenant_id: string;
  patient_id: string;
  image_id: string;
  case_id?: string | null;
  consultation_id: string;
  form_instance_id?: string | null;
  storage_bucket: string;
  storage_path: string;
  content_type?: string | null;
  size_bytes?: number | null;
  external_category?: string | null;
  anatomical_region?: string | null;
  captured_by_staff_id?: string | null;
  metadata?: Record<string, unknown>;
};

export function buildConsultationOsImageIngestionRequest(
  input: ConsultationOsImageAdapterInput
): ImagingOsImageIngestionRequest {
  return {
    source_system: "consultation_os",
    upload_surface: "consultation_form",
    tenant_id: input.tenant_id,
    patient_id: input.patient_id,
    case_id: input.case_id?.trim() || undefined,
    consultation_id: input.consultation_id,
    external_image_id: input.image_id,
    storage_bucket: input.storage_bucket,
    storage_path: input.storage_path,
    ...(input.content_type ? { content_type: input.content_type } : {}),
    ...(input.size_bytes != null ? { size_bytes: input.size_bytes } : {}),
    external_category: input.external_category?.trim() || "scalp",
    uploaded_by_actor_id: input.captured_by_staff_id?.trim() || undefined,
    uploaded_by_actor_type: input.captured_by_staff_id ? "clinician" : "unknown",
    metadata: {
      capture_source: "consultation_os",
      ...(input.form_instance_id ? { form_instance_id: input.form_instance_id } : {}),
      ...(input.anatomical_region ? { anatomical_region: input.anatomical_region } : {}),
      ...(input.metadata ?? {}),
    },
  };
}