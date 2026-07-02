import "server-only";

import { cache } from "react";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isFiOsPlatformAdminFullSessionBypass,
  loadProxyFiUserRowForPlatformAdminTenant,
  resolveAuthUserId,
} from "@/src/lib/crm/crmGate";
import { getFiOsImpersonationTargetAuthUserId } from "@/src/lib/fiOs/fiOsImpersonation.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

import {
  canAccessTab as coreCanAccessTab,
  canApproveModule as coreCanApproveModule,
  canEditModule as coreCanEditModule,
  canViewModule as coreCanViewModule,
  computeEffectiveAccess,
  getVisibleStaffNavigation as coreGetVisibleStaffNavigation,
  type EffectiveAccessMap,
  type RoleTemplateMap,
  type StaffAccessGrantInput,
} from "./staffAccessCore";
import {
  isStaffAccessLevel,
  isStaffAccessModuleKey,
  isStaffAccessScope,
  listStaffAccessModules,
  normalizeStaffRoleKey,
  STAFF_ACCESS_MODULES,
  type StaffAccessLevel,
  type StaffAccessModuleKey,
  type StaffAccessScope,
  type StaffRoleKey,
} from "./staffAccessRegistry";

/**
 * SA-1 server engine. Resolves the viewer's (or a named staff member's) effective access by
 * merging role templates, explicit grants, and tenant/platform admin overrides loaded from the
 * database, then delegating to the pure {@link computeEffectiveAccess}.
 */

export type StaffAccessPrincipal = {
  tenantId: string;
  /** `fi_staff.id` when the viewer maps to a staff row; null for admin-only sessions. */
  staffMemberId: string | null;
  /** Canonical role for template lookup (may be null for unmapped members). */
  roleKey: StaffRoleKey | null;
  /** Raw role string for display. */
  rawRole: string | null;
  /** Tenant admin (clinic_admin) or platform admin → admin on every module. */
  isAdminOverride: boolean;
  /** Resolved `fi_users.id` for the active session (for audit attribution). */
  fiUserId: string | null;
  authUserId: string | null;
};

async function resolveSessionAuthUserId(sessionAuthUserId: string): Promise<string> {
  const target = await getFiOsImpersonationTargetAuthUserId(sessionAuthUserId);
  return target ?? sessionAuthUserId;
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

async function loadActiveStaffRowForFiUser(
  tenantId: string,
  fiUserId: string
): Promise<{ id: string; staffRole: string } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id, staff_role, is_active")
    .eq("tenant_id", tenantId.trim())
    .eq("fi_user_id", fiUserId.trim())
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: String((data as { id: string }).id),
    staffRole: String((data as { staff_role: string | null }).staff_role ?? ""),
  };
}

/**
 * Resolve the access principal for the current session against a tenant.
 * Returns null when there is no usable session/membership (callers should fall back to the
 * existing portal gates rather than hard-denying — progressive enhancement).
 */
export async function resolveStaffAccessPrincipal(
  tenantId: string
): Promise<StaffAccessPrincipal | null> {
  const tid = tenantId.trim();
  if (!tid) return null;
  const sessionAuthId = await resolveAuthUserId(null);
  if (!sessionAuthId) return null;

  // Platform admin full bypass → admin everywhere.
  if (await isFiOsPlatformAdminFullSessionBypass(sessionAuthId)) {
    const proxy = await loadProxyFiUserRowForPlatformAdminTenant(tid, sessionAuthId);
    return {
      tenantId: tid,
      staffMemberId: null,
      roleKey: "platform_admin",
      rawRole: "platform_admin",
      isAdminOverride: true,
      fiUserId: proxy?.id ?? null,
      authUserId: sessionAuthId,
    };
  }

  const os = await loadFiOsIdentity(sessionAuthId);
  const isPlatformAdminRole = Boolean(os && isFiOsPlatformAdminRole(os.osRole));

  const navAuth = await resolveSessionAuthUserId(sessionAuthId);
  const fiUser = await loadFiUserRow(tid, navAuth);

  if (isPlatformAdminRole) {
    const proxy = fiUser ?? (await loadProxyFiUserRowForPlatformAdminTenant(tid, sessionAuthId));
    return {
      tenantId: tid,
      staffMemberId: null,
      roleKey: "platform_admin",
      rawRole: "platform_admin",
      isAdminOverride: true,
      fiUserId: proxy?.id ?? null,
      authUserId: sessionAuthId,
    };
  }

  if (!fiUser) return null;

  const adminProfile = await loadActiveTenantAdminProfileForSession(tid, sessionAuthId);
  const tenantAdminRole = adminProfile?.adminRole ?? null;
  // clinic_admin behaves as a tenant-wide owner override.
  const isTenantOwnerOverride = tenantAdminRole === "clinic_admin";

  const staffRow = await loadActiveStaffRowForFiUser(tid, fiUser.id);

  const roleKey =
    normalizeStaffRoleKey(staffRow?.staffRole ?? null) ??
    normalizeStaffRoleKey(fiUser.role) ??
    normalizeStaffRoleKey(tenantAdminRole ?? null);

  return {
    tenantId: tid,
    staffMemberId: staffRow?.id ?? null,
    roleKey,
    rawRole: staffRow?.staffRole ?? fiUser.role ?? tenantAdminRole ?? null,
    isAdminOverride: isTenantOwnerOverride,
    fiUserId: fiUser.id,
    authUserId: sessionAuthId,
  };
}

