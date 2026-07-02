import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { truncateRawTextPreview } from "@/src/lib/pathology/pathologyPdfExtractCore";
import {
  normalizePathologyExtractedMarkers,
  type NormalizedPathologyMarker,
} from "@/src/lib/pathology/pathologyMarkerNormalize";
import { buildPathologyMedicalIntelligencePreview } from "@/src/lib/pathology/pathologyExtractionPreview.server";
import type {
  PathologyExtractionConfidenceSummary,
  PathologyExtractionProviderAuditRecord,
  PathologyExtractionSource,
  PathologyPdfExtractionOutput,
} from "@/src/lib/pathology/pathologyExtractionProviderTypes";
import { buildPathologyExtractionConfidenceSummary } from "@/src/lib/pathology/pathologyExtractionProviderTypes";
import { buildPathologyExtractionProviderAudit } from "@/src/lib/pathology/pathologyExtractionProviderAudit";
import { buildManualReviewFallbackOutput } from "@/src/lib/pathology/pathologyExtractionProviderStub";
import type { PathologyExtractionProviderAdapter } from "@/src/lib/pathology/pathologyExtractionProvider";
import { readPathologyExtractionMinOcrConfidenceFromEnv } from "@/src/lib/pathology/pathologyExtractionProvider";
import {
  resolvePathologyExtractionProvider,
  setPathologyExtractionProviderAdapterForTests,
} from "@/src/lib/pathology/pathologyExtractionProviderResolve.server";
import { resolvePathologyExtractionProviderIdFromEnv } from "@/src/lib/pathology/pathologyExtractionProvider";

export type PathologyExtractionWorkerResult = {
  provider: string;
  rawTextPreview: string;
  rawExtractionJson: Record<string, unknown>;
  normalizedMarkers: NormalizedPathologyMarker[];
  extractedMarkerCount: number;
  skippedMarkerCount: number;
  medicalIntelligencePreview: Record<string, unknown> | null;
  ocrConfidence: number | null;
  source: PathologyExtractionSource;
  providerAudit: PathologyExtractionProviderAuditRecord;
  requiresManualReview: boolean;
  confidenceSummary: PathologyExtractionConfidenceSummary;
};

/** @deprecated Use PathologyExtractionProviderAdapter via resolvePathologyExtractionProvider */
export type PathologyExtractionProvider = PathologyExtractionProviderAdapter["extractFromPdf"];

type LegacyTestExtractionOutput = Partial<PathologyPdfExtractionOutput> & {
  provider: PathologyPdfExtractionOutput["provider"] | string;
  rawText: string;
  markers: PathologyPdfExtractionOutput["markers"];
  ocrConfidence: number | null;
  source: PathologyExtractionSource;
  skippedRawCount: number;
};

function enrichLegacyTestOutput(raw: LegacyTestExtractionOutput): PathologyPdfExtractionOutput {
  const threshold = readPathologyExtractionMinOcrConfidenceFromEnv();
  const confidenceSummary = buildPathologyExtractionConfidenceSummary(
    raw.markers,
    raw.ocrConfidence,
    threshold
  );
  const requiresManualReview =
    raw.requiresManualReview ??
    (raw.markers.length === 0 || !confidenceSummary.meets_threshold);

  return {
    provider: raw.provider as PathologyPdfExtractionOutput["provider"],
    rawText: raw.rawText,
    markers: raw.markers,
    ocrConfidence: raw.ocrConfidence,
    source: raw.source,
    skippedRawCount: raw.skippedRawCount,
    providerAudit:
      raw.providerAudit ??
      buildPathologyExtractionProviderAudit({
        providerId: "fi-pathology-stub-v1",
        requestedProviderId: "fi-pathology-stub-v1",
        outcome: requiresManualReview ? "fallback_manual_review" : "extracted",
        latencyMs: 0,
        credentialPresent: true,
      }),
    requiresManualReview,
    confidenceSummary: raw.confidenceSummary ?? confidenceSummary,
  };
}

/** Test hook — inject deterministic extraction output via a custom adapter. */
export function setPathologyExtractionProviderForTests(
  provider: ((pdfBytes: Uint8Array) => LegacyTestExtractionOutput) | null
): void {
  if (!provider) {
    setPathologyExtractionProviderAdapterForTests(null);
    return;
  }
  setPathologyExtractionProviderAdapterForTests({
    providerId: "fi-pathology-stub-v1",
    isConfigured: () => true,
    extractFromPdf: async (pdfBytes) => enrichLegacyTestOutput(provider(pdfBytes)),
  });
}

export function resolvePathologyExtractionJobStatus(result: PathologyExtractionWorkerResult): {
  jobStatus: "succeeded" | "needs_review";
  inboundStatus: "succeeded" | "needs_review";
} {
  const hasMarkers = result.extractedMarkerCount > 0;
  const needsReview =
    result.requiresManualReview || !hasMarkers || !result.confidenceSummary.meets_threshold;
  return needsReview
    ? { jobStatus: "needs_review", inboundStatus: "needs_review" }
    : { jobStatus: "succeeded", inboundStatus: "succeeded" };
}

export async function runPathologyExtractionOnPdf(
  pdfBytes: Uint8Array,
  provider?: PathologyExtractionProviderAdapter
): Promise<PathologyExtractionWorkerResult> {
  const adapter = provider ?? resolvePathologyExtractionProvider();
  const requestedProviderId = resolvePathologyExtractionProviderIdFromEnv();
  const started = Date.now();

  let raw: PathologyPdfExtractionOutput;
  try {
    raw = await adapter.extractFromPdf(pdfBytes);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction provider failed.";
    raw = buildManualReviewFallbackOutput({
      requestedProviderId,
      providerId: adapter.providerId,
      reason: message,
      latencyMs: Date.now() - started,
      credentialPresent: adapter.isConfigured(),
      outcome: "provider_error",
    });
  }

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
      provider_audit: raw.providerAudit,
      confidence_summary: raw.confidenceSummary,
      requires_manual_review: raw.requiresManualReview,
    },
    normalizedMarkers: normalized,
    extractedMarkerCount: normalized.length,
    skippedMarkerCount,
    medicalIntelligencePreview: miPreview ? (miPreview as unknown as Record<string, unknown>) : null,
    ocrConfidence: raw.ocrConfidence,
    source: raw.source,
    providerAudit: raw.providerAudit,
    requiresManualReview: raw.requiresManualReview,
    confidenceSummary: raw.confidenceSummary,
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
