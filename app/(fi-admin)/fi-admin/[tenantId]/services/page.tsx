import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { ServicesCatalogClient } from "@/src/components/fi/services/ServicesCatalogClient";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadServicesCatalogPage } from "@/src/lib/services/servicesCatalogLoader.server";

export const metadata = {
  title: "Services",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ServicesCatalogRoutePage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const tid = tenantId.trim();
  await assertFiTenantPortalAccess(tid);

  const [data, showCrmNav] = await Promise.all([loadServicesCatalogPage(tid), getCrmShellNavAllowed(tid)]);

  return <ServicesCatalogClient tenantId={tid} data={data} showCrmNav={showCrmNav} />;
}
