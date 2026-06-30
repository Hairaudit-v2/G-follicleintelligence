/**
 * Follicle Intelligence OS platform roles (stored in `fi_os_identities.os_role`).
 * Pure helpers — safe for unit tests and client bundles if imported without server secrets.
 */

export const FI_OS_ROLES = [
  "fi_platform_admin",
  "fi_admin",
  "fi_auditor",
  "fi_clinic_admin",
  "fi_doctor",
  "fi_nurse",
  "fi_consultant",
] as const;

export type FiOsRole = (typeof FI_OS_ROLES)[number];

const CROSS_TENANT_DIRECTORY = new Set<FiOsRole>(["fi_platform_admin", "fi_admin", "fi_auditor"]);

export function normalizeFiOsRole(role: string | null | undefined): string {
  return String(role ?? "")
    .trim()
    .toLowerCase();
}

export function isFiOsRoleString(role: string | null | undefined): role is FiOsRole {
  return (FI_OS_ROLES as readonly string[]).includes(normalizeFiOsRole(role));
}

/** Roles that may list all tenants in FI Admin (server-enforced). */
export function isFiOsCrossTenantDirectoryRole(role: string | null | undefined): boolean {
  const r = normalizeFiOsRole(role);
  return CROSS_TENANT_DIRECTORY.has(r as FiOsRole);
}

/** Highest platform operator: all tenants, modules, and system configuration (app-enforced). */
export function isFiOsPlatformAdminRole(role: string | null | undefined): boolean {
  return normalizeFiOsRole(role) === "fi_platform_admin";
}

export function canImpersonateUsers(role: string | null | undefined): boolean {
  return isFiOsPlatformAdminRole(role);
}

export function canAccessAllTenants(role: string | null | undefined): boolean {
  return isFiOsCrossTenantDirectoryRole(role);
}

export function canManageSystemConfiguration(role: string | null | undefined): boolean {
  return isFiOsPlatformAdminRole(role);
}

/** Elevated OS operator used for staff/services overrides (not auditors). */
export function isFiOsElevatedOsOperatorRole(role: string | null | undefined): boolean {
  const r = normalizeFiOsRole(role);
  return r === "fi_admin" || r === "fi_platform_admin";
}
