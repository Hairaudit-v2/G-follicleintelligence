import type { VieCapturePolicy } from "./vieCapturePolicy";
import type {
  VieCaptureAcceptanceStatus,
  VieClinicalUsability,
  VieClinicalUsabilityStatus,
  VieInstantIntelligenceResult,
} from "./vieProtocolTypes";

export type VieQualityCheckInput = Pick<
  VieInstantIntelligenceResult,
  | "quality_score"
  | "quality_band"
  | "focus_verification"
  | "lighting_verification"
  | "classification"
  | "angle_verification"
>;

export type VieAcceptDecision = {
  allowed: boolean;
  requires_override: boolean;
  reason: string | null;
};

export function deriveClinicalUsability(
  intel: VieQualityCheckInput,
  policy: VieCapturePolicy
): VieClinicalUsability {
  const warnings: string[] = [];
  let status: VieClinicalUsabilityStatus = "usable";

  if (intel.quality_score < policy.minimum_capture_quality_score) {
    warnings.push(
      `Quality score ${intel.quality_score} is below the clinic minimum of ${policy.minimum_capture_quality_score}.`
    );
    status = "warning";
  }

  if (intel.quality_band === "retake_recommended") {
    warnings.push("Overall quality band recommends a retake.");
    status = status === "usable" ? "warning" : status;
  }

  if (intel.focus_verification.status === "heuristic_fail") {
    warnings.push(intel.focus_verification.message || "Focus check failed.");
    status = "unusable";
  }

  if (intel.lighting_verification.status === "heuristic_fail") {
    warnings.push(intel.lighting_verification.message || "Lighting check failed.");
    status = status === "unusable" ? "unusable" : "warning";
  }

  if (intel.classification.status === "pending_ai") {
    warnings.push(
      "View classification pending AI — follow the capture guide and review before accepting."
    );
  }

  const clinically_usable =
    status !== "unusable" &&
    (!policy.block_clinically_unusable_images ||
      intel.quality_score >= policy.minimum_capture_quality_score);

  if (policy.block_clinically_unusable_images && !clinically_usable && status !== "unusable") {
    status = "unusable";
  }

  const retake_recommendation =
    status === "unusable" || intel.quality_band === "retake_recommended"
      ? (warnings[0] ?? "Retake recommended for clinical documentation quality.")
      : status === "warning"
        ? "Acceptable with caution — consider retaking if any check looks wrong."
        : null;

  return {
    status,
    clinically_usable,
    warnings,
    retake_recommendation,
  };
}

export function canAcceptVieCapture(params: {
  clinical: VieClinicalUsability;
  quality_score: number;
  policy: VieCapturePolicy;
  quality_override?: boolean;
}): VieAcceptDecision {
  const { clinical, policy, quality_override } = params;

  if (clinical.clinically_usable) {
    return { allowed: true, requires_override: false, reason: null };
  }

  if (quality_override && policy.allow_quality_override) {
    return { allowed: true, requires_override: true, reason: null };
  }

  if (!policy.allow_quality_override) {
    return {
      allowed: false,
      requires_override: true,
      reason:
        clinical.retake_recommendation ??
        "Capture is not clinically usable. Retake or ask an admin to enable quality override.",
    };
  }

  return {
    allowed: false,
    requires_override: true,
    reason: "Quality override is required to accept this capture.",
  };
}

export function canProgressAfterCapture(params: {
  clinical: VieClinicalUsability;
  acceptance_status: VieCaptureAcceptanceStatus;
}): boolean {
  return params.acceptance_status === "accepted" && params.clinical.clinically_usable;
}

export function isVerificationCheckFailed(status: string): boolean {
  return status === "heuristic_fail";
}
