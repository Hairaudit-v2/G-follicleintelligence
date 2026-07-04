/**
 * Imaging Core — unified patient image ingest orchestrator (Phase 1, pure).
 */

import { runImagingOsIngestionPipeline } from "@/src/lib/imaging-os/pipeline";
import { buildImagingOsIngestMetadata } from "./buildImagingOsIngestMetadata";
import { buildPatientImageIngestionRequest } from "./buildPatientImageIngestionRequest";
import { parsePatientImageIngestionContext } from "./parsePatientImageIngestionContext";
import type {
  FlatPatientImageIngestionContext,
  ParsedPatientImageIngestContext,
} from "./patientImageIngestContextTypes";
import { buildImagingSessionTaxonomy } from "./sessionTaxonomy";

export type { PatientImageIngestionContext } from "./patientImageIngestContextTypes";

export type UnifiedPatientImageIngestResult = {
  imaging_os_ingest: ReturnType<typeof buildImagingOsIngestMetadata>;
  imaging_session: ReturnType<typeof buildImagingSessionTaxonomy>;
};

function resolveIngestContext(
  input: FlatPatientImageIngestionContext | ParsedPatientImageIngestContext
): ParsedPatientImageIngestContext {
  return "kind" in input ? input : parsePatientImageIngestionContext(input);
}

/**
 * Run the universal ImagingOS ingestion pipeline for any patient image context.
 * Pure — no I/O; safe for tests and server post-capture hooks.
 */
export function runUnifiedPatientImageIngest(
  input: FlatPatientImageIngestionContext | ParsedPatientImageIngestContext
): UnifiedPatientImageIngestResult {
  const ctx = resolveIngestContext(input);
  const request = buildPatientImageIngestionRequest(ctx);
  const pipeline = runImagingOsIngestionPipeline(request);
  const captureSource =
    ctx.capture_source ||
    (typeof request.metadata?.capture_source === "string"
      ? request.metadata.capture_source
      : null);

  return {
    imaging_os_ingest: buildImagingOsIngestMetadata(pipeline),
    imaging_session: buildImagingSessionTaxonomy({
      capture_source: captureSource,
      protocol_template_slug: ctx.protocol_template_slug,
      protocol_slot_slug: ctx.protocol_slot_slug,
      follow_up_interval: ctx.follow_up_interval,
      visit_type: ctx.visit_type,
      image_category: ctx.image_category,
      upload_source: ctx.upload_source,
    }),
  };
}

export function buildUnifiedIngestMetadataPatch(
  input: FlatPatientImageIngestionContext | ParsedPatientImageIngestContext
): Record<string, unknown> {
  const result = runUnifiedPatientImageIngest(input);
  return {
    imaging_os_ingest: result.imaging_os_ingest,
    imaging_session: result.imaging_session,
    canonical_view: result.imaging_os_ingest.canonical_photo_category,
  };
}