import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { SurgeryOsDashboard } from "@/src/components/fi-admin/surgery-os/SurgeryOsDashboard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { resolveSurgeryOsViewerContext } from "@/src/lib/surgeryOs/surgeryOsAccess.server";
import { loadSurgeryOsCommandCentrePayload } from "@/src/lib/surgeryOs/surgeryOsCommandCentreLoader.server";

export const metadata = {
  title: "Surgery",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminSurgeryOsPage({
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
    console.error("[FiAdminSurgeryOsPage]", msg || "load failed");
    return (
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Surgery could not load">
          <p className="text-sm">
            The surgical command centre failed to load. Check production Supabase migrations and
            Vercel function logs for the server error digest.
          </p>
          {msg ? <p className="mt-2 text-xs text-slate-500">{msg}</p> : null}
        </InfoNotice>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <SurgeryOsDashboard data={data} />
    </div>
  );
}
