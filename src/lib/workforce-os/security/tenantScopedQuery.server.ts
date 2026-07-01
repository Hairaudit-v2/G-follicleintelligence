import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * WorkforceOS tenant-scoping guard — see `./README.md`.
 *
 * WHY THIS EXISTS
 * ---------------
 * WorkforceOS reads/writes with the Supabase **service-role** client (`supabaseAdmin()`),
 * which **bypasses Row Level Security**. Tenant isolation therefore depends on every query
 * carrying a `tenant_id` predicate. Doing that by hand on hundreds of call sites is easy to
 * forget, and a single missed filter leaks another clinic's staff / payroll data.
 *
 * THE RULE (enforced by `tenantScopingGuard.test.ts`)
 * ---------------------------------------------------
 * Every WorkforceOS service-role query must either:
 *   1. go through this helper (`workforceTenantClient(tenantId).list/byId/insert/update/remove`),
 *      which injects `tenant_id` automatically; OR
 *   2. carry an explicit `tenant_id` predicate / column in the same statement; OR
 *   3. be justified inline with a `// tenant-guard-allow: <reason>` comment (e.g. a genuinely
 *      cross-tenant platform aggregation, or a global reference table without `tenant_id`).
 *
 * Inserts force `tenant_id` from the trusted server-resolved `tenantId` and **strip any
 * caller-supplied `tenant_id`** so a request payload can never redirect a write to another tenant.
 *
 * This helper deliberately stays a thin wrapper: `list`/`byId` return the normal PostgREST
 * builder pre-filtered by tenant, so callers keep chaining `.eq()/.order()/.range()/…` as usual.
 */

/** Remove any caller-supplied `tenant_id`; the server-resolved tenant is the only source of truth. */
function stripTenant<T extends Record<string, unknown>>(values: T): Record<string, unknown> {
  if (values && typeof values === "object" && "tenant_id" in values) {
    const { tenant_id: _ignored, ...rest } = values as Record<string, unknown>;
    return rest;
  }
  return { ...values };
}

function createWorkforceTenantClient(db: SupabaseClient, tenantId: string) {
  return {
    /** Server-resolved tenant this client is bound to. */
    tenantId,

    /**
     * Raw service-role client — ESCAPE HATCH ONLY.
     * Any query made through this bypasses the tenant guard and MUST carry its own `tenant_id`
     * predicate or a `// tenant-guard-allow:` justification, or the guard test will fail.
     */
    unsafeAdmin: db,

    /** Tenant-scoped SELECT. Returns the PostgREST builder for further chaining (.eq/.order/…). */
    list(table: string, columns = "*") {
      return db.from(table).select(columns).eq("tenant_id", tenantId);
    },

    /** Tenant-scoped read-by-id. Resolves to a single row or null. */
    byId(table: string, id: string, columns = "*") {
      return db.from(table).select(columns).eq("tenant_id", tenantId).eq("id", id).maybeSingle();
    },

    /** Tenant-scoped INSERT. Forces `tenant_id`; strips any caller-supplied value. */
    insert<T extends Record<string, unknown>>(table: string, values: T | T[]) {
      const payload = Array.isArray(values)
        ? values.map((row) => ({ ...stripTenant(row), tenant_id: tenantId }))
        : { ...stripTenant(values), tenant_id: tenantId };
      return db.from(table).insert(payload);
    },

    /** Tenant-scoped UPDATE. Pre-filters on `tenant_id`; chain `.eq("id", …)` for the target row. */
    update<T extends Record<string, unknown>>(table: string, patch: T) {
      return db.from(table).update(stripTenant(patch)).eq("tenant_id", tenantId);
    },

    /**
     * Tenant-scoped UPSERT. Forces `tenant_id`; strips any caller-supplied value.
     * Pass the same `onConflict` you would to PostgREST.
     */
    upsert<T extends Record<string, unknown>>(
      table: string,
      values: T | T[],
      options?: { onConflict?: string; ignoreDuplicates?: boolean }
    ) {
      const payload = Array.isArray(values)
        ? values.map((row) => ({ ...stripTenant(row), tenant_id: tenantId }))
        : { ...stripTenant(values), tenant_id: tenantId };
      return db.from(table).upsert(payload, options);
    },

    /** Tenant-scoped DELETE. Pre-filters on `tenant_id`; chain `.eq("id", …)` for the target row(s). */
    remove(table: string) {
      return db.from(table).delete().eq("tenant_id", tenantId);
    },
  };
}

export type WorkforceTenantClient = ReturnType<typeof createWorkforceTenantClient>;

/**
 * Create a tenant-scoped WorkforceOS query client.
 *
 * @param tenantId server-resolved tenant id (never taken directly from a request body).
 * @throws if `tenantId` is empty — fail closed rather than run an unscoped query.
 */
export function workforceTenantClient(tenantId: string): WorkforceTenantClient {
  const tid = tenantId?.trim();
  if (!tid) {
    throw new Error("workforceTenantClient: a non-empty tenantId is required (fail closed).");
  }
  return createWorkforceTenantClient(supabaseAdmin(), tid);
}
