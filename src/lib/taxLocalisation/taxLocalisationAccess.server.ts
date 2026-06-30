import "server-only";

import {
  isFiOsPlatformAdminFullSessionBypass,
  loadProxyFiUserRowForPlatformAdminTenant,
  resolveAuthUserId,
} from "@/src/lib/crm/crmGate";
import { getFiOsImpersonationTargetAuthUserId } from "@/src/lib/fiOs/fiOsImpersonation.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  canEditTaxLocalisationRoute,
  canViewTaxLocalisationRoute,
} from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

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
  return {
    id: String((data as { id: string }).id),
    role: String((data as { role: string | null }).role ?? "member"),
  };
}

/**
 * Tax & localisation UI: view requires finance capability or legacy clinical tenant member;
 * edit requires {@link canEditTaxLocalisationRoute}. FI platform admin overrides apply here.
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

  const canView = await canViewTaxLocalisationRoute(tid);
  if (!canView) {
    return { canView: false, canEdit: false, actorFiUserId: null };
  }

  const canEdit = await canEditTaxLocalisationRoute(tid);

  return {
    canView: true,
    canEdit,
    actorFiUserId: row.id,
  };
}
