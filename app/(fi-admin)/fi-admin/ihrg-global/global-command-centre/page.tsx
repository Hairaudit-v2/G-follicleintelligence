import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { ENTERPRISE_DEMO_TENANT_SLUG } from "@/src/lib/enterprise-demo/enterpriseDemoConstants";
import { resolveEnterpriseDemoTenant } from "@/src/lib/enterprise-demo/enterpriseDemoTenantAccess.server";

export const metadata = {
  title: "TITAN · Global Command Centre",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Friendly slug entry point: /fi-admin/ihrg-global/global-command-centre */
export default async function IhrgGlobalCommandCentreSlugRedirectPage() {
  noStore();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    notFound();
  }

  const resolved = await resolveEnterpriseDemoTenant(ENTERPRISE_DEMO_TENANT_SLUG);
  if (!resolved) notFound();

  redirect(`/fi-admin/${resolved.tenantId}/global-command-centre`);
}
