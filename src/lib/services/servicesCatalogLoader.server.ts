import "server-only";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import { canManageFiServicesCatalog } from "@/src/lib/services/fiServicesManageAccess.server";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

export type ServicesCatalogPageResult = {
  services: FiServiceRow[];
  activeServiceCount: number;
  canManageServices: boolean;
};

export async function loadServicesCatalogPage(tenantId: string): Promise<ServicesCatalogPageResult> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const services = await loadFiServicesForTenant(tid);

  const canManageServices = await canManageFiServicesCatalog({ tenantId: tid, request: null });
  const activeServiceCount = services.filter((s) => s.is_active).length;

  return { services, activeServiceCount, canManageServices };
}
