/**
 * Client-safe tenant branding normalization — fallbacks, metadata parsing, initials.
 */

import type { EffectiveBranding } from "./tenantSettings";
import {
  FI_ADMIN_NEUTRAL_ACCENT,
  FI_ADMIN_NEUTRAL_PRIMARY,
  FI_ADMIN_NEUTRAL_SECONDARY,
  safeBrandingColourHex,
} from "./brandingCss";

export const FI_DEFAULT_BRAND_NAME = "Follicle Intelligence";
export const FI_DEFAULT_BRAND_MARK = "FI";

export type TenantBrandingThemeMode = "light" | "dark" | "system";

export type TenantBrandingMetadata = {
  logo_storage_bucket?: string | null;
  logo_storage_path?: string | null;
  logo_uploaded_at?: string | null;
  theme_mode?: TenantBrandingThemeMode | null;
};

/** Normalized branding values for shell rendering and previews. */
export type NormalizedTenantBranding = {
  clinicDisplayName: string;
  logoUrl: string | null;
  /** Raw `logo_url` column — legacy http(s) or public path fallback. */
  logoUrlLegacy: string | null;
  logoStoragePath: string | null;
  logoStorageBucket: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  themeMode: TenantBrandingThemeMode | null;
  clinicInitials: string;
};

export function parseTenantBrandingMetadata(
  metadata: Record<string, unknown> | null | undefined
): TenantBrandingMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const bucket = metadata.logo_storage_bucket;
  const path = metadata.logo_storage_path;
  const uploadedAt = metadata.logo_uploaded_at;
  const theme = metadata.theme_mode;
  const themeMode =
    theme === "light" || theme === "dark" || theme === "system" ? theme : null;
  return {
    logo_storage_bucket:
      typeof bucket === "string" && bucket.trim() ? bucket.trim() : null,
    logo_storage_path: typeof path === "string" && path.trim() ? path.trim() : null,
    logo_uploaded_at:
      typeof uploadedAt === "string" && uploadedAt.trim() ? uploadedAt.trim() : null,
    theme_mode: themeMode,
  };
}

export function deriveClinicInitials(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return FI_DEFAULT_BRAND_MARK;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return FI_DEFAULT_BRAND_MARK;
  if (words.length === 1) {
    const w = words[0]!;
    return w.length >= 2 ? w.slice(0, 2).toUpperCase() : w.toUpperCase();
  }
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Mix hex colour with alpha for soft surfaces (returns rgba). */
export function hexToRgba(hex: string, alpha: number): string {
  const t = hex.trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t);
  if (!match) return `rgba(75, 85, 99, ${alpha})`;
  let h = match[1]!;
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export type NormalizeTenantBrandingInput = {
  effective: EffectiveBranding;
  /** Resolved display URL for uploaded logo (signed URL). Uploaded path wins when set. */
  uploadedLogoUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Pure normalization — never throws. Applies FI defaults for missing colours/names.
 */
export function normalizeTenantBranding(
  input: NormalizeTenantBrandingInput
): NormalizedTenantBranding {
  const { effective } = input;
  const meta = parseTenantBrandingMetadata(input.metadata ?? null);
  const displayName =
    effective.clinic_display_name?.trim() ||
    effective.brand_name?.trim() ||
    FI_DEFAULT_BRAND_NAME;

  const legacyLogo = effective.logo_url?.trim() || null;
  const uploaded = input.uploadedLogoUrl?.trim() || null;
  const logoUrl = uploaded || legacyLogo;

  return {
    clinicDisplayName: displayName,
    logoUrl,
    logoUrlLegacy: legacyLogo,
    logoStoragePath: meta.logo_storage_path ?? null,
    logoStorageBucket: meta.logo_storage_bucket ?? null,
    primaryColor: safeBrandingColourHex(effective.primary_colour, FI_ADMIN_NEUTRAL_PRIMARY),
    secondaryColor: safeBrandingColourHex(
      effective.secondary_colour,
      FI_ADMIN_NEUTRAL_SECONDARY
    ),
    accentColor: safeBrandingColourHex(effective.accent_colour, FI_ADMIN_NEUTRAL_ACCENT),
    themeMode: meta.theme_mode ?? null,
    clinicInitials: deriveClinicInitials(displayName),
  };
}

/** Safe empty branding for error/missing tenant paths. */
export function emptyNormalizedTenantBranding(): NormalizedTenantBranding {
  return normalizeTenantBranding({
    effective: {
      brand_name: null,
      logo_url: null,
      primary_colour: null,
      secondary_colour: null,
      accent_colour: null,
      support_email: null,
      default_timezone: null,
      website_url: null,
      clinic_display_name: null,
      booking_url: null,
      public_intake_url: null,
      clinic_phone: null,
      clinic_email: null,
      address: null,
      clinic_timezone: null,
    },
  });
}
