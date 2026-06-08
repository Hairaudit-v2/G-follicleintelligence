/**
 * Pure policy for who may create/update/deactivate tenant service catalogue rows.
 * Used by server access checks and unit tests (no DB / env).
 */

import { isCrmStaffManageRole } from "@/src/lib/crm/crmGatePolicy";
import { normalizeFiOsRole } from "@/src/lib/fiOs/fiOsRoles";

export type FiServicesCatalogManageSnapshot = {
  /** True when caller supplied a valid `FI_ADMIN_API_KEY` (checked by caller). */
  adminKeyValid: boolean;
  /** Platform OS role from `fi_os_identities` (any casing). */
  osRole: string | null | undefined;
  /** `fi_users.role` for the tenant when the auth user is a member; otherwise null/undefined. */
  tenantUserRole: string | null | undefined;
};

/**
 * Tenant `admin` / `fi_admin`, platform OS `fi_admin`, or admin API key may manage the catalogue.
 * Platform `fi_auditor` is always denied (read-only). `crm_operator` is denied unless later expanded.
 */
export function evaluateFiServicesCatalogManageAllowed(snapshot: FiServicesCatalogManageSnapshot): boolean {
  if (snapshot.adminKeyValid) return true;

  const os = normalizeFiOsRole(snapshot.osRole);
  if (os === "fi_auditor") return false;
  if (os === "fi_admin" || os === "fi_platform_admin") return true;

  return isCrmStaffManageRole(snapshot.tenantUserRole);
}
