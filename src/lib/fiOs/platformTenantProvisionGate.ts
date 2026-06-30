import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";

/**
 * Only `fi_platform_admin` may provision tenants from `/fi-admin/system/*`.
 * (`fi_admin` / `fi_auditor` are cross-tenant directory roles but not platform operators for this surface.)
 */
export function isFiOsRoleAllowedForPlatformTenantProvisioning(
  osRole: string | null | undefined
): boolean {
  return isFiOsPlatformAdminRole(osRole);
}
