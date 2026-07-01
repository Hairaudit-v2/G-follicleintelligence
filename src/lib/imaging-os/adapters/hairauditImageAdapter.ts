/**
 * ImagingOS — HairAudit event image adapter (Phase 1 consolidation).
 */

import type { ImagingOsImageIngestionRequest } from "../intake";

export type HairauditImageAdapterInput = {
  tenant_id?: string;
  case_id: string;
  external_image_id: string;
  storage_bucket: string;
  storage_path: string;
  content_type?: string | null;
  size_bytes?: number | null;
  external_category: string;
  legacy_upload_type?: string | null;
  idempotency_key?: string | null;
  patient_id?: string | null;
  metadata?: Record<string, unknown>;
};

export function buildHairauditImageIngestionRequest(
  input: HairauditImageAdapterInput
): ImagingOsImageIngestionRequest {
  return {
    source_system: "hairaudit",
    upload_surface: "audit_upload",
    ...(input.tenant_id ? { tenant_id: input.tenant_id } : {}),
    ...(input.patient_id ? { patient_id: input.patient_id } : {}),
    case_id: input.case_id,
    external_image_id: input.external_image_id,
    storage_bucket: input.storage_bucket,
    storage_path: input.storage_path,
    ...(input.content_type ? { content_type: input.content_type } : {}),
    ...(input.size_bytes != null ? { size_bytes: input.size_bytes } : {}),
    external_category: input.external_category,
    uploaded_by_actor_type: "unknown",
    metadata: {
      capture_source: "hairaudit",
      ...(input.legacy_upload_type ? { legacy_upload_type: input.legacy_upload_type } : {}),
      ...(input.idempotency_key ? { idempotency_key: input.idempotency_key } : {}),
      ...(input.metadata ?? {}),
    },
  };
}