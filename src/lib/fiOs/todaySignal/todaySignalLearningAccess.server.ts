import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isFiOsPlatformAdminFullSessionBypass,
  resolveAuthUserId,
} from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import {
  isFiOsElevatedOsOperatorRole,
  isFiOsPlatformAdminRole,
  normalizeFiOsRole,
} from "@/src/lib/fiOs/fiOsRoles";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

const CLINIC_MANAGER_TENANT_ADMIN_ROLES = new Set<FiTenantAdminRole>([
  "clinic_admin",
  "operations_admin",
]);

function legacyFiUserRoleAllowsSignalLearning(role: string | null | undefined): boolean {
  const r = String(role ?? "")
    .trim()
    .toLowerCase();
  return r === "admin" || r === "fi_admin" || r === "owner";
}

/**
 * Internal Signal Learning surface — platform operators and clinic managers only.
 * Fail closed when the viewer cannot access operational intelligence.
 */
export async function canViewTodaySignalLearning(tenantId: string): Promise<boolean> {
  const tid = tenantId.trim();
  if (!tid) return false;

  const authId = await resolveAuthUserId(null);
  if (!authId) return false;

  if (await isFiOsPlatformAdminFullSessionBypass(authId)) return true;

  const os = await loadFiOsIdentity(authId);
  if (isFiOsPlatformAdminRole(os?.osRole) || isFiOsElevatedOsOperatorRole(os?.osRole)) {
    return true;
  }

  const tenantAdmin = await loadActiveTenantAdminProfileForSession(tid, authId);
  if (
    tenantAdmin?.adminRole &&
    CLINIC_MANAGER_TENANT_ADMIN_ROLES.has(tenantAdmin.adminRole)
  ) {
    return true;
  }

  const { data } = await supabaseAdmin()
    .from("fi_users")
    .select("role")
    .eq("tenant_id", tid)
    .eq("auth_user_id", authId)
    .maybeSingle();

  const fiUserRole = normalizeFiOsRole((data as { role?: string | null } | null)?.role);
  return legacyFiUserRoleAllowsSignalLearning(fiUserRole);
}
