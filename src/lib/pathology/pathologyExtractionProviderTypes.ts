import type { RawPathologyExtractedMarker } from "./pathologyMarkerNormalize";

/** Deterministic local/test provider — default when unset. */
export const FI_PATHOLOGY_STUB_PROVIDER_ID = "fi-pathology-stub-v1" as const;

export const PATHOLOGY_EXTRACTION_PROVIDER_IDS = [
  FI_PATHOLOGY_STUB_PROVIDER_ID,
  "aws-textract-v1",
  "google-vision-v1",
  "openai-vision-v1",
] as const;

export type PathologyExtractionProviderId = (typeof PATHOLOGY_EXTRACTION_PROVIDER_IDS)[number];

export type PathologyExtractionSource =
  | "embedded_json"
  | "pdf_text"
  | "ocr_textract"
  | "ocr_vision"
  | "ocr_openai"
  | "empty"
  | "provider_fallback";

export type PathologyExtractionProviderAuditOutcome =
  | "extracted"
  | "fallback_manual_review"
  | "provider_error";

export type PathologyExtractionProviderAuditRecord = {
  provider_id: PathologyExtractionProviderId;
  requested_provider_id: PathologyExtractionProviderId;
  outcome: PathologyExtractionProviderAuditOutcome;
  fallback_reason: string | null;
  latency_ms: number;
  credential_present: boolean;
  external_request_id: string | null;
  invoked_at: string;
};

export type PathologyExtractionConfidenceSummary = {
  document_ocr_confidence: number | null;
  min_marker_confidence: number | null;
  avg_marker_confidence: number | null;
  markers_below_threshold: number;
  confidence_threshold: number;
  meets_threshold: boolean;
};

export type PathologyPdfExtractionOutput = {
  provider: PathologyExtractionProviderId;
  rawText: string;
  markers: RawPathologyExtractedMarker[];
  ocrConfidence: number | null;
  source: PathologyExtractionSource;
  skippedRawCount: number;
  providerAudit: PathologyExtractionProviderAuditRecord;
  requiresManualReview: boolean;
  confidenceSummary: PathologyExtractionConfidenceSummary;
};

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function buildPathologyExtractionConfidenceSummary(
  markers: RawPathologyExtractedMarker[],
  documentOcrConfidence: number | null,
  threshold: number
): PathologyExtractionConfidenceSummary {
  const confidences = markers
    .map((m) => m.confidence)
    .filter((c): c is number => typeof c === "number" && Number.isFinite(c));

  const minMarker =
    confidences.length > 0 ? Math.min(...confidences.map(clampConfidence)) : null;
  const avgMarker =
    confidences.length > 0
      ? clampConfidence(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : null;

  const markersBelowThreshold = confidences.filter((c) => clampConfidence(c) < threshold).length;
  const docOk =
    documentOcrConfidence == null || clampConfidence(documentOcrConfidence) >= threshold;
  const markerOk =
    markers.length === 0
      ? false
      : minMarker != null && minMarker >= threshold && markersBelowThreshold === 0;

  return {
    document_ocr_confidence: documentOcrConfidence,
    min_marker_confidence: minMarker,
    avg_marker_confidence: avgMarker,
    markers_below_threshold: markersBelowThreshold,
    confidence_threshold: threshold,
    meets_threshold: docOk && markerOk,
  };
}

export function normalizePathologyExtractionProviderId(
  raw: string | null | undefined
): PathologyExtractionProviderId | null {
  const t = raw?.trim().toLowerCase();
  if (!t) return null;
  if (t === "stub" || t === FI_PATHOLOGY_STUB_PROVIDER_ID) return FI_PATHOLOGY_STUB_PROVIDER_ID;
  if (t === "textract" || t === "aws-textract-v1") return "aws-textract-v1";
  if (t === "vision" || t === "google-vision-v1" || t === "google_vision") {
    return "google-vision-v1";
  }
  if (t === "openai" || t === "openai-vision-v1") return "openai-vision-v1";
  if ((PATHOLOGY_EXTRACTION_PROVIDER_IDS as readonly string[]).includes(t)) {
    return t as PathologyExtractionProviderId;
  }
  return null;
}
