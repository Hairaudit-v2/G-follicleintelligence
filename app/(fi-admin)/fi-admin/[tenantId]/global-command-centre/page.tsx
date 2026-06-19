import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { GlobalCommandCentreDashboard } from "@/src/components/fi-admin/enterprise-demo/GlobalCommandCentreDashboard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { ENTERPRISE_DEMO_TENANT_SLUG } from "@/src/lib/enterprise-demo/enterpriseDemoConstants";
import {
  assertGlobalCommandCentrePage,
  resolveGlobalCommandCentrePage,
} from "@/src/lib/enterprise-demo/enterpriseDemoGlobalCommandCentrePage.server";
import { resolveEnterpriseDemoTenant } from "@/src/lib/enterprise-demo/enterpriseDemoTenantAccess.server";
import { isNonEmptyUuid } from "@/src/lib/crm/validation";

export const metadata = {
  title: "TITAN · Global Command Centre",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminGlobalCommandCentrePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ presentation?: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const sp = await searchParams;
  const key = tenantId?.trim();
  if (!key) notFound();

  if (!isNonEmptyUuid(key) && key !== ENTERPRISE_DEMO_TENANT_SLUG) {
    notFound();
  }

  if (key === ENTERPRISE_DEMO_TENANT_SLUG) {
    const resolved = await resolveEnterpriseDemoTenant(key);
    if (!resolved) notFound();
    const presentationSuffix = sp.presentation === "true" ? "/presentation" : "";
    redirect(`/fi-admin/${resolved.tenantId}/global-command-centre${presentationSuffix}`);
  }

  if (sp.presentation === "true") {
    redirect(`/fi-admin/${key}/global-command-centre/presentation`);
  }

  const result = await resolveGlobalCommandCentrePage(key);

  if (!result.ok && result.kind === "misconfigured") {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing. Check deployment configuration.</p>
      </InfoNotice>
    );
  }

  if (!result.ok && result.kind === "load_failed") {
    return (
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Global Command Centre could not load">
          <p className="text-sm">
            The TITAN global command centre failed to load. Ensure the enterprise demo tenant is seeded and Supabase
            migrations are applied.
          </p>
          {result.message ? <p className="mt-2 text-xs text-slate-500">{result.message}</p> : null}
        </InfoNotice>
      </div>
    );
  }

  assertGlobalCommandCentrePage(result);
  if (!result.ok) notFound();

  const presentationHref = `/fi-admin/${result.tenantKey}/global-command-centre/presentation`;

  return (
    <div className="p-4 sm:p-6">
      <GlobalCommandCentreDashboard data={result.data} presentationHref={presentationHref} />
    </div>
  );
}
