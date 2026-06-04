import "server-only";

import { normalizeFiOsRole } from "./fiOsRoles";
import { loadFiOsIdentity, loadFirstTenantIdForAuthUser } from "./fiOsIdentity.server";

/**
 * Server-only post-login redirect for Follicle Intelligence OS.
 * Uses `fi_os_identities` and `fi_users` only via service role — never trust client hints.
 * When the login action has no valid `next` path, tenant members default to `/fi-admin/[tenantId]` (Home).
 */
export async function resolveFiOsPostLoginRedirect(authUserId: string): Promise<string> {
  const os = await loadFiOsIdentity(authUserId);
  const r = os ? normalizeFiOsRole(os.osRole) : "";

  if (r === "fi_auditor") {
    return "/hair-audit/admin";
  }

  if (r === "fi_admin") {
    return "/fi-admin";
  }

  if (r === "fi_clinic_admin" || r === "fi_doctor" || r === "fi_nurse" || r === "fi_consultant") {
    const tenantId = await loadFirstTenantIdForAuthUser(authUserId);
    if (tenantId) return `/fi-admin/${tenantId}`;
    return "/fi-admin";
  }

  const tenantId = await loadFirstTenantIdForAuthUser(authUserId);
  if (tenantId) return `/fi-admin/${tenantId}`;
  return "/fi-admin";
}
