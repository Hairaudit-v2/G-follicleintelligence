import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { StaffRoleKey } from "@/src/lib/staffAccess/staffAccessRegistry";

/**
 * Idempotently copy global (`tenant_id IS NULL`) role templates into a tenant when none exist.
 * Safe to call on every resolver pass — no-op when tenant rows already present.
 */
export async function seedTenantRoleTemplatesFromGlobal(
  tenantId: string,
  roleKey: StaffRoleKey,
  client?: SupabaseClient
): Promise<number> {
  const tid = tenantId.trim();
  const supabase = client ?? supabaseAdmin();

  const { count: existingCount, error: countErr } = await supabase
    .from("fi_role_permission_templates")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .eq("role_key", roleKey)
    .is("tab_key", null);
  if (countErr) throw new Error(countErr.message);
  if ((existingCount ?? 0) > 0) return 0;

  const { data: globalRows, error: globalErr } = await supabase
    .from("fi_role_permission_templates")
    .select("role_key, module_key, tab_key, access_level, scope, metadata")
    .is("tenant_id", null)
    .eq("role_key", roleKey)
    .is("tab_key", null);
  if (globalErr) throw new Error(globalErr.message);
  if (!globalRows?.length) return 0;

  const payload = (globalRows as Array<Record<string, unknown>>).map((r) => ({
    tenant_id: tid,
    role_key: String(r.role_key),
    module_key: String(r.module_key),
    tab_key: null,
    access_level: String(r.access_level ?? "none"),
    scope: String(r.scope ?? "tenant"),
    metadata: r.metadata ?? {},
  }));

  const { error: insertErr } = await supabase.from("fi_role_permission_templates").insert(payload);
  if (insertErr) throw new Error(insertErr.message);
  return payload.length;
}
