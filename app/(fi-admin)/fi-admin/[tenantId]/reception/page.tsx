import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { CalendarToastProvider } from "@/components/calendar/CalendarToast";
import { ReceptionBoardDashboard } from "@/src/components/fi-admin/reception/ReceptionBoardDashboard";
import type { ReceptionMutationMode } from "@/src/components/fi-admin/reception/ReceptionPatientFlowBoard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { canViewDashboardSystemDiagnostics } from "@/src/lib/fi-os/dashboardSystemDiagnosticsAccess.server";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadTenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { getClinicFloorSessionIfAllowed } from "@/src/lib/staffPin/clinicFloorAccess";

export const metadata = {
  title: "Reception Board",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminReceptionBoardPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccessUnlessStaffPinSession(tenantId);

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

  let data: Awaited<ReturnType<typeof loadTenantOperationalDashboard>>;
  let session: Awaited<ReturnType<typeof getClinicFloorSessionIfAllowed>>;
  let showDiagnosticsExpanded: boolean;
  try {
    [data, session, showDiagnosticsExpanded] = await Promise.all([
      loadTenantOperationalDashboard(tenantId.trim(), { includeReceptionBoard: true }),
      getClinicFloorSessionIfAllowed(tenantId.trim()),
      canViewDashboardSystemDiagnostics(tenantId.trim()),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") notFound();
    throw e;
  }

  let mutationMode: ReceptionMutationMode = "none";
  if (session) {
    mutationMode = session.authMode === "staff_pin" ? "pin_reception" : "full";
  }

  return (
    <CalendarToastProvider>
      <div className="p-4 sm:p-6">
        <ReceptionBoardDashboard
          data={data}
          mutationMode={mutationMode}
          showDiagnosticsExpanded={showDiagnosticsExpanded}
        />
      </div>
    </CalendarToastProvider>
  );
}
