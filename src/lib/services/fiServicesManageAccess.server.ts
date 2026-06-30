import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CrmAccessError, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { rejectStaffPinSessionForRestrictedMutation } from "@/src/lib/staffPin/staffPinMutationGuard.server";
import { isFiAdminApiKeyMatch } from "@/src/lib/crm/crmFiAdminApiKeyMatch";
import { evaluateFiServicesCatalogManageAllowed } from "@/src/lib/services/fiServicesManagePolicy";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";

async function assertTenantRowExists(tenantId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenants")
    .select("id")
    .eq("id", tenantId.trim())
    .maybeSingle();
  if (error) throw new CrmAccessError(500, "Could not verify tenant.");
  if (!data) throw new CrmAccessError(404, "Tenant not found.");
}

async function loadFiUserForTenant(
  tenantId: string,
  authUserId: string
): Promise<{ id: string; role: string } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new CrmAccessError(500, "Could not verify tenant membership.");
  if (!data) return null;
  return {
    id: String((data as { id: string }).id),
    role: String((data as { role: string | null }).role ?? "member"),
  };
}

export type FiServicesManageAccessOpts = {
  tenantId: string;
  adminKey?: string | null;
  request?: Request | null;
};

/**
 * Throws {@link CrmAccessError} when the caller may not mutate the tenant service catalogue.
 */
export async function assertFiServicesManageAllowed(
  opts: FiServicesManageAccessOpts
): Promise<void> {
  const tenantId = opts.tenantId.trim();
  if (!tenantId) throw new CrmAccessError(400, "tenantId is required.");

  const adminKeyValid = isFiAdminApiKeyMatch(
    opts.adminKey ?? undefined,
    process.env.FI_ADMIN_API_KEY
  );
  if (adminKeyValid) {
    await assertTenantRowExists(tenantId);
    return;
  }

  await rejectStaffPinSessionForRestrictedMutation(tenantId);

  const authUserId = await resolveAuthUserId(opts.request ?? null);
  if (!authUserId) {
    throw new CrmAccessError(401, "Authentication required.");
  }

  const os = await loadFiOsIdentity(authUserId);
  const tenantRow = await loadFiUserForTenant(tenantId, authUserId);

  const allowed = evaluateFiServicesCatalogManageAllowed({
    adminKeyValid: false,
    osRole: os?.osRole ?? null,
    tenantUserRole: tenantRow?.role ?? null,
  });

  if (allowed) {
    await assertTenantRowExists(tenantId);
    return;
  }

  const osNorm = String(os?.osRole ?? "")
    .trim()
    .toLowerCase();
  if (osNorm === "fi_auditor") {
    throw new CrmAccessError(403, "Admin role required to manage services.");
  }

  if (!tenantRow) {
    throw new CrmAccessError(403, "Not a member of this tenant.");
  }

  throw new CrmAccessError(403, "Admin role required to manage services.");
}

export async function canManageFiServicesCatalog(
  opts: FiServicesManageAccessOpts
): Promise<boolean> {
  try {
    await assertFiServicesManageAllowed(opts);
    return true;
  } catch {
    return false;
  }
}
