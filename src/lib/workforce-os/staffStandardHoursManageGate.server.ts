import "server-only";

import { CrmAccessError, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import {
  HR_OS_ROUTE_REQUIRED_ROLES,
  resolveHrOsRouteAccess,
} from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { getStaffEffectiveAccess } from "@/src/lib/staffAccess/staffAccess.server";
import { staffCapabilitySatisfies } from "@/src/lib/staffAccess/staffCapabilityCore";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

export const STAFF_STANDARD_HOURS_PERMISSION_DENIED_MESSAGE =
  "You do not have permission to edit standard hours.";

/** fi_users roles allowed to manage standard hours / roster mutations. */
export const STAFF_STANDARD_HOURS_MANAGE_FI_USER_ROLES = HR_OS_ROUTE_REQUIRED_ROLES;

/** fi_tenant_admin_users roles that may manage standard hours when module access is granted. */
export const STAFF_STANDARD_HOURS_MANAGE_TENANT_ADMIN_ROLES = [
  "clinic_admin",
  "operations_admin",
] as const satisfies readonly FiTenantAdminRole[];

export type StaffStandardHoursManageDecision = {
  canManage: boolean;
  manageDeniedReason: string;
  /** Populated in development when permission is denied. */
  debugReason?: string;
};

function logManageDecisionInDevelopment(decision: StaffStandardHoursManageDecision): void {
  if (process.env.NODE_ENV === "production") return;
  if (decision.canManage) return;
  console.info("[staff-standard-hours] manage denied:", decision.debugReason ?? decision.manageDeniedReason);
}

export async function resolveStaffStandardHoursManageCapability(
  tenantId: string
): Promise<StaffStandardHoursManageDecision> {
  const tid = tenantId.trim();

  const { access: staffAccess } = await getStaffEffectiveAccess(tid);
  if (staffCapabilitySatisfies(staffAccess, "roster.manage")) {
    return { canManage: true, manageDeniedReason: "" };
  }

  const access = await resolveHrOsRouteAccess(tid);
  if (!access.ok) {
    const decision = {
      canManage: false,
      manageDeniedReason: access.access.message,
      debugReason: `hr_os_route_denied:${access.access.reason}`,
    };
    logManageDecisionInDevelopment(decision);
    return decision;
  }

  if (access.platformAdminPreview) {
    return { canManage: true, manageDeniedReason: "" };
  }

  const fiRole = access.userRole.trim().toLowerCase();
  if ((STAFF_STANDARD_HOURS_MANAGE_FI_USER_ROLES as readonly string[]).includes(fiRole)) {
    return { canManage: true, manageDeniedReason: "" };
  }

  const authUserId = await resolveAuthUserId(null);
  if (authUserId) {
    const os = await loadFiOsIdentity(authUserId);
    if (os && isFiOsPlatformAdminRole(os.osRole)) {
      return { canManage: true, manageDeniedReason: "" };
    }

    const tenantAdmin = await loadActiveTenantAdminProfileForSession(tid, authUserId);
    if (
      tenantAdmin &&
      (STAFF_STANDARD_HOURS_MANAGE_TENANT_ADMIN_ROLES as readonly string[]).includes(
        tenantAdmin.adminRole
      )
    ) {
      return { canManage: true, manageDeniedReason: "" };
    }
  }

  const decision = {
    canManage: false,
    manageDeniedReason: STAFF_STANDARD_HOURS_PERMISSION_DENIED_MESSAGE,
    debugReason: `fi_user_role:${fiRole}`,
  };
  logManageDecisionInDevelopment(decision);
  return decision;
}

export async function assertStaffStandardHoursManageAllowed(
  tenantId: string
): Promise<{ fiUserId: string }> {
  const manage = await resolveStaffStandardHoursManageCapability(tenantId);
  if (!manage.canManage) {
    throw new CrmAccessError(403, manage.manageDeniedReason);
  }

  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (access.ok) {
    return { fiUserId: access.fiUserId };
  }

  const authUserId = await resolveAuthUserId(null);
  if (!authUserId) {
    throw new CrmAccessError(403, manage.manageDeniedReason);
  }

  const { principal } = await getStaffEffectiveAccess(tenantId.trim());
  if (principal?.fiUserId) {
    return { fiUserId: principal.fiUserId };
  }

  throw new CrmAccessError(403, manage.manageDeniedReason);
}
