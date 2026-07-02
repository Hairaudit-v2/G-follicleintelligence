import "server-only";

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
 */
function parseTenantAllowlist(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function isTodaySurfaceEnabledForTenant(tenantId: string): boolean {
  const tid = tenantId.trim();
  if (!tid) return false;
  if (process.env.FI_TODAY_SURFACE_ENABLED?.trim().toLowerCase() === "true") return true;
  return parseTenantAllowlist(process.env.FI_TODAY_SURFACE_TENANT_IDS).has(tid);
}
