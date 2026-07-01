/**
 * ImagingOS — patient portal self-upload adapter (Phase 1 consolidation).
 */

import type { ImagingOsImageIngestionRequest } from "../intake";

export type PatientPortalImageAdapterInput = {
  tenant_id: string;
  patient_id: string;
  image_id: string;
  case_id?: string | null;
  storage_bucket: string;
  storage_path: string;
  content_type?: string | null;
  size_bytes?: number | null;
  external_category?: string | null;
  protocol_template_slug?: string | null;
  protocol_slot_slug?: string | null;
  follow_up_interval?: string | null;
  metadata?: Record<string, unknown>;
};

export function buildPatientPortalImageIngestionRequest(
  input: PatientPortalImageAdapterInput
): ImagingOsImageIngestionRequest {
  return {
    source_system: "patient_upload",
    upload_surface: "patient_portal",
    tenant_id: input.tenant_id,
    patient_id: input.patient_id,
    case_id: input.case_id?.trim() || undefined,
    external_image_id: input.image_id,
    storage_bucket: input.storage_bucket,
    storage_path: input.storage_path,
    ...(input.content_type ? { content_type: input.content_type } : {}),
    ...(input.size_bytes != null ? { size_bytes: input.size_bytes } : {}),
    external_category: input.external_category?.trim() || input.protocol_slot_slug?.trim() || "follow_up",
    uploaded_by_actor_type: "patient",
    metadata: {
      capture_source: "patient_portal",
      protocol_template_slug: input.protocol_template_slug?.trim() || "follow_up_review",
      ...(input.protocol_slot_slug ? { protocol_slot_slug: input.protocol_slot_slug } : {}),
      ...(input.follow_up_interval ? { follow_up_interval: input.follow_up_interval } : {}),
      ...(input.metadata ?? {}),
    },
  };
}