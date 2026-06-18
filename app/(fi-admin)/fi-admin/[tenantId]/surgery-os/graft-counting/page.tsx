import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { GraftCountingAssistant } from "@/src/components/fi-admin/surgery-os/GraftCountingAssistant";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { resolveSurgeryOsViewerContext } from "@/src/lib/surgeryOs/surgeryOsAccess.server";
import { loadSurgeryOsCommandCentrePayload } from "@/src/lib/surgeryOs/surgeryOsCommandCentreLoader.server";

export const metadata = {
  title: "Graft counting · SurgeryOS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminGraftCountingPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ surgery?: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const { surgery: initialSurgeryId } = await searchParams;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccessUnlessStaffPinSession(tenantId);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const viewer = await resolveSurgeryOsViewerContext(tenantId.trim());
  if (!viewer.canAccessSurgeryOs) {
    redirect(`/fi-admin/${tenantId.trim()}/calendar`);
  }

  let data: Awaited<ReturnType<typeof loadSurgeryOsCommandCentrePayload>>;
  try {
    data = await loadSurgeryOsCommandCentrePayload(tenantId.trim(), new Date());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") notFound();
    return (
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Graft counting could not load">
          <p className="text-sm">{msg || "Failed to load surgery data."}</p>
        </InfoNotice>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <GraftCountingAssistant data={data} initialSurgeryId={initialSurgeryId?.trim() || null} />
    </div>
  );
}
