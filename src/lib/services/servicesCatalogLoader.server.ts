import "server-only";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadClinicRoomsForTenant } from "@/src/lib/rooms/fiClinicRooms.server";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import { canManageFiServicesCatalog } from "@/src/lib/services/fiServicesManageAccess.server";
import type {
  FiServiceRow,
  ServicesCatalogStaffOption,
} from "@/src/lib/services/fiServiceTypes";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import { loadServiceEligibilityMapsForTenant } from "@/src/lib/rooms/fiClinicRooms.server";
import { hydrateServiceSetupConfig } from "@/src/lib/services/setup/hydrateServiceSetupConfig";
import type { ServiceSetupConfig } from "@/src/lib/services/setup/serviceSetupTypes";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type { ServicesCatalogStaffOption };

export type ServicesCatalogPageResult = {
  services: FiServiceRow[];
  activeServiceCount: number;
  canManageServices: boolean;
  rooms: FiClinicRoomRow[];
  roomEligibilityByServiceId: Record<string, string[]>;
  preferredRoomByServiceId: Record<string, string | null>;
  staffRolesByServiceId: Record<string, string[]>;
  preferredStaffByServiceId: Record<string, string[]>;
  setupConfigByServiceId: Record<string, ServiceSetupConfig>;
  staffOptions: ServicesCatalogStaffOption[];
  staffCountByRole: Record<string, number>;
};

async function loadStaffOptionsForCatalog(tenantId: string): Promise<{
  staffOptions: ServicesCatalogStaffOption[];
  staffCountByRole: Record<string, number>;
}> {
  const { data, error } = await supabaseAdmin()
    .from("fi_staff")
    .select("id, full_name, staff_role, is_active")
    .eq("tenant_id", tenantId)
    .order("full_name", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);

  const staffOptions: ServicesCatalogStaffOption[] = (data ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    full_name: String((r as { full_name?: string }).full_name ?? "").trim() || "Unnamed",
    staff_role:
      (r as { staff_role?: string | null }).staff_role != null
        ? String((r as { staff_role: string }).staff_role).trim()
        : null,
    is_active: Boolean((r as { is_active?: boolean }).is_active),
  }));

  const staffCountByRole: Record<string, number> = {};
  for (const s of staffOptions) {
    if (!s.is_active || !s.staff_role) continue;
    const role = s.staff_role.trim().toLowerCase();
    staffCountByRole[role] = (staffCountByRole[role] ?? 0) + 1;
  }

  return { staffOptions, staffCountByRole };
}

export async function loadServicesCatalogPage(
  tenantId: string
): Promise<ServicesCatalogPageResult> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const [services, rooms, eligibilityMaps, canManageServices, staffBundle] =
    await Promise.all([
      loadFiServicesForTenant(tid),
      loadClinicRoomsForTenant(tid),
      loadServiceEligibilityMapsForTenant(tid),
      canManageFiServicesCatalog({ tenantId: tid, request: null }),
      loadStaffOptionsForCatalog(tid),
    ]);

  const roomEligibilityByServiceId: Record<string, string[]> = {};
  const preferredRoomByServiceId: Record<string, string | null> = {};
  const fallbackRoomByServiceId: Record<string, string[]> = {};
  for (const [serviceId, rows] of Array.from(eligibilityMaps.roomByServiceId.entries())) {
    roomEligibilityByServiceId[serviceId] = rows.filter((r) => r.is_active).map((r) => r.room_id);
    preferredRoomByServiceId[serviceId] =
      rows.find((r) => r.is_active && r.is_preferred)?.room_id ?? null;
    fallbackRoomByServiceId[serviceId] = rows
      .filter((r) => r.is_active && r.metadata && (r.metadata as { fallback?: boolean }).fallback)
      .map((r) => r.room_id);
  }

  const staffRolesByServiceId: Record<string, string[]> = {};
  const preferredStaffByServiceId: Record<string, string[]> = {};
  for (const [serviceId, rows] of Array.from(eligibilityMaps.staffByServiceId.entries())) {
    staffRolesByServiceId[serviceId] = rows
      .filter((r) => r.is_active && r.staff_role)
      .map((r) => r.staff_role!.trim());
    preferredStaffByServiceId[serviceId] = rows
      .filter((r) => r.is_active && r.staff_id)
      .map((r) => r.staff_id!.trim());
  }

  const setupConfigByServiceId: Record<string, ServiceSetupConfig> = {};
  for (const svc of services) {
    setupConfigByServiceId[svc.id] = hydrateServiceSetupConfig({
      setupConfigRaw: svc.setup_config,
      bookingType: svc.booking_type,
      serviceName: svc.name,
      legacyStaffRoles: staffRolesByServiceId[svc.id] ?? [],
      preferredStaffIds: preferredStaffByServiceId[svc.id] ?? [],
      eligibleRoomIds: roomEligibilityByServiceId[svc.id] ?? [],
      preferredRoomId: preferredRoomByServiceId[svc.id] ?? null,
      fallbackRoomIds: fallbackRoomByServiceId[svc.id] ?? [],
    });
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
    preferredStaffByServiceId,
    setupConfigByServiceId,
    staffOptions: staffBundle.staffOptions,
    staffCountByRole: staffBundle.staffCountByRole,
  };
}
