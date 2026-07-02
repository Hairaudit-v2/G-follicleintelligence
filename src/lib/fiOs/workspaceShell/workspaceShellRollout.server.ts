import "server-only";

/**
 * FI-UX-REBUILD D1 rollout gate — universal workspace shell.
 *
 * Same opt-in pattern as `todaySurfaceRollout.server.ts`: default OFF until
 * validated tenant-by-tenant. Env-controlled so no DB migration is required.
 *
 * - `FI_WORKSPACE_SHELL_ENABLED=true` — on for every tenant.
 * - `FI_WORKSPACE_SHELL_TENANT_IDS=uuid,uuid` — allowlist only.
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

export interface WorkspaceShellTenantGateContext {
  tenantSlug?: string | null;
}

export function isWorkspaceShellEnabledForTenant(
  tenantId: string,
  context: WorkspaceShellTenantGateContext = {}
): boolean {
  const tid = tenantId.trim();
  if (!tid) return false;

  const globalEnabled = process.env.FI_WORKSPACE_SHELL_ENABLED?.trim().toLowerCase() === "true";
  const allowlist = parseTenantAllowlist(process.env.FI_WORKSPACE_SHELL_TENANT_IDS);
  const slug = context.tenantSlug?.trim().toLowerCase() || null;

  if (globalEnabled) return true;
  if (allowlist.has(tid.toLowerCase())) return true;
  if (slug && allowlist.has(slug)) return true;
  return false;
}
