import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createCalendarAppointment } from "@/src/lib/bookings/appointmentsApi";
import { cancelBooking } from "@/src/lib/bookings/server";
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { isoFromLocalDayMinutes, normalizeCalendarTimezone, zonedMidnightUtcMs } from "@/src/lib/calendar/calendarTimezone";
import { nextStaffWorkingLocalDayYmd } from "@/src/lib/calendar/calendarTestingSlotHelpers";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import { formatStaffWeeklyHoursSummary, minutesFromHm, parseStaffWeeklyHours, staffWeekdayKeyFromUtcMs } from "@/src/lib/staff/staffWeeklyHours";

function hasWeeklyHoursSummary(staff: { working_hours: Record<string, unknown> }): boolean {
  return Boolean(formatStaffWeeklyHoursSummary(parseStaffWeeklyHours(staff.working_hours)).trim());
}

export type CalendarSmokeTestResult =
  | { ok: true; bookingId: string; message: string }
  | { ok: false; error: string };

/**
 * Creates a short on-hours consultation for the first lead + staffed slot found, then cancels it.
 * Intended for staging / QA only.
 */
export async function runCalendarConsultationSmokeTest(
  tenantId: string,
  adminKey?: string | null
): Promise<CalendarSmokeTestResult> {
  const tid = tenantId.trim();
  await assertCrmTenantWriteAllowed({ tenantId: tid, adminKey: adminKey ?? undefined, request: undefined });

  const supabase = supabaseAdmin();
  const { data: lead, error: le } = await supabase
    .from("fi_crm_leads")
    .select("id, person_id")
    .eq("tenant_id", tid)
    .not("person_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (le) return { ok: false, error: le.message };
  if (!lead) {
    return { ok: false, error: "No CRM lead with person_id found — create a lead first, then retry." };
  }

  const staffList = await loadAllStaffForTenant(tid);
  const staff = staffList.find((s) => s.is_active && hasWeeklyHoursSummary(s));
  if (!staff) {
    return { ok: false, error: "No active staff with weekly hours — complete Staff setup first." };
  }

  const weekly = parseStaffWeeklyHours(staff.working_hours);
  const staffTz = normalizeCalendarTimezone(staff.default_timezone?.trim() || "Australia/Perth");
  const ymd = nextStaffWorkingLocalDayYmd(staffTz, weekly, Date.now());
  if (!ymd) {
    return { ok: false, error: "Could not find a working day for the assigned staff member." };
  }
  const mid = zonedMidnightUtcMs(ymd, staffTz);
  if (mid == null) return { ok: false, error: "Invalid staff timezone for slot math." };
  const anchor = mid + 12 * 3_600_000;
  const wk = staffWeekdayKeyFromUtcMs(anchor, staffTz);
  const day = weekly[wk];
  const openMin = day?.start ? minutesFromHm(day.start) : null;
  const endHm = day?.end ? minutesFromHm(day.end) : null;
  if (openMin == null || endHm == null || endHm <= openMin) {
    return { ok: false, error: "Staff working hours could not be parsed for smoke slot." };
  }
  let slotStart = openMin + 60;
  let slotEnd = Math.min(openMin + 120, endHm - 1);
  if (slotEnd <= slotStart + 29) {
    slotStart = openMin + Math.max(5, Math.floor((endHm - openMin - 35) / 2));
    slotEnd = slotStart + 30;
  }
  if (slotEnd <= slotStart) {
    return { ok: false, error: "Working window too narrow for a smoke booking — widen staff hours." };
  }
  const startIso = isoFromLocalDayMinutes(ymd, slotStart, staffTz);
  const endIso = isoFromLocalDayMinutes(ymd, slotEnd, staffTz);
  if (!startIso || !endIso) {
    return { ok: false, error: "Could not build ISO instants for smoke booking." };
  }

  const createdByUserId = await tryResolveFiUserIdForTenant(tid, undefined);
  const cancelledByUserId = createdByUserId;

  try {
    const appt = await createCalendarAppointment({
      tenantId: tid,
      procedure: "consultation",
      startAt: startIso,
      endAt: endIso,
      assignedStaffId: staff.id,
      leadId: String((lead as { id: string }).id),
      personId: String((lead as { person_id: string }).person_id),
      skipAvailabilityCheck: false,
      createdByUserId,
    });
    await cancelBooking({
      tenantId: tid,
      bookingId: appt.id,
      cancellationReason: "Calendar QA smoke test (auto-cancelled).",
      cancelledByUserId,
    });
    return {
      ok: true,
      bookingId: appt.id,
      message: `Created and cancelled booking ${appt.id.slice(0, 8)}… on ${ymd} (${staff.full_name}, consultation).`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
