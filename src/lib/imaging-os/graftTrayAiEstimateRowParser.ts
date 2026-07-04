/**
 * FI-IMAGING-GRAFT-TRAY-AI-TYPES-1 — validate graft tray AI estimate rows and summaries.
 * Pure — no I/O.
 */

import {
  GRAFT_TRAY_AI_PROVIDERS,
  GRAFT_TRAY_AI_REVIEW_ACTIONS,
  GRAFT_TRAY_AI_REVIEW_STATUSES,
  GRAFT_TRAY_CONFIDENCE_BANDS,
  GRAFT_TRAY_IMAGE_QUALITIES,
  GRAFT_TRAY_MANUAL_COUNT_SOURCES,
  GRAFT_TRAY_MISMATCH_BANDS,
  type GraftTrayAiEstimateRow,
  type GraftTrayAiEstimateSummary,
  type GraftTrayAiProviderName,
  type GraftTrayAiReviewAction,
  type GraftTrayAiReviewStatus,
  type GraftTrayConfidenceBand,
  type GraftTrayImageQuality,
  type GraftTrayManualCountSource,
  type GraftTrayMismatchBand,
} from "./graftTrayCountTypes";

function isUnionMember<T extends readonly string[]>(
  values: T,
  value: unknown
): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNullableInt(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function readRequiredString(value: unknown, field: string): string {
  const parsed = readString(value);
  if (!parsed) throw new Error(`Invalid graft tray AI estimate row: ${field} is required`);
  return parsed;
}

export function parseGraftTrayMismatchBand(
  value: unknown,
  options?: { fallback?: GraftTrayMismatchBand }
): GraftTrayMismatchBand {
  if (isUnionMember(GRAFT_TRAY_MISMATCH_BANDS, value)) return value;
  if (options?.fallback !== undefined) return options.fallback;
  throw new Error(`Invalid graft tray mismatch_band: ${JSON.stringify(value)}`);
}

export function parseGraftTrayAiReviewStatus(
  value: unknown,
  options?: { fallback?: GraftTrayAiReviewStatus }
): GraftTrayAiReviewStatus {
  if (isUnionMember(GRAFT_TRAY_AI_REVIEW_STATUSES, value)) return value;
  if (options?.fallback !== undefined) return options.fallback;
  throw new Error(`Invalid graft tray review_status: ${JSON.stringify(value)}`);
}

export function parseGraftTrayAiProviderName(
  value: unknown,
  options?: { fallback?: GraftTrayAiProviderName }
): GraftTrayAiProviderName {
  if (isUnionMember(GRAFT_TRAY_AI_PROVIDERS, value)) return value;
  if (options?.fallback !== undefined) return options.fallback;
  throw new Error(`Invalid graft tray provider: ${JSON.stringify(value)}`);
}

export function parseGraftTrayConfidenceBand(
  value: unknown,
  options?: { fallback?: GraftTrayConfidenceBand }
): GraftTrayConfidenceBand {
  if (isUnionMember(GRAFT_TRAY_CONFIDENCE_BANDS, value)) return value;
  if (options?.fallback !== undefined) return options.fallback;
  throw new Error(`Invalid graft tray confidence_band: ${JSON.stringify(value)}`);
}

export function parseGraftTrayImageQuality(
  value: unknown,
  options?: { fallback?: GraftTrayImageQuality }
): GraftTrayImageQuality {
  if (isUnionMember(GRAFT_TRAY_IMAGE_QUALITIES, value)) return value;
  if (options?.fallback !== undefined) return options.fallback;
  throw new Error(`Invalid graft tray image_quality: ${JSON.stringify(value)}`);
}

export function parseGraftTrayManualCountSource(
  value: unknown,
  options?: { fallback?: GraftTrayManualCountSource }
): GraftTrayManualCountSource {
  if (isUnionMember(GRAFT_TRAY_MANUAL_COUNT_SOURCES, value)) return value;
  if (options?.fallback !== undefined) return options.fallback;
  throw new Error(`Invalid graft tray manual_count_source: ${JSON.stringify(value)}`);
}

export function parseGraftTrayAiReviewAction(
  value: unknown
): GraftTrayAiReviewAction | null {
  if (value == null) return null;
  if (isUnionMember(GRAFT_TRAY_AI_REVIEW_ACTIONS, value)) return value;
  return null;
}

export function parseGraftTrayAiEstimateRow(row: unknown): GraftTrayAiEstimateRow {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("Graft tray AI estimate row must be an object");
  }

  const r = row as Record<string, unknown>;
  const manualCountSourceRaw = r.manual_count_source;
  const manualCountSource =
    manualCountSourceRaw == null
      ? null
      : parseGraftTrayManualCountSource(manualCountSourceRaw);

  return {
    id: readRequiredString(r.id, "id"),
    tenant_id: readRequiredString(r.tenant_id, "tenant_id"),
    patient_id: readRequiredString(r.patient_id, "patient_id"),
    image_id: readRequiredString(r.image_id, "image_id"),
    graft_tray_link_id: readString(r.graft_tray_link_id),
    surgery_id: readString(r.surgery_id),
    estimated_graft_count: readNullableInt(r.estimated_graft_count),
    manual_graft_count: readNullableInt(r.manual_graft_count),
    manual_count_source: manualCountSource,
    corrected_graft_count: readNullableInt(r.corrected_graft_count),
    delta: readNullableInt(r.delta),
    mismatch_band: parseGraftTrayMismatchBand(r.mismatch_band),
    confidence: typeof r.confidence === "number" && Number.isFinite(r.confidence) ? r.confidence : 0,
    confidence_band: parseGraftTrayConfidenceBand(r.confidence_band),
    image_quality: parseGraftTrayImageQuality(r.image_quality),
    assessable: r.assessable === true,
    review_status: parseGraftTrayAiReviewStatus(r.review_status),
    reviewer_decision: parseGraftTrayAiReviewAction(r.reviewer_decision),
    reviewed_by_fi_user_id: readString(r.reviewed_by_fi_user_id),
    reviewed_at: readString(r.reviewed_at),
    analysis_job_id: readString(r.analysis_job_id),
    provider: parseGraftTrayAiProviderName(r.provider),
    provider_version: readString(r.provider_version) ?? "unknown",
    review_reasons: r.review_reasons,
    created_at: readRequiredString(r.created_at, "created_at"),
    updated_at: readRequiredString(r.updated_at, "updated_at"),
  };
}

