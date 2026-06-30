import "server-only";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadClinicRoomsForTenant } from "@/src/lib/rooms/fiClinicRooms.server";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import { canManageFiServicesCatalog } from "@/src/lib/services/fiServicesManageAccess.server";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import { loadServiceEligibilityMapsForTenant } from "@/src/lib/rooms/fiClinicRooms.server";

export type ServicesCatalogPageResult = {
  services: FiServiceRow[];
  activeServiceCount: number;
  canManageServices: boolean;
  rooms: FiClinicRoomRow[];
  roomEligibilityByServiceId: Record<string, string[]>;
  preferredRoomByServiceId: Record<string, string | null>;
  staffRolesByServiceId: Record<string, string[]>;
};

export async function loadServicesCatalogPage(
  tenantId: string
): Promise<ServicesCatalogPageResult> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const [services, rooms, eligibilityMaps, canManageServices] = await Promise.all([
    loadFiServicesForTenant(tid),
    loadClinicRoomsForTenant(tid),
    loadServiceEligibilityMapsForTenant(tid),
    canManageFiServicesCatalog({ tenantId: tid, request: null }),
  ]);

  const roomEligibilityByServiceId: Record<string, string[]> = {};
  const preferredRoomByServiceId: Record<string, string | null> = {};
  for (const [serviceId, rows] of Array.from(eligibilityMaps.roomByServiceId.entries())) {
    roomEligibilityByServiceId[serviceId] = rows.filter((r) => r.is_active).map((r) => r.room_id);
    preferredRoomByServiceId[serviceId] =
      rows.find((r) => r.is_active && r.is_preferred)?.room_id ?? null;
  }

  const staffRolesByServiceId: Record<string, string[]> = {};
  for (const [serviceId, rows] of Array.from(eligibilityMaps.staffByServiceId.entries())) {
    staffRolesByServiceId[serviceId] = rows
      .filter((r) => r.is_active && r.staff_role)
      .map((r) => r.staff_role!.trim());
  }

  const activeServiceCount = services.filter((s) => s.is_active).length;

  return {
    services,
    activeServiceCount,
    canManageServices,
    rooms,
    roomEligibilityByServiceId,
    preferredRoomByServiceId,
    staffRolesByServiceId,
  };
}
