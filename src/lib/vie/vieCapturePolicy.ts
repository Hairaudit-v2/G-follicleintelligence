/** Tenant-level VIE capture quality policy (stored in fi_tenant_settings.metadata.vie_capture_policy). */

export type VieCapturePolicy = {
  allow_quality_override: boolean;
  minimum_capture_quality_score: number;
  block_clinically_unusable_images: boolean;
};

export const VIE_CAPTURE_POLICY_DEFAULTS: VieCapturePolicy = {
  allow_quality_override: false,
  minimum_capture_quality_score: 65,
  block_clinically_unusable_images: true,
};

export function parseVieCapturePolicy(raw: unknown): VieCapturePolicy {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...VIE_CAPTURE_POLICY_DEFAULTS };
  }
  const o = raw as Record<string, unknown>;
  const minScore = Number(o.minimum_capture_quality_score);
  return {
    allow_quality_override: o.allow_quality_override === true,
    minimum_capture_quality_score:
      Number.isFinite(minScore) && minScore >= 0 && minScore <= 100
        ? Math.round(minScore)
        : VIE_CAPTURE_POLICY_DEFAULTS.minimum_capture_quality_score,
    block_clinically_unusable_images:
      o.block_clinically_unusable_images === false
        ? false
        : VIE_CAPTURE_POLICY_DEFAULTS.block_clinically_unusable_images,
  };
}

export function parseVieCapturePolicyFromTenantMetadata(metadata: unknown): VieCapturePolicy {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { ...VIE_CAPTURE_POLICY_DEFAULTS };
  }
  return parseVieCapturePolicy((metadata as Record<string, unknown>).vie_capture_policy);
}