/**
 * Load role template defaults from `fi_role_permission_templates` for a role. Tenant-specific
 * rows override the global baseline (tenant_id NULL). Returns an empty map when none exist, so
 * the core can fall back to the static registry.
 */
async function loadRoleTemplateFromDbUncached(
  tenantId: string,
  roleKey: StaffRoleKey | null
): Promise<RoleTemplateMap> {
  if (!roleKey) return {};
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_role_permission_templates")
    .select("tenant_id, module_key, tab_key, access_level, scope")
    .eq("role_key", roleKey)
    .is("tab_key", null)
    .or(`tenant_id.is.null,tenant_id.eq.${tid}`);
  if (error || !data) return {};

  const out: RoleTemplateMap = {};
  // Apply global rows first, then tenant rows so tenant overrides win.
  const rows = (data as Array<Record<string, unknown>>).slice().sort((a, b) => {
    const at = a.tenant_id ? 1 : 0;
    const bt = b.tenant_id ? 1 : 0;
    return at - bt;
  });
  for (const r of rows) {
    const moduleKey = String(r.module_key ?? "");
    const level = String(r.access_level ?? "none");
    const scope = String(r.scope ?? "tenant");
    if (
      !isStaffAccessModuleKey(moduleKey) ||
      !isStaffAccessLevel(level) ||
      !isStaffAccessScope(scope)
    )
      continue;
    if (level === "none") {
      delete out[moduleKey];
      continue;
    }
    out[moduleKey] = { level, scope };
  }
  return out;
}

/** Per-request deduped SA-1 module permission matrix (role templates). */
export const loadRoleTemplateFromDb = cache(loadRoleTemplateFromDbUncached);

/** Load active + revoked grants for one staff member (core ignores revoked). */
export async function loadStaffAccessGrants(
  tenantId: string,
  staffMemberId: string | null
): Promise<StaffAccessGrantInput[]> {
  const tid = tenantId.trim();
  const sid = staffMemberId?.trim();
  if (!tid || !sid) return [];
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_access_grants")
    .select("module_key, tab_key, access_level, scope, revoked_at")
    .eq("tenant_id", tid)
    .eq("staff_member_id", sid);
  if (error || !data) return [];
  const out: StaffAccessGrantInput[] = [];
  for (const r of data as Array<Record<string, unknown>>) {
    const moduleKey = String(r.module_key ?? "");
    const level = String(r.access_level ?? "none");
    const scope = String(r.scope ?? "tenant");
    if (
      !isStaffAccessModuleKey(moduleKey) ||
      !isStaffAccessLevel(level) ||
      !isStaffAccessScope(scope)
    )
      continue;
    out.push({
      moduleKey: moduleKey,
      tabKey: r.tab_key ? String(r.tab_key) : null,
      accessLevel: level,
      scope,
      revokedAt: r.revoked_at ? String(r.revoked_at) : null,
    });
  }
  return out;
}

export type StaffEffectiveAccessResult = {
  principal: StaffAccessPrincipal | null;
  access: EffectiveAccessMap;
};

/**
 * Effective access for the current viewer in a tenant. When no principal can be resolved
 * (e.g. legacy session), returns a null principal and an empty access map — callers decide
 * whether to fall back (guards do, to avoid lockout).
 */
export async function getStaffEffectiveAccess(
  tenantId: string
): Promise<StaffEffectiveAccessResult> {
  const principal = await resolveStaffAccessPrincipal(tenantId);
  if (!principal) {
    return { principal: null, access: computeEffectiveAccess({ roleKey: null, grants: [] }) };
  }
  const [roleTemplate, grants] = await Promise.all([
    loadRoleTemplateFromDb(tenantId, principal.roleKey),
    loadStaffAccessGrants(tenantId, principal.staffMemberId),
  ]);
  const access = computeEffectiveAccess({
    roleKey: principal.roleKey,
    roleTemplate,
    grants,
    isAdminOverride: principal.isAdminOverride,
  });
  return { principal, access };
}

