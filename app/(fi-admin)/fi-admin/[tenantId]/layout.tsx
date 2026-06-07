import { cn } from "@/lib/utils";
import { fiAdminAmbientBackgroundStyle } from "@/src/components/fi-admin/dashboard-ui";
import { FiOsAppShell } from "@/src/components/fi-os/FiOsAppShell";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { buildBrandingCssVariables } from "@/src/lib/fi/foundation/brandingCss";
import type { EffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { resolveEffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { getBookingsBoardNavAllowed, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { resolveFiOsAuthUserEmail } from "@/src/lib/fiOs/fiOsAuthDisplay.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

const NEUTRAL_EFFECTIVE: EffectiveBranding = {
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
};

export default async function TenantAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  await assertFiTenantPortalAccess(tenantId);
  const base = `/fi-admin/${tenantId}`;
  const [showCrmNav, showBookingsBoard, userEmail] = await Promise.all([
    getCrmShellNavAllowed(tenantId),
    getBookingsBoardNavAllowed(tenantId),
    resolveFiOsAuthUserEmail(),
  ]);

  let effective: EffectiveBranding = NEUTRAL_EFFECTIVE;
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      effective = await resolveEffectiveBranding({ tenantId });
    }
  } catch {
    effective = NEUTRAL_EFFECTIVE;
  }

  const mainSurface = (
    <div className={fiOsChromeClasses.tenantMainSurface}>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.38]"
        style={fiAdminAmbientBackgroundStyle}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a1528]/45 via-transparent to-[#02060d]/85" aria-hidden />
      <div className={cn(fiOsChromeClasses.tenantMainSurfaceInner)}>{children}</div>
    </div>
  );

  return (
    <div style={buildBrandingCssVariables(effective)}>
      <FiOsAppShell
        tenantId={tenantId}
        base={base}
        showCrmNav={showCrmNav}
        showBookingsBoard={showBookingsBoard}
        effective={effective}
        userEmail={userEmail}
      >
        {mainSurface}
      </FiOsAppShell>
    </div>
  );
}
