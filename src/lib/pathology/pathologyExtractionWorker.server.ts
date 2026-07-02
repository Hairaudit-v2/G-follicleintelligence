import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractPathologyMarkersFromPdf,
  truncateRawTextPreview,
  type PathologyPdfExtractionOutput,
} from "@/src/lib/pathology/pathologyPdfExtractCore";
import {
  normalizePathologyExtractedMarkers,
  type NormalizedPathologyMarker,
} from "@/src/lib/pathology/pathologyMarkerNormalize";
import { buildPathologyMedicalIntelligencePreview } from "@/src/lib/pathology/pathologyExtractionPreview.server";

export type PathologyExtractionWorkerResult = {
  provider: string;
  rawTextPreview: string;
  rawExtractionJson: Record<string, unknown>;
  normalizedMarkers: NormalizedPathologyMarker[];
  extractedMarkerCount: number;
  skippedMarkerCount: number;
  medicalIntelligencePreview: Record<string, unknown> | null;
  ocrConfidence: number | null;
  source: PathologyPdfExtractionOutput["source"];
};

export type PathologyExtractionProvider = (pdfBytes: Uint8Array) => PathologyPdfExtractionOutput;

let extractionProviderOverride: PathologyExtractionProvider | null = null;

/** Test hook — inject deterministic extraction output. */
export function setPathologyExtractionProviderForTests(
  provider: PathologyExtractionProvider | null
): void {
  extractionProviderOverride = provider;
}

function defaultProvider(pdfBytes: Uint8Array): PathologyPdfExtractionOutput {
  return extractPathologyMarkersFromPdf(pdfBytes);
}

export async function runPathologyExtractionOnPdf(
  pdfBytes: Uint8Array,
  provider?: PathologyExtractionProvider
): Promise<PathologyExtractionWorkerResult> {
  const extract = provider ?? extractionProviderOverride ?? defaultProvider;
  const raw = extract(pdfBytes);

  const normalized = normalizePathologyExtractedMarkers(raw.markers);
  const skippedMarkerCount = Math.max(0, raw.markers.length - normalized.length);
  const miPreview = buildPathologyMedicalIntelligencePreview(normalized);

  return {
    provider: raw.provider,
    rawTextPreview: truncateRawTextPreview(raw.rawText),
    rawExtractionJson: {
      provider: raw.provider,
      source: raw.source,
      ocr_confidence: raw.ocrConfidence,
      marker_count: raw.markers.length,
      skipped_raw_count: raw.skippedRawCount,
      markers: raw.markers,
    },
    normalizedMarkers: normalized,
    extractedMarkerCount: normalized.length,
    skippedMarkerCount,
    medicalIntelligencePreview: miPreview ? (miPreview as unknown as Record<string, unknown>) : null,
    ocrConfidence: raw.ocrConfidence,
    source: raw.source,
  };
}

export async function downloadInboundDocumentPdf(
  supabase: SupabaseClient,
  storageBucket: string,
  storagePath: string
): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(storageBucket).download(storagePath);
  if (error) throw new Error(error.message);
  return new Uint8Array(await data.arrayBuffer());
}
