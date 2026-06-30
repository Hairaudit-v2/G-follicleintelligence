"use client";

import type { ReactNode } from "react";
import {
  buildBrandingCssVariables,
  safeBrandingColourHex,
  FI_ADMIN_NEUTRAL_ACCENT,
} from "@/src/lib/fi/foundation/brandingCss";
import type { EffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { BrandLogoImage } from "@/src/components/brand/BrandLogoImage";
import { resolveTenantLogoSource } from "@/src/lib/brand/resolveTenantLogo";

const DEFAULT_HEADLINE = "FI Admin";

function BrandingBlock({
  effective,
  density,
}: {
  effective: EffectiveBranding;
  density: "layout" | "preview";
}) {
  const accent = safeBrandingColourHex(effective.accent_colour, FI_ADMIN_NEUTRAL_ACCENT);
  const headline = effective.brand_name?.trim() || DEFAULT_HEADLINE;
  const logoSrc = resolveTenantLogoSource(effective.logo_url);
  const support = effective.support_email?.trim() || null;
  const clinicLine = effective.clinic_display_name?.trim() || null;

  const box =
    density === "layout"
      ? "relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0F1629]/80 px-4 py-4 shadow-xl shadow-black/50 backdrop-blur-md sm:px-5 sm:py-4"
      : "rounded border border-amber-400/20 bg-amber-400/10 px-3 py-2 shadow-sm";

  return (
    <div className={box}>
      {density === "layout" ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(420px 120px at 0% 0%, rgba(34, 193, 255, 0.1), transparent 55%), radial-gradient(360px 100px at 100% 100%, rgba(124, 58, 237, 0.06), transparent 50%)",
          }}
          aria-hidden
        />
      ) : null}
      <div className="relative flex flex-wrap items-start gap-3 border-l-4 pl-3" style={{ borderLeftColor: accent }}>
        {logoSrc ? (
          <div className="shrink-0 pt-0.5">
            <BrandLogoImage
              logoUrl={effective.logo_url}
              alt={headline}
              width={120}
              height={40}
              className="h-10 w-auto max-w-[140px] object-contain"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <p className={`text-base font-semibold tracking-tight ${density === "layout" ? "text-[#F8FAFC]" : "text-slate-100"}`}>
            {headline}
          </p>
          {clinicLine ? (
            <p className={`text-xs ${density === "layout" ? "text-[#94A3B8]" : "text-slate-400"}`}>
              <span className={`font-medium ${density === "layout" ? "text-[#CBD5E1]" : "text-slate-300"}`}>Clinic:</span>{" "}
              {clinicLine}
            </p>
          ) : null}
          {support ? (
            <p className={`text-xs ${density === "layout" ? "text-[#94A3B8]" : "text-slate-400"}`}>
              <span className={`font-medium ${density === "layout" ? "text-[#CBD5E1]" : "text-slate-300"}`}>Support:</span>{" "}
              <a
                href={`mailto:${encodeURIComponent(support)}`}
                className="underline decoration-dotted underline-offset-2 hover:opacity-90"
                style={{ color: "var(--fi-brand-accent)" }}
              >
                {support}
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Applies tenant (or cascaded) effective branding to FI Admin using validated CSS variables and optional logo.
 *
 * - `layout`: wraps navigation + page content (tenant-level cascade from layout loader).
 * - `page-preview`: compact strip for configuration URL preview (`organisationId` / `clinicId` query params).
 */
export function FiTenantBrandFrame({
  effective,
  variant = "layout",
  children,
  /** Rendered above the tenant brand strip (e.g. primary nav). */
  topSlot,
}: {
  effective: EffectiveBranding;
  variant?: "layout" | "page-preview";
  children?: ReactNode;
  topSlot?: ReactNode;
}) {
  if (variant === "page-preview") {
    return (
      <div className="space-y-1" style={buildBrandingCssVariables(effective)}>
        <p className="text-xs font-medium uppercase tracking-wide text-amber-200">Cascade preview</p>
        <BrandingBlock effective={effective} density="preview" />
      </div>
    );
  }

  return (
    <div className="space-y-4" style={buildBrandingCssVariables(effective)}>
      {topSlot}
      <BrandingBlock effective={effective} density="layout" />
      {children}
    </div>
  );
}
