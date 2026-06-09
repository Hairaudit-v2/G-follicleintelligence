import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions, type SetAllCookies } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getFiOsImpersonationTargetAuthUserId } from "@/src/lib/fiOs/fiOsImpersonation.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import { resolveDevelopmentClinicAccessForTenant } from "@/src/lib/fiOs/developmentClinicAccess.server";
import type { StaffPinClinicAction } from "@/src/lib/staffPin/staffPinPermissions";
import {
  rejectStaffPinSessionForRestrictedMutation,
  resolveStaffPinFloorMutation,
} from "@/src/lib/staffPin/staffPinMutationGuard.server";

import { isCrmStaffManageRole, isFiAdminApiKeyMatch } from "./crmGatePolicy";

export type { StaffPinClinicAction };

export { CRM_MUTATION_ROLES_LOWER } from "./crmGatePolicy";

export class CrmAccessError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "CrmAccessError";
  }
}

function requireFiAdminKey(adminKey: string | undefined | null): boolean {
  return isFiAdminApiKeyMatch(adminKey, process.env.FI_ADMIN_API_KEY);
}

async function assertTenantRowExists(tenantId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_tenants").select("id").eq("id", tenantId.trim()).maybeSingle();
  if (error) throw new CrmAccessError(500, "Could not verify tenant.");
  if (!data) throw new CrmAccessError(404, "Tenant not found.");
}

/**
 * Resolve Supabase Auth user id: optional `Authorization: Bearer` on `request`, else session cookies.
 */
export async function resolveAuthUserId(request?: Request | null): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;

  if (request) {
    const authHeader = request.headers.get("authorization");
    const m = authHeader?.match(/^Bearer\s+(.+)$/i);
    const bearer = m?.[1]?.trim();
    if (bearer) {
      const supabase = createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      if (data.user?.id) return data.user.id;
    }
  }

  try {
    const cookieStore = cookies();
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as CookieOptions);
            });
          } catch {
            /* ignore cookie write failures in server contexts */
          }
        },
      },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function loadFiUserForTenant(tenantId: string, authUserId: string): Promise<{ id: string; role: string } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new CrmAccessError(500, "Could not verify tenant membership.");
  if (!data) return null;
  return { id: String((data as { id: string }).id), role: String((data as { role: string | null }).role ?? "member") };
}

/** `fi_platform_admin` without an active impersonation cookie — full tenant API access (server-enforced). */
export async function isFiOsPlatformAdminFullSessionBypass(sessionAuthUserId: string): Promise<boolean> {
  const id = sessionAuthUserId.trim();
  if (!id) return false;
  const os = await loadFiOsIdentity(id);
  if (!os || !isFiOsPlatformAdminRole(os.osRole)) return false;
  return !(await getFiOsImpersonationTargetAuthUserId(id));
}

/**
 * Platform administrators may lack a `fi_users` row; resolve a stable tenant `fi_users.id` for FKs
 * (prefer the signed-in user's row, else a tenant admin, else any member).
 */
export async function loadProxyFiUserRowForPlatformAdminTenant(
  tenantId: string,
  sessionAuthUserId: string
): Promise<{ id: string; role: string } | null> {
  const tid = tenantId.trim();
  const sid = sessionAuthUserId.trim();
  if (!tid || !sid) return null;
  const own = await loadFiUserForTenant(tid, sid);
  if (own) return own;
  const supabase = supabaseAdmin();
  const { data: admins, error: e1 } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tid)
    .in("role", ["fi_admin", "admin"])
    .limit(1);
  if (!e1 && admins?.[0]) {
    const r = admins[0] as { id: string; role: string | null };
    return { id: String(r.id), role: String(r.role ?? "fi_admin") };
  }
  const { data: anyRow, error: e2 } = await supabase.from("fi_users").select("id, role").eq("tenant_id", tid).limit(1);
  if (!e2 && anyRow?.[0]) {
    const r = anyRow[0] as { id: string; role: string | null };
    return { id: String(r.id), role: String(r.role ?? "member") };
  }
  return null;
}

async function resolveTenantMembershipAuthUserId(sessionAuthUserId: string): Promise<string> {
  const imp = await getFiOsImpersonationTargetAuthUserId(sessionAuthUserId);
  return imp ?? sessionAuthUserId;
}

/**
 * Reads: valid `FI_ADMIN_API_KEY` **or** signed-in user with `fi_users` row for the tenant (any role).
 */
