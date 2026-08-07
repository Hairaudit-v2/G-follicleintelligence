/**
 * Shared projection failure categories — extracted from HairAudit provider patterns.
 * Safe for product UIs; never leak provider credentials or raw stack traces.
 */

export const SHARED_PROJECTION_FAILURE_CATEGORIES = [
  "prerequisites_incomplete",
  "unsupported_request",
  "source_image_unavailable",
  "mask_invalid",
  "provider_disabled",
  "provider_timeout",
  "provider_error",
  "validation_failed",
  "identity_or_containment_failed",
  "idempotency_conflict",
  "tenant_denied",
  "capability_denied",
  "implementation_failure",
] as const;

export type SharedProjectionFailureCategory =
  (typeof SHARED_PROJECTION_FAILURE_CATEGORIES)[number];

export const PATIENT_SAFE_FAILURE_MESSAGES: Record<SharedProjectionFailureCategory, string> = {
  prerequisites_incomplete:
    "Projected-outcome generation is not available until the surgical plan and hairline design are approved.",
  unsupported_request: "This projection request cannot be processed with the current inputs.",
  source_image_unavailable: "The selected source photograph could not be loaded for projection.",
  mask_invalid: "The treatment mask is incomplete or invalid for projection.",
  provider_disabled:
    "Projected-outcome generation is unavailable because the imaging provider is not configured.",
  provider_timeout: "Projected-outcome generation timed out. Please try again later.",
  provider_error: "Projected-outcome generation failed at the imaging provider.",
  validation_failed: "The generated image did not pass technical validation.",
  identity_or_containment_failed:
    "The generated image did not preserve identity or treatment-zone containment well enough for clinical review.",
  idempotency_conflict: "A conflicting projection request already exists for this key.",
  tenant_denied: "Projection request denied for this tenant.",
  capability_denied: "You do not have permission to perform this projection action.",
  implementation_failure: "Projected-outcome generation failed due to an internal error.",
};

export function patientSafeFailureMessage(
  category: SharedProjectionFailureCategory
): string {
  return PATIENT_SAFE_FAILURE_MESSAGES[category];
}

export function isSharedProjectionFailureCategory(
  value: unknown
): value is SharedProjectionFailureCategory {
  return (
    typeof value === "string" &&
    (SHARED_PROJECTION_FAILURE_CATEGORIES as readonly string[]).includes(value)
  );
}
