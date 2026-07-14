import "server-only";

/**
 * FI-UX-REBUILD-1 S4.5A — temporary Pipeline V1 tenant allowlist.
 *
 * Default OFF. Opt-in only via exact tenant UUID allowlist.
 * No fleet-wide wildcard, no role/email gate, no DB migration.
 *
 * Env: `FI_PIPELINE_V1_TENANT_ALLOWLIST=uuid,uuid`
 *
 * Remove after real-tenant dual-run sign-off and full cutover.
 */

const TENANT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTenantUuid(value: string): boolean {
  return TENANT_UUID_RE.test(value);
}

/**
 * Parse comma-separated tenant UUIDs. Trims whitespace, validates UUIDs,
 * ignores malformed entries (including wildcards) safely.
 */
export function parsePipelineV1TenantAllowlist(raw: string | undefined): ReadonlySet<string> {
  const out = new Set<string>();
  for (const part of (raw ?? "").split(",")) {
    const token = part.trim().toLowerCase();
    if (!token) continue;
    if (token === "*" || token === "all" || token === "true") continue;
    if (!isTenantUuid(token)) continue;
    out.add(token);
  }
  return out;
}

/**
 * Server-side tenant gate for mounting PipelineWorkspace on `/crm`.
 * Platform-admin status alone does not enable Pipeline for a tenant.
 */
export async function isPipelineV1EnabledForTenant(tenantId: string): Promise<boolean> {
  const tid = tenantId.trim().toLowerCase();
  if (!tid || !isTenantUuid(tid)) return false;

  const allowlist = parsePipelineV1TenantAllowlist(process.env.FI_PIPELINE_V1_TENANT_ALLOWLIST);
  return allowlist.has(tid);
}
