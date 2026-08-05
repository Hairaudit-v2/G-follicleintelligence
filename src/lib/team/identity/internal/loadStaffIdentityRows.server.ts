/**
 * Internal row loaders for staff identity resolution.
 * Not part of the public Team identity API — consumers must use resolveStaffIdentity*.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type {
  StaffIdentityLifecycleRow,
  StaffIdentitySchedulingRow,
} from "@/src/lib/team/identity/internal/staffIdentityRowTypes";

export type { StaffIdentityLifecycleRow, StaffIdentitySchedulingRow };
export { isActiveLifecycleRow } from "@/src/lib/team/identity/internal/staffIdentityRowTypes";

const SCHEDULING_SELECT =
  "id, tenant_id, fi_user_id, full_name, email, staff_role, is_active, working_hours, staff_metadata";

const LIFECYCLE_SELECT =
  "id, tenant_id, fi_staff_id, full_name, email, employment_status, role_code, clinic_id, archived_at, merged_into, system_access_revoked, iiohr_staff_record_id, iiohr_user_id, source_system, source_synced_at";

function mapScheduling(raw: Record<string, unknown>): StaffIdentitySchedulingRow {
  const wh = raw.working_hours;
  const working_hours =
    wh && typeof wh === "object" && !Array.isArray(wh) ? (wh as Record<string, unknown>) : {};
  const sm = raw.staff_metadata;
  const staff_metadata =
    sm && typeof sm === "object" && !Array.isArray(sm) ? (sm as Record<string, unknown>) : {};
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    fi_user_id: raw.fi_user_id != null ? String(raw.fi_user_id) : null,
    full_name: String(raw.full_name ?? "").trim() || "Staff",
    email: raw.email != null ? String(raw.email) : null,
    staff_role: String(raw.staff_role ?? "").trim() || "consultant",
    is_active: Boolean(raw.is_active),
    working_hours,
    staff_metadata,
  };
}

function mapLifecycle(raw: Record<string, unknown>): StaffIdentityLifecycleRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    fi_staff_id: raw.fi_staff_id != null ? String(raw.fi_staff_id) : null,
    full_name: String(raw.full_name ?? "").trim() || "Staff",
    email: raw.email != null ? String(raw.email) : null,
    employment_status: String(raw.employment_status ?? "active"),
    role_code: raw.role_code != null ? String(raw.role_code) : null,
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    archived_at: raw.archived_at != null ? String(raw.archived_at) : null,
    merged_into: raw.merged_into != null ? String(raw.merged_into) : null,
    system_access_revoked:
      raw.system_access_revoked == null ? null : Boolean(raw.system_access_revoked),
    iiohr_staff_record_id:
      raw.iiohr_staff_record_id != null ? String(raw.iiohr_staff_record_id) : null,
    iiohr_user_id: raw.iiohr_user_id != null ? String(raw.iiohr_user_id) : null,
    source_system: raw.source_system != null ? String(raw.source_system) : null,
    source_synced_at: raw.source_synced_at != null ? String(raw.source_synced_at) : null,
  };
}

export async function loadSchedulingRowsByIds(
  tenantId: string,
  staffIds: string[],
  client?: SupabaseClient
): Promise<Map<string, StaffIdentitySchedulingRow>> {
  const out = new Map<string, StaffIdentitySchedulingRow>();
  const ids = Array.from(new Set(staffIds.map((x) => x.trim()).filter(Boolean)));
  if (!ids.length) return out;

  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff")
    .select(SCHEDULING_SELECT)
    .eq("tenant_id", tid)
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const row = mapScheduling(raw as Record<string, unknown>);
    out.set(row.id, row);
  }
  return out;
}

export async function loadSchedulingRowsByUserIds(
  tenantId: string,
  userIds: string[],
  client?: SupabaseClient
): Promise<Map<string, StaffIdentitySchedulingRow[]>> {
  const out = new Map<string, StaffIdentitySchedulingRow[]>();
  const ids = Array.from(new Set(userIds.map((x) => x.trim()).filter(Boolean)));
  if (!ids.length) return out;

  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff")
    .select(SCHEDULING_SELECT)
    .eq("tenant_id", tid)
    .in("fi_user_id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const row = mapScheduling(raw as Record<string, unknown>);
    const uid = row.fi_user_id;
    if (!uid) continue;
    const list = out.get(uid) ?? [];
    list.push(row);
    out.set(uid, list);
  }
  return out;
}

export async function loadLifecycleRowsByIds(
  tenantId: string,
  staffMemberIds: string[],
  client?: SupabaseClient
): Promise<Map<string, StaffIdentityLifecycleRow>> {
  const out = new Map<string, StaffIdentityLifecycleRow>();
  const ids = Array.from(new Set(staffMemberIds.map((x) => x.trim()).filter(Boolean)));
  if (!ids.length) return out;

  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_members")
    .select(LIFECYCLE_SELECT)
    .eq("tenant_id", tid)
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const row = mapLifecycle(raw as Record<string, unknown>);
    out.set(row.id, row);
  }
  return out;
}

export async function loadLifecycleRowsByStaffIds(
  tenantId: string,
  staffIds: string[],
  client?: SupabaseClient
): Promise<Map<string, StaffIdentityLifecycleRow[]>> {
  const out = new Map<string, StaffIdentityLifecycleRow[]>();
  const ids = Array.from(new Set(staffIds.map((x) => x.trim()).filter(Boolean)));
  if (!ids.length) return out;

  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_members")
    .select(LIFECYCLE_SELECT)
    .eq("tenant_id", tid)
    .in("fi_staff_id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const row = mapLifecycle(raw as Record<string, unknown>);
    const sid = row.fi_staff_id;
    if (!sid) continue;
    const list = out.get(sid) ?? [];
    list.push(row);
    out.set(sid, list);
  }
  return out;
}

/**
 * Probe whether a staff id exists under a different tenant (cross-tenant FK).
 * Returns that tenant id when found outside `tenantId`; null when absent globally.
 */
export async function probeSchedulingTenantOutside(
  tenantId: string,
  staffId: string,
  client?: SupabaseClient
): Promise<string | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id, tenant_id")
    .eq("id", sid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const otherTenant = String((data as { tenant_id: string }).tenant_id);
  if (otherTenant === tid) return null;
  return otherTenant;
}
