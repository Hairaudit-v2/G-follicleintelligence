import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { CalendarToastProvider } from "@/components/calendar/CalendarToast";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { FrontDeskTodayBoard } from "@/src/components/fi-os/front-desk/FrontDeskTodayBoard";
import type { FrontDeskMutationMode } from "@/src/lib/fiOs/frontDesk/frontDeskTodayPresentation.types";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadReceptionBoardCommandCenterPayload } from "@/src/lib/receptionBoard/receptionBoard.server";
import { getClinicFloorSessionIfAllowed } from "@/src/lib/staffPin/clinicFloorAccess";

export const metadata = {
  title: "Today",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminFrontDeskHubPage({
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

  const tid = tenantId.trim();
  let payload: Awaited<ReturnType<typeof loadReceptionBoardCommandCenterPayload>>;
  let session: Awaited<ReturnType<typeof getClinicFloorSessionIfAllowed>>;
  try {
    [payload, session] = await Promise.all([
      loadReceptionBoardCommandCenterPayload(tid, new Date(), { tier: "shell" }),
      getClinicFloorSessionIfAllowed(tid),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") notFound();
    console.error("[FiAdminFrontDeskHubPage]", msg || "load failed");
    return (
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Front desk could not load">
          <p className="text-sm">
            Today failed to load. Check production Supabase migrations and Vercel function logs
            for the server error digest.
          </p>
          {msg ? <p className="mt-2 text-xs text-slate-500">{msg}</p> : null}
        </InfoNotice>
      </div>
    );
  }

  let mutationMode: FrontDeskMutationMode = "none";
  if (session) {
    mutationMode = session.authMode === "staff_pin" ? "pin_reception" : "full";
  }

  return (
    <CalendarToastProvider>
      <div className="p-4 sm:p-6">
        <FrontDeskTodayBoard initialData={payload} mutationMode={mutationMode} />
      </div>
    </CalendarToastProvider>
  );
}
