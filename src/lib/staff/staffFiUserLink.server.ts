import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { updateFiStaff } from "@/src/lib/staff/staff.server";
import {
  listUnlinkedStaffWithEmail,
  normalizeStaffLinkEmail,
  planStaffFiUserLinks,
  type StaffFiUserLinkCandidate,
  type StaffFiUserLinkExistingUser,
  type StaffFiUserLinkPlanRow,
} from "@/src/lib/staff/staffFiUserLinkPlan";

export type StaffFiUserLinkPageRow = StaffFiUserLinkPlanRow & {
  selected: boolean;
};

export type StaffFiUserLinkPageModel = {
  tenantId: string;
  rows: StaffFiUserLinkPageRow[];
  unlinkedBefore: number;
  canPerformAdminActions: boolean;
};

async function loadStaffCandidates(tenantId: string, client: SupabaseClient): Promise<StaffFiUserLinkCandidate[]> {
  const tid = tenantId.trim();
  const { data, error } = await client
    .from("fi_staff")
    .select("id, full_name, email, fi_user_id")
    .eq("tenant_id", tid)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((raw) => {
    const r = raw as { id: string; full_name: string | null; email: string | null; fi_user_id: string | null };
    return {
      staffId: String(r.id),
      fullName: String(r.full_name ?? "").trim() || "Staff",
      email: String(r.email ?? "").trim(),
      fiUserId: r.fi_user_id != null ? String(r.fi_user_id) : null,
    };
  });
}

async function loadTenantFiUsers(tenantId: string, client: SupabaseClient): Promise<StaffFiUserLinkExistingUser[]> {
  const tid = tenantId.trim();
  const { data, error } = await client.from("fi_users").select("id, email, tenant_id").eq("tenant_id", tid);
  if (error) throw new Error(error.message);
  return (data ?? []).map((raw) => {
    const r = raw as { id: string; email: string | null; tenant_id: string };
    return {
      id: String(r.id),
      email: r.email != null ? String(r.email) : null,
      tenantId: String(r.tenant_id),
    };
  });
}

export async function loadStaffFiUserLinkPage(tenantId: string): Promise<StaffFiUserLinkPageModel> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const [staff, users] = await Promise.all([loadStaffCandidates(tid, supabase), loadTenantFiUsers(tid, supabase)]);
  const unlinked = listUnlinkedStaffWithEmail(staff);
  const plan = planStaffFiUserLinks({
    tenantId: tid,
    staff: unlinked,
    users,
    selectedStaffIds: unlinked.map((s) => s.staffId),
  });
  return {
    tenantId: tid,
    rows: plan.rows.map((row) => ({ ...row, selected: true })),
    unlinkedBefore: plan.unlinkedBefore,
    canPerformAdminActions: true,
  };
}

export type BulkLinkStaffToFiUsersResult = {
  linkedCount: number;
  createdUsers: number;
  unlinkedBefore: number;
  unlinkedAfter: number;
};

export async function bulkLinkStaffToFiUsersForTests(
  tenantId: string,
  selectedStaffIds: string[],
  client: SupabaseClient
): Promise<BulkLinkStaffToFiUsersResult> {
  return bulkLinkStaffToFiUsers(tenantId, selectedStaffIds, client);
}

export async function bulkLinkStaffToFiUsers(
  tenantId: string,
  selectedStaffIds: string[],
  client?: SupabaseClient
): Promise<BulkLinkStaffToFiUsersResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const selected = selectedStaffIds.map((id) => id.trim()).filter(Boolean);
  if (selected.length === 0) {
    throw new Error("Select at least one staff member to link.");
  }

  const [staff, users] = await Promise.all([loadStaffCandidates(tid, supabase), loadTenantFiUsers(tid, supabase)]);
  const beforePlan = planStaffFiUserLinks({ tenantId: tid, staff, users, selectedStaffIds: [] });
  const plan = planStaffFiUserLinks({ tenantId: tid, staff, users, selectedStaffIds: selected });
  const selectedSet = new Set(selected);
  const rowsToApply = plan.rows.filter((r) => selectedSet.has(r.staffId));

  const emailToUserId = new Map<string, string>();
  for (const u of users) {
    const key = normalizeStaffLinkEmail(u.email);
    if (key && !emailToUserId.has(key)) emailToUserId.set(key, u.id);
  }

  let linkedCount = 0;
  let createdUsers = 0;

  for (const row of rowsToApply) {
    const emailKey = normalizeStaffLinkEmail(row.email);
    if (!emailKey) continue;

    let fiUserId = row.matchedUserId?.trim() || emailToUserId.get(emailKey) || null;

    if (!fiUserId && row.action === "create_user_and_link") {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("fi_users")
        .insert({
          tenant_id: tid,
          email: row.email.trim(),
          role: "member",
          auth_user_id: null,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      fiUserId = String((data as { id: string }).id);
      emailToUserId.set(emailKey, fiUserId);
      createdUsers += 1;
    }

    if (!fiUserId) {
      throw new Error(`Could not resolve fi_user for staff ${row.fullName}.`);
    }

    const { data: userCheck, error: userErr } = await supabase
      .from("fi_users")
      .select("id")
      .eq("tenant_id", tid)
      .eq("id", fiUserId)
      .maybeSingle();
    if (userErr) throw new Error(userErr.message);
    if (!userCheck) throw new Error("Resolved fi_user is not in this tenant.");

    await updateFiStaff(tid, row.staffId, { fi_user_id: fiUserId }, supabase);
    linkedCount += 1;
  }

  const afterStaff = await loadStaffCandidates(tid, supabase);
  const afterUnlinked = listUnlinkedStaffWithEmail(afterStaff).length;

  return {
    linkedCount,
    createdUsers,
    unlinkedBefore: beforePlan.unlinkedBefore,
    unlinkedAfter: afterUnlinked,
  };
}
