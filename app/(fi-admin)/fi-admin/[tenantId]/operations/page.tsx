import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { ClinicOsOperationsCentre } from "@/src/components/fi-admin/operations/ClinicOsOperationsCentre";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { CalendarToastProvider } from "@/components/calendar/CalendarToast";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { canViewDashboardSystemDiagnostics } from "@/src/lib/fi-os/dashboardSystemDiagnosticsAccess.server";
import { loadTenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { readFiProcedureDayEnabled } from "@/src/lib/procedureDay/procedureDayEnv.server";

export const metadata = {
  title: "Operations centre",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ClinicOsOperationsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">
          Supabase environment variables are missing. Check deployment configuration.
        </p>
      </InfoNotice>
    );
  }

  const [showCrmNav, showDiagnosticsExpanded, showProcedureDayNav] = await Promise.all([
    getCrmShellNavAllowed(tenantId),
    canViewDashboardSystemDiagnostics(tenantId),
    Promise.resolve(readFiProcedureDayEnabled()),
  ]);

  let data;
  try {
    data = await loadTenantOperationalDashboard(tenantId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") notFound();
    throw e;
  }

  return (
    <CalendarToastProvider>
      <ClinicOsOperationsCentre
        data={data}
        showCrmNav={showCrmNav}
        showDiagnosticsExpanded={showDiagnosticsExpanded}
        showProcedureDayNav={showProcedureDayNav}
      />
    </CalendarToastProvider>
  );
}
