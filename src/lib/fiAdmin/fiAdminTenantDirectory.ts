import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { isFiOsCrossTenantDirectoryRole } from "@/src/lib/fiOs/fiOsRoles";
import { isFiPortalStaff, loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import {
  filterPlatformTenantList,
  type FiPlatformTenantLifecycleRow,
} from "@/src/lib/fiOs/platformTenantLifecycleCore";

export type FiAdminTenantRow = { id: string; name: string; slug: string };

const TENANT_DIRECTORY_SELECT = "id, name, slug, archived_at, is_demo, is_production_visible";

function toAdminTenantRows(rows: FiPlatformTenantLifecycleRow[]): FiAdminTenantRow[] {
  return rows.map(({ id, name, slug }) => ({ id, name, slug }));
}

/** Opt-in local dev only: never `true` in production builds (`NODE_ENV === 'production'` blocks use). */
export function isFiDevTenantListFallbackEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    String(process.env.FI_ENABLE_DEV_ADMIN_ACCESS ?? "").trim() === "true"
  );
}

async function loadTenantsForAuthUser(authUserId: string): Promise<FiAdminTenantRow[]> {
  const supabase = supabaseAdmin();
  const { data: memberships, error: e1 } = await supabase
    .from("fi_users")
    .select("tenant_id")
    .eq("auth_user_id", authUserId);
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
    .select(TENANT_DIRECTORY_SELECT)
    .in("id", ids)
    .is("archived_at", null)
    .order("name");
  if (e2) throw new Error(e2.message);
  return toAdminTenantRows(
    filterPlatformTenantList((tenants ?? []) as FiPlatformTenantLifecycleRow[], {
      includeArchived: false,
      includeDemo: false,
      includeHidden: false,
    })
  );
}

async function loadAllTenants(includeArchived: boolean): Promise<FiAdminTenantRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenants")
    .select(TENANT_DIRECTORY_SELECT)
    .order("name");
  if (error) throw new Error(error.message);
  const rows = filterPlatformTenantList((data ?? []) as FiPlatformTenantLifecycleRow[], {
    includeArchived,
    includeDemo: false,
    includeHidden: false,
  });
  return toAdminTenantRows(rows);
}

/**
 * Resolves the FI Admin home tenant directory for `GET /api/tenants`.
 *
 * - **Authenticated (production):** must be FI portal staff (`fi_os_identities` or `fi_users`); otherwise **403**.
 * - **Authenticated staff:** `fi_admin` / `fi_auditor` OS roles → all tenants; else tenants from `fi_users` membership.
 * - **Production, unauthenticated:** error (401).
 * - **Non-production, unauthenticated:** if `FI_ENABLE_DEV_ADMIN_ACCESS=true`, all `fi_tenants` (dev fallback); else 401.
 */
export type FiAdminTenantDirectoryOptions = {
  /** When true, include archived tenants (platform hygiene default: false). */
  includeArchived?: boolean;
};

export async function resolveFiAdminTenantDirectory(
  request: Request,
  opts: FiAdminTenantDirectoryOptions = {}
): Promise<
  | { kind: "ok"; tenants: FiAdminTenantRow[]; devTenantListFallback: boolean }
  | { kind: "error"; status: number; message: string; code: string }
> {
  const includeArchived = opts.includeArchived === true;
  const authId = await resolveAuthUserId(request);

  if (authId) {
    if (process.env.NODE_ENV === "production") {
      const staff = await isFiPortalStaff(authId);
      if (!staff) {
        return {
          kind: "error",
          status: 403,
          message: "This account is not provisioned for Follicle Intelligence OS.",
          code: "FI_PORTAL_FORBIDDEN",
        };
      }
    }

    const os = await loadFiOsIdentity(authId);
    if (os && isFiOsCrossTenantDirectoryRole(os.osRole)) {
      const tenants = await loadAllTenants(includeArchived);
      return { kind: "ok", tenants, devTenantListFallback: false };
    }
    let tenants = await loadTenantsForAuthUser(authId);
    if (includeArchived) {
      const supabase = supabaseAdmin();
      const { data: memberships } = await supabase
        .from("fi_users")
        .select("tenant_id")
        .eq("auth_user_id", authId);
      const ids = Array.from(
        new Set(
          (memberships ?? [])
            .map((r) => (r as { tenant_id: string | null }).tenant_id)
            .filter((id): id is string => Boolean(id))
        )
      );
      if (ids.length > 0) {
        const { data, error } = await supabase
          .from("fi_tenants")
          .select(TENANT_DIRECTORY_SELECT)
          .in("id", ids)
          .order("name");
        if (error) throw new Error(error.message);
        tenants = toAdminTenantRows((data ?? []) as FiPlatformTenantLifecycleRow[]);
      }
    }
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
    const tenants = await loadAllTenants(includeArchived);
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
