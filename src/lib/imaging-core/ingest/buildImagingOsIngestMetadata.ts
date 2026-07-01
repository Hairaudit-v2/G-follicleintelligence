/**
 * Imaging Core — serialize ImagingOS pipeline snapshot for fi_patient_images metadata.
 */

import type { ImagingOsIngestionPipelineResult } from "@/src/lib/imaging-os/pipeline";

export const IMAGING_OS_INGEST_METADATA_VERSION = "imaging-os-ingest.v1" as const;

export type ImagingOsIngestMetadataRecord = {
  metadata_version: typeof IMAGING_OS_INGEST_METADATA_VERSION;
  pipeline_version: string;
  status: string;
  source_system: string;
  upload_surface: string;
  canonical_photo_category: string;
  intake_id: string;
  classification: ImagingOsIngestionPipelineResult["classification"];
  quality: ImagingOsIngestionPipelineResult["quality"];
  protocol: ImagingOsIngestionPipelineResult["protocol"];
  warnings?: string[];
};

export function buildImagingOsIngestMetadata(
  pipeline: ImagingOsIngestionPipelineResult
): ImagingOsIngestMetadataRecord {
  return {
    metadata_version: IMAGING_OS_INGEST_METADATA_VERSION,
    pipeline_version: pipeline.pipeline_version,
    status: pipeline.status,
    source_system: pipeline.intake.source_system,
    upload_surface: pipeline.intake.upload_surface,
    canonical_photo_category: pipeline.intake.canonical_photo_category,
    intake_id: pipeline.intake.intake_id,
    classification: pipeline.classification,
    quality: pipeline.quality,
    protocol: pipeline.protocol,
    ...(pipeline.warnings?.length ? { warnings: pipeline.warnings } : {}),
  };
}