import type { RawPathologyExtractedMarker } from "./pathologyMarkerNormalize";

export const FI_PATHOLOGY_EXTRACTION_PROVIDER = "fi-pathology-stub-v1";

export type PathologyPdfExtractionOutput = {
  provider: string;
  rawText: string;
  markers: RawPathologyExtractedMarker[];
  ocrConfidence: number | null;
  source: "embedded_json" | "pdf_text" | "empty";
  skippedRawCount: number;
};

const EMBEDDED_JSON_PREFIX = "FI_PATHOLOGY_MARKERS_JSON=";

/** Extract printable ASCII runs from PDF byte streams (no external OCR deps). */
export function extractPdfAsciiText(pdfBytes: Uint8Array): string {
  const chunks: string[] = [];
  let run = "";
  for (let i = 0; i < pdfBytes.length; i++) {
    const c = pdfBytes[i];
    if (c >= 32 && c <= 126) {
      run += String.fromCharCode(c);
    } else if (run.length >= 4) {
      chunks.push(run);
      run = "";
    } else {
      run = "";
    }
  }
  if (run.length >= 4) chunks.push(run);
  return chunks.join("\n");
}

function parseEmbeddedMarkersJson(text: string): RawPathologyExtractedMarker[] | null {
  const idx = text.indexOf(EMBEDDED_JSON_PREFIX);
  if (idx < 0) return null;
  const slice = text.slice(idx + EMBEDDED_JSON_PREFIX.length);
  const end = slice.indexOf("\n");
  const jsonPart = (end >= 0 ? slice.slice(0, end) : slice).trim();
  if (!jsonPart.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(jsonPart) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((row) => row && typeof row === "object" && !Array.isArray(row))
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          test_code: r.test_code != null ? String(r.test_code) : null,
          test_label: r.test_label != null ? String(r.test_label) : null,
          result_value: r.result_value != null ? String(r.result_value) : null,
          result_unit: r.result_unit != null ? String(r.result_unit) : null,
          reference_range: r.reference_range != null ? String(r.reference_range) : null,
          flag: r.flag != null ? String(r.flag) : null,
          confidence:
            typeof r.confidence === "number" && Number.isFinite(r.confidence) ? r.confidence : null,
        };
      });
  } catch {
    return null;
  }
}

/** Parse tabular marker lines: Label | Value | Unit | Range | Flag */
function parseTabularMarkerLines(text: string): RawPathologyExtractedMarker[] {
  const markers: RawPathologyExtractedMarker[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%") || trimmed.startsWith("FI_PATHOLOGY")) continue;
    const parts = trimmed.split("|").map((p) => p.trim());
    if (parts.length < 2) continue;
    const [label, value, unit, range, flag] = parts;
    if (!label || !value) continue;
    if (!/[a-zA-Z]/.test(label)) continue;
    markers.push({
      test_label: label,
      result_value: value,
      result_unit: unit || null,
      reference_range: range || null,
      flag: flag || null,
      confidence: 0.75,
    });
  }
  return markers;
}

/**
 * Deterministic pathology PDF extraction (Sprint F stub provider).
 * Supports embedded JSON test fixtures and pipe-delimited text rows.
 */
export function extractPathologyMarkersFromPdf(pdfBytes: Uint8Array): PathologyPdfExtractionOutput {
  const rawText = extractPdfAsciiText(pdfBytes);
  const embedded = parseEmbeddedMarkersJson(rawText);
  if (embedded && embedded.length > 0) {
    return {
      provider: FI_PATHOLOGY_EXTRACTION_PROVIDER,
      rawText,
      markers: embedded,
      ocrConfidence: 0.95,
      source: "embedded_json",
      skippedRawCount: 0,
    };
  }

  const tabular = parseTabularMarkerLines(rawText);
  if (tabular.length > 0) {
    return {
      provider: FI_PATHOLOGY_EXTRACTION_PROVIDER,
      rawText,
      markers: tabular,
      ocrConfidence: 0.72,
      source: "pdf_text",
      skippedRawCount: 0,
    };
  }

  return {
    provider: FI_PATHOLOGY_EXTRACTION_PROVIDER,
    rawText,
    markers: [],
    ocrConfidence: null,
    source: "empty",
    skippedRawCount: 0,
  };
}

export function truncateRawTextPreview(rawText: string, maxLen = 2000): string {
  const t = rawText.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}
