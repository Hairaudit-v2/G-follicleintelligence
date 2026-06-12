import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiStaffFeatureAccessAuditInsert } from "@/src/lib/fi-os/staffFeatureAccessAuditPayload";

export async function tryInsertFiStaffFeatureAccessAuditEvent(
  row: FiStaffFeatureAccessAuditInsert
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("fi_staff_feature_access_audit_events").insert({
      tenant_id: row.tenant_id,
      staff_id: row.staff_id,
      actor_user_id: row.actor_user_id,
      actor_fi_user_id: row.actor_fi_user_id,
      event_type: row.event_type,
      target_type: row.target_type,
      feature_key: row.feature_key,
      old_value: row.old_value as object | null,
      new_value: row.new_value as object | null,
      reason: row.reason,
      source: row.source,
      metadata: row.metadata,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "audit insert failed";
    return { ok: false, error: msg };
  }
}

export async function resolveActorIdsForFiOsAudit(
  tenantId: string,
  authUserId: string | null
): Promise<{ actor_user_id: string | null; actor_fi_user_id: string | null }> {
  const tid = tenantId.trim();
  const aid = authUserId?.trim();
  if (!tid || !aid) return { actor_user_id: aid ?? null, actor_fi_user_id: null };
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tid)
    .eq("auth_user_id", aid)
    .maybeSingle();
  if (error || !data) return { actor_user_id: aid, actor_fi_user_id: null };
  return { actor_user_id: aid, actor_fi_user_id: String((data as { id: string }).id) };
}
