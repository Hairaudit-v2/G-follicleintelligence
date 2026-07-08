"use client";

import Image from "next/image";
import { useState } from "react";

import { BrandLogoImage } from "@/src/components/brand/BrandLogoImage";
import { resolveTenantLogoSource } from "@/src/lib/brand/resolveTenantLogo";
import { FI_DEFAULT_BRAND_MARK } from "@/src/lib/fi/foundation/tenantBrandingCore";
import type { NormalizedTenantBranding } from "@/src/lib/fi/foundation/tenantBrandingCore";
import { cn } from "@/lib/utils";

type TenantBrandMarkProps = {
  branding: NormalizedTenantBranding;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
  labelClassName?: string;
};

const SIZE = {
  xs: { box: "h-6 w-6 text-[10px]", img: 24, logoH: "h-4", logoMaxW: "max-w-[3.25rem]" },
  sm: { box: "h-8 w-8 text-xs", img: 32, logoH: "h-6", logoMaxW: "max-w-[140px]" },
  md: { box: "h-9 w-9 text-xs", img: 36, logoH: "h-8", logoMaxW: "max-w-[140px]" },
  lg: { box: "h-12 w-12 text-sm", img: 48, logoH: "h-10", logoMaxW: "max-w-[140px]" },
} as const;

/**
 * Tenant logo with fallback chain: uploaded/legacy logo → clinic initials → FI mark.
 */
export function TenantBrandMark({
  branding,
  size = "md",
  className,
  showLabel = false,
  labelClassName,
}: TenantBrandMarkProps) {
  const [hideLogo, _setHideLogo] = useState(false);
  const dims = SIZE[size];
  const logoSrc = resolveTenantLogoSource(branding.logoUrl);
  const initials = branding.clinicInitials || FI_DEFAULT_BRAND_MARK;

  const mark =
    logoSrc && !hideLogo ? (
      <BrandLogoImage
        logoUrl={branding.logoUrl}
        alt={branding.clinicDisplayName}
        width={dims.img}
        height={dims.img}
        className={cn("w-auto object-contain", dims.logoMaxW, dims.logoH)}
      />
    ) : (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border font-bold tracking-tight",
          dims.box
        )}
        style={{
          borderColor: "color-mix(in srgb, var(--fi-tenant-accent) 20%, transparent)",
          backgroundColor: "var(--fi-tenant-brand-bg)",
          color: "var(--fi-tenant-accent)",
        }}
        aria-hidden={!showLabel}
      >
        {initials}
      </div>
    );

  if (!showLabel) {
    return <div className={className}>{mark}</div>;
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {mark}
      <div className="min-w-0">
        <p
          className={cn("truncate text-sm font-semibold text-slate-50", labelClassName)}
          style={{ color: "inherit" }}
        >
          {branding.clinicDisplayName}
        </p>
      </div>
    </div>
  );
}

/** Preview logo on light/dark backgrounds (settings panel). */
export function TenantLogoPreviewStrip({
  logoUrl,
  displayName,
  localPreviewUrl,
}: {
  logoUrl: string | null;
  displayName: string;
  localPreviewUrl?: string | null;
}) {
  const preview = localPreviewUrl?.trim() || logoUrl;
  const src = resolveTenantLogoSource(preview);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["light", "dark"] as const).map((surface) => (
        <div
          key={surface}
          className={cn(
            "flex min-h-[72px] items-center justify-center rounded-xl border p-4",
            surface === "light"
              ? "border-slate-200 bg-white"
              : "border-white/10 bg-[#0F1629]"
          )}
        >
          {src && preview ? (
            preview.startsWith("blob:") || preview.startsWith("data:") ? (
              <Image
                src={preview}
                alt={displayName}
                width={120}
                height={40}
                unoptimized
                className="h-10 w-auto max-w-[140px] object-contain"
              />
            ) : (
              <BrandLogoImage
                logoUrl={preview}
                alt={displayName}
                width={120}
                height={40}
                className="h-10 w-auto max-w-[140px] object-contain"
              />
            )
          ) : (
            <span
              className={cn(
                "text-xs font-medium",
                surface === "light" ? "text-slate-500" : "text-slate-400"
              )}
            >
              No logo — initials will show
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
