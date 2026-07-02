import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { ProcedureDayBoard } from "@/src/components/fi-admin/surgery/ProcedureDayBoard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { assertFiProcedureDayRouteAllowed } from "@/src/lib/procedureDay/procedureDayGate.server";
import { loadProcedureDayBoardForTenant } from "@/src/lib/procedureDay/procedureDayOrchestrator.server";

export const metadata = {
  title: "Procedure day",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminProcedureDayPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  assertFiProcedureDayRouteAllowed();
  await assertFiTenantPortalAccess(tenantId);

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return (
      <div className="px-3 py-4 sm:px-4 sm:py-5">
        <InfoNotice variant="danger" title="Server misconfigured">
          <p className="text-sm">
            Supabase environment variables are missing. Check deployment configuration.
          </p>
        </InfoNotice>
      </div>
    );
  }

  let data;
  try {
    data = await loadProcedureDayBoardForTenant(tenantId.trim(), { tier: "shell" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") notFound();
    throw e;
  }

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-5">
      <ProcedureDayBoard data={data} />
    </div>
  );
}