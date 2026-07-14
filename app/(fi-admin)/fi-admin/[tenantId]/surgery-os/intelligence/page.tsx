import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { SurgeryIntelligenceDashboard } from "@/src/components/fi-admin/surgery-os/SurgeryIntelligenceDashboard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadSurgeryIntelligenceDashboard } from "@/src/lib/outcomeIntelligence/surgeryIntelligenceDashboardLoader.server";
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";
import { resolveSurgeryOsViewerContext } from "@/src/lib/surgeryOs/surgeryOsAccess.server";

export const metadata = {
  title: "Surgery intelligence",
  description: "Outcome Intelligence dashboard for published surgery-case graft tray facts.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SurgeryIntelligenceDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccessUnlessStaffPinSession(tenantId);
  await assertStaffModuleAccess(tenantId, "surgery_os", "read");

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
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

  const sp = (await searchParams) ?? {};
  let data: Awaited<ReturnType<typeof loadSurgeryIntelligenceDashboard>>;
  try {
    data = await loadSurgeryIntelligenceDashboard({ tenantId: tenantId.trim(), searchParams: sp });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    console.error("[SurgeryIntelligenceDashboardPage]", msg || "load failed");
    return (
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Surgery intelligence could not load">
          <p className="text-sm">
            Published surgery intelligence facts could not be loaded from the analytics event store.
          </p>
          {msg ? <p className="mt-2 text-xs text-slate-500">{msg}</p> : null}
        </InfoNotice>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <SurgeryIntelligenceDashboard data={data} />
    </div>
  );
}
