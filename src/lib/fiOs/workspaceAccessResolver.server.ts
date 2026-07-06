import "server-only";

import { cache } from "react";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isFiOsPlatformAdminFullSessionBypass,
  resolveAuthUserId,
} from "@/src/lib/crm/crmGate";
import { getFiOsImpersonationTargetAuthUserId } from "@/src/lib/fiOs/fiOsImpersonation.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsCrossTenantDirectoryRole, isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import type { StaffRoleKey } from "@/src/lib/staffAccess/staffAccessRegistry";

import {
  buildWorkspaceStaffIdentity,
  type FiStaffRowSnapshot,
  type StaffMemberRowSnapshot,
  type WorkspaceAccessDiagnostic,
  type WorkspaceAccessResolverResult,
  resolveWorkspaceAccessDecision,
} from "./workspaceAccessResolverCore";
import { seedTenantRoleTemplatesFromGlobal } from "./workspaceAccessResolverSeed.server";

export type { WorkspaceAccessDiagnostic, WorkspaceAccessResolverResult };
export {
  WORKSPACE_ACCESS_GENERIC_DENIED_MESSAGE,
  buildWorkspaceStaffIdentity,
  followMergedIntoCanonicalMemberId,
  resolveCanonicalStaffMemberRow,
  resolveWorkspaceAccessDecision,
  resolveWorkspaceStaffRoleKey,
} from "./workspaceAccessResolverCore";

function logWorkspaceAccessDiagnostics(input: {
  tenantId: string;
  authUserId: string;
  allowed: boolean;
  denyReason: string | null;
  diagnostics: WorkspaceAccessDiagnostic[];
  identity: WorkspaceAccessResolverResult["identity"];
}): void {
  if (input.allowed && input.diagnostics.length === 0) return;
  console.info(
    "[fi-workspace-access]",
    JSON.stringify({
      tenantId: input.tenantId,
      authUserId: input.authUserId,
      allowed: input.allowed,
      denyReason: input.denyReason,
      fiStaffId: input.identity.fiStaffId,
      canonicalStaffMemberId: input.identity.canonicalStaffMemberId,
      roleKey: input.identity.roleKey,
      rawRole: input.identity.rawRole,
      diagnostics: input.diagnostics.map((d) => d.code),
    })
  );
}

async function resolveSessionAuthUserId(sessionAuthUserId: string): Promise<string> {
  const target = await getFiOsImpersonationTargetAuthUserId(sessionAuthUserId);
  return target ?? sessionAuthUserId;
}

async function loadFiUserRow(
  tenantId: string,
  authUserId: string,
  client: SupabaseClient
): Promise<{ id: string; role: string } | null> {
  const { data, error } = await client
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

async function loadActiveFiStaffForFiUser(
  tenantId: string,
  fiUserId: string,
  client: SupabaseClient
): Promise<FiStaffRowSnapshot | null> {
  const { data, error } = await client
    .from("fi_staff")
    .select("id, staff_role, is_active, employment_status")
    .eq("tenant_id", tenantId.trim())
    .eq("fi_user_id", fiUserId.trim())
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string;
    staff_role: string | null;
    is_active: boolean;
    employment_status: string | null;
  };
  return {
    id: String(row.id),
    staffRole: row.staff_role != null ? String(row.staff_role) : null,
    isActive: Boolean(row.is_active),
    employmentStatus: row.employment_status != null ? String(row.employment_status) : null,
  };
}

async function loadStaffMemberSnapshotsForFiStaff(
  tenantId: string,
  fiStaffId: string,
  client: SupabaseClient
): Promise<StaffMemberRowSnapshot[]> {
  const { data, error } = await client
    .from("fi_staff_members")
    .select(
      "id, fi_staff_id, role_code, archived_at, merged_into, employment_status, system_access_revoked"
    )
    .eq("tenant_id", tenantId.trim())
    .eq("fi_staff_id", fiStaffId.trim());
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    fiStaffId: r.fi_staff_id != null ? String(r.fi_staff_id) : null,
    roleCode: r.role_code != null ? String(r.role_code) : null,
    archivedAt: r.archived_at != null ? String(r.archived_at) : null,
    mergedInto: r.merged_into != null ? String(r.merged_into) : null,
    employmentStatus: String(r.employment_status ?? "active"),
    systemAccessRevoked: Boolean(r.system_access_revoked),
  }));
}

async function countActiveGrants(
  tenantId: string,
  staffId: string,
  client: SupabaseClient
): Promise<number> {
  const { count, error } = await client
    .from("fi_staff_access_grants")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId.trim())
    .eq("staff_member_id", staffId.trim())
    .is("revoked_at", null);
  if (error) return 0;
  return count ?? 0;
}

async function countRoleTemplates(
  tenantId: string,
  roleKey: StaffRoleKey,
  client: SupabaseClient
): Promise<{ tenantCount: number; globalCount: number }> {
  const tid = tenantId.trim();
  const [tenantRes, globalRes] = await Promise.all([
    client
      .from("fi_role_permission_templates")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("role_key", roleKey)
      .is("tab_key", null),
    client
      .from("fi_role_permission_templates")
      .select("id", { count: "exact", head: true })
      .is("tenant_id", null)
      .eq("role_key", roleKey)
      .is("tab_key", null),
  ]);
  return {
    tenantCount: tenantRes.count ?? 0,
    globalCount: globalRes.count ?? 0,
  };
}

