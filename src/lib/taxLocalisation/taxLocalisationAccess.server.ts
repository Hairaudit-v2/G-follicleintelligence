import "server-only";

import { isFiOsPlatformAdminFullSessionBypass, loadProxyFiUserRowForPlatformAdminTenant, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { getFiOsImpersonationTargetAuthUserId } from "@/src/lib/fiOs/fiOsImpersonation.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

async function resolveShellAuthUserId(sessionAuthUserId: string): Promise<string> {
  const imp = await getFiOsImpersonationTargetAuthUserId(sessionAuthUserId);
  return imp ?? sessionAuthUserId;
}

async function loadFiUserRow(
  tenantId: string,
  authUserId: string
): Promise<{ id: string; role: string } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error || !data) return null;
  return { id: String((data as { id: string }).id), role: String((data as { role: string | null }).role ?? "member") };
}

function legacyTenantRoleCanEditTax(role: string): boolean {
  const r = role.trim().toLowerCase();
  return r === "admin" || r === "fi_admin";
}

function tenantAdminRoleCanEditTax(role: FiTenantAdminRole | null): boolean {
  return role === "clinic_admin" || role === "finance_admin";
}

/**
 * Tax & localisation UI: any tenant member may view; edit restricted to finance/clinic admins,
 * legacy tenant admins, or FI platform admin (full session).
 */
export async function getTaxLocalisationAccess(tenantId: string): Promise<{
  canView: boolean;
  canEdit: boolean;
  actorFiUserId: string | null;
}> {
  const tid = tenantId.trim();
  const authId = await resolveAuthUserId(null);
  if (!authId || !tid) {
    return { canView: false, canEdit: false, actorFiUserId: null };
  }

  if (await isFiOsPlatformAdminFullSessionBypass(authId)) {
    const proxy = await loadProxyFiUserRowForPlatformAdminTenant(tid, authId);
    return {
      canView: true,
      canEdit: true,
      actorFiUserId: proxy?.id ?? null,
    };
  }

  const navAuth = await resolveShellAuthUserId(authId);
  const row = await loadFiUserRow(tid, navAuth);
  if (!row) {
    return { canView: false, canEdit: false, actorFiUserId: null };
  }

  const os = await loadFiOsIdentity(authId);
  if (os && isFiOsPlatformAdminRole(os.osRole)) {
    const proxy = await loadProxyFiUserRowForPlatformAdminTenant(tid, authId);
    return { canView: true, canEdit: true, actorFiUserId: proxy?.id ?? row.id };
  }

  const prof = await loadActiveTenantAdminProfileForSession(tid, authId);
  const adminRole = prof?.adminRole ?? null;

  const canEdit = legacyTenantRoleCanEditTax(row.role) || tenantAdminRoleCanEditTax(adminRole);

  return {
    canView: true,
    canEdit,
    actorFiUserId: row.id,
  };
}