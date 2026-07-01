/**
 * ImagingOS Phase 2 — tenant imaging quality policy (fi_tenant_settings.metadata.imaging_quality).
 */

export type ImagingQualityTenantPolicy = {
  enabled: boolean;
  block_upload_on_poor_quality: boolean;
  block_only_audit_required_views: boolean;
  minimum_quality_score: number;
};

export const IMAGING_QUALITY_POLICY_DEFAULTS: ImagingQualityTenantPolicy = {
  enabled: true,
  block_upload_on_poor_quality: false,
  block_only_audit_required_views: true,
  minimum_quality_score: 70,
};

export function parseImagingQualityPolicy(raw: unknown): ImagingQualityTenantPolicy {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...IMAGING_QUALITY_POLICY_DEFAULTS };
  }
  const o = raw as Record<string, unknown>;
  const min = Number(o.minimum_quality_score);
  return {
    enabled: o.enabled === false ? false : IMAGING_QUALITY_POLICY_DEFAULTS.enabled,
    block_upload_on_poor_quality: o.block_upload_on_poor_quality === true,
    block_only_audit_required_views:
      o.block_only_audit_required_views === false
        ? false
        : IMAGING_QUALITY_POLICY_DEFAULTS.block_only_audit_required_views,
    minimum_quality_score:
      Number.isFinite(min) && min >= 0 && min <= 100
        ? Math.round(min)
        : IMAGING_QUALITY_POLICY_DEFAULTS.minimum_quality_score,
  };
}

export function parseImagingQualityPolicyFromTenantMetadata(
  metadata: unknown
): ImagingQualityTenantPolicy {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { ...IMAGING_QUALITY_POLICY_DEFAULTS };
  }
  return parseImagingQualityPolicy((metadata as Record<string, unknown>).imaging_quality);
}