/**
 * ImagingOS Phase 2 — reusable pure image quality scoring core.
 */

import type { ImagingQualityTenantPolicy } from "./imageQualityPolicy";
import { IMAGING_QUALITY_POLICY_DEFAULTS } from "./imageQualityPolicy";

export type ImagingQualityStatus = "pass" | "review" | "fail";

export type ImagingQualityClientHints = {
  blur_score?: number | null;
  lighting_score?: number | null;
  framing_score?: number | null;
  exposure_hint?: "normal" | "underexposed" | "overexposed" | "unknown";
};

export type ImagingQualityServerHeuristic = {
  sharpness_score?: number | null;
  blur_status?: "clear" | "possible_blur" | "blurred" | "unknown";
  exposure_status?: "normal" | "underexposed" | "overexposed" | "unknown";
};

export type ImagingQualityDuplicateSignal = {
  duplicate_status: "unique" | "possible_duplicate" | "unknown";
};

export type ImagingQualityProtocolContext = {
  capture_source?: string | null;
  protocol_session_id?: string | null;
  protocol_template_slug?: string | null;
  protocol_slot_slug?: string | null;
  slot_required?: boolean;
  is_audit_context?: boolean;
};

export type ImagingQualityImageMetadata = {
  width?: number | null;
  height?: number | null;
  size_bytes?: number | null;
  content_type?: string | null;
  missing_required_fields?: string[];
};

export type ImagingQualityEvaluationInput = {
  image_metadata?: ImagingQualityImageMetadata;
  client_hints?: ImagingQualityClientHints;
  server_heuristic?: ImagingQualityServerHeuristic;
  duplicate_signal?: ImagingQualityDuplicateSignal;
  protocol_context?: ImagingQualityProtocolContext;
  policy?: Partial<ImagingQualityTenantPolicy>;
};

export type ImagingQualityEvaluationResult = {
  qualityScore: number;
  status: ImagingQualityStatus;
  reasons: string[];
  retakePrompt?: string;
  shouldBlockUpload: boolean;
};

const RETAKE_PROMPTS: Record<string, string> = {
  blur: "Image may be blurred. Retake with the camera held steady.",
  exposure_dark: "Image may be too dark. Retake in brighter, even lighting.",
  exposure_bright: "Image may be overexposed. Retake with softer, even lighting.",
  framing: "Framing may be incorrect. Retake following the protocol guide.",
  duplicate: "Image appears similar to a previous upload. Confirm or retake.",
  metadata: "Required capture metadata is missing. Retake using the guided protocol flow.",
  audit_required: "Required audit image quality is low. Please retake before continuing.",
  low_score: "Image quality score is below the clinic minimum. Retake before continuing.",
};

function normalizeSource(source: string | null | undefined): string {
  return String(source ?? "")
    .trim()
    .toLowerCase();
}

