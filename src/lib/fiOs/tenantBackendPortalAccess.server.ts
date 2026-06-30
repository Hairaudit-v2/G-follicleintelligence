import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type FiUserMembershipRow = {
  id: string;
  role: string;
  auth_user_id: string | null;
};

/**
 * `fi_users.role = tenant_backend` requires a matching `fi_tenant_admin_users` row that is
 * active (or invited with confirmed auth). Suspended / missing admin rows deny portal and API access.
 */
export async function isTenantBackendPortalAllowed(
  tenantId: string,
  row: FiUserMembershipRow
): Promise<boolean> {
  const role = row.role.trim().toLowerCase();
  if (role !== "tenant_backend") return true;

  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: adm, error } = await supabase
    .from("fi_tenant_admin_users")
    .select("id, status")
    .eq("tenant_id", tid)
    .eq("fi_user_id", row.id)
    .maybeSingle();
  if (error || !adm) return false;

  const st = String((adm as { status: string }).status)
    .trim()
    .toLowerCase();
  if (st === "suspended") return false;
  if (st === "active") return true;

  if (st !== "invited") return false;
  const authUid = row.auth_user_id?.trim();
  if (!authUid) return false;

  const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(authUid);
  if (authErr || !authUser?.user) return false;
  const u = authUser.user;
  const ready = Boolean(u.email_confirmed_at || u.last_sign_in_at);
  if (!ready) return false;

  const adminId = String((adm as { id: string }).id);
  await supabase
    .from("fi_tenant_admin_users")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", adminId)
    .eq("tenant_id", tid);

  return true;
}