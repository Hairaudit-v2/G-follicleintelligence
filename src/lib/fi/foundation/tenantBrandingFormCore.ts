/**
 * Client-safe helpers for Settings → Branding form hydration and save merging.
 */

import {
  parseTenantBrandingMetadata,
  type NormalizedTenantBranding,
} from "./tenantBrandingCore";
import { safeBrandingColourHex } from "./brandingCss";
import type { FiTenantSettingsRow, WriteFiTenantSettingsPayload } from "./tenantSettings";

export type TenantBrandingFormFields = {
  brand_name: string;
  logo_url: string;
  primary_colour: string;
  secondary_colour: string;
  accent_colour: string;
  support_email: string;
  default_timezone: string;
};

/** Stable key for remounting branding edit UI after server revalidation. */
export function buildTenantBrandingRevisionKey(
  settings: FiTenantSettingsRow | null | undefined
): string {
  if (!settings) return "no-row";
  const meta = parseTenantBrandingMetadata(settings.metadata);
  return [
    settings.updated_at,
    meta.logo_storage_path ?? "",
    meta.logo_uploaded_at ?? "",
  ].join("|");
}

/** Initialize editable fields from persisted tenant settings (not cascade preview). */
export function buildTenantBrandingFormInitialState(
  settings: FiTenantSettingsRow | null | undefined
): TenantBrandingFormFields {
  return {
    brand_name: settings?.brand_name?.trim() ?? "",
    logo_url: settings?.logo_url?.trim() ?? "",
    primary_colour: settings?.primary_colour?.trim() ?? "",
    secondary_colour: settings?.secondary_colour?.trim() ?? "",
    accent_colour: settings?.accent_colour?.trim() ?? "",
    support_email: settings?.support_email?.trim() ?? "",
    default_timezone: settings?.default_timezone?.trim() ?? "",
  };
}

/**
 * When a submitted field is blank/null, keep the existing persisted value so
 * partial saves (e.g. colours only) do not erase logo metadata companions or other fields.
 */
export function mergeTenantSettingsSavePayload(
  existing: FiTenantSettingsRow | null | undefined,
  incoming: WriteFiTenantSettingsPayload
): WriteFiTenantSettingsPayload {
  const keep = <T extends string | null>(
    next: T,
    prev: string | null | undefined
  ): T => {
    if (next !== null && String(next).trim() !== "") return next;
    return (prev ?? null) as T;
  };

  return {
    // Blank brand name is an explicit clear — unlike colours, which use "leave blank to keep".
    brand_name: incoming.brand_name,
    logo_url: keep(incoming.logo_url, existing?.logo_url),
    primary_colour: keep(incoming.primary_colour, existing?.primary_colour),
    secondary_colour: keep(incoming.secondary_colour, existing?.secondary_colour),
    accent_colour: keep(incoming.accent_colour, existing?.accent_colour),
    support_email: keep(incoming.support_email, existing?.support_email),
    default_timezone: keep(incoming.default_timezone, existing?.default_timezone),
  };
}

export function tenantBrandingHasUploadedLogo(
  settings: FiTenantSettingsRow | null | undefined
): boolean {
  return Boolean(parseTenantBrandingMetadata(settings?.metadata ?? null).logo_storage_path);
}

export function tenantBrandingHasLegacyLogoUrl(
  settings: FiTenantSettingsRow | null | undefined
): boolean {
  return Boolean(settings?.logo_url?.trim());
}

/** Ordered logo fallback chain shown in the Branding UI. */
export const TENANT_BRANDING_LOGO_FALLBACK_ORDER = [
  "Uploaded logo",
  "Legacy logo URL",
  "Clinic initials",
  "FI mark",
] as const;

export type TenantBrandingLogoControlsState = {
  hasUploadedLogo: boolean;
  hasLegacyLogoUrl: boolean;
  /** True only when the uploaded logo can actually be removed (upload exists + editable). */
  removeUploadedEnabled: boolean;
  /** True only when a legacy `logo_url` can be cleared (legacy set + editable). */
  clearLegacyEnabled: boolean;
  /** No upload present but a legacy URL is doing the work. */
  legacyOnly: boolean;
  /** Human status line describing which logo source is active. */
  statusLabel: string;
  fallbackOrder: readonly string[];
};

/**
 * Pure derivation of Branding logo control availability + messaging.
 * Centralised so the UI and tests agree on when Remove / Clear are enabled
 * and which fallback source is currently active.
 */
export function computeTenantBrandingLogoControlsState(input: {
  settings: FiTenantSettingsRow | null | undefined;
  canEdit: boolean;
  busy?: boolean;
}): TenantBrandingLogoControlsState {
  const hasUploadedLogo = tenantBrandingHasUploadedLogo(input.settings);
  const hasLegacyLogoUrl = tenantBrandingHasLegacyLogoUrl(input.settings);
  const editable = input.canEdit && !input.busy;
  const legacyOnly = !hasUploadedLogo && hasLegacyLogoUrl;

  const statusLabel = hasUploadedLogo
    ? "Using uploaded logo."
    : legacyOnly
      ? "Using legacy logo URL."
      : "No logo set — initials will show.";

  return {
    hasUploadedLogo,
    hasLegacyLogoUrl,
    removeUploadedEnabled: editable && hasUploadedLogo,
    clearLegacyEnabled: editable && hasLegacyLogoUrl,
    legacyOnly,
    statusLabel,
    fallbackOrder: TENANT_BRANDING_LOGO_FALLBACK_ORDER,
  };
}

/** Preview draft values derived from form fields + resolved tenant branding logo. */
export function buildTenantBrandingPreviewDraft(
  fields: TenantBrandingFormFields,
  tenantBranding: NormalizedTenantBranding,
  localLogoPreview?: string | null
): {
  brandName: string;
  primaryColour: string;
  accentColour: string;
  logoUrl: string | null;
  localLogoPreview?: string | null;
} {
  return {
    brandName: fields.brand_name.trim() || tenantBranding.clinicDisplayName,
    primaryColour: safeBrandingColourHex(
      fields.primary_colour.trim() || null,
      tenantBranding.primaryColor
    ),
    accentColour: safeBrandingColourHex(
      fields.accent_colour.trim() || null,
      tenantBranding.accentColor
    ),
    logoUrl: tenantBranding.logoUrl,
    localLogoPreview,
  };
}
