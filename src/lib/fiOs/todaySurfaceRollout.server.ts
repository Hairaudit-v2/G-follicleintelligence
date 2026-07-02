import "server-only";

import { logStructured } from "@/src/lib/server/structuredLog";

/**
 * FI-UX-REBUILD-1D rollout gate.
 *
 * Deliberately NOT wired into `fiFeatureAccessRegistry` (Stage 2 feature access):
 * that registry defaults every key to enabled and layers per-staff visibility
 * overrides on top of an already-shipped feature. `today_surface` is a fresh,
 * opt-in choice of *which home surface renders* — it needs to default OFF for
 * every tenant until shadow-mode validation (P0B) has baked, which the Stage 2
 * "all enabled unless overridden" baseline cannot express safely.
 *
 * Controlled via env vars so tenants can be enabled incrementally without a DB
 * migration during rollout:
 * - `FI_TODAY_SURFACE_ENABLED=true` — on for every tenant (fleet-wide default).
 * - `FI_TODAY_SURFACE_TENANT_IDS=uuid,uuid` — on for a specific allowlist only.
 * Defaults to OFF when neither is set.
 *
 * Tenant matching: the `[tenantId]` route segment under `/fi-admin/[tenantId]/...`
 * is always `fi_tenants.id` (a UUID) — see `assertFiTenantPortalAccess` and every
 * other tenant-scoped loader, which all query `fi_tenants` by `id`, never `slug`.
 * `FI_TODAY_SURFACE_TENANT_IDS` therefore MUST be populated with tenant UUIDs.
 *
 * `isTodaySurfaceEnabledForTenant` also accepts an optional `tenantSlug` for
 * forward-compatibility with callers that have already loaded the tenant's slug
 * elsewhere and want to allow ops to use either form in the allowlist — but
 * `app/(fi-admin)/fi-admin/[tenantId]/page.tsx` does not currently fetch the
 * tenant's slug (its dashboard loader — `tenantOperationalDashboardLoader.server.ts`
 * — never selects `fi_tenants.slug`), so in practice only the UUID form works
 * there today. Fetching the slug solely for this gate would add an extra DB
 * round-trip to every tenant home page load, which isn't justified for a
 * temporary rollout flag — use the UUID.
 *
 * Matching is case-insensitive: UUIDs are canonically lowercase but are easy to
 * paste in with mixed case, and slugs are stored lowercase.
 */
function normalizeAllowlistToken(raw: string): string {
  return raw.trim().toLowerCase();
}

function parseTenantAllowlist(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => normalizeAllowlistToken(s))
      .filter(Boolean)
  );
}

export interface TodaySurfaceTenantGateContext {
  /**
   * Tenant slug, if already loaded in the caller's context. Optional — most
   * callers (including the tenant home page today) only have the UUID.
   */
  tenantSlug?: string | null;
}

export function isTodaySurfaceEnabledForTenant(
  tenantId: string,
  context: TodaySurfaceTenantGateContext = {}
): boolean {
  const tid = tenantId.trim();
  if (!tid) return false;

  const globalEnabled = process.env.FI_TODAY_SURFACE_ENABLED?.trim().toLowerCase() === "true";
  const allowlist = parseTenantAllowlist(process.env.FI_TODAY_SURFACE_TENANT_IDS);
  const slug = context.tenantSlug?.trim().toLowerCase() || null;

  const matchedBy: "global" | "uuid" | "slug" | "none" = globalEnabled
    ? "global"
    : allowlist.has(tid.toLowerCase())
      ? "uuid"
      : slug && allowlist.has(slug)
        ? "slug"
        : "none";

  // TEMPORARY diagnostic logging for the FI_TODAY_SURFACE_TENANT_IDS production
  // rollout investigation. Safe: only the tenant id (not patient data), parsed
  // env booleans/counts, and the match outcome are logged. Remove once the gate
  // is confirmed working as expected in production.
  logStructured("info", "fi_today_surface_gate_evaluated", {
    tenant_id: tid,
    tenant_slug_provided: slug !== null,
    fi_today_surface_enabled: globalEnabled,
    fi_today_surface_tenant_ids_count: allowlist.size,
    matched: matchedBy !== "none",
    matched_by: matchedBy,
  });

  return matchedBy !== "none";
}
