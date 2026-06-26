import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * SA-2 field-permission audit log. Mirrors {@link tryInsertStaffAccessAuditEvent} (SA-1): never
 * throws — audit failures are returned, not raised, so they cannot block the underlying change.
 */

export type StaffFieldAccessAuditInsert = {
  tenantId: string;
  clinicId?: string | null;
  staffMemberId: string;
  moduleKey: string;
  fieldKey: string;
  changedBy: string | null;
  previousPermission: unknown;
  newPermission: unknown;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

export async function tryInsertStaffFieldAccessAuditEvent(
  row: StaffFieldAccessAuditInsert
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("fi_staff_field_access_audit_log").insert({
      tenant_id: row.tenantId.trim(),
      clinic_id: row.clinicId?.trim() || null,
      staff_member_id: row.staffMemberId.trim(),
      module_key: row.moduleKey.trim(),
      field_key: row.fieldKey.trim(),
      changed_by: row.changedBy?.trim() || null,
      previous_permission: (row.previousPermission ?? null) as object | null,
      new_permission: (row.newPermission ?? null) as object | null,
      reason: row.reason?.trim() || null,
      metadata: row.metadata ?? {},
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "field audit insert failed" };
  }
}

export type StaffFieldAccessAuditHistoryRow = {
  id: string;
  staffMemberId: string;
  clinicId: string | null;
  moduleKey: string;
  fieldKey: string;
  changedBy: string | null;
  previousPermission: unknown;
  newPermission: unknown;
  reason: string | null;
  createdAt: string;
};

export async function loadStaffFieldAccessAuditHistory(
  tenantId: string,
  staffMemberId: string | null,
  limit = 50
): Promise<StaffFieldAccessAuditHistoryRow[]> {
  const tid = tenantId.trim();
  if (!tid) return [];
  const supabase = supabaseAdmin();
  let query = supabase
    .from("fi_staff_field_access_audit_log")
    .select(
      "id, staff_member_id, clinic_id, module_key, field_key, changed_by, previous_permission, new_permission, reason, created_at"
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
    staffMemberId: String(r.staff_member_id ?? ""),
    clinicId: r.clinic_id ? String(r.clinic_id) : null,
    moduleKey: String(r.module_key ?? ""),
    fieldKey: String(r.field_key ?? ""),
    changedBy: r.changed_by ? String(r.changed_by) : null,
    previousPermission: r.previous_permission ?? null,
    newPermission: r.new_permission ?? null,
    reason: r.reason ? String(r.reason) : null,
    createdAt: String(r.created_at),
  }));
}
