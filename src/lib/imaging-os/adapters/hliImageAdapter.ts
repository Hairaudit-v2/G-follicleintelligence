/**
 * ImagingOS — HLI image classification/upload adapter (Phase IM-2 stub).
 * Maps HLI concepts to universal ingestion requests.
 */

import type { ImagingOsImageIngestionRequest } from "../intake";

export type HliImageAdapterInput = {
  patient_id?: string;
  external_image_id?: string;
  external_category?: string;
  public_url?: string;
  signed_url?: string;
  storage_bucket?: string;
  storage_path?: string;
  upload_surface?: "patient_portal" | "internal_api";
  metadata?: Record<string, unknown>;
};

/** Build a universal ingestion request from HLI image metadata. */
export function buildHliImageIngestionRequest(
  input: HliImageAdapterInput
): ImagingOsImageIngestionRequest {
  return {
    source_system: "hli",
    upload_surface: input.upload_surface ?? "patient_portal",
    ...(input.patient_id ? { patient_id: input.patient_id } : {}),
    ...(input.external_image_id ? { external_image_id: input.external_image_id } : {}),
    ...(input.external_category ? { external_category: input.external_category } : {}),
    ...(input.public_url ? { public_url: input.public_url } : {}),
    ...(input.signed_url ? { signed_url: input.signed_url } : {}),
    ...(input.storage_bucket ? { storage_bucket: input.storage_bucket } : {}),
    ...(input.storage_path ? { storage_path: input.storage_path } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}
