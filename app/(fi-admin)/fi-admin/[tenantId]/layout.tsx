import { FiAdminTenantNav } from "@/src/components/fi-admin/FiAdminTenantNav";
import { fiAdminAmbientBackgroundStyle } from "@/src/components/fi-admin/dashboard-ui";
import { FiTenantBrandFrame } from "@/src/components/fi/FiTenantBrandFrame";
import type { EffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { resolveEffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
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
  const showCrmNav = await getCrmShellNavAllowed(tenantId);

  let effective: EffectiveBranding = NEUTRAL_EFFECTIVE;
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      effective = await resolveEffectiveBranding({ tenantId });
    }
  } catch {
    effective = NEUTRAL_EFFECTIVE;
  }

  const year = new Date().getFullYear();

  return (
    <FiTenantBrandFrame effective={effective} topSlot={<FiAdminTenantNav base={base} showCrmNav={showCrmNav} />}>
      <div className="relative min-h-[min(50vh,560px)] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#050a14]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_40px_rgba(0,0,0,0.35)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.42]"
          style={fiAdminAmbientBackgroundStyle}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a1528]/50 via-transparent to-[#02060d]/80" aria-hidden />
        <div className="relative p-4 sm:p-6 lg:p-8">{children}</div>
      </div>

      <footer className="mt-8 border-t border-white/[0.08] pt-6 text-center text-sm leading-relaxed text-[#64748B] sm:text-base">
        <p>
          Follicle Intelligence OS · Hair Restoration Operating System ·{" "}
          <span className="text-[#94A3B8]">Internal tenant workspace</span>
        </p>
        <p className="mt-1 text-xs text-[#64748B] sm:text-sm">© {year} Follicle Intelligence</p>
      </footer>
    </FiTenantBrandFrame>
  );
}
