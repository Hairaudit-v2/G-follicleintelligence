import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions, type SetAllCookies } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CRM_MUTATION_ROLES_LOWER, isFiAdminApiKeyMatch } from "./crmGatePolicy";

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

  const row = await loadFiUserForTenant(tenantId, authUserId);
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

  const row = await loadFiUserForTenant(tenantId, authUserId);
  if (!row) {
    throw new CrmAccessError(403, "Not a member of this tenant.");
  }

  const role = row.role.trim().toLowerCase();
  if (!CRM_MUTATION_ROLES_LOWER.has(role)) {
    throw new CrmAccessError(403, "CRM operator role required for this action.");
  }
}

/**
 * Resolves `fi_users.id` for the signed-in tenant member (cookies or Bearer on `request`).
 * Returns null when unauthenticated or the user has no row in this tenant.
 */
export async function tryResolveFiUserIdForTenant(tenantId: string, request?: Request | null): Promise<string | null> {
  const authUserId = await resolveAuthUserId(request ?? null);
  if (!authUserId) return null;
  const row = await loadFiUserForTenant(tenantId, authUserId);
  return row?.id ?? null;
}

export function parseAdminKeyFromUnknown(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const ak = (body as Record<string, unknown>).adminKey;
  return typeof ak === "string" ? ak : undefined;
}