export function isAuditCaptureContext(context: ImagingQualityProtocolContext | undefined): boolean {
  if (!context) return false;
  if (context.is_audit_context === true) return true;
  const source = normalizeSource(context.capture_source);
  if (source.includes("hairaudit") || source.includes("audit")) return true;
  if (
    context.slot_required &&
    (source === "vie_capture_wizard" ||
      source === "appointment_procedure" ||
      source === "surgery_os" ||
      source === "imaging_os_wizard")
  ) {
    return true;
  }
  return false;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function pickRetakePrompt(reasons: string[]): string | undefined {
  if (reasons.some((r) => r.startsWith("audit_required"))) return RETAKE_PROMPTS.audit_required;
  if (reasons.some((r) => r.startsWith("duplicate"))) return RETAKE_PROMPTS.duplicate;
  if (reasons.some((r) => r.startsWith("blur"))) return RETAKE_PROMPTS.blur;
  if (reasons.some((r) => r.startsWith("exposure_under"))) return RETAKE_PROMPTS.exposure_dark;
  if (reasons.some((r) => r.startsWith("exposure_over"))) return RETAKE_PROMPTS.exposure_bright;
  if (reasons.some((r) => r.startsWith("framing"))) return RETAKE_PROMPTS.framing;
  if (reasons.some((r) => r.startsWith("metadata"))) return RETAKE_PROMPTS.metadata;
  if (reasons.some((r) => r.startsWith("low_score"))) return RETAKE_PROMPTS.low_score;
  return reasons.length > 0 ? RETAKE_PROMPTS.low_score : undefined;
}

export function resolveImagingQualityPolicy(
  policy?: Partial<ImagingQualityTenantPolicy>
): ImagingQualityTenantPolicy {
  return {
    enabled: policy?.enabled ?? IMAGING_QUALITY_POLICY_DEFAULTS.enabled,
    block_upload_on_poor_quality:
      policy?.block_upload_on_poor_quality ??
      IMAGING_QUALITY_POLICY_DEFAULTS.block_upload_on_poor_quality,
    block_only_audit_required_views:
      policy?.block_only_audit_required_views ??
      IMAGING_QUALITY_POLICY_DEFAULTS.block_only_audit_required_views,
    minimum_quality_score:
      policy?.minimum_quality_score ?? IMAGING_QUALITY_POLICY_DEFAULTS.minimum_quality_score,
  };
}

export function shouldBlockUploadForImagingQuality(input: {
  evaluation: Pick<ImagingQualityEvaluationResult, "status" | "qualityScore">;
  policy: ImagingQualityTenantPolicy;
  protocol_context?: ImagingQualityProtocolContext;
}): boolean {
  if (!input.policy.enabled || !input.policy.block_upload_on_poor_quality) return false;
  if (input.evaluation.status !== "fail") return false;

  if (input.policy.block_only_audit_required_views) {
    const audit = isAuditCaptureContext(input.protocol_context);
    const required = input.protocol_context?.slot_required === true;
    return audit && required;
  }

  return true;
}

/**
 * Pure scoring from metadata, client hints, server heuristics, and duplicate signals.
 */
export function evaluateImagingQuality(input: ImagingQualityEvaluationInput): ImagingQualityEvaluationResult {
  const policy = resolveImagingQualityPolicy(input.policy);
  const reasons: string[] = [];
  let score = 100;

  const meta = input.image_metadata ?? {};
  const hints = input.client_hints ?? {};
  const heuristic = input.server_heuristic ?? {};
  const duplicate = input.duplicate_signal ?? { duplicate_status: "unique" as const };
  const context = input.protocol_context ?? {};
  const auditContext = isAuditCaptureContext(context);

  if (!meta.width || !meta.height) {
    score -= 12;
    reasons.push("metadata_missing_dimensions");
  }
  if (!meta.size_bytes) {
    score -= 8;
    reasons.push("metadata_missing_file_size");
  }
  if (!meta.content_type?.trim()) {
    score -= 6;
    reasons.push("metadata_missing_content_type");
  }
  for (const field of meta.missing_required_fields ?? []) {
    score -= 10;
    reasons.push(`metadata_missing_${field}`);
  }

  const blurStatus = heuristic.blur_status ?? "unknown";
  if (blurStatus === "blurred") {
    score -= 30;
    reasons.push("blur_sharpness_low");
  } else if (blurStatus === "possible_blur") {
    score -= 15;
    reasons.push("blur_possible");
  }

  if (typeof hints.blur_score === "number" && hints.blur_score < 40) {
    score -= 12;
    reasons.push("blur_client_hint_low");
  }

  const exposureStatus = heuristic.exposure_status ?? hints.exposure_hint ?? "unknown";
  if (exposureStatus === "underexposed") {
    score -= 18;
    reasons.push("exposure_underexposed");
  } else if (exposureStatus === "overexposed") {
    score -= 16;
    reasons.push("exposure_overexposed");
  }

  if (typeof hints.lighting_score === "number" && hints.lighting_score < 45) {
    score -= 10;
    reasons.push("exposure_client_hint_low");
  }

  if (typeof hints.framing_score === "number" && hints.framing_score < 50) {
    score -= 12;
    reasons.push("framing_issue");
  }

  if (meta.width && meta.height) {
    const minSide = Math.min(meta.width, meta.height);
    if (minSide < 480) {
      score -= 20;
      reasons.push("framing_resolution_low");
    } else if (minSide < 720) {
      score -= 8;
      reasons.push("framing_resolution_borderline");
    }
  }

  if (duplicate.duplicate_status === "possible_duplicate") {
    score -= 22;
    reasons.push("duplicate_possible_same_session");
  }

  const qualityScore = clampScore(score);
  let status: ImagingQualityStatus = "pass";
  if (qualityScore < policy.minimum_quality_score) {
    status = qualityScore < Math.max(40, policy.minimum_quality_score - 20) ? "fail" : "review";
    reasons.push("low_score_below_minimum");
  } else if (reasons.some((r) => r.startsWith("blur_sharpness") || r.startsWith("exposure_"))) {
    status = "review";
  } else if (reasons.some((r) => r.startsWith("duplicate_"))) {
    status = "review";
  } else if (reasons.some((r) => r.startsWith("metadata_missing_"))) {
    status = auditContext && context.slot_required ? "review" : "pass";
  }

  if (auditContext && context.slot_required && status === "fail") {
    reasons.push("audit_required_view_quality_low");
  }

  const retakePrompt = pickRetakePrompt(reasons);
  const preliminary = { qualityScore, status, reasons, retakePrompt };
  const shouldBlockUpload = shouldBlockUploadForImagingQuality({
    evaluation: preliminary,
    policy,
    protocol_context: context,
  });

  return {
    qualityScore,
    status,
    reasons,
    retakePrompt,
    shouldBlockUpload,
  };
}

export function readClientCaptureHintsFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): ImagingQualityClientHints {
  const root = metadata?.capture_hints;
  if (!root || typeof root !== "object" || Array.isArray(root)) return {};
  const o = root as Record<string, unknown>;
  const exposure = String(o.exposure_hint ?? "").trim().toLowerCase();
  const exposure_hint =
    exposure === "underexposed" || exposure === "overexposed" || exposure === "normal"
      ? exposure
      : exposure
        ? "unknown"
        : undefined;
  return {
    blur_score: typeof o.blur_score === "number" ? o.blur_score : undefined,
    lighting_score: typeof o.lighting_score === "number" ? o.lighting_score : undefined,
    framing_score: typeof o.framing_score === "number" ? o.framing_score : undefined,
    exposure_hint: exposure_hint as ImagingQualityClientHints["exposure_hint"],
  };
}