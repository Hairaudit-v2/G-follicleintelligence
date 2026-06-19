import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { GlobalCommandCentrePresentation } from "@/src/components/fi-admin/enterprise-demo/GlobalCommandCentrePresentation";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { ENTERPRISE_DEMO_TENANT_SLUG } from "@/src/lib/enterprise-demo/enterpriseDemoConstants";
import {
  assertGlobalCommandCentrePage,
  resolveGlobalCommandCentrePage,
} from "@/src/lib/enterprise-demo/enterpriseDemoGlobalCommandCentrePage.server";
import { resolveEnterpriseDemoTenant } from "@/src/lib/enterprise-demo/enterpriseDemoTenantAccess.server";
import { isNonEmptyUuid } from "@/src/lib/crm/validation";

export const metadata = {
  title: "TITAN · Global Command Centre · Presentation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminGlobalCommandCentrePresentationPage({
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
    redirect(`/fi-admin/${resolved.tenantId}/global-command-centre/presentation`);
  }

  const result = await resolveGlobalCommandCentrePage(key);

  if (!result.ok && result.kind === "misconfigured") {
    return (
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Server misconfigured">
          <p className="text-sm">Supabase environment variables are missing. Check deployment configuration.</p>
        </InfoNotice>
      </div>
    );
  }

  if (!result.ok && result.kind === "load_failed") {
    return (
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Presentation mode could not load">
          <p className="text-sm">
            The TITAN presentation view failed to load. Ensure the enterprise demo tenant is seeded and Supabase
            migrations are applied.
          </p>
          {result.message ? <p className="mt-2 text-xs text-slate-500">{result.message}</p> : null}
        </InfoNotice>
      </div>
    );
  }

  assertGlobalCommandCentrePage(result);
  if (!result.ok) notFound();

  const dashboardHref = `/fi-admin/${result.tenantKey}/global-command-centre`;

  return <GlobalCommandCentrePresentation data={result.data} dashboardHref={dashboardHref} />;
}
