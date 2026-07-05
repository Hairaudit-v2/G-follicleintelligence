"use client";

import type { ReactNode } from "react";

import type { NormalizedTenantBranding } from "@/src/lib/fi/foundation/tenantBrandingCore";
import { buildNormalizedBrandingCssVariables } from "@/src/lib/fi/foundation/brandingCss";

/**
 * Applies tenant CSS variables to staff-facing surfaces (PIN login, invites, onboarding).
 */
export function TenantBrandedSurface({
  branding,
  children,
  className,
}: {
  branding: NormalizedTenantBranding;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className} style={buildNormalizedBrandingCssVariables(branding)}>
      {children}
    </div>
  );
}
