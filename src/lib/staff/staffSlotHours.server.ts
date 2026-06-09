import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isStaffBookableForClinicalWorkflow } from "@/src/lib/staff/staffRolePolicy";
import { normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { AppointmentStaffHoursError } from "@/src/lib/bookings/bookingErrors";
import {
  DEFAULT_STAFF_HOURS_FALLBACK_TZ,
  formatStaffWeeklyHoursSummary,
  isUtcRangeWithinStaffWeeklyHours,
  parseStaffWeeklyHours,
  staffWeekdayKeyFromUtcMs,
  timeZoneShortLabel,
  type StaffWeekdayKey,
} from "@/src/lib/staff/staffWeeklyHours";

import { loadStaffMemberForTenant } from "./staff.server";

const LONG_DAY: Record<StaffWeekdayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function dayHoursLineForKey(weekly: ReturnType<typeof parseStaffWeeklyHours>, key: StaffWeekdayKey): string | null {
  const d = weekly[key];
  if (!d || d.enabled === false) return null;
  const a = d.start?.trim();
  const b = d.end?.trim();
  if (!a || !b) return null;
  return `${a}–${b}`;
}

/**
 * Ensures `[startIso, endIso)` falls inside `fi_staff.working_hours` for the staff member's
 * `default_timezone` (Perth fallback). Does not check booking overlap (handled separately).
 */
export async function assertStaffAppointmentWithinWorkingHours(
  tenantId: string,
  staffId: string,
  startIso: string,
  endIso: string,
  client: SupabaseClient
): Promise<void> {
  const startMs = Date.parse(startIso.trim());
  const endMs = Date.parse(endIso.trim());
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new AppointmentStaffHoursError("Invalid appointment start or end time.");
  }

  const staff = await loadStaffMemberForTenant(tenantId, staffId, client);
  if (!staff) {
    throw new AppointmentStaffHoursError("That staff member could not be found for this clinic.");
  }
  if (!staff.is_active) {
    throw new AppointmentStaffHoursError(
      `${staff.full_name} is inactive and cannot be assigned to appointments. Choose another clinician or reactivate them in Staff settings.`
    );
  }
  if (!isStaffBookableForClinicalWorkflow(staff)) {
    throw new AppointmentStaffHoursError(
      `${staff.full_name} still has role “needs review”. Assign a clinical role in Staff before booking them.`
    );
  }

  const staffTz = normalizeCalendarTimezone(staff.default_timezone?.trim() || DEFAULT_STAFF_HOURS_FALLBACK_TZ);
  const tzShort = timeZoneShortLabel(staffTz, startMs);
  const weekly = parseStaffWeeklyHours(staff.working_hours);
  const summary = formatStaffWeeklyHoursSummary(weekly).trim();

  if (!summary) {
    throw new AppointmentStaffHoursError(
      `No working hours are on file for ${staff.full_name}. Add weekly hours in Staff settings (${staffTz}), then try again.`
    );
  }

  const startKey = staffWeekdayKeyFromUtcMs(startMs, staffTz);
  const endKey = staffWeekdayKeyFromUtcMs(endMs - 1, staffTz);
  if (startKey !== endKey) {
    throw new AppointmentStaffHoursError(
      `This appointment crosses midnight on ${staff.full_name}'s local calendar (${tzShort}). Keep the visit on one calendar day or adjust the times.`
    );
  }

  const dayCfg = weekly[startKey];
  if (!dayCfg || dayCfg.enabled === false) {
    throw new AppointmentStaffHoursError(
      `${staff.full_name} is not scheduled to work on ${LONG_DAY[startKey]}. Pick another day or assign someone else.`
    );
  }

  if (!isUtcRangeWithinStaffWeeklyHours(startMs, endMs, weekly, staffTz)) {
    const line = dayHoursLineForKey(weekly, startKey);
    const hoursHint = line ? `${line} (${tzShort})` : `configured hours (${tzShort})`;
    throw new AppointmentStaffHoursError(
      `That time falls outside ${staff.full_name}'s working hours on ${LONG_DAY[startKey]} (${hoursHint}). Adjust the start or end time.`
    );
  }
}
