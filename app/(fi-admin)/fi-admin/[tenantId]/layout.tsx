import Link from "next/link";
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

  const navLink =
    "text-gray-600 underline decoration-transparent underline-offset-2 hover:text-[color:var(--fi-brand-accent)] hover:decoration-gray-400";

  return (
    <FiTenantBrandFrame effective={effective}>
      <nav className="flex flex-wrap gap-4 border-b border-gray-200 pb-2 text-sm">
        <Link href={base} className={navLink}>
          Home
        </Link>
        <Link href={`${base}/cases`} className={navLink}>
          Cases
        </Link>
        <Link href={`${base}/audit`} className={navLink}>
          Audit queue
        </Link>
        <Link href={`${base}/directory`} className={navLink}>
          Directory
        </Link>
        <Link href={`${base}/configuration`} className={navLink}>
          Configuration
        </Link>
        <Link href={`${base}/foundation-integrity`} className={navLink}>
          Foundation integrity
        </Link>
        {showCrmNav ? (
          <>
            <Link href={`${base}/patients`} className={navLink}>
              Patients
            </Link>
            <Link href={`${base}/crm`} className={navLink}>
              CRM
            </Link>
            <Link href={`${base}/bookings`} className={navLink}>
              Bookings
            </Link>
            <Link href={`${base}/calendar`} className={navLink}>
              Calendar
            </Link>
            <Link href={`${base}/system-status`} className={navLink}>
              System Status
            </Link>
          </>
        ) : null}
      </nav>
      {children}
    </FiTenantBrandFrame>
  );
}
