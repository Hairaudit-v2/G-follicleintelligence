import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

export type FiStaffRow = {
  id: string;
  tenant_id: string;
  fi_user_id: string | null;
  full_name: string;
  staff_role: string;
  email: string | null;
  mobile: string | null;
  default_timezone: string | null;
  working_hours: Record<string, unknown>;
  is_active: boolean;
  calendar_color: string | null;
  created_at: string;
  updated_at: string;
};

function mapStaffRow(row: Record<string, unknown>): FiStaffRow {
  const wh = row.working_hours;
  const working_hours =
    wh && typeof wh === "object" && !Array.isArray(wh) ? (wh as Record<string, unknown>) : {};
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    fi_user_id: row.fi_user_id != null ? String(row.fi_user_id) : null,
    full_name: String(row.full_name ?? "").trim() || "Staff",
    staff_role: String(row.staff_role ?? "consultant").trim() || "consultant",
    email: row.email != null ? String(row.email) : null,
    mobile: row.mobile != null ? String(row.mobile) : null,
    default_timezone: row.default_timezone != null ? String(row.default_timezone) : null,
    working_hours,
    is_active: Boolean(row.is_active),
    calendar_color: row.calendar_color != null ? String(row.calendar_color) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function assertFiStaffBelongsToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  staffId: string
): Promise<FiStaffRow> {
  const tid = tenantId.trim();
  const sid = staffId.trim();
  const { data, error } = await supabase
    .from("fi_staff")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", sid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("assignedStaffId must belong to the tenant.");
  return mapStaffRow(data as Record<string, unknown>);
}

export async function loadStaffMemberForTenant(
  tenantId: string,
  staffId: string,
  client?: SupabaseClient
): Promise<FiStaffRow | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");
  const { data, error } = await supabase
    .from("fi_staff")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", sid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapStaffRow(data as Record<string, unknown>);
}

export async function loadActiveStaffForTenant(tenantId: string, client?: SupabaseClient): Promise<FiStaffRow[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const { data, error } = await supabase
    .from("fi_staff")
    .select("*")
    .eq("tenant_id", tid)
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapStaffRow);
}

export async function loadAllStaffForTenant(tenantId: string, client?: SupabaseClient): Promise<FiStaffRow[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const { data, error } = await supabase
    .from("fi_staff")
    .select("*")
    .eq("tenant_id", tid)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapStaffRow);
}

/** Maps `fi_staff.id` → linked `fi_users.id` (null when staff has no login). */
export async function loadStaffFiUserIdMap(
  tenantId: string,
  staffIds: string[],
  client?: SupabaseClient
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const ids = Array.from(new Set(staffIds.map((x) => x.trim()).filter(Boolean)));
  for (const id of ids) out.set(id, null);
  if (!ids.length) return out;

  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id, fi_user_id")
    .eq("tenant_id", tid)
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as { id: string; fi_user_id: string | null };
    out.set(String(r.id), r.fi_user_id != null ? String(r.fi_user_id) : null);
  }
  return out;
}

export type StaffAssignmentResolved = {
  assigned_staff_id: string | null;
  assigned_user_id: string | null;
};

/**
 * Resolves booking assignee columns from optional staff id and/or legacy user id.
 * When `assignedStaffId` is set, it wins and `assigned_user_id` is derived from `fi_staff.fi_user_id`.
 */
export async function resolveBookingStaffAssignment(
  supabase: SupabaseClient,
  tenantId: string,
  params: { assignedStaffId?: string | null; assignedUserId?: string | null }
): Promise<StaffAssignmentResolved> {
  const tid = tenantId.trim();
  const sid = params.assignedStaffId?.trim() || null;
  if (sid) {
    const staff = await assertFiStaffBelongsToTenant(supabase, tid, sid);
    if (!staff.is_active) throw new Error("Cannot assign an inactive staff member. Reactivate them in Staff or pick another clinician.");
    return {
      assigned_staff_id: staff.id,
      assigned_user_id: staff.fi_user_id?.trim() || null,
    };
  }
  const uid = params.assignedUserId?.trim() || null;
  return { assigned_staff_id: null, assigned_user_id: uid };
}

export type FiStaffUpsertInput = {
  full_name: string;
  staff_role?: string;
  email?: string | null;
  mobile?: string | null;
  default_timezone?: string | null;
  working_hours?: Record<string, unknown>;
  is_active?: boolean;
  calendar_color?: string | null;
  fi_user_id?: string | null;
};

async function assertFiUserBelongsToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  fiUserId: string
): Promise<void> {
  const tid = tenantId.trim();
  const uid = fiUserId.trim();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tid)
    .eq("id", uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("fi_user_id must be a fi_users row in this tenant.");
}

export async function insertFiStaff(
  tenantId: string,
  input: FiStaffUpsertInput,
  client?: SupabaseClient
): Promise<FiStaffRow> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const fiUserId = input.fi_user_id?.trim() || null;
  if (fiUserId) await assertFiUserBelongsToTenant(supabase, tid, fiUserId);

  const wh =
    input.working_hours && typeof input.working_hours === "object" && !Array.isArray(input.working_hours)
      ? input.working_hours
      : {};
  const payload = {
    tenant_id: tid,
    full_name: input.full_name.trim(),
    staff_role: (input.staff_role ?? "consultant").trim() || "consultant",
    email: input.email?.trim() || null,
    mobile: input.mobile?.trim() || null,
    default_timezone: input.default_timezone?.trim() || null,
    working_hours: wh,
    is_active: input.is_active !== false,
    calendar_color: input.calendar_color?.trim() || null,
    fi_user_id: fiUserId,
  };

  const { data, error } = await supabase.from("fi_staff").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return mapStaffRow(data as Record<string, unknown>);
}

export async function updateFiStaff(
  tenantId: string,
  staffId: string,
  patch: Partial<FiStaffUpsertInput>,
  client?: SupabaseClient
): Promise<FiStaffRow> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");
  await assertFiStaffBelongsToTenant(supabase, tid, sid);

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.full_name !== undefined) row.full_name = String(patch.full_name ?? "").trim() || "Staff";
  if (patch.staff_role !== undefined) row.staff_role = String(patch.staff_role ?? "consultant").trim() || "consultant";
  if (patch.email !== undefined) row.email = patch.email?.trim() || null;
  if (patch.mobile !== undefined) row.mobile = patch.mobile?.trim() || null;
  if (patch.default_timezone !== undefined) row.default_timezone = patch.default_timezone?.trim() || null;
  if (patch.working_hours !== undefined) {
    const wh =
      patch.working_hours && typeof patch.working_hours === "object" && !Array.isArray(patch.working_hours)
        ? patch.working_hours
        : {};
    row.working_hours = wh;
  }
  if (patch.is_active !== undefined) row.is_active = Boolean(patch.is_active);
  if (patch.calendar_color !== undefined) row.calendar_color = patch.calendar_color?.trim() || null;
  if (patch.fi_user_id !== undefined) {
    const fiUserId = patch.fi_user_id?.trim() || null;
    if (fiUserId) await assertFiUserBelongsToTenant(supabase, tid, fiUserId);
    row.fi_user_id = fiUserId;
  }

  const { data, error } = await supabase.from("fi_staff").update(row).eq("tenant_id", tid).eq("id", sid).select("*").single();
  if (error) throw new Error(error.message);
  return mapStaffRow(data as Record<string, unknown>);
}