export function mapEstimateRowToSummary(row: GraftTrayAiEstimateRow): GraftTrayAiEstimateSummary {
  return {
    estimate_id: row.id,
    image_id: row.image_id,
    graft_tray_link_id: row.graft_tray_link_id,
    estimated_graft_count: row.estimated_graft_count,
    manual_graft_count: row.manual_graft_count,
    manual_count_source: row.manual_count_source ?? "missing",
    mismatch_band: row.mismatch_band,
    delta: row.delta,
    confidence: row.confidence,
    confidence_band: row.confidence_band,
    image_quality: row.image_quality,
    assessable: row.assessable,
    review_status: row.review_status,
    reviewer_decision: row.reviewer_decision,
    reviewed_by_fi_user_id: row.reviewed_by_fi_user_id,
    reviewed_at: row.reviewed_at,
    analysis_job_id: row.analysis_job_id,
    corrected_count: row.corrected_graft_count,
    provider: row.provider,
    provider_version: row.provider_version,
    generated_at: row.created_at,
  };
}

export function parseGraftTrayAiEstimateSummaryFromMetadata(
  metadata: Record<string, unknown>
): GraftTrayAiEstimateSummary | null {
  const raw = metadata.graft_tray_ai_estimate;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const e = raw as Record<string, unknown>;
  const estimateId = readString(e.estimate_id);
  const imageId = readString(e.image_id);
  if (!estimateId || !imageId) return null;

  return {
    estimate_id: estimateId,
    image_id: imageId,
    graft_tray_link_id: readString(e.graft_tray_link_id),
    estimated_graft_count: readNullableInt(e.estimated_graft_count),
    manual_graft_count: readNullableInt(e.manual_graft_count),
    manual_count_source: parseGraftTrayManualCountSource(e.manual_count_source, {
      fallback: "missing",
    }),
    mismatch_band: parseGraftTrayMismatchBand(e.mismatch_band, {
      fallback: "unable_to_assess",
    }),
    delta: readNullableInt(e.delta),
    confidence: typeof e.confidence === "number" && Number.isFinite(e.confidence) ? e.confidence : 0,
    confidence_band: parseGraftTrayConfidenceBand(e.confidence_band, { fallback: "unknown" }),
    image_quality: parseGraftTrayImageQuality(e.image_quality, { fallback: "unknown" }),
    assessable: e.assessable === true,
    review_status: parseGraftTrayAiReviewStatus(e.review_status, {
      fallback: "pending_review",
    }),
    reviewer_decision: parseGraftTrayAiReviewAction(e.reviewer_decision),
    reviewed_by_fi_user_id: readString(e.reviewed_by_fi_user_id),
    reviewed_at: readString(e.reviewed_at),
    analysis_job_id: readString(e.analysis_job_id),
    corrected_count: readNullableInt(e.corrected_count),
    provider: parseGraftTrayAiProviderName(e.provider, { fallback: "stub" }),
    provider_version: readString(e.provider_version) ?? "unknown",
    generated_at: readString(e.generated_at) ?? new Date().toISOString(),
  };
}