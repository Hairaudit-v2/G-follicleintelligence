import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isFiOsPlatformAdminFullSessionBypass,
  loadProxyFiUserRowForPlatformAdminTenant,
  resolveAuthUserId,
} from "@/src/lib/crm/crmGate";
import { isFiAdminApiKeyMatch } from "@/src/lib/crm/crmGatePolicy";
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

async function loadFiUserForTenant(tenantId: string, authUserId: string): Promise<{ id: string; role: string } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new PaymentRecordAccessError(500, "Could not verify tenant membership.");
  if (!data) return null;
  return { id: String((data as { id: string }).id), role: String((data as { role: string | null }).role ?? "member") };
}

/**
 * Mutations: finance-capable roles on `fi_users` (`PAYMENT_MUTATION_ROLES_LOWER`), platform-admin bypass, or `FI_ADMIN_API_KEY`.
 * **Not** aligned with `fi_tenant_admin_users` capability grants — see `docs/design/fi-payment-records-access.md`.
 * Staff PIN sessions are always blocked (even if role would allow).
 */
export async function assertPaymentRecordWriteAllowed(tenantId: string, adminKey?: string | null): Promise<{
  actorFiUserId: string | null;
}> {
  const tid = tenantId.trim();
  if (!tid) throw new PaymentRecordAccessError(400, "tenantId is required.");

  await rejectStaffPinSessionForRestrictedMutation(tid);

  if (isFiAdminApiKeyMatch(adminKey, process.env.FI_ADMIN_API_KEY)) {
    return { actorFiUserId: null };
  }

  const authUserId = await resolveAuthUserId(null);
  if (!authUserId) throw new PaymentRecordAccessError(401, "Authentication required.");

  if (await isFiOsPlatformAdminFullSessionBypass(authUserId)) {
    const proxy = await loadProxyFiUserRowForPlatformAdminTenant(tid, authUserId);
    return { actorFiUserId: proxy?.id ?? null };
  }

  const row = await loadFiUserForTenant(tid, authUserId);
  if (!row) throw new PaymentRecordAccessError(403, "Not a member of this tenant.");
  if (!isPaymentMutationRole(row.role)) {
    throw new PaymentRecordAccessError(403, "Finance or manager access required to record payments.");
  }
  return { actorFiUserId: row.id };
}

export async function getPaymentRecordMutationCapability(tenantId: string): Promise<{ canMutate: boolean }> {
  try {
    await assertPaymentRecordWriteAllowed(tenantId, undefined);
    return { canMutate: true };
  } catch {
    return { canMutate: false };
  }
}
