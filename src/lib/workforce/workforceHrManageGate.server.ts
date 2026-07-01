import "server-only";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";

/** Roles allowed to manage WorkforceOS HR operational actions (Sprint 2). */
export const WORKFORCE_HR_MANAGE_ROLES = [
  "owner",
  "fi_admin",
  "admin",
  "hr_manager",
] as const;

export async function assertWorkforceHrManageAllowed(
  tenantId: string
): Promise<{ fiUserId: string }> {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) throw new CrmAccessError(403, access.access.message);
  if (!access.platformAdminPreview) {
    const role = access.userRole.trim().toLowerCase();
    if (!WORKFORCE_HR_MANAGE_ROLES.some((allowed) => allowed === role)) {
      throw new CrmAccessError(
        403,
        "Owner, fi_admin, admin, or HR manager role required."
      );
    }
  }
  return { fiUserId: access.fiUserId };
}