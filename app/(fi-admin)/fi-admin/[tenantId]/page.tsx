import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { FiHomeDashboard } from "@/src/components/fi-admin/FiHomeDashboard";
import { ClinicOsDashboardHome } from "@/src/components/fi-admin/shell/ClinicOsDashboardHome";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { resolveEffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { loadFiHomeDashboardPayload } from "@/src/lib/fiOs/fiHomeDashboardLoader.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Home",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminTenantHomePage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing. Check deployment configuration.</p>
      </InfoNotice>
    );
  }

  const showCrmShellExtras = await getCrmShellNavAllowed(tenantId);

  const clinicOsShellEnabled = process.env.NEXT_PUBLIC_FI_CLINIC_OS_SHELL === "true";
  if (clinicOsShellEnabled) {
    let clinicLabel: string | null = null;
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
        const eff = await resolveEffectiveBranding({ tenantId });
        clinicLabel = eff.clinic_display_name?.trim() || eff.brand_name?.trim() || null;
      }
    } catch {
      clinicLabel = null;
    }
    return <ClinicOsDashboardHome tenantId={tenantId} clinicLabel={clinicLabel} showCrmNav={showCrmShellExtras} />;
  }

  let data;
  try {
    data = await loadFiHomeDashboardPayload(tenantId, { showCrmShellChecklistItems: showCrmShellExtras });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") notFound();
    throw e;
  }

  return <FiHomeDashboard data={data} showCrmShellExtras={showCrmShellExtras} />;
}
