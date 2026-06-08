import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getFiOsImpersonationTargetAuthUserId } from "@/src/lib/fiOs/fiOsImpersonation.server";
import {
  isFiOsPlatformAdminFullSessionBypass,
  loadProxyFiUserRowForPlatformAdminTenant,
  resolveAuthUserId,
} from "@/src/lib/crm/crmGate";
import type { FiTenantAdminRole, FiTenantAdminUserStatus } from "@/src/lib/tenantAdmin/tenantAdminRoles";
import { canManageTenantAdminUsersFromProfiles, normalizeFiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

export type FiTenantAdminUserRow = {
  id: string;
  tenantId: string;
  fiUserId: string;
  adminRole: FiTenantAdminRole;
  status: FiTenantAdminUserStatus;
  displayName: string | null;
  accessNotes: string | null;
  invitedByFiUserId: string | null;
  createdAt: string;
  updatedAt: string;
  fiUserEmail: string | null;
  fiUserAuthUserId: string | null;
};

async function resolveShellAuthUserId(sessionAuthUserId: string): Promise<string> {
  const imp = await getFiOsImpersonationTargetAuthUserId(sessionAuthUserId);
  return imp ?? sessionAuthUserId;
}

async function loadFiUserRow(
  tenantId: string,
  authUserId: string
): Promise<{ id: string; role: string; email: string | null; auth_user_id: string | null } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role, email, auth_user_id")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as { id: string; role: string | null; email: string | null; auth_user_id: string | null };
  return {
    id: String(r.id),
    role: String(r.role ?? "member"),
    email: r.email ? String(r.email) : null,
    auth_user_id: r.auth_user_id ? String(r.auth_user_id) : null,
  };
}

/**
 * Active fi_tenant_admin_users row for this tenant + auth user (via fi_users), if any.
 */
export async function loadActiveTenantAdminProfileForSession(
  tenantId: string,
  sessionAuthUserId: string
): Promise<{ fiUserId: string; adminRole: FiTenantAdminRole; status: FiTenantAdminUserStatus } | null> {
  const tid = tenantId.trim();
  const sid = sessionAuthUserId.trim();
  if (!tid || !sid) return null;
  if (await isFiOsPlatformAdminFullSessionBypass(sid)) {
    return null;
  }
  const navAuth = await resolveShellAuthUserId(sid);
  const u = await loadFiUserRow(tid, navAuth);
  if (!u) return null;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_admin_users")
    .select("id, admin_role, status")
    .eq("tenant_id", tid)
    .eq("fi_user_id", u.id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { admin_role: string; status: string };
  const adminRole = normalizeFiTenantAdminRole(row.admin_role);
  const st = String(row.status ?? "").trim().toLowerCase();
  if (!adminRole || st !== "active") return null;
  return { fiUserId: u.id, adminRole, status: "active" };
}

export async function loadTenantAdminUserRowsForTenant(tenantId: string): Promise<FiTenantAdminUserRow[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_admin_users")
    .select(
      "id, tenant_id, fi_user_id, admin_role, status, display_name, access_notes, invited_by_fi_user_id, created_at, updated_at"
    )
    .eq("tenant_id", tid)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const fiUserIds = Array.from(new Set(rows.map((r) => String(r.fi_user_id ?? "")).filter(Boolean)));
  const emailByFiUser = new Map<string, { email: string | null; auth_user_id: string | null }>();
  if (fiUserIds.length) {
    const { data: users, error: ue } = await supabase
      .from("fi_users")
      .select("id, email, auth_user_id")
      .eq("tenant_id", tid)
      .in("id", fiUserIds);
    if (ue) throw new Error(ue.message);
    for (const u of users ?? []) {
      const rec = u as { id: string; email: string | null; auth_user_id: string | null };
      emailByFiUser.set(String(rec.id), {
        email: rec.email ? String(rec.email) : null,
        auth_user_id: rec.auth_user_id ? String(rec.auth_user_id) : null,
      });
    }
  }
  return rows.map((r) => {
    const role = normalizeFiTenantAdminRole(String(r.admin_role ?? ""));
    const st = String(r.status ?? "").trim().toLowerCase();
    if (!role || !["invited", "active", "suspended"].includes(st)) {
      throw new Error("Invalid fi_tenant_admin_users row.");
    }
    const fiUserId = String(r.fi_user_id);
    const fu = emailByFiUser.get(fiUserId);
    return {
      id: String(r.id),
      tenantId: String(r.tenant_id),
      fiUserId,
      adminRole: role,
      status: st as FiTenantAdminUserStatus,
      displayName: r.display_name ? String(r.display_name) : null,
      accessNotes: r.access_notes ? String(r.access_notes) : null,
      invitedByFiUserId: r.invited_by_fi_user_id ? String(r.invited_by_fi_user_id) : null,
      createdAt: String(r.created_at ?? ""),
      updatedAt: String(r.updated_at ?? ""),
      fiUserEmail: fu?.email ?? null,
      fiUserAuthUserId: fu?.auth_user_id ?? null,
    };
  });
}

export type AuthUserLastLogin = { authUserId: string; lastSignInAt: string | null };

/**
 * Best-effort last sign-in from auth.users (service role). Skips missing users.
 */
export async function loadAuthLastSignInAtForUserIds(authUserIds: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const ids = Array.from(new Set(authUserIds.map((x) => x.trim()).filter(Boolean)));
  if (!ids.length) return out;
  const supabase = supabaseAdmin();
  for (const id of ids) {
    const { data, error } = await supabase.auth.admin.getUserById(id);
    if (error || !data?.user) {
      out.set(id, null);
      continue;
    }
    const iso = data.user.last_sign_in_at ?? null;
    out.set(id, iso);
  }
  return out;
}

/**
 * Resolves actor fi_users.id for tenant admin mutations (respects impersonation + platform admin proxy row).
 */
export async function resolveActorFiUserIdForTenantAdminActions(tenantId: string): Promise<string | null> {
  const tid = tenantId.trim();
  const authId = await resolveAuthUserId(null);
  if (!authId) return null;
  if (await isFiOsPlatformAdminFullSessionBypass(authId)) {
    const proxy = await loadProxyFiUserRowForPlatformAdminTenant(tid, authId);
    return proxy?.id ?? null;
  }
  const navAuth = await resolveShellAuthUserId(authId);
  const row = await loadFiUserRow(tid, navAuth);
  return row?.id ?? null;
}

/** Whether the current session may open Admin Users settings (invite / role / suspend). */
export async function getTenantAdminUsersManageAllowed(tenantId: string): Promise<boolean> {
  const tid = tenantId.trim();
  const authId = await resolveAuthUserId(null);
  if (!authId) return false;
  if (await isFiOsPlatformAdminFullSessionBypass(authId)) return true;
  const navAuth = await resolveShellAuthUserId(authId);
  const row = await loadFiUserRow(tid, navAuth);
  if (!row) return false;
  const prof = await loadActiveTenantAdminProfileForSession(tid, authId);
  return canManageTenantAdminUsersFromProfiles({
    tenantFiUserRole: row.role,
    activeTenantAdminRole: prof?.adminRole ?? null,
  });
}
