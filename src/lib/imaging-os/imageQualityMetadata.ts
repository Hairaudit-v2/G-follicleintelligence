/**
 * ImagingOS Phase 2 — canonical imaging_quality metadata shape.
 */

import type { ImagingQualityEvaluationResult } from "./imageQualityCore";

export const IMAGINGOS_QUALITY_EVALUATOR_VERSION = "imagingos_quality_v1" as const;

export type ImagingQualityMetadataRecord = {
  sharpness_score: number | null;
  blur_status: "clear" | "possible_blur" | "blurred" | "unknown";
  exposure_status: "normal" | "underexposed" | "overexposed" | "unknown";
  duplicate_status: "unique" | "possible_duplicate" | "unknown";
  quality_score: number;
  quality_status: "pass" | "review" | "fail";
  retake_prompt?: string;
  evaluated_at: string;
  evaluator_version: typeof IMAGINGOS_QUALITY_EVALUATOR_VERSION;
  reasons?: string[];
  content_hash?: string;
  perceptual_hash?: string;
};

export function buildImagingQualityMetadataRecord(input: {
  evaluation: ImagingQualityEvaluationResult;
  sharpness_score?: number | null;
  blur_status?: ImagingQualityMetadataRecord["blur_status"];
  exposure_status?: ImagingQualityMetadataRecord["exposure_status"];
  duplicate_status?: ImagingQualityMetadataRecord["duplicate_status"];
  content_hash?: string | null;
  perceptual_hash?: string | null;
  evaluated_at?: string;
}): ImagingQualityMetadataRecord {
  return {
    sharpness_score: input.sharpness_score ?? null,
    blur_status: input.blur_status ?? "unknown",
    exposure_status: input.exposure_status ?? "unknown",
    duplicate_status: input.duplicate_status ?? "unique",
    quality_score: input.evaluation.qualityScore,
    quality_status: input.evaluation.status,
    ...(input.evaluation.retakePrompt ? { retake_prompt: input.evaluation.retakePrompt } : {}),
    evaluated_at: input.evaluated_at ?? new Date().toISOString(),
    evaluator_version: IMAGINGOS_QUALITY_EVALUATOR_VERSION,
    ...(input.evaluation.reasons.length > 0 ? { reasons: input.evaluation.reasons } : {}),
    ...(input.content_hash ? { content_hash: input.content_hash } : {}),
    ...(input.perceptual_hash ? { perceptual_hash: input.perceptual_hash } : {}),
  };
}

/** Safe client-facing subset — no storage paths or internal hashes. */
export function toClientImagingQualitySummary(
  record: ImagingQualityMetadataRecord
): Pick<
  ImagingQualityMetadataRecord,
  "quality_score" | "quality_status" | "retake_prompt" | "blur_status" | "exposure_status" | "duplicate_status"
> {
  return {
    quality_score: record.quality_score,
    quality_status: record.quality_status,
    blur_status: record.blur_status,
    exposure_status: record.exposure_status,
    duplicate_status: record.duplicate_status,
    ...(record.retake_prompt ? { retake_prompt: record.retake_prompt } : {}),
  };
}