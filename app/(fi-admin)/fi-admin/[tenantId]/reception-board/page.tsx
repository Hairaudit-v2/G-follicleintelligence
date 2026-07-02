import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { CalendarToastProvider } from "@/components/calendar/CalendarToast";
import { ReceptionBoardCommandCenter } from "@/src/components/fi-admin/reception-board/ReceptionBoardCommandCenter";
import type { ReceptionMutationMode } from "@/src/components/fi-admin/reception/ReceptionPatientFlowBoard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import {
  getBookingsBoardNavAllowed,
  getCrmShellNavAllowed,
} from "@/src/lib/crm/crmShellAccess";
import { loadReceptionBoardCommandCenterPayload } from "@/src/lib/receptionBoard/receptionBoard.server";
import { getClinicFloorSessionIfAllowed } from "@/src/lib/staffPin/clinicFloorAccess";

export const metadata = {
  title: "Reception Board",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminReceptionBoardCommandCenterPage({
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

  let data: Awaited<ReturnType<typeof loadReceptionBoardCommandCenterPayload>>;
  let session: Awaited<ReturnType<typeof getClinicFloorSessionIfAllowed>>;
  let showCrmNav: boolean;
  let showBookingsBoard: boolean;
  try {
    [data, session, showCrmNav, showBookingsBoard] = await Promise.all([
      loadReceptionBoardCommandCenterPayload(tenantId.trim(), new Date(), { tier: "shell" }),
      getClinicFloorSessionIfAllowed(tenantId.trim()),
      getCrmShellNavAllowed(tenantId.trim()),
      getBookingsBoardNavAllowed(tenantId.trim()),
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
        <ReceptionBoardCommandCenter
          initialData={data}
          mutationMode={mutationMode}
          showCrmNav={showCrmNav}
          showBookingsBoard={showBookingsBoard}
        />
      </div>
    </CalendarToastProvider>
  );
}