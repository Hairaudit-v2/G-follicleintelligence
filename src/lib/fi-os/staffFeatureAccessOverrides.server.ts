import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isFiFeatureKey, type FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";

/**
 * Loads explicit per-feature toggles from `fi_staff_feature_access` for one staff member.
 * Unknown `feature_key` values from the database are ignored.
 */
export async function loadStaffFeatureAccessOverrides(
  tenantId: string,
  staffId: string | null
): Promise<Partial<Record<FiFeatureKey, boolean>>> {
  const tid = tenantId.trim();
  const sid = staffId?.trim() ?? "";
  if (!tid || !sid) return {};
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_feature_access")
    .select("feature_key, enabled")
    .eq("tenant_id", tid)
    .eq("staff_id", sid);
  if (error || !data) return {};
  const out: Partial<Record<FiFeatureKey, boolean>> = {};
  for (const raw of data) {
    const row = raw as { feature_key: string; enabled: boolean };
    const k = String(row.feature_key ?? "");
    if (!isFiFeatureKey(k)) continue;
    out[k] = Boolean(row.enabled);
  }
  return out;
}
