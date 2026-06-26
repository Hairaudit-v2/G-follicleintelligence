import "server-only";

import { isFiOsPlatformAdminFullSessionBypass, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import {
  canViewTenantConfigurationHub,
  resolveSessionTenantAdminCapabilities,
} from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

export async function getCalendarSettingsAccess(tenantId: string): Promise<{
  canView: boolean;
  canEdit: boolean;
}> {
  const tid = tenantId.trim();
  const canView = await canViewTenantConfigurationHub(tid);
  if (!canView) return { canView: false, canEdit: false };

  const authId = await resolveAuthUserId(null);
  if (!authId) return { canView: true, canEdit: false };

  if (await isFiOsPlatformAdminFullSessionBypass(authId)) {
    return { canView: true, canEdit: true };
  }

  const os = await loadFiOsIdentity(authId);
  if (os && isFiOsPlatformAdminRole(os.osRole)) {
    return { canView: true, canEdit: true };
  }

  const caps = await resolveSessionTenantAdminCapabilities(tid);
  const canEdit = caps.has("manage_clinic_settings") || caps.has("manage_admin_users");

  return { canView: true, canEdit };
}
