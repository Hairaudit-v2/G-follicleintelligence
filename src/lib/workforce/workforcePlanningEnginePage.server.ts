import "server-only";

import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/hrOsRouteGateCore.server";
import { loadWorkforcePlanningEngine } from "@/src/lib/workforce/workforcePlanningEngine.server";

export async function loadWorkforceOsPlanningPage(tenantId: string, anchorDate?: string | null) {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) return null;

  const tid = tenantId.trim();
  const planning = await loadWorkforcePlanningEngine(tid, anchorDate);

  const role = access.userRole.trim().toLowerCase();
  const canManage =
    access.platformAdminPreview ||
    (HR_OS_ROUTE_REQUIRED_ROLES as readonly string[]).includes(role);

  return {
    planning,
    canManage,
  };
}