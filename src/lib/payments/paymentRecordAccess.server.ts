import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import {
  FI_ADMIN_KEY_TENANT_DENIED_MESSAGE,
  isFiAdminKeyTenantScopeAllowed,
} from "@/src/lib/crm/fiAdminKeyTenantScope";
import { isFiAdminApiKeyMatch } from "@/src/lib/crm/crmFiAdminApiKeyMatch";
import { getFiOsImpersonationTargetAuthUserId } from "@/src/lib/fiOs/fiOsImpersonation.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import { isPaymentMutationRole } from "@/src/lib/payments/paymentRecordModel";
import { rejectStaffPinSessionForRestrictedMutation } from "@/src/lib/staffPin/staffPinMutationGuard.server";

export class PaymentRecordAccessError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "PaymentRecordAccessError";
  }
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
  if (error) throw new PaymentRecordAccessError(500, "Could not verify tenant membership.");
  if (!data) return null;
  return {
    id: String((data as { id: string }).id),
    role: String((data as { role: string | null }).role ?? "member"),
  };
}

/**
 * Mutations: finance-capable roles on `fi_users` (`PAYMENT_MUTATION_ROLES_LOWER`), impersonating platform-admin, or scoped `FI_ADMIN_API_KEY`.
 * **Not** aligned with `fi_tenant_admin_users` capability grants — see `docs/design/fi-payment-records-access.md`.
 * Staff PIN sessions are always blocked (even if role would allow).
 */
export async function assertPaymentRecordWriteAllowed(
  tenantId: string,
  adminKey?: string | null
): Promise<{
  actorFiUserId: string | null;
}> {
  const tid = tenantId.trim();
  if (!tid) throw new PaymentRecordAccessError(400, "tenantId is required.");

  await rejectStaffPinSessionForRestrictedMutation(tid);

  if (isFiAdminApiKeyMatch(adminKey, process.env.FI_ADMIN_API_KEY)) {
    if (!isFiAdminKeyTenantScopeAllowed(tid)) {
      throw new PaymentRecordAccessError(403, FI_ADMIN_KEY_TENANT_DENIED_MESSAGE);
    }
    return { actorFiUserId: null };
  }

  const authUserId = await resolveAuthUserId(null);
  if (!authUserId) throw new PaymentRecordAccessError(401, "Authentication required.");

  const os = await loadFiOsIdentity(authUserId);
  if (os && isFiOsPlatformAdminRole(os.osRole)) {
    const impersonated = await getFiOsImpersonationTargetAuthUserId(authUserId);
    if (!impersonated) {
      throw new PaymentRecordAccessError(
        403,
        "Platform administrators must impersonate a tenant member before recording payments."
      );
    }
    const row = await loadFiUserForTenant(tid, impersonated);
    if (!row) {
      throw new PaymentRecordAccessError(403, "Impersonated user is not a member of this tenant.");
    }
    if (!isPaymentMutationRole(row.role)) {
      throw new PaymentRecordAccessError(
        403,
        "Finance or manager access required to record payments."
      );
    }
    return { actorFiUserId: row.id };
  }

  const row = await loadFiUserForTenant(tid, authUserId);
  if (!row) throw new PaymentRecordAccessError(403, "Not a member of this tenant.");
  if (!isPaymentMutationRole(row.role)) {
    throw new PaymentRecordAccessError(
      403,
      "Finance or manager access required to record payments."
    );
  }
  return { actorFiUserId: row.id };
}

export async function getPaymentRecordMutationCapability(
  tenantId: string
): Promise<{ canMutate: boolean }> {
  try {
    await assertPaymentRecordWriteAllowed(tenantId, undefined);
    return { canMutate: true };
  } catch {
    return { canMutate: false };
  }
}