/**
 * Effective access for a SPECIFIC staff member (admin preview on the Staff Access page).
 * No session override is applied — this reflects what that staff member would actually see.
 */
export async function getStaffEffectiveAccessForStaffMember(
  tenantId: string,
  staffMemberId: string,
  rawRole: string | null
): Promise<EffectiveAccessMap> {
  const roleKey = normalizeStaffRoleKey(rawRole);
  const [roleTemplate, grants] = await Promise.all([
    loadRoleTemplateFromDb(tenantId, roleKey),
    loadStaffAccessGrants(tenantId, staffMemberId),
  ]);
  return computeEffectiveAccess({ roleKey, roleTemplate, grants });
}

// ---------------------------------------------------------------------------
// Convenience predicates for the current viewer (used by loaders/actions).
// ---------------------------------------------------------------------------

export async function canViewModule(
  tenantId: string,
  module: StaffAccessModuleKey
): Promise<boolean> {
  const { access } = await getStaffEffectiveAccess(tenantId);
  return coreCanViewModule(access, module);
}

export async function canEditModule(
  tenantId: string,
  module: StaffAccessModuleKey
): Promise<boolean> {
  const { access } = await getStaffEffectiveAccess(tenantId);
  return coreCanEditModule(access, module);
}

export async function canApproveModule(
  tenantId: string,
  module: StaffAccessModuleKey
): Promise<boolean> {
  const { access } = await getStaffEffectiveAccess(tenantId);
  return coreCanApproveModule(access, module);
}

export async function canAccessTab(
  tenantId: string,
  module: StaffAccessModuleKey,
  tabKey: string,
  required: StaffAccessLevel = "read"
): Promise<boolean> {
  const { access } = await getStaffEffectiveAccess(tenantId);
  return coreCanAccessTab(access, module, tabKey, required);
}

/**
 * Map SA-1 modules to the legacy `FiFeatureKey` nav-visibility keys so blocked modules are also
 * excluded from the existing feature-access-driven navigation (server-resolved, not client-hidden).
 */
const STAFF_MODULE_TO_FEATURE_KEYS: Partial<Record<StaffAccessModuleKey, string[]>> = {
  clinic_os: ["dashboard", "calendar"],
  lead_flow: ["crm"],
  patient_os: ["patients"],
  consultation_os: ["consultations"],
  surgery_os: ["cases", "procedure_day"],
  imaging_os: ["imaging"],
  audit_os: ["audit"],
  academy_os: ["academy"],
  analytics_os: ["analytics"],
  workforce_os: ["staff"],
  settings: ["settings"],
};

/**
 * Compute `FiFeatureKey → false` overrides for the current viewer's blocked modules, so the
 * existing nav (which filters by feature access) hides what SA-1 blocks. Returns null when SA-1
 * is not enforcing this session (no staff mapping / admin override) — callers keep base nav.
 */
export async function getStaffAccessNavFeatureOverrides(
  tenantId: string
): Promise<Record<string, boolean> | null> {
  const { principal, access } = await getStaffEffectiveAccess(tenantId);
  if (!principal || principal.isAdminOverride || !principal.staffMemberId || !principal.roleKey) {
    return null;
  }
  const managed = new Set<string>();
  const visible = new Set<string>();
  for (const moduleKey of Object.keys(STAFF_MODULE_TO_FEATURE_KEYS) as StaffAccessModuleKey[]) {
    const keys = STAFF_MODULE_TO_FEATURE_KEYS[moduleKey] ?? [];
    keys.forEach((k) => managed.add(k));
    if (coreCanViewModule(access, moduleKey)) keys.forEach((k) => visible.add(k));
  }
  const overrides: Record<string, boolean> = {};
  for (const k of managed) {
    if (!visible.has(k)) overrides[k] = false;
  }
  return overrides;
}

export type VisibleStaffNavItem = {
  module: StaffAccessModuleKey;
  label: string;
  navPath: string;
  level: StaffAccessLevel;
  scope: StaffAccessScope;
  href: (base: string) => string;
};

/**
 * Server-resolved navigation for the current viewer: only modules they may at least view.
 * Returns null when no principal resolves (caller keeps legacy navigation).
 */
