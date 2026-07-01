import "server-only";

import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/hrOsRouteGateCore.server";
import { loadShiftCostIntelligence } from "@/src/lib/workforce/shiftCostIntelligence.server";

export async function loadWorkforceOsShiftCostPage(tenantId: string, workDate?: string | null) {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) return null;

  const tid = tenantId.trim();
  const intelligence = await loadShiftCostIntelligence(tid, workDate);

  const role = access.userRole.trim().toLowerCase();
  const canManage =
    access.platformAdminPreview ||
    (HR_OS_ROUTE_REQUIRED_ROLES as readonly string[]).includes(role);

  return {
    intelligence,
    canManage,
  };
}