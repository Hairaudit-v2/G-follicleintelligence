import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { FiTenantOperationalHome } from "@/src/components/fi-admin/FiTenantOperationalHome";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { CalendarToastProvider } from "@/components/calendar/CalendarToast";
import { getBookingsBoardNavAllowed, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadTenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
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

  const [showCrmNav, showBookingsBoard] = await Promise.all([
    getCrmShellNavAllowed(tenantId),
    getBookingsBoardNavAllowed(tenantId),
  ]);

  let data;
  try {
    data = await loadTenantOperationalDashboard(tenantId, { includeReceptionBoard: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") notFound();
    throw e;
  }

  return (
    <CalendarToastProvider>
      <FiTenantOperationalHome data={data} showCrmNav={showCrmNav} showBookingsBoard={showBookingsBoard} />
    </CalendarToastProvider>
  );
}
