import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeFiOsRole } from "./fiOsRoles";
import { loadFiOsIdentity } from "./fiOsIdentity.server";
import { loadMembershipTenantIdsForAuthUser } from "@/src/lib/workforce/staffTenantLinkRepair.server";
import {
  readMetadataTenantId,
  resolvePostLoginDestination,
  resolvePreferredLoginTenantId,
  extractTenantIdFromFiAdminPath,
} from "@/src/lib/workforce/staffTenantLinkRepairCore";
import { resolveFiOsPostLoginPathSuffix } from "@/src/lib/fiOs/fiOsRoleLandingCore";
import { resolveWorkspaceStaffRoleKey } from "@/src/lib/fiOs/workspaceAccessResolverCore";

async function loadAuthMetadataTenantId(authUserId: string): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.auth.admin.getUserById(authUserId.trim());
  if (error || !data.user) return null;
  return readMetadataTenantId((data.user.user_metadata ?? {}) as Record<string, unknown>);
}

/**
 * Best-effort staff_role + tenant admin role for preferred login tenant (pure DB reads).
 * Never throws into the login path — falls back to OS role only.
 */
async function loadLandingHintsForAuthUser(
  authUserId: string,
  preferredTenantId: string | null
): Promise<{ staffRoleKey: string | null; tenantAdminRole: string | null }> {
  if (!preferredTenantId?.trim() || !authUserId.trim()) {
    return { staffRoleKey: null, tenantAdminRole: null };
  }
  const supabase = supabaseAdmin();
  const tid = preferredTenantId.trim();
  const uid = authUserId.trim();

  try {
    const { data: fiUser } = await supabase
      .from("fi_users")
      .select("id, role")
      .eq("tenant_id", tid)
      .eq("auth_user_id", uid)
      .maybeSingle();

    const fiUserId = fiUser ? String((fiUser as { id: string }).id) : null;
    let staffRole: string | null = null;
    let tenantAdminRole: string | null = null;
    if (fiUserId) {
      const { data: staff } = await supabase
        .from("fi_staff")
        .select("staff_role")
        .eq("tenant_id", tid)
        .eq("fi_user_id", fiUserId)
        .limit(1)
        .maybeSingle();
      staffRole = staff ? String((staff as { staff_role: string | null }).staff_role ?? "") : null;

      const { data: adminRow } = await supabase
        .from("fi_tenant_admin_users")
        .select("admin_role, status")
        .eq("tenant_id", tid)
        .eq("fi_user_id", fiUserId)
        .maybeSingle();
      if (adminRow) {
        const st = String((adminRow as { status?: string }).status ?? "")
          .trim()
          .toLowerCase();
        if (st === "active" || !st) {
          tenantAdminRole = String((adminRow as { admin_role: string | null }).admin_role ?? "");
        }
      }
    }

    const { roleKey } = resolveWorkspaceStaffRoleKey({
      staffRole,
      roleCode: null,
    });

    return {
      staffRoleKey: roleKey ?? (staffRole?.trim() || null),
      tenantAdminRole: tenantAdminRole?.trim() || null,
    };
  } catch {
    return { staffRoleKey: null, tenantAdminRole: null };
  }
}

/**
 * Server-only post-login redirect for Follicle Intelligence OS.
 * Uses `fi_os_identities` and `fi_users` only via service role — never trust client hints.
 *
 * FI-TRUST-LANDING-AND-SPINE-1: tenant members land on a role-appropriate home
 * (Front desk / Pipeline / Doctor / Money / Today) — not `/cases`.
 */
export async function resolveFiOsPostLoginRedirect(
  authUserId: string,
  explicitNext?: string | null
): Promise<string> {
  const os = await loadFiOsIdentity(authUserId);
  const r = os ? normalizeFiOsRole(os.osRole) : "";

  if (r === "fi_auditor") {
    return "/hair-audit/admin";
  }

  if (r === "fi_admin" || r === "fi_platform_admin") {
    return "/fi-admin";
  }

  const [membershipTenantIds, metadataTenantId] = await Promise.all([
    loadMembershipTenantIdsForAuthUser(authUserId),
    loadAuthMetadataTenantId(authUserId),
  ]);

  const preferredTenantId = resolvePreferredLoginTenantId({
    nextPathTenantId: extractTenantIdFromFiAdminPath(explicitNext ?? null),
    metadataTenantId,
    membershipTenantIds,
  });

  const hints = await loadLandingHintsForAuthUser(authUserId, preferredTenantId);
  const homeSuffix = resolveFiOsPostLoginPathSuffix({
    osRole: r || null,
    staffRoleKey: hints.staffRoleKey,
    tenantAdminRole: hints.tenantAdminRole,
  });

  return resolvePostLoginDestination({
    explicitNext: explicitNext ?? null,
    membershipTenantIds,
    metadataTenantId,
    defaultTenantHomeSuffix: homeSuffix,
  });
}