export { seedTenantRoleTemplatesFromGlobal } from "./workspaceAccessResolverSeed.server";

export type ResolveWorkspaceAccessOptions = {
  tenantId: string;
  authUserId: string;
  client?: SupabaseClient;
  /** When true, seed missing tenant role templates from global baseline before deciding. */
  repairMissingTemplates?: boolean;
};

async function resolveWorkspaceAccessImpl(
  options: ResolveWorkspaceAccessOptions
): Promise<WorkspaceAccessResolverResult> {
  const tid = options.tenantId.trim();
  const authUserId = options.authUserId.trim();
  const client = options.client ?? supabaseAdmin();

  if (await isFiOsPlatformAdminFullSessionBypass(authUserId)) {
    return {
      allowed: true,
      identity: {
        fiStaffId: null,
        canonicalStaffMemberId: null,
        roleKey: "platform_admin",
        rawRole: "platform_admin",
      },
      diagnostics: [],
      denyReason: null,
    };
  }

  const os = await loadFiOsIdentity(authUserId);
  if (os && isFiOsCrossTenantDirectoryRole(os.osRole)) {
    return {
      allowed: true,
      identity: {
        fiStaffId: null,
        canonicalStaffMemberId: null,
        roleKey: isFiOsPlatformAdminRole(os.osRole) ? "platform_admin" : null,
        rawRole: os.osRole,
      },
      diagnostics: [],
      denyReason: null,
    };
  }

  const navAuth = await resolveSessionAuthUserId(authUserId);
  const fiUser = await loadFiUserRow(tid, navAuth, client);
  if (!fiUser) {
    return {
      allowed: false,
      identity: buildWorkspaceStaffIdentity({ fiStaff: null, memberRows: [] }),
      diagnostics: [],
      denyReason: "no_fi_users_membership",
    };
  }

  const adminProfile = await loadActiveTenantAdminProfileForSession(tid, authUserId);
  const isAdminOverride = adminProfile?.adminRole === "clinic_admin";

  const fiStaff = await loadActiveFiStaffForFiUser(tid, fiUser.id, client);
  const memberRows = fiStaff
    ? await loadStaffMemberSnapshotsForFiStaff(tid, fiStaff.id, client)
    : [];

  const identityPreview = buildWorkspaceStaffIdentity({ fiStaff, memberRows });

  if (options.repairMissingTemplates !== false && identityPreview.roleKey && fiStaff) {
    const { tenantCount } = await countRoleTemplates(tid, identityPreview.roleKey, client);
    if (tenantCount === 0) {
      await seedTenantRoleTemplatesFromGlobal(tid, identityPreview.roleKey, client);
    }
  }

  const grantStaffId = fiStaff?.id ?? null;
  const memberId = identityPreview.canonicalStaffMemberId;
  const [grantsForFiStaffId, grantsForMemberId, templateCounts] = await Promise.all([
    grantStaffId ? countActiveGrants(tid, grantStaffId, client) : Promise.resolve(0),
    memberId && memberId !== grantStaffId
      ? countActiveGrants(tid, memberId, client)
      : Promise.resolve(null),
    identityPreview.roleKey
      ? countRoleTemplates(tid, identityPreview.roleKey, client)
      : Promise.resolve({ tenantCount: 0, globalCount: 0 }),
  ]);

  const result = resolveWorkspaceAccessDecision({
    fiStaff,
    memberRows,
    tenantTemplateCount: templateCounts.tenantCount,
    globalTemplateCount: templateCounts.globalCount,
    activeGrantCountForFiStaffId: grantsForFiStaffId,
    activeGrantCountForMemberId: grantsForMemberId,
    isAdminOverride,
  });

  logWorkspaceAccessDiagnostics({
    tenantId: tid,
    authUserId,
    allowed: result.allowed,
    denyReason: result.denyReason,
    diagnostics: result.diagnostics,
    identity: result.identity,
  });

  return result;
}

/** Per-request cached workspace access resolution for the active session viewer. */
export const resolveWorkspaceAccessForViewer = cache(async (tenantId: string) => {
  const authUserId = await resolveAuthUserId(null);
  if (!authUserId) {
    return {
      allowed: false,
      identity: buildWorkspaceStaffIdentity({ fiStaff: null, memberRows: [] }),
      diagnostics: [] as WorkspaceAccessDiagnostic[],
      denyReason: "no_session",
    } satisfies WorkspaceAccessResolverResult;
  }
  return resolveWorkspaceAccessImpl({ tenantId, authUserId });
});

export async function resolveWorkspaceAccessForAuthUser(
  options: ResolveWorkspaceAccessOptions
): Promise<WorkspaceAccessResolverResult> {
  return resolveWorkspaceAccessImpl(options);
}

/**
 * Grant lookup staff id for SA-1 — always `fi_staff.id`, never `fi_staff_members.id`.
 */
export async function resolveWorkspaceGrantStaffIdForFiUser(
  tenantId: string,
  fiUserId: string,
  client?: SupabaseClient
): Promise<string | null> {
  const tid = tenantId.trim();
  const uid = fiUserId.trim();
  if (!tid || !uid) return null;
  const supabase = client ?? supabaseAdmin();
  const fiStaff = await loadActiveFiStaffForFiUser(tid, uid, supabase);
  return fiStaff?.id ?? null;
}
