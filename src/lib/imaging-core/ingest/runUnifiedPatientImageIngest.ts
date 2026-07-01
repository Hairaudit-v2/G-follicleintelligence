/**
 * Imaging Core — unified patient image ingest orchestrator (Phase 1, pure).
 */

import { runImagingOsIngestionPipeline } from "@/src/lib/imaging-os/pipeline";
import { buildImagingOsIngestMetadata } from "./buildImagingOsIngestMetadata";
import {
  buildPatientImageIngestionRequest,
  type PatientImageIngestionContext,
} from "./buildPatientImageIngestionRequest";
import { buildImagingSessionTaxonomy } from "./sessionTaxonomy";

export type UnifiedPatientImageIngestResult = {
  imaging_os_ingest: ReturnType<typeof buildImagingOsIngestMetadata>;
  imaging_session: ReturnType<typeof buildImagingSessionTaxonomy>;
};

/**
 * Run the universal ImagingOS ingestion pipeline for any patient image context.
 * Pure — no I/O; safe for tests and server post-capture hooks.
 */
export function runUnifiedPatientImageIngest(
  input: PatientImageIngestionContext
): UnifiedPatientImageIngestResult {
  const request = buildPatientImageIngestionRequest(input);
  const pipeline = runImagingOsIngestionPipeline(request);
  const captureSource =
    input.capture_source?.trim() ||
    (typeof request.metadata?.capture_source === "string"
      ? request.metadata.capture_source
      : null);

  return {
    imaging_os_ingest: buildImagingOsIngestMetadata(pipeline),
    imaging_session: buildImagingSessionTaxonomy({
      capture_source: captureSource,
      protocol_template_slug: input.protocol_template_slug,
      protocol_slot_slug: input.protocol_slot_slug,
      follow_up_interval: input.follow_up_interval,
      visit_type: input.visit_type,
      image_category: input.image_category,
      upload_source: input.upload_source,
    }),
  };
}

export function buildUnifiedIngestMetadataPatch(
  input: PatientImageIngestionContext
): Record<string, unknown> {
  const result = runUnifiedPatientImageIngest(input);
  return {
    imaging_os_ingest: result.imaging_os_ingest,
    imaging_session: result.imaging_session,
    canonical_view: result.imaging_os_ingest.canonical_photo_category,
  };
}