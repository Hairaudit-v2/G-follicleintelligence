import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { isCrmStaffManageRole } from "@/src/lib/crm/crmGatePolicy";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsElevatedOsOperatorRole } from "@/src/lib/fiOs/fiOsRoles";
import { loadAllStaffForTenant, type FiStaffRow } from "@/src/lib/staff/staff.server";

export type StaffDirectoryPageResult = {
  staff: FiStaffRow[];
  canManageStaff: boolean;
  /** Staff profile id linked to the signed-in tenant user (`fi_staff.fi_user_id` = `fi_users.id`), if any. */
  viewerStaffId: string | null;
  fiUsersForLink: { id: string; email: string | null }[];
};

async function loadFiUserRow(
  tenantId: string,
  authUserId: string
): Promise<{ id: string; role: string } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: String((data as { id: string }).id), role: String((data as { role: string | null }).role ?? "member") };
}

export async function loadStaffDirectoryPage(tenantId: string): Promise<StaffDirectoryPageResult> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();
  const [staffRes, usersRes] = await Promise.all([
    loadAllStaffForTenant(tid),
    supabase.from("fi_users").select("id, email").eq("tenant_id", tid).order("email", { ascending: true }).limit(200),
  ]);
  if (usersRes.error) throw new Error(usersRes.error.message);

  const fiUsersForLink = ((usersRes.data ?? []) as { id: string; email: string | null }[]).map((r) => ({
    id: String(r.id),
    email: r.email != null ? String(r.email) : null,
  }));

  const authId = await resolveAuthUserId(null);
  let canManageStaff = false;
  let viewerStaffId: string | null = null;
  if (authId) {
    const row = await loadFiUserRow(tid, authId);
    if (row && isCrmStaffManageRole(row.role)) canManageStaff = true;
    if (!canManageStaff) {
      const os = await loadFiOsIdentity(authId);
      if (isFiOsElevatedOsOperatorRole(os?.osRole)) canManageStaff = true;
    }
    if (row) {
      const mine = staffRes.find((s) => (s.fi_user_id?.trim() ?? "") === row.id);
      viewerStaffId = mine?.id ?? null;
    }
  }

  return { staff: staffRes, canManageStaff, viewerStaffId, fiUsersForLink };
}
