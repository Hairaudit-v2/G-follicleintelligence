/**
 * ImagingOS — image quality evaluation contract (Phase IM-1 stub + IM-4 metadata engine).
 * Stub evaluator preserved for backwards compatibility; IM-4 adds metadata-first scoring.
 */

import type { CanonicalHairImageCategory } from "./categories";
import {
  getImageQualityExpectationsForCategory,
  QUALITY_BASELINE_MIN_DIMENSION,
  QUALITY_BASELINE_PREFERRED_DIMENSION,
} from "./qualityRules";
import type { ImagingOsSourceSystem, ImagingOsUploadSurface } from "./types";

export type ImageQualityStatus = "pass" | "warn" | "fail" | "not_evaluated";

export type ImageQualityScores = {
  blur_score: number | null;
  lighting_score: number | null;
  angle_score: number | null;
  resolution_score: number | null;
  occlusion_score: number | null;
};

export type ImageQualityResult = ImageQualityScores & {
  quality_status: ImageQualityStatus;
  notes: string;
};

export type ImageQualityStubInput = {
  content_type?: string | null;
  file_size_bytes?: number | null;
};

export type ImagingOsImageQualityStatus =
  | "not_evaluated"
  | "excellent"
  | "acceptable"
  | "borderline"
  | "poor"
  | "invalid";

export type ImagingOsImageQualitySignalStatus = "pass" | "warning" | "fail" | "unknown";

export type ImagingOsImageQualitySignal = {
  name: string;
  status: ImagingOsImageQualitySignalStatus;
  score: number;
  message: string;
};

export const IMAGING_QUALITY_METADATA_EVALUATOR_VERSION = "imaging-quality-metadata-v1" as const;

export type ImagingOsImageQualityEvaluationResult = {
  quality_status: ImagingOsImageQualityStatus;
  quality_score: number;
  is_clinically_usable: boolean;
  signals: ImagingOsImageQualitySignal[];
  warnings: string[];
  blockers: string[];
  evaluator_version: typeof IMAGING_QUALITY_METADATA_EVALUATOR_VERSION;
};

export type ImagingOsImageQualityMetadataInput = {
  width?: number;
  height?: number;
  size_bytes?: number;
  content_type?: string;
  canonical_category?: CanonicalHairImageCategory;
  source_system?: ImagingOsSourceSystem;
  upload_surface?: ImagingOsUploadSurface;
  metadata?: Record<string, unknown>;
};

export type ImagingOsPipelineQualityResult =
  | ImageQualityResult
  | ImagingOsImageQualityEvaluationResult;

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const KB = 1024;
const MIN_FILE_SIZE_BYTES = 80 * KB;
const WARN_FILE_SIZE_BYTES = 250 * KB;
const MAX_FILE_SIZE_BYTES = 15 * 1024 * KB;

const EXTREME_ASPECT_RATIO_MAX = 2.2;
const EXTREME_ASPECT_RATIO_MIN = 0.45;

const QUALITY_HINT_KEYS = [
  "blur_score",
  "lighting_score",
  "angle_deviation_degrees",
  "scalp_visibility_score",
] as const;

function normalizeContentType(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.trim().toLowerCase();
}

