import "server-only";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsElevatedOsOperatorRole, isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

/** Platform operators and tenant admins may expand system diagnostics on the home dashboard. */
export async function canViewDashboardSystemDiagnostics(tenantId: string): Promise<boolean> {
  const authId = await resolveAuthUserId(null);
  if (!authId) return false;

  const os = await loadFiOsIdentity(authId);
  if (isFiOsPlatformAdminRole(os?.osRole) || isFiOsElevatedOsOperatorRole(os?.osRole)) return true;

  const tenantAdmin = await loadActiveTenantAdminProfileForSession(tenantId.trim(), authId);
  return tenantAdmin != null;
}
