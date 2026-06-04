/**
 * Pure CRM access policy (Stage 2D). Safe to import from unit tests.
 */

export const CRM_MUTATION_ROLES_LOWER = new Set(["fi_admin", "admin", "crm_operator"]);

/** CRM shell nav + FI Admin route guard (Stage 2E): `fi_admin` or delegated `crm_operator` only. */
export const CRM_SHELL_NAV_ROLES_LOWER = new Set(["fi_admin", "crm_operator"]);

export function isCrmMutationRole(role: string | null | undefined): boolean {
  return CRM_MUTATION_ROLES_LOWER.has(String(role ?? "").trim().toLowerCase());
}

export function isCrmShellNavRole(role: string | null | undefined): boolean {
  return CRM_SHELL_NAV_ROLES_LOWER.has(String(role ?? "").trim().toLowerCase());
}

/** Compare submitted admin key to configured `FI_ADMIN_API_KEY` (both trimmed). */
export function isFiAdminApiKeyMatch(adminKey: string | undefined | null, configuredKey: string | undefined | null): boolean {
  const expected = configuredKey?.trim();
  if (!expected) return false;
  return !!adminKey?.trim() && adminKey.trim() === expected;
}