function readMetadataNumber(
  metadata: Record<string, unknown> | undefined,
  key: string
): number | undefined {
  const value = metadata?.[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isUnknownCategory(category: CanonicalHairImageCategory | undefined): boolean {
  return category == null || category === "other";
}

function isImpossibleDimension(value: number | undefined): boolean {
  return value != null && (!Number.isFinite(value) || value <= 0);
}

function isImpossibleSize(sizeBytes: number | undefined): boolean {
  return sizeBytes != null && (!Number.isFinite(sizeBytes) || sizeBytes <= 0);
}

function pushSignal(
  signals: ImagingOsImageQualitySignal[],
  name: string,
  status: ImagingOsImageQualitySignalStatus,
  score: number,
  message: string
): void {
  signals.push({ name, status, score, message });
}

/**
 * Deterministic stub — returns not_evaluated until metadata is supplied to the pipeline.
 */
export function evaluateImageQualityStub(_input: ImageQualityStubInput = {}): ImageQualityResult {
  return {
    quality_status: "not_evaluated",
    blur_score: null,
    lighting_score: null,
    angle_score: null,
    resolution_score: null,
    occlusion_score: null,
    notes: "Quality evaluation not run (ImagingOS IM-1 stub)",
  };
}

export function isImagingOsMetadataQualityResult(
  quality: ImagingOsPipelineQualityResult
): quality is ImagingOsImageQualityEvaluationResult {
  return (
    typeof quality === "object" &&
    quality != null &&
    "evaluator_version" in quality &&
    quality.evaluator_version === IMAGING_QUALITY_METADATA_EVALUATOR_VERSION
  );
}

export function hasMetadataForQualityEvaluation(input: {
  width?: number;
  height?: number;
  size_bytes?: number;
  content_type?: string;
  metadata?: Record<string, unknown>;
}): boolean {
  if (
    input.width != null ||
    input.height != null ||
    input.size_bytes != null ||
    (typeof input.content_type === "string" && input.content_type.trim().length > 0)
  ) {
    return true;
  }

  const metadata = input.metadata ?? {};
  return QUALITY_HINT_KEYS.some((key) => typeof metadata[key] === "number");
}

/**
 * Pure metadata-first quality evaluation (Phase IM-4).
 */
export function evaluateImageQualityFromMetadata(
  input: ImagingOsImageQualityMetadataInput
): ImagingOsImageQualityEvaluationResult {
  let score = 100;
  const signals: ImagingOsImageQualitySignal[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];

  const expectations = getImageQualityExpectationsForCategory(input.canonical_category);
  const minDimension = expectations.min_width ?? QUALITY_BASELINE_MIN_DIMENSION;
  const preferredDimension =
    expectations.preferred_min_width ?? QUALITY_BASELINE_PREFERRED_DIMENSION;
  const categoryMinSizeBytes = expectations.min_size_bytes;

  const normalizedContentType = normalizeContentType(input.content_type);
  let unsupportedContentType = false;

  if (!normalizedContentType) {
    score -= 10;
    pushSignal(signals, "content_type", "warning", score, "Content type missing");
    warnings.push("Content type missing");
  } else if (!ALLOWED_CONTENT_TYPES.has(normalizedContentType)) {
    unsupportedContentType = true;
    score -= 35;
    const message = `Unsupported content type: ${normalizedContentType}`;
    pushSignal(signals, "content_type", "fail", score, message);
    blockers.push(message);
  } else {
    pushSignal(
      signals,
      "content_type",
      "pass",
      score,
      `Supported content type: ${normalizedContentType}`
    );
  }

  const width = input.width;
  const height = input.height;
  const hasWidth = width != null;
  const hasHeight = height != null;
  const impossibleDimensions = isImpossibleDimension(width) || isImpossibleDimension(height);

  if (!hasWidth || !hasHeight) {
    score -= 15;
    pushSignal(signals, "dimensions", "warning", score, "Image dimensions missing");
    warnings.push("Image dimensions missing");
  } else if (impossibleDimensions) {
    score -= 25;
    const message = "Impossible image dimensions";
    pushSignal(signals, "dimensions", "fail", score, message);
    blockers.push(message);
  } else if (width! < minDimension || height! < minDimension) {
    score -= 25;
    const message = `Dimensions below minimum (${width}x${height}, minimum ${minDimension}px per side)`;
    pushSignal(signals, "dimensions", "fail", score, message);
    blockers.push(message);
  } else if (width! < preferredDimension || height! < preferredDimension) {
    score -= 10;
    pushSignal(
      signals,
      "dimensions",
      "warning",
      score,
      `Dimensions below preferred clinical detail (${width}x${height})`
    );
    warnings.push("Dimensions below preferred clinical detail threshold");
  } else {
    pushSignal(signals, "dimensions", "pass", score, `Dimensions acceptable (${width}x${height})`);
  }

  const sizeBytes = input.size_bytes;
  const impossibleSize = isImpossibleSize(sizeBytes);

  if (sizeBytes == null) {
    score -= 10;
    pushSignal(signals, "file_size", "warning", score, "File size missing");
    warnings.push("File size missing");
  } else if (impossibleSize) {
    score -= 25;
    const message = "Impossible file size";
    pushSignal(signals, "file_size", "fail", score, message);
    blockers.push(message);
  } else if (sizeBytes < MIN_FILE_SIZE_BYTES) {
    score -= 25;
    const message = `File size too small (${sizeBytes} bytes, minimum ${MIN_FILE_SIZE_BYTES} bytes)`;
    pushSignal(signals, "file_size", "fail", score, message);
    blockers.push(message);
  } else if (sizeBytes <= WARN_FILE_SIZE_BYTES) {
    score -= 10;
    pushSignal(signals, "file_size", "warning", score, "File size is low for clinical detail");
    warnings.push("File size is low for clinical detail");
  } else if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    score -= 5;
    pushSignal(signals, "file_size", "warning", score, "File size is unusually large");
    warnings.push("File size is unusually large");
  } else {
    pushSignal(signals, "file_size", "pass", score, "File size within expected range");
  }

  if (categoryMinSizeBytes != null && sizeBytes != null && sizeBytes < categoryMinSizeBytes) {
    score -= 10;
    pushSignal(
      signals,
      "category_file_size",
      "warning",
      score,
      `File size below category expectation for ${input.canonical_category ?? "unknown"}`
    );
    warnings.push(
      `File size below category expectation for ${input.canonical_category ?? "unknown"}`
    );
  }

  if (!hasWidth || !hasHeight) {
    pushSignal(
      signals,
      "aspect_ratio",
      "unknown",
      score,
      "Aspect ratio not evaluated (dimensions missing)"
    );
  } else if (!impossibleDimensions) {
    const aspectRatio = width! / height!;
    if (aspectRatio > EXTREME_ASPECT_RATIO_MAX || aspectRatio < EXTREME_ASPECT_RATIO_MIN) {
      score -= 10;
      pushSignal(
        signals,
        "aspect_ratio",
        "warning",
        score,
        `Extreme aspect ratio (${aspectRatio.toFixed(2)})`
      );
      warnings.push("Extreme aspect ratio may reduce clinical usefulness");
    } else {
      pushSignal(
        signals,
        "aspect_ratio",
        "pass",
        score,
        `Aspect ratio acceptable (${aspectRatio.toFixed(2)})`
      );
    }
  }

  if (isUnknownCategory(input.canonical_category)) {
    score -= 10;
    pushSignal(
      signals,
      "category_suitability",
      "warning",
      score,
      "Canonical category missing or unknown"
    );
    warnings.push("Canonical category missing or unknown");
  } else {
    pushSignal(
      signals,
      "category_suitability",
      "pass",
      score,
      `Category suitable for evaluation (${input.canonical_category})`
    );
  }

  const metadata = input.metadata ?? {};
  const blurScore = readMetadataNumber(metadata, "blur_score");
  if (blurScore != null) {
    if (blurScore > 0.7) {
      score -= 30;
      const message = `High blur score (${blurScore.toFixed(2)})`;
      pushSignal(signals, "blur_score", "fail", score, message);
      blockers.push(message);
    } else if (blurScore >= 0.4) {
      score -= 15;
      pushSignal(
        signals,
        "blur_score",
        "warning",
        score,
        `Moderate blur score (${blurScore.toFixed(2)})`
      );
      warnings.push("Moderate blur detected in metadata");
    } else {
      pushSignal(
        signals,
        "blur_score",
        "pass",
        score,
        `Blur score acceptable (${blurScore.toFixed(2)})`
      );
    }
  }

  const lightingScore = readMetadataNumber(metadata, "lighting_score");
  if (lightingScore != null) {
    if (lightingScore < 0.3) {
      score -= 25;
      const message = `Low lighting score (${lightingScore.toFixed(2)})`;
      pushSignal(signals, "lighting_score", "fail", score, message);
      blockers.push(message);
    } else if (lightingScore <= 0.6) {
      score -= 10;
      pushSignal(
        signals,
        "lighting_score",
        "warning",
        score,
        `Suboptimal lighting score (${lightingScore.toFixed(2)})`
      );
      warnings.push("Suboptimal lighting detected in metadata");
    } else {
      pushSignal(
        signals,
        "lighting_score",
        "pass",
        score,
        `Lighting score acceptable (${lightingScore.toFixed(2)})`
      );
    }
  }

  const angleDeviation = readMetadataNumber(metadata, "angle_deviation_degrees");
  if (angleDeviation != null) {
    if (angleDeviation > 35) {
      score -= 25;
      const message = `High angle deviation (${angleDeviation.toFixed(1)}°)`;
      pushSignal(signals, "angle_deviation", "fail", score, message);
      blockers.push(message);
    } else if (angleDeviation >= 20) {
      score -= 10;
      pushSignal(
        signals,
        "angle_deviation",
        "warning",
        score,
        `Moderate angle deviation (${angleDeviation.toFixed(1)}°)`
      );
      warnings.push("Moderate angle deviation detected in metadata");
    } else {
      pushSignal(
        signals,
        "angle_deviation",
        "pass",
        score,
        `Angle deviation acceptable (${angleDeviation.toFixed(1)}°)`
      );
    }
  }

  const scalpVisibilityScore = readMetadataNumber(metadata, "scalp_visibility_score");
  if (scalpVisibilityScore != null) {
    if (scalpVisibilityScore < 0.35) {
      score -= 30;
      const message = `Low scalp visibility score (${scalpVisibilityScore.toFixed(2)})`;
      pushSignal(signals, "scalp_visibility", "fail", score, message);
      blockers.push(message);
    } else if (scalpVisibilityScore <= 0.65) {
      score -= 15;
      pushSignal(
        signals,
        "scalp_visibility",
        "warning",
        score,
        `Moderate scalp visibility score (${scalpVisibilityScore.toFixed(2)})`
      );
      warnings.push("Moderate scalp visibility detected in metadata");
    } else {
      pushSignal(
        signals,
        "scalp_visibility",
        "pass",
        score,
        `Scalp visibility acceptable (${scalpVisibilityScore.toFixed(2)})`
      );
    }
  } else if (expectations.scalp_visibility_important) {
    warnings.push("Scalp visibility score not supplied for donor category");
  }

  const qualityScore = clampScore(score);

  let qualityStatus: ImagingOsImageQualityStatus;
  if (unsupportedContentType || impossibleDimensions || impossibleSize) {
    qualityStatus = "invalid";
  } else if (blockers.length > 0 || qualityScore < 50) {
    qualityStatus = "poor";
  } else if (qualityScore < 70) {
    qualityStatus = "borderline";
  } else if (qualityScore < 90) {
    qualityStatus = "acceptable";
  } else {
    qualityStatus = "excellent";
  }

  const isClinicallyUsable = qualityStatus === "acceptable" || qualityStatus === "excellent";

  return {
    quality_status: qualityStatus,
    quality_score: qualityScore,
    is_clinically_usable: isClinicallyUsable,
    signals,
    warnings,
    blockers,
    evaluator_version: IMAGING_QUALITY_METADATA_EVALUATOR_VERSION,
  };
}

export function canUseImageForClinicalIntelligence(result: ImagingOsImageQualityEvaluationResult): {
  usable: boolean;
  reason: string;
  blockers: string[];
} {
  if (result.quality_status === "invalid") {
    return {
      usable: false,
      reason: "Image quality invalid.",
      blockers: result.blockers,
    };
  }

  if (result.is_clinically_usable) {
    return {
      usable: true,
      reason: "Image quality acceptable for clinical intelligence.",
      blockers: [],
    };
  }

  return {
    usable: false,
    reason: "Image quality below clinical usability threshold.",
    blockers: result.blockers,
  };
}
