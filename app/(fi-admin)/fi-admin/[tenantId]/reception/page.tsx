import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { CalendarToastProvider } from "@/components/calendar/CalendarToast";
import { ReceptionBoardClient, type ReceptionMutationMode } from "@/src/components/fi-admin/reception/ReceptionBoardClient";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadTenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { getClinicFloorSessionIfAllowed } from "@/src/lib/staffPin/clinicFloorAccess";

export const metadata = {
  title: "Reception board",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminReceptionBoardPage({ params }: { params: Promise<{ tenantId: string }> }) {
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

  const [data, session] = await Promise.all([
    loadTenantOperationalDashboard(tenantId.trim(), { includeReceptionBoard: true }),
    getClinicFloorSessionIfAllowed(tenantId.trim()),
  ]);

  let mutationMode: ReceptionMutationMode = "none";
  if (session) {
    mutationMode = session.authMode === "staff_pin" ? "complete_only" : "full";
  }

  const base = `/fi-admin/${data.tenantId}`;

  return (
    <CalendarToastProvider>
      <div className="p-4 sm:p-6">
        <ReceptionBoardClient
          tenantId={data.tenantId}
          base={base}
          calendarTimezone={data.operationalDay.calendarTimezone}
          todayYmd={data.operationalDay.todayYmd}
          cards={data.receptionBoard.cards}
          mutationMode={mutationMode}
        />
      </div>
    </CalendarToastProvider>
  );
}