export async function assertCrmTenantReadAllowed(opts: {
  tenantId: string;
  adminKey?: string | null;
  request?: Request | null;
}): Promise<void> {
  const tenantId = opts.tenantId.trim();
  if (!tenantId) throw new CrmAccessError(400, "tenantId is required.");

  if (requireFiAdminKey(opts.adminKey ?? undefined)) {
    await assertTenantRowExists(tenantId);
    return;
  }

  const authUserId = await resolveAuthUserId(opts.request ?? null);
  if (!authUserId) {
    throw new CrmAccessError(401, "Authentication required.");
  }

  if (await isFiOsPlatformAdminFullSessionBypass(authUserId)) {
    await assertTenantRowExists(tenantId);
    return;
  }

  const principal = await resolveTenantMembershipAuthUserId(authUserId);
  const row = await loadFiUserForTenant(tenantId, principal);
  if (!row) {
    throw new CrmAccessError(403, "Not a member of this tenant.");
  }
}

/**
 * Writes: valid `FI_ADMIN_API_KEY` **or** signed-in tenant member with CRM mutation role.
 */
export async function assertCrmTenantWriteAllowed(opts: {
  tenantId: string;
  adminKey?: string | null;
  request?: Request | null;
  /** When set, an active clinic-floor PIN session may perform this mutation. */
  staffPinFloorAction?: StaffPinClinicAction;
}): Promise<void> {
  const tenantId = opts.tenantId.trim();
  if (!tenantId) throw new CrmAccessError(400, "tenantId is required.");

  if (requireFiAdminKey(opts.adminKey ?? undefined)) {
    await assertTenantRowExists(tenantId);
    return;
  }

  const pinMode = await resolveStaffPinFloorMutation(tenantId, opts.staffPinFloorAction);
  if (pinMode === "pin_floor") {
    await assertTenantRowExists(tenantId);
    return;
  }

  const authUserId = await resolveAuthUserId(opts.request ?? null);
  if (!authUserId) {
    throw new CrmAccessError(401, "Authentication required.");
  }

  if (await isFiOsPlatformAdminFullSessionBypass(authUserId)) {
    await assertTenantRowExists(tenantId);
    return;
  }

  const access = await resolveDevelopmentClinicAccessForTenant(tenantId, authUserId);
  if (!access.allowed) {
    throw new CrmAccessError(403, access.blockedReason ?? "ClinicOS operator role required for this action.");
  }
}

/**
 * Resolves `fi_users.id` for the signed-in tenant member (cookies or Bearer on `request`).
 * Returns null when unauthenticated or the user has no row in this tenant.
 */
export async function tryResolveFiUserIdForTenant(tenantId: string, request?: Request | null): Promise<string | null> {
  const sessionAuthUserId = await resolveAuthUserId(request ?? null);
  if (!sessionAuthUserId) return null;
  const os = await loadFiOsIdentity(sessionAuthUserId);
  if (os && isFiOsPlatformAdminRole(os.osRole)) {
    const proxy = await loadProxyFiUserRowForPlatformAdminTenant(tenantId, sessionAuthUserId);
    return proxy?.id ?? null;
  }
  const row = await loadFiUserForTenant(tenantId, sessionAuthUserId);
  return row?.id ?? null;
}

/**
 * Staff directory writes: `FI_ADMIN_API_KEY` **or** tenant member with `fi_admin` / `admin` role.
 * `crm_operator` may read staff and assign bookings, but cannot create/edit staff rows.
 */
export async function assertCrmTenantStaffManageAllowed(opts: {
  tenantId: string;
  adminKey?: string | null;
  request?: Request | null;
}): Promise<void> {
  const tenantId = opts.tenantId.trim();
  if (!tenantId) throw new CrmAccessError(400, "tenantId is required.");

  if (requireFiAdminKey(opts.adminKey ?? undefined)) {
    await assertTenantRowExists(tenantId);
    return;
  }

  await rejectStaffPinSessionForRestrictedMutation(tenantId);

  const authUserId = await resolveAuthUserId(opts.request ?? null);
  if (!authUserId) {
    throw new CrmAccessError(401, "Authentication required.");
  }

  if (await isFiOsPlatformAdminFullSessionBypass(authUserId)) {
    await assertTenantRowExists(tenantId);
    return;
  }

  const principal = await resolveTenantMembershipAuthUserId(authUserId);
  const row = await loadFiUserForTenant(tenantId, principal);
  if (!row) {
    throw new CrmAccessError(403, "Not a member of this tenant.");
  }

  if (!isCrmStaffManageRole(row.role)) {
    throw new CrmAccessError(403, "Admin role required to manage staff.");
  }
}

export function parseAdminKeyFromUnknown(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const ak = (body as Record<string, unknown>).adminKey;
  return typeof ak === "string" ? ak : undefined;
}
