/**
 * ImagingOS — FI OS patient image upload adapter (Phase IM-2 stub).
 * Maps patient image upload metadata to universal ingestion requests.
 */

import type { ImagingOsImageIngestionRequest } from "../intake";

export type FiOsPatientImageAdapterInput = {
  patient_id: string;
  case_id?: string;
  storage_bucket: string;
  storage_path: string;
  content_type?: string;
  size_bytes?: number;
  external_category?: string;
  upload_surface?: "case_gallery" | "clinic_console";
  metadata?: Record<string, unknown>;
};

/** Build a universal ingestion request from FI OS patient image upload metadata. */
export function buildFiOsPatientImageIngestionRequest(
  input: FiOsPatientImageAdapterInput
): ImagingOsImageIngestionRequest {
  return {
    source_system: "fi_os",
    upload_surface: input.upload_surface ?? "case_gallery",
    patient_id: input.patient_id,
    ...(input.case_id ? { case_id: input.case_id } : {}),
    storage_bucket: input.storage_bucket,
    storage_path: input.storage_path,
    ...(input.content_type ? { content_type: input.content_type } : {}),
    ...(input.size_bytes != null ? { size_bytes: input.size_bytes } : {}),
    ...(input.external_category ? { external_category: input.external_category } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}
