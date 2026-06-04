import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { isFiOsCrossTenantDirectoryRole } from "@/src/lib/fiOs/fiOsRoles";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";

export type FiAdminTenantRow = { id: string; name: string; slug: string };

/** Opt-in local dev only: never `true` in production builds (`NODE_ENV === 'production'` blocks use). */
export function isFiDevTenantListFallbackEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && String(process.env.FI_ENABLE_DEV_ADMIN_ACCESS ?? "").trim() === "true";
}

async function loadTenantsForAuthUser(authUserId: string): Promise<FiAdminTenantRow[]> {
  const supabase = supabaseAdmin();
  const { data: memberships, error: e1 } = await supabase.from("fi_users").select("tenant_id").eq("auth_user_id", authUserId);
  if (e1) throw new Error(e1.message);
  const ids = Array.from(
    new Set(
      (memberships ?? [])
        .map((r) => (r as { tenant_id: string | null }).tenant_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  if (ids.length === 0) return [];
  const { data: tenants, error: e2 } = await supabase
    .from("fi_tenants")
    .select("id, name, slug")
    .in("id", ids)
    .order("name");
  if (e2) throw new Error(e2.message);
  return (tenants ?? []) as FiAdminTenantRow[];
}

async function loadAllTenants(): Promise<FiAdminTenantRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_tenants").select("id, name, slug").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as FiAdminTenantRow[];
}

/**
 * Resolves the FI Admin home tenant directory for `GET /api/tenants`.
 *
 * - **Authenticated:** tenants where `fi_users.auth_user_id` matches the session (or Bearer) user.
 * - **Production, unauthenticated:** error (401).
 * - **Non-production, unauthenticated:** if `FI_ENABLE_DEV_ADMIN_ACCESS=true`, all `fi_tenants` (dev fallback); else 401.
 */
export async function resolveFiAdminTenantDirectory(request: Request): Promise<
  | { kind: "ok"; tenants: FiAdminTenantRow[]; devTenantListFallback: boolean }
  | { kind: "error"; status: number; message: string; code: string }
> {
  const authId = await resolveAuthUserId(request);

  if (authId) {
    const os = await loadFiOsIdentity(authId);
    if (os && isFiOsCrossTenantDirectoryRole(os.osRole)) {
      const tenants = await loadAllTenants();
      return { kind: "ok", tenants, devTenantListFallback: false };
    }
    const tenants = await loadTenantsForAuthUser(authId);
    return { kind: "ok", tenants, devTenantListFallback: false };
  }

  if (process.env.NODE_ENV === "production") {
    return {
      kind: "error",
      status: 401,
      message: "Authentication required.",
      code: "AUTH_REQUIRED",
    };
  }

  if (isFiDevTenantListFallbackEnabled()) {
    const tenants = await loadAllTenants();
    return { kind: "ok", tenants, devTenantListFallback: true };
  }

  return {
    kind: "error",
    status: 401,
    message:
      "No authenticated FI user session. For local development only, set FI_ENABLE_DEV_ADMIN_ACCESS=true in your environment (ignored when NODE_ENV is production).",
    code: "AUTH_OR_DEV_FLAG_REQUIRED",
  };
}
