import "server-only";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { canViewModule } from "@/src/lib/staffAccess/staffAccessCore";
import { getStaffEffectiveAccess } from "@/src/lib/staffAccess/staffAccess.server";

/**
 * Full Admin Audit trail: clinic_admin / operations_admin / finance_admin,
 * or SA-1 manager/owner/platform_admin/auditor.
 */
export async function canViewSystemAuditAdmin(tenantId: string): Promise<boolean> {
  const tid = tenantId.trim();
  if (!tid) return false;

  const authId = await resolveAuthUserId(null);
  if (!authId) return false;

  const admin = await loadActiveTenantAdminProfileForSession(tid, authId);
  if (
    admin?.adminRole === "clinic_admin" ||
    admin?.adminRole === "operations_admin" ||
    admin?.adminRole === "finance_admin"
  ) {
    return true;
  }

  try {
    const { principal, access } = await getStaffEffectiveAccess(tid);
    if (principal?.isAdminOverride) return true;
    if (
      principal?.roleKey === "manager" ||
      principal?.roleKey === "owner" ||
      principal?.roleKey === "auditor" ||
      principal?.roleKey === "platform_admin"
    ) {
      return true;
    }
    if (canViewModule(access, "audit_os")) return true;
  } catch {
    /* fall through */
  }

  return false;
}

/** Patient chart Activity: any tenant member who can open the patient profile. */
export async function canViewPatientSystemAudit(tenantId: string): Promise<boolean> {
  const tid = tenantId.trim();
  if (!tid) return false;
  if (await canViewSystemAuditAdmin(tid)) return true;

  try {
    const { principal, access } = await getStaffEffectiveAccess(tid);
    if (!principal) return false;
    return canViewModule(access, "patient_os") || canViewModule(access, "clinic_os");
  } catch {
    return false;
  }
}
