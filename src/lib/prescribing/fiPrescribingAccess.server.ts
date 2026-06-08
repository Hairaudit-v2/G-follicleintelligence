import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";

export type FiPrescribingActor = {
  authUserId: string;
  fiUserId: string;
};

/**
 * Prescribing mutations require a tenant `fi_users` row (same membership model as FI Admin tenant routes).
 */
export async function requireFiPrescribingActor(tenantId: string): Promise<FiPrescribingActor> {
  const tid = tenantId.trim();
  const authId = await resolveAuthUserId(null);
  if (!authId) {
    throw new Error("Not signed in.");
  }
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tid)
    .eq("auth_user_id", authId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("You do not have access to prescribe for this tenant.");
  }
  return { authUserId: authId, fiUserId: String((data as { id: string }).id) };
}
