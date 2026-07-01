/**
 * Tenant scope for FI_ADMIN_API_KEY — limits cross-tenant god-key abuse.
 * When `FI_ADMIN_API_KEY_TENANT_ALLOWLIST` is unset (non-production dev), all tenants are allowed.
 * In production, env validation requires the allowlist when the admin key is configured.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function parseFiAdminKeyTenantAllowlist(
  raw: string | null | undefined = process.env.FI_ADMIN_API_KEY_TENANT_ALLOWLIST
): Set<string> | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const ids = trimmed
    .split(/[,;\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0 && isUuid(part));
  return new Set(ids);
}

/** Returns true when the admin key may operate on `tenantId`. */
export function isFiAdminKeyTenantScopeAllowed(
  tenantId: string,
  allowlist: Set<string> | null = parseFiAdminKeyTenantAllowlist()
): boolean {
  const tid = tenantId.trim().toLowerCase();
  if (!tid || !isUuid(tid)) return false;
  if (!allowlist) return true;
  return allowlist.has(tid);
}

export const FI_ADMIN_KEY_TENANT_DENIED_MESSAGE =
  "Admin key is not authorized for this tenant.";