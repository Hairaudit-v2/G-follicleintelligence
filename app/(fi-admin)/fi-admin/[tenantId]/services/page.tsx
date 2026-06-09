import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { ServicesCatalogClient } from "@/src/components/fi/services/ServicesCatalogClient";
import { RoomSchedulingReadinessPanel } from "@/src/components/fi-admin/rooms/RoomSchedulingReadinessPanel";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { getRoomSchedulingReadiness } from "@/src/lib/rooms/roomSchedulingReadiness.server";
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

  const [data, showCrmNav, readiness] = await Promise.all([
    loadServicesCatalogPage(tid),
    getCrmShellNavAllowed(tid),
    getRoomSchedulingReadiness({ tenantId: tid }),
  ]);

  return (
    <>
      <div className="mx-auto mb-4 max-w-[88rem] px-4 pt-6 sm:px-6">
        <RoomSchedulingReadinessPanel tenantId={tid} readiness={readiness} variant="light" />
      </div>
      <ServicesCatalogClient tenantId={tid} data={data} showCrmNav={showCrmNav} />
    </>
  );
}
