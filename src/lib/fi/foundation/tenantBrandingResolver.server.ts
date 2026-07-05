import "server-only";

import type { EffectiveBranding } from "./tenantSettings";
import { loadTenantBranding, resolveEffectiveBranding } from "./tenantSettings";
import {
  emptyNormalizedTenantBranding,
  normalizeTenantBranding,
  type NormalizedTenantBranding,
} from "./tenantBrandingCore";
import { resolveTenantLogoSignedUrl } from "./tenantBrandingStorage.server";

export type ResolveTenantBrandingParams = {
  tenantId: string;
  organisationId?: string | null;
  clinicId?: string | null;
};

/**
 * Single server-safe resolver for tenant branding.
 * Never throws — returns FI defaults when branding is missing or partially configured.
 */
export async function resolveTenantBranding(
  params: ResolveTenantBrandingParams
): Promise<NormalizedTenantBranding> {
  try {
    const effective = await resolveEffectiveBranding({
      tenantId: params.tenantId,
      organisationId: params.organisationId,
      clinicId: params.clinicId,
    });
    const tenantSettings = await loadTenantBranding(params.tenantId);
    const metadata = tenantSettings?.metadata ?? null;
    const uploadedLogoUrl = await resolveTenantLogoSignedUrl(metadata);
    return normalizeTenantBranding({ effective, uploadedLogoUrl, metadata });
  } catch {
    return emptyNormalizedTenantBranding();
  }
}

/** Build normalized branding from an already-loaded effective row (layout hot path). */
export async function normalizeEffectiveBrandingForShell(
  tenantId: string,
  effective: EffectiveBranding
): Promise<NormalizedTenantBranding> {
  try {
    const tenantSettings = await loadTenantBranding(tenantId);
    const metadata = tenantSettings?.metadata ?? null;
    const uploadedLogoUrl = await resolveTenantLogoSignedUrl(metadata);
    return normalizeTenantBranding({ effective, uploadedLogoUrl, metadata });
  } catch {
    return normalizeTenantBranding({ effective });
  }
}
