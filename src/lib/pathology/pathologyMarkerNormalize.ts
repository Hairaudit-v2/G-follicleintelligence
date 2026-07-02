import type { PathologyResultItemFlag } from "./pathologyResultTypes";

export type RawPathologyExtractedMarker = {
  test_code?: string | null;
  test_label?: string | null;
  result_value?: string | null;
  result_unit?: string | null;
  reference_range?: string | null;
  flag?: string | null;
  confidence?: number | null;
};

export type NormalizedPathologyMarker = {
  test_code: string | null;
  test_label: string;
  result_value: string;
  result_unit: string | null;
  reference_range: string | null;
  flag: PathologyResultItemFlag;
  confidence: number | null;
  source: "extraction" | "manual";
};

const VALID_FLAGS = new Set<PathologyResultItemFlag>([
  "low",
  "normal",
  "high",
  "critical",
  "unknown",
]);

function normalizeFlag(raw: string | null | undefined): PathologyResultItemFlag {
  const t = (raw ?? "").trim().toLowerCase();
  if (VALID_FLAGS.has(t as PathologyResultItemFlag)) return t as PathologyResultItemFlag;
  return "unknown";
}

export function normalizePathologyExtractedMarkers(
  raw: RawPathologyExtractedMarker[]
): NormalizedPathologyMarker[] {
  const out: NormalizedPathologyMarker[] = [];
  for (const row of raw) {
    const label = row.test_label?.trim() ?? "";
    if (!label) continue;
    out.push({
      test_code: row.test_code?.trim() ? row.test_code.trim() : null,
      test_label: label,
      result_value: row.result_value?.trim() ?? "",
      result_unit: row.result_unit?.trim() ? row.result_unit.trim() : null,
      reference_range: row.reference_range?.trim() ? row.reference_range.trim() : null,
      flag: normalizeFlag(row.flag),
      confidence:
        typeof row.confidence === "number" && Number.isFinite(row.confidence)
          ? row.confidence
          : null,
      source: "extraction",
    });
  }
  return out;
}

export function normalizedMarkersToResultItemInputs(
  markers: NormalizedPathologyMarker[]
): {
  test_code: string | null;
  test_label: string;
  result_value: string;
  result_unit: string | null;
  reference_range: string | null;
  flag: PathologyResultItemFlag;
}[] {
  return markers.map((m) => ({
    test_code: m.test_code,
    test_label: m.test_label,
    result_value: m.result_value,
    result_unit: m.result_unit,
    reference_range: m.reference_range,
    flag: m.flag,
  }));
}
