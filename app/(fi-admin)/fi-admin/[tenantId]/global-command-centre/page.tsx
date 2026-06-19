import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { GlobalCommandCentreDashboard } from "@/src/components/fi-admin/enterprise-demo/GlobalCommandCentreDashboard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { ENTERPRISE_DEMO_TENANT_SLUG } from "@/src/lib/enterprise-demo/enterpriseDemoConstants";
import { loadGlobalCommandCentrePayload } from "@/src/lib/enterprise-demo/enterpriseDemoGlobalCommandCentreLoader.server";
import { resolveEnterpriseDemoTenant } from "@/src/lib/enterprise-demo/enterpriseDemoTenantAccess.server";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { isNonEmptyUuid } from "@/src/lib/crm/validation";

export const metadata = {
  title: "TITAN · Global Command Centre",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminGlobalCommandCentrePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const key = tenantId?.trim();
  if (!key) notFound();

  if (!isNonEmptyUuid(key) && key !== ENTERPRISE_DEMO_TENANT_SLUG) {
    notFound();
  }

  if (key === ENTERPRISE_DEMO_TENANT_SLUG) {
    const resolved = await resolveEnterpriseDemoTenant(key);
    if (!resolved) notFound();
    redirect(`/fi-admin/${resolved.tenantId}/global-command-centre`);
  }

  await assertFiTenantPortalAccessUnlessStaffPinSession(key);

  const demoTenant = await resolveEnterpriseDemoTenant(key);
  if (!demoTenant) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing. Check deployment configuration.</p>
      </InfoNotice>
    );
  }

  let data: Awaited<ReturnType<typeof loadGlobalCommandCentrePayload>>;
  try {
    data = await loadGlobalCommandCentrePayload(key, new Date());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") notFound();
    console.error("[FiAdminGlobalCommandCentrePage]", msg || "load failed");
    return (
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Global Command Centre could not load">
          <p className="text-sm">
            The TITAN global command centre failed to load. Ensure the enterprise demo tenant is seeded and Supabase
            migrations are applied.
          </p>
          {msg ? <p className="mt-2 text-xs text-slate-500">{msg}</p> : null}
        </InfoNotice>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <GlobalCommandCentreDashboard data={data} />
    </div>
  );
}
