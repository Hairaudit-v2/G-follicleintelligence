/**
 * ImagingOS — IIOHR academy case image adapter (Phase 1 consolidation).
 */

import type { ImagingOsImageIngestionRequest } from "../intake";

export type IiohrImageAdapterInput = {
  tenant_id?: string;
  case_id: string;
  external_image_id: string;
  storage_bucket: string;
  storage_path: string;
  content_type?: string | null;
  size_bytes?: number | null;
  external_category: string;
  legacy_upload_type?: string | null;
  patient_id?: string | null;
  metadata?: Record<string, unknown>;
};

export function buildIiohrImageIngestionRequest(
  input: IiohrImageAdapterInput
): ImagingOsImageIngestionRequest {
  return {
    source_system: "iiohr",
    upload_surface: "iiohr_portal",
    ...(input.tenant_id ? { tenant_id: input.tenant_id } : {}),
    ...(input.patient_id ? { patient_id: input.patient_id } : {}),
    case_id: input.case_id,
    external_image_id: input.external_image_id,
    storage_bucket: input.storage_bucket,
    storage_path: input.storage_path,
    ...(input.content_type ? { content_type: input.content_type } : {}),
    ...(input.size_bytes != null ? { size_bytes: input.size_bytes } : {}),
    external_category: input.external_category,
    uploaded_by_actor_type: "staff",
    metadata: {
      capture_source: "iiohr_academy",
      ...(input.legacy_upload_type ? { legacy_upload_type: input.legacy_upload_type } : {}),
      ...(input.metadata ?? {}),
    },
  };
}