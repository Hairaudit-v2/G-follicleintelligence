import "server-only";

/**
 * Bookings — appointment slot availability gate.
 *
 * Owns the final allow/deny for assigning a staff member to an appointment window.
 * Composes:
 * - Team Directory clinical bookability (active + role)
 * - Team Roster effective availability (weekly template + blocks/overrides)
 *
 * Does not own weekly-hours parsing or availability-block precedence.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { isStaffBookableForClinicalWorkflow } from "@/src/lib/team/directory";
import { normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { AppointmentStaffHoursError } from "@/src/lib/bookings/bookingErrors";
import {
  BLOCKING_AVAILABILITY_BLOCK_TYPES,
  DEFAULT_STAFF_HOURS_FALLBACK_TZ,
  formatStaffWeeklyHoursSummary,
  getStaffAvailabilityForRange,
  isUtcRangeWithinStaffWeeklyHours,
  parseStaffWeeklyHours,
  staffWeekdayKeyFromUtcMs,
  timeZoneShortLabel,
  type StaffAvailabilityBlockRecord,
  type StaffWeekdayKey,
} from "@/src/lib/team/roster/availability";
import { loadStaffMemberForTenant } from "@/src/lib/staff/staff.server";

const LONG_DAY: Record<StaffWeekdayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function dayHoursLineForKey(
  weekly: ReturnType<typeof parseStaffWeeklyHours>,
  key: StaffWeekdayKey
): string | null {
  const d = weekly[key];
  if (!d || d.enabled === false) return null;
  const a = d.start?.trim();
  const b = d.end?.trim();
  if (!a || !b) return null;
  return `${a}–${b}`;
}

function mapAvailabilityBlock(row: Record<string, unknown>): StaffAvailabilityBlockRecord {
  return {
    id: String(row.id ?? ""),
    block_type: row.block_type as StaffAvailabilityBlockRecord["block_type"],
    starts_at: String(row.starts_at ?? ""),
    ends_at: String(row.ends_at ?? ""),
    status: (row.status as StaffAvailabilityBlockRecord["status"]) || "active",
    reason: (row.reason as string | null | undefined) ?? null,
  };
}

async function loadActiveAvailabilityBlocksForStaffRange(
  tenantId: string,
  staffId: string,
  startIso: string,
  endIso: string,
  client: SupabaseClient
): Promise<StaffAvailabilityBlockRecord[]> {
  const { data, error } = await client
    .from("fi_staff_availability_blocks")
    .select("id, block_type, starts_at, ends_at, status, reason")
    .eq("tenant_id", tenantId)
    .eq("staff_id", staffId)
    .eq("status", "active")
    .lt("starts_at", endIso)
    .gt("ends_at", startIso);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapAvailabilityBlock(r as Record<string, unknown>));
}

function blockingBlockLabel(blockType: string): string {
  return blockType.replace(/_/g, " ");
}

/**
 * Ensures `[startIso, endIso)` is bookable for the staff member:
 * directory bookability + roster effective availability (weekly OR available_override,
 * not blocked by leave/sick/unavailable/etc.). Does not check booking overlap.
 */
export async function assertStaffAppointmentWithinWorkingHours(
  tenantId: string,
  staffId: string,
  startIso: string,
  endIso: string,
  client: SupabaseClient
): Promise<void> {
  const startTrim = startIso.trim();
  const endTrim = endIso.trim();
  const startMs = Date.parse(startTrim);
  const endMs = Date.parse(endTrim);
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

  const staffTz = normalizeCalendarTimezone(
    staff.default_timezone?.trim() || DEFAULT_STAFF_HOURS_FALLBACK_TZ
  );
  const tzShort = timeZoneShortLabel(staffTz, startMs);
  const weekly = parseStaffWeeklyHours(staff.working_hours);
  const summary = formatStaffWeeklyHoursSummary(weekly).trim();

  const blocks = await loadActiveAvailabilityBlocksForStaffRange(
    tenantId,
    staffId,
    startTrim,
    endTrim,
    client
  );

  const effective = getStaffAvailabilityForRange({
    staffId,
    startsAt: startTrim,
    endsAt: endTrim,
    workingHours: staff.working_hours,
    staffTimezone: staffTz,
    availabilityBlocks: blocks,
    shifts: [],
  });

  const hasOverride = effective.activeBlocks.some((b) => b.block_type === "available_override");
  const blocking = effective.activeBlocks.filter((b) =>
    (BLOCKING_AVAILABILITY_BLOCK_TYPES as readonly string[]).includes(b.block_type)
  );

  if (blocking.length > 0) {
    const primary = blocking[0]!;
    const kind = blockingBlockLabel(primary.block_type);
    const reason = primary.reason?.trim();
    throw new AppointmentStaffHoursError(
      reason
        ? `${staff.full_name} is unavailable (${kind}: ${reason}). Pick another time or clinician.`
        : `${staff.full_name} has an active ${kind} block covering that time. Pick another time or clinician.`
    );
  }

  if (!summary && !hasOverride) {
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

  if (effective.available) {
    return;
  }

  if (!hasOverride) {
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

  throw new AppointmentStaffHoursError(
    `${staff.full_name} is not available for that appointment window. Adjust the time or add a roster override.`
  );
}
