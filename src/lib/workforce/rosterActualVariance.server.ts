import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  buildRosterActualVarianceReport,
  type RosterActualVarianceRow,
  type PunchSnapshot,
  type RosterShiftSnapshot,
} from "./rosterActualVarianceCore";
import { listWorkforceTimePunches } from "./staffTimeClock.server";

export async function buildRosterActualVarianceForPeriod(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
  timeZone: string,
  client?: SupabaseClient
): Promise<RosterActualVarianceRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const start = periodStart.trim();
  const end = periodEnd.trim();

  const dayStart = `${start}T00:00:00.000Z`;
  const dayEnd = `${end}T23:59:59.999Z`;

  const [shiftRes, punches] = await Promise.all([
    supabase
      .from("fi_staff_shifts")
      .select("id, staff_id, shift_type, starts_at, ends_at, status")
      .eq("tenant_id", tid)
      .neq("status", "cancelled")
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd),
    listWorkforceTimePunches(tid, { periodStart: start, periodEnd: end, limit: 500 }, supabase),
  ]);
  if (shiftRes.error) throw new Error(shiftRes.error.message);

  const staffIds = Array.from(
    new Set(
      ((shiftRes.data ?? []) as { staff_id: string }[]).map((s) => String(s.staff_id))
    )
  );
  const nameByStaff = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: staffRows } = await supabase
      .from("fi_staff")
      .select("id, full_name")
      .eq("tenant_id", tid)
      .in("id", staffIds);
    for (const r of (staffRows ?? []) as { id: string; full_name: string }[]) {
      nameByStaff.set(String(r.id), String(r.full_name));
    }
  }

  const shifts: RosterShiftSnapshot[] = ((shiftRes.data ?? []) as Record<string, unknown>[]).map(
    (row) => {
      const startsAt = String(row.starts_at);
      return {
        shiftId: String(row.id),
        fiStaffId: String(row.staff_id),
        staffFullName: nameByStaff.get(String(row.staff_id)) ?? null,
        workDate: calendarDateStringFromInstant(new Date(startsAt), timeZone),
        shiftStartsAt: startsAt,
        shiftEndsAt: String(row.ends_at),
        shiftType: String(row.shift_type),
      };
    }
  );

  const punchSnapshots: PunchSnapshot[] = punches.map((p) => ({
    punchId: p.id,
    fiStaffId: p.fiStaffId,
    workDate: p.workDate,
    clockInAt: p.clockInAt,
    clockOutAt: p.clockOutAt,
    minutesWorked: p.minutesWorked,
  }));

  return buildRosterActualVarianceReport({ shifts, punches: punchSnapshots });
}