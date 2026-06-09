import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { RoomsCatalogClient } from "@/src/components/fi/rooms/RoomsCatalogClient";
import { RoomSchedulingReadinessPanel } from "@/src/components/fi-admin/rooms/RoomSchedulingReadinessPanel";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadCrmShellScopePickerOptions } from "@/src/lib/crm/crmShellLoaders";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadClinicRoomsForTenant } from "@/src/lib/rooms/fiClinicRooms.server";
import { getRoomSchedulingReadiness } from "@/src/lib/rooms/roomSchedulingReadiness.server";
import { canManageFiServicesCatalog } from "@/src/lib/services/fiServicesManageAccess.server";

export const metadata = {
  title: "Rooms",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RoomsCatalogRoutePage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const tid = tenantId.trim();
  await assertFiTenantPortalAccess(tid);

  const [rooms, scope, canManage, showCrmNav, readiness] = await Promise.all([
    loadClinicRoomsForTenant(tid),
    loadCrmShellScopePickerOptions(tid),
    canManageFiServicesCatalog({ tenantId: tid, request: null }),
    getCrmShellNavAllowed(tid),
    getRoomSchedulingReadiness({ tenantId: tid }),
  ]);

  return (
    <>
      <div className="mx-auto mb-6 max-w-5xl px-4 pt-8 sm:px-6">
        <RoomSchedulingReadinessPanel tenantId={tid} readiness={readiness} variant="dark" />
      </div>
      <RoomsCatalogClient
        tenantId={tid}
        initialRooms={rooms}
        clinics={scope.clinics}
        canManage={canManage}
        showCrmNav={showCrmNav}
      />
    </>
  );
}
