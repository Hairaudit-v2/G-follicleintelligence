import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { FrontDeskPatientMessagesBoard } from "@/src/components/fi-os/front-desk/FrontDeskPatientMessagesBoard";
import { assertFrontDeskPatientMessagesAccess } from "@/src/lib/fiOs/frontDesk/frontDeskPatientMessagesAccess.server";
import { loadFrontDeskPatientMessageQueue } from "@/src/lib/fiOs/frontDesk/frontDeskPatientMessages.server";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Patient Messages",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminFrontDeskMessagesPage({
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
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Server misconfigured">
          <p className="text-sm">
            Supabase environment variables are missing. Check deployment configuration.
          </p>
        </InfoNotice>
      </div>
    );
  }

  const tid = tenantId.trim();
  const allowed = await assertFrontDeskPatientMessagesAccess(tid, "read");
  if (!allowed) {
    return (
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Access restricted">
          <p className="text-sm">
            Patient messaging is not available for your role. Ask an admin if you need Front Desk
            message access.
          </p>
        </InfoNotice>
      </div>
    );
  }

  let payload: Awaited<ReturnType<typeof loadFrontDeskPatientMessageQueue>>;
  try {
    payload = await loadFrontDeskPatientMessageQueue(tid, { filter: "unread" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    console.error("[FiAdminFrontDeskMessagesPage]", msg || "load failed");
    return (
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Messages could not load">
          <p className="text-sm">
            The patient message queue failed to load. Check Supabase migrations for staff inbox
            columns and function logs.
          </p>
          {msg ? <p className="mt-2 text-xs text-slate-500">{msg}</p> : null}
        </InfoNotice>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <FrontDeskPatientMessagesBoard initialData={payload} />
    </div>
  );
}
