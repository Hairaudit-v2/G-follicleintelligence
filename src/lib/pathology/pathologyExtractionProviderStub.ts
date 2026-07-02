import { buildPathologyExtractionProviderAudit } from "./pathologyExtractionProviderAudit";
import type { PathologyExtractionProviderAdapter } from "./pathologyExtractionProvider";
import { readPathologyExtractionMinOcrConfidenceFromEnv } from "./pathologyExtractionProvider";
import {
  buildPathologyExtractionConfidenceSummary,
  FI_PATHOLOGY_STUB_PROVIDER_ID,
  normalizePathologyExtractionProviderId,
  type PathologyExtractionProviderId,
  type PathologyPdfExtractionOutput,
} from "./pathologyExtractionProviderTypes";
import {
  extractPathologyMarkersFromPdf,
  extractPdfAsciiText,
  parseTabularMarkerLines,
} from "./pathologyPdfExtractCore";

function enrichStubOutput(
  base: Omit<
    PathologyPdfExtractionOutput,
    "providerAudit" | "requiresManualReview" | "confidenceSummary"
  >,
  requestedProviderId: PathologyExtractionProviderId,
  latencyMs: number
): PathologyPdfExtractionOutput {
  const threshold = readPathologyExtractionMinOcrConfidenceFromEnv();
  const confidenceSummary = buildPathologyExtractionConfidenceSummary(
    base.markers,
    base.ocrConfidence,
    threshold
  );
  const requiresManualReview =
    base.markers.length === 0 ||
    !confidenceSummary.meets_threshold ||
    base.source === "empty";

  return {
    ...base,
    providerAudit: buildPathologyExtractionProviderAudit({
      providerId: FI_PATHOLOGY_STUB_PROVIDER_ID,
      requestedProviderId,
      outcome: requiresManualReview ? "fallback_manual_review" : "extracted",
      fallbackReason: requiresManualReview
        ? base.markers.length === 0
          ? "No markers extracted from PDF text."
          : "Confidence below configured threshold."
        : null,
      latencyMs,
      credentialPresent: true,
    }),
    requiresManualReview,
    confidenceSummary,
  };
}

/** Local/test-only provider — deterministic PDF text + fixture parsing. */
export class StubPathologyExtractionProvider implements PathologyExtractionProviderAdapter {
  readonly providerId = FI_PATHOLOGY_STUB_PROVIDER_ID;

  isConfigured(): boolean {
    return true;
  }

  async extractFromPdf(
    pdfBytes: Uint8Array,
    env?: import("./pathologyExtractionProvider").PathologyExtractionProviderEnvSlice
  ): Promise<PathologyPdfExtractionOutput> {
    const started = Date.now();
    const requested = env ? requestedProviderFromEnv(env) : FI_PATHOLOGY_STUB_PROVIDER_ID;
    const raw = extractPathologyMarkersFromPdf(pdfBytes);
    return enrichStubOutput(
      {
        provider: FI_PATHOLOGY_STUB_PROVIDER_ID,
        rawText: raw.rawText,
        markers: raw.markers,
        ocrConfidence: raw.ocrConfidence,
        source: raw.source,
        skippedRawCount: raw.skippedRawCount,
      },
      requested,
      Date.now() - started
    );
  }
}

function requestedProviderFromEnv(
  env: import("./pathologyExtractionProvider").PathologyExtractionProviderEnvSlice
): PathologyExtractionProviderId {
  return (
    normalizePathologyExtractionProviderId(env.PATHOLOGY_EXTRACTION_PROVIDER) ??
    FI_PATHOLOGY_STUB_PROVIDER_ID
  );
}

export function buildManualReviewFallbackOutput(params: {
  requestedProviderId: PathologyExtractionProviderId;
  providerId: PathologyExtractionProviderId;
  rawText?: string;
  reason: string;
  latencyMs: number;
  credentialPresent: boolean;
  externalRequestId?: string | null;
  outcome?: "fallback_manual_review" | "provider_error";
}): PathologyPdfExtractionOutput {
  const threshold = readPathologyExtractionMinOcrConfidenceFromEnv();
  const rawText = params.rawText ?? "";
  return {
    provider: params.providerId,
    rawText,
    markers: [],
    ocrConfidence: null,
    source: "provider_fallback",
    skippedRawCount: 0,
    providerAudit: buildPathologyExtractionProviderAudit({
      providerId: params.providerId,
      requestedProviderId: params.requestedProviderId,
      outcome: params.outcome ?? "fallback_manual_review",
      fallbackReason: params.reason,
      latencyMs: params.latencyMs,
      credentialPresent: params.credentialPresent,
      externalRequestId: params.externalRequestId,
    }),
    requiresManualReview: true,
    confidenceSummary: buildPathologyExtractionConfidenceSummary([], null, threshold),
  };
}

/** Secondary parse pass shared by OCR adapter shells when vendor OCR is unavailable. */
export function parseMarkersFromExtractedText(
  rawText: string,
  source: PathologyPdfExtractionOutput["source"]
): Pick<PathologyPdfExtractionOutput, "markers" | "ocrConfidence" | "source"> {
  const tabular = parseTabularMarkerLines(rawText);
  if (tabular.length > 0) {
    return { markers: tabular, ocrConfidence: 0.68, source };
  }
  return { markers: [], ocrConfidence: null, source: "empty" };
}

export { extractPdfAsciiText, parseTabularMarkerLines };
