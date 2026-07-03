import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { parseStaffWeeklyHours, serializeStaffWeeklyHours } from "@/src/lib/staff/staffWeeklyHours";
import {
  standardHoursToWeeklyHoursMap,
  validateStandardHoursPattern,
  weeklyHoursMapToStandardHours,
  type StaffStandardHoursDayInput,
  type StaffStandardHoursRow,
} from "@/src/lib/workforce-os/staffStandardHoursCore";

function mapStandardHoursRow(row: Record<string, unknown>): StaffStandardHoursRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    staff_id: String(row.staff_id),
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    weekday: Number(row.weekday),
    start_time: row.start_time != null ? String(row.start_time).slice(0, 5) : null,
    end_time: row.end_time != null ? String(row.end_time).slice(0, 5) : null,
    break_minutes: row.break_minutes != null ? Number(row.break_minutes) : null,
    shift_label: row.shift_label != null ? String(row.shift_label) : null,
    role_code: row.role_code != null ? String(row.role_code) : null,
    is_working_day: Boolean(row.is_working_day),
    effective_from: String(row.effective_from).slice(0, 10),
    effective_to: row.effective_to != null ? String(row.effective_to).slice(0, 10) : null,
    status: row.status === "archived" ? "archived" : "active",
  };
}

function rowToDayInput(row: StaffStandardHoursRow): StaffStandardHoursDayInput {
  return {
    weekday: row.weekday,
    is_working_day: row.is_working_day,
    start_time: row.start_time,
    end_time: row.end_time,
    break_minutes: row.break_minutes,
    clinic_id: row.clinic_id,
    shift_label: row.shift_label,
    role_code: row.role_code,
  };
}

export async function loadActiveStandardHoursForStaff(
  tenantId: string,
  staffId: string
): Promise<StaffStandardHoursDayInput[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_standard_hours")
    .select("*")
    .eq("tenant_id", tid)
    .eq("staff_id", sid)
    .eq("status", "active")
    .order("weekday", { ascending: true });
  if (error) throw new Error(error.message);
  if (!data?.length) return [];
  return (data as Record<string, unknown>[]).map((r) => rowToDayInput(mapStandardHoursRow(r)));
}

export async function loadActiveStandardHoursForTenant(
  tenantId: string,
  staffIds?: string[]
): Promise<Map<string, StaffStandardHoursDayInput[]>> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();
  let query = supabase
    .from("fi_staff_standard_hours")
    .select("*")
    .eq("tenant_id", tid)
    .eq("status", "active")
    .order("staff_id", { ascending: true })
    .order("weekday", { ascending: true });

  if (staffIds?.length) {
    query = query.in("staff_id", staffIds.map((id) => assertNonEmptyUuid(id, "staffId")));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const out = new Map<string, StaffStandardHoursDayInput[]>();
  for (const raw of data ?? []) {
    const row = mapStandardHoursRow(raw as Record<string, unknown>);
    const list = out.get(row.staff_id) ?? [];
    list.push(rowToDayInput(row));
    out.set(row.staff_id, list);
  }
  return out;
}

/** Resolve standard hours: table first, then legacy JSONB on fi_staff.working_hours. */
export async function resolveStandardHoursForStaff(
  tenantId: string,
  staffId: string,
  legacyWorkingHours?: Record<string, unknown> | null
): Promise<StaffStandardHoursDayInput[]> {
  const fromTable = await loadActiveStandardHoursForStaff(tenantId, staffId);
  if (fromTable.length) return fromTable;
  if (legacyWorkingHours) {
    return weeklyHoursMapToStandardHours(parseStaffWeeklyHours(legacyWorkingHours));
  }
  return [];
}

async function syncLegacyWorkingHoursJson(
  tenantId: string,
  staffId: string,
  days: StaffStandardHoursDayInput[]
): Promise<void> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");
  const weekly = standardHoursToWeeklyHoursMap(days);
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("fi_staff")
    .update({ working_hours: serializeStaffWeeklyHours(weekly) })
    .eq("tenant_id", tid)
    .eq("id", sid);
  if (error) throw new Error(error.message);
}

export type SaveStaffStandardHoursInput = {
  tenantId: string;
  staffId: string;
  days: StaffStandardHoursDayInput[];
  effectiveFrom?: string;
};

export type SaveStaffStandardHoursResult = {
  days: StaffStandardHoursDayInput[];
  validation: ReturnType<typeof validateStandardHoursPattern>;
};

export async function saveStaffStandardHours(
  input: SaveStaffStandardHoursInput
): Promise<SaveStaffStandardHoursResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.staffId, "staffId");
  const validation = validateStandardHoursPattern(input.days);
  if (!validation.valid) {
    return { days: input.days, validation };
  }

  const effectiveFrom = input.effectiveFrom?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const supabase = supabaseAdmin();

  const { error: archiveErr } = await supabase
    .from("fi_staff_standard_hours")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("tenant_id", tid)
    .eq("staff_id", sid)
    .eq("status", "active");
  if (archiveErr) throw new Error(archiveErr.message);

  const rows = input.days.map((day) => ({
    tenant_id: tid,
    staff_id: sid,
    clinic_id: day.clinic_id?.trim() || null,
    weekday: day.weekday,
    start_time: day.is_working_day ? day.start_time : null,
    end_time: day.is_working_day ? day.end_time : null,
    break_minutes: day.break_minutes ?? 0,
    shift_label: day.shift_label?.trim() || null,
    role_code: day.role_code?.trim() || null,
    is_working_day: day.is_working_day,
    effective_from: effectiveFrom,
    effective_to: null,
    status: "active",
  }));

  const { error: insertErr } = await supabase.from("fi_staff_standard_hours").insert(rows);
  if (insertErr) throw new Error(insertErr.message);

  await syncLegacyWorkingHoursJson(tid, sid, input.days);
  return { days: input.days, validation };
}
