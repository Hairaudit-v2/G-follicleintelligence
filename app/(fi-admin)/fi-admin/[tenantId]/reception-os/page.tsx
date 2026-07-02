import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { ReceptionOsDashboard } from "@/src/components/fi-admin/reception-os/ReceptionOsDashboard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { resolveReceptionOsViewerContext } from "@/src/lib/receptionOs/receptionOsAccess.server";
import { loadReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsCommandCentreLoader.server";

export const metadata = {
  title: "Front desk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminReceptionOsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const sp = await searchParams;
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

  const viewer = await resolveReceptionOsViewerContext(tenantId.trim());
  if (!viewer.canAccessReceptionOs) {
    redirect(`/fi-admin/${tenantId.trim()}/calendar`);
  }

  let data: Awaited<ReturnType<typeof loadReceptionOsCommandCentrePayload>>;
  try {
    data = await loadReceptionOsCommandCentrePayload(tenantId.trim(), new Date(), {
      demoModeRequested: sp.demo === "1",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") notFound();
    console.error("[FiAdminReceptionOsPage]", msg || "load failed");
    return (
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Front desk could not load">
          <p className="text-sm">
            The command centre failed to load. Check production Supabase migrations and Vercel
            function logs for the server error digest.
          </p>
          {msg ? <p className="mt-2 text-xs text-slate-500">{msg}</p> : null}
        </InfoNotice>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <ReceptionOsDashboard data={data} />
    </div>
  );
}
