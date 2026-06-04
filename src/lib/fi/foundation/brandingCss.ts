/**
 * Stage 1M — safe CSS values derived from effective branding (no raw DB strings into style without checks).
 */

import type { CSSProperties } from "react";
import type { EffectiveBranding } from "./tenantSettings";

const HEX_COLOUR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Neutral Tailwind-aligned greys / blue when settings are missing or invalid. */
export const FI_ADMIN_NEUTRAL_PRIMARY = "#4b5563";
export const FI_ADMIN_NEUTRAL_SECONDARY = "#9ca3af";
export const FI_ADMIN_NEUTRAL_ACCENT = "#2563eb";

export function safeBrandingColourHex(input: string | null | undefined, fallback: string): string {
  const t = input?.trim();
  if (!t || !HEX_COLOUR.test(t)) return fallback;
  return t;
}

/** Only http(s) URLs within length; used before rendering <img src>. */
export function safeLogoUrlForImg(url: string | null | undefined): string | null {
  const t = url?.trim();
  if (!t || t.length > 2048) return null;
  const low = t.toLowerCase();
  if (!low.startsWith("https://") && !low.startsWith("http://")) return null;
  return t;
}

export function buildBrandingCssVariables(effective: EffectiveBranding): CSSProperties {
  const primary = safeBrandingColourHex(effective.primary_colour, FI_ADMIN_NEUTRAL_PRIMARY);
  const secondary = safeBrandingColourHex(effective.secondary_colour, FI_ADMIN_NEUTRAL_SECONDARY);
  const accent = safeBrandingColourHex(effective.accent_colour, FI_ADMIN_NEUTRAL_ACCENT);
  return {
    "--fi-brand-primary": primary,
    "--fi-brand-secondary": secondary,
    "--fi-brand-accent": accent,
  } as CSSProperties;
}
