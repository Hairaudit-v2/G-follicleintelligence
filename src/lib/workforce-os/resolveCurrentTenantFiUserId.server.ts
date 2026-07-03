import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CrmAccessError,
  loadProxyFiUserRowForPlatformAdminTenant,
  resolveAuthUserId,
} from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";

export const ROSTER_ACTOR_FI_USER_NOT_LINKED_MESSAGE =
  "Your staff login is not linked to this clinic. Please repair staff access before generating the roster.";

export type ResolveCurrentTenantFiUserIdInput = {
  supabase: SupabaseClient;
  tenantId: string;
  /** Test injection — bypasses session auth lookup when defined. */
  authUserIdForTests?: string | null;
  /** Test injection — skips platform-admin proxy lookup (avoids live Supabase). */
  skipPlatformAdminLookupForTests?: boolean;
};

/**
 * Resolves `fi_users.id` for the signed-in actor scoped to a tenant.
 * Never returns `auth.users.id` — callers must use this for `fi_staff_shifts.created_by`.
 */
export async function resolveCurrentTenantFiUserId(
  input: ResolveCurrentTenantFiUserIdInput
): Promise<string> {
  const tenantId = input.tenantId.trim();
  if (!tenantId) {
    throw new CrmAccessError(400, "tenantId is required.");
  }

  const authUserId =
    input.authUserIdForTests !== undefined
      ? input.authUserIdForTests
      : await resolveAuthUserId(null);

  if (!authUserId?.trim()) {
    throw new CrmAccessError(401, "Authentication required.");
  }

  const os =
    input.skipPlatformAdminLookupForTests === true
      ? null
      : await loadFiOsIdentity(authUserId);
  if (os && isFiOsPlatformAdminRole(os.osRole)) {
    const proxy = await loadProxyFiUserRowForPlatformAdminTenant(tenantId, authUserId);
    if (proxy?.id) return proxy.id;
  }

  const { data, error } = await input.supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("auth_user_id", authUserId.trim())
    .maybeSingle();

  if (error) {
    throw new CrmAccessError(500, "Could not verify tenant membership.");
  }

  const fiUserId = data?.id != null ? String(data.id) : null;
  if (!fiUserId) {
    throw new CrmAccessError(403, ROSTER_ACTOR_FI_USER_NOT_LINKED_MESSAGE);
  }

  return fiUserId;
}