export async function getVisibleStaffNavigation(
  tenantId: string
): Promise<VisibleStaffNavItem[] | null> {
  const { principal, access } = await getStaffEffectiveAccess(tenantId);
  if (!principal) return null;
  return coreGetVisibleStaffNavigation(access).map((m) => {
    const def = STAFF_ACCESS_MODULES[m.module];
    return {
      module: m.module,
      label: def.label,
      navPath: def.navPath,
      level: m.level,
      scope: m.scope,
      href: (base: string) => (def.navPath ? `${base}/${def.navPath}` : base),
    };
  });
}

// ---------------------------------------------------------------------------
// Admin-page loaders.
// ---------------------------------------------------------------------------

export type StaffAccessAdminStaffRow = {
  id: string;
  fullName: string;
  staffRole: string;
  roleKey: StaffRoleKey | null;
  email: string | null;
  isActive: boolean;
};

export async function loadTenantStaffForAccessAdmin(
  tenantId: string
): Promise<StaffAccessAdminStaffRow[]> {
  const tid = tenantId.trim();
  if (!tid) return [];
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id, full_name, staff_role, email, is_active")
    .eq("tenant_id", tid)
    .order("full_name", { ascending: true });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    fullName: String(r.full_name ?? ""),
    staffRole: String(r.staff_role ?? ""),
    roleKey: normalizeStaffRoleKey(String(r.staff_role ?? "")),
    email: r.email ? String(r.email) : null,
    isActive: Boolean(r.is_active),
  }));
}

export type StaffAccessGrantRow = {
  id: string;
  clinicId: string | null;
  moduleKey: StaffAccessModuleKey;
  tabKey: string | null;
  accessLevel: StaffAccessLevel;
  scope: StaffAccessScope;
  grantedBy: string | null;
  grantedAt: string;
  revokedAt: string | null;
};

export async function loadStaffAccessGrantRows(
  tenantId: string,
  staffMemberId: string
): Promise<StaffAccessGrantRow[]> {
  const tid = tenantId.trim();
  const sid = staffMemberId.trim();
  if (!tid || !sid) return [];
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_access_grants")
    .select(
      "id, clinic_id, module_key, tab_key, access_level, scope, granted_by, granted_at, revoked_at"
    )
    .eq("tenant_id", tid)
    .eq("staff_member_id", sid)
    .order("granted_at", { ascending: false });
  if (error || !data) return [];
  const out: StaffAccessGrantRow[] = [];
  for (const r of data as Array<Record<string, unknown>>) {
    const moduleKey = String(r.module_key ?? "");
    const level = String(r.access_level ?? "none");
    const scope = String(r.scope ?? "tenant");
    if (
      !isStaffAccessModuleKey(moduleKey) ||
      !isStaffAccessLevel(level) ||
      !isStaffAccessScope(scope)
    )
      continue;
    out.push({
      id: String(r.id),
      clinicId: r.clinic_id ? String(r.clinic_id) : null,
      moduleKey: moduleKey,
      tabKey: r.tab_key ? String(r.tab_key) : null,
      accessLevel: level,
      scope,
      grantedBy: r.granted_by ? String(r.granted_by) : null,
      grantedAt: String(r.granted_at),
      revokedAt: r.revoked_at ? String(r.revoked_at) : null,
    });
  }
  return out;
}

export type StaffAccessClinicRow = { id: string; name: string };

export async function loadClinicsForStaffAccess(tenantId: string): Promise<StaffAccessClinicRow[]> {
  const tid = tenantId.trim();
  if (!tid) return [];
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id, name")
    .eq("tenant_id", tid)
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? "Clinic"),
  }));
}

export function listStaffAccessModuleDefinitions() {
  return listStaffAccessModules();
}

/**
 * Who may open / edit the Staff Access settings page. Reuses the tenant-admin-users gate
 * (clinic_admin / platform admin), so managing entitlements requires admin standing.
 */
export async function getStaffAccessAdminPermission(tenantId: string): Promise<{
  canView: boolean;
  canManage: boolean;
  actorFiUserId: string | null;
  actorAuthUserId: string | null;
}> {
  const { canManageTenantAdminUsersRoute } =
    await import("@/src/lib/tenantAdmin/tenantAdminProfile.server");
  const canManage = await canManageTenantAdminUsersRoute(tenantId);
  const principal = await resolveStaffAccessPrincipal(tenantId);
  return {
    canView: canManage,
    canManage,
    actorFiUserId: principal?.fiUserId ?? null,
    actorAuthUserId: principal?.authUserId ?? null,
  };
}
