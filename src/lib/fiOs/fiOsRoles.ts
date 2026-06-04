/**
 * Follicle Intelligence OS platform roles (stored in `fi_os_identities.os_role`).
 * Pure helpers — safe for unit tests and client bundles if imported without server secrets.
 */

export const FI_OS_ROLES = [
  "fi_admin",
  "fi_auditor",
  "fi_clinic_admin",
  "fi_doctor",
  "fi_nurse",
  "fi_consultant",
] as const;

export type FiOsRole = (typeof FI_OS_ROLES)[number];

const CROSS_TENANT_DIRECTORY = new Set<FiOsRole>(["fi_admin", "fi_auditor"]);

export function normalizeFiOsRole(role: string | null | undefined): string {
  return String(role ?? "").trim().toLowerCase();
}

export function isFiOsRoleString(role: string | null | undefined): role is FiOsRole {
  return (FI_OS_ROLES as readonly string[]).includes(normalizeFiOsRole(role));
}

/** Roles that may list all tenants in FI Admin (server-enforced). */
export function isFiOsCrossTenantDirectoryRole(role: string | null | undefined): boolean {
  const r = normalizeFiOsRole(role);
  return CROSS_TENANT_DIRECTORY.has(r as FiOsRole);
}
