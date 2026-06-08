import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";

/**
 * Resolves the foundation patient row for the current Supabase user when `fi_patients.portal_auth_user_id` is set.
 */
export async function loadPatientPortalPatientRow(tenantId: string): Promise<{ patientId: string } | null> {
  const tid = tenantId.trim();
  const authId = await resolveAuthUserId(null);
  if (!authId) return null;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("tenant_id", tid)
    .eq("portal_auth_user_id", authId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { patientId: String((data as { id: string }).id) };
}
