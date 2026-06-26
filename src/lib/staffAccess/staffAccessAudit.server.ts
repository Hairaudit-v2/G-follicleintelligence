import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type StaffAccessAuditAction =
  | "grant_created"
  | "grant_updated"
  | "grant_revoked"
  | "grant_reinstated";

export type StaffAccessAuditInsert = {
  tenantId: string;
  staffMemberId: string | null;
  changedBy: string | null;
  action: StaffAccessAuditAction;
  moduleKey: string | null;
  tabKey: string | null;
  previousAccess: unknown;
  newAccess: unknown;
  reason: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Append an entry to `fi_staff_access_audit_log`. Never throws — audit failures are logged
 * to the result and must not block the underlying access change.
 */
export async function tryInsertStaffAccessAuditEvent(
  row: StaffAccessAuditInsert
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("fi_staff_access_audit_log").insert({
      tenant_id: row.tenantId.trim(),
      staff_member_id: row.staffMemberId?.trim() || null,
      changed_by: row.changedBy?.trim() || null,
      action: row.action,
      module_key: row.moduleKey?.trim() || null,
      tab_key: row.tabKey?.trim() || null,
      previous_access: (row.previousAccess ?? null) as object | null,
      new_access: (row.newAccess ?? null) as object | null,
      reason: row.reason?.trim() || null,
      metadata: row.metadata ?? {},
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "audit insert failed" };
  }
}

export type StaffAccessAuditHistoryRow = {
  id: string;
  staffMemberId: string | null;
  changedBy: string | null;
  action: StaffAccessAuditAction;
  moduleKey: string | null;
  tabKey: string | null;
  previousAccess: unknown;
  newAccess: unknown;
  reason: string | null;
  createdAt: string;
};

export async function loadStaffAccessAuditHistory(
  tenantId: string,
  staffMemberId: string | null,
  limit = 50
): Promise<StaffAccessAuditHistoryRow[]> {
  const tid = tenantId.trim();
  if (!tid) return [];
  const supabase = supabaseAdmin();
  let query = supabase
    .from("fi_staff_access_audit_log")
    .select(
      "id, staff_member_id, changed_by, action, module_key, tab_key, previous_access, new_access, reason, created_at"
    )
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)));
  const sid = staffMemberId?.trim();
  if (sid) query = query.eq("staff_member_id", sid);

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    staffMemberId: r.staff_member_id ? String(r.staff_member_id) : null,
    changedBy: r.changed_by ? String(r.changed_by) : null,
    action: String(r.action) as StaffAccessAuditAction,
    moduleKey: r.module_key ? String(r.module_key) : null,
    tabKey: r.tab_key ? String(r.tab_key) : null,
    previousAccess: r.previous_access ?? null,
    newAccess: r.new_access ?? null,
    reason: r.reason ? String(r.reason) : null,
    createdAt: String(r.created_at),
  }));
}
