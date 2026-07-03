import "server-only";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";

export {
  WORKFORCE_HR_MANAGE_DENIED_MESSAGE,
  WORKFORCE_HR_MANAGE_ROLES,
  workforceHrManageAllowedForRole,
  type WorkforceHrManageDecision,
} from "@/src/lib/workforce/workforceHrManageGateCore";

import {
  WORKFORCE_HR_MANAGE_DENIED_MESSAGE,
  workforceHrManageAllowedForRole,
  type WorkforceHrManageDecision,
} from "@/src/lib/workforce/workforceHrManageGateCore";

export async function resolveWorkforceHrManageCapability(
  tenantId: string
): Promise<WorkforceHrManageDecision> {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) {
    return { canManage: false, manageDeniedReason: access.access.message };
  }

  if (workforceHrManageAllowedForRole(access.userRole, access.platformAdminPreview)) {
    return { canManage: true, manageDeniedReason: "" };
  }

  return {
    canManage: false,
    manageDeniedReason: WORKFORCE_HR_MANAGE_DENIED_MESSAGE,
  };
}

export async function assertWorkforceHrManageAllowed(
  tenantId: string
): Promise<{ fiUserId: string }> {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) throw new CrmAccessError(403, access.access.message);

  const manage = await resolveWorkforceHrManageCapability(tenantId);
  if (!manage.canManage) {
    throw new CrmAccessError(403, manage.manageDeniedReason);
  }

  return { fiUserId: access.fiUserId };
}