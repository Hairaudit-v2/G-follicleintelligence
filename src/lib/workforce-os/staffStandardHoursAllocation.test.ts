/**
 * End-to-end allocation bridge: fi_staff_standard_hours → fi_staff.working_hours JSONB
 * → CalendarOS picker readiness + slot validation.
 *
 * Appointment allocation does NOT read fi_staff_standard_hours or fi_staff_shifts directly;
 * saveStaffStandardHours syncs standard hours into working_hours for engine compatibility.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildClinicalStaffPickerReadiness,
  canSelectStaffForClinicalPicker,
  enrichCrmShellStaffPickerOption,
} from "@/src/lib/staff/clinicalStaffPicker";
import { buildStaffHrNotificationNoLinkSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import {
  isUtcRangeWithinStaffWeeklyHours,
  parseStaffWeeklyHours,
  serializeStaffWeeklyHours,
} from "@/src/lib/staff/staffWeeklyHours";
import { localWallTimeToUtcRange } from "@/src/lib/workforce-os/rosterGenerationCore";
import {
  applyStandardHoursTemplate,
  standardHoursToWeeklyHoursMap,
  weeklyHoursMapToStandardHours,
} from "@/src/lib/workforce-os/staffStandardHoursCore";

const STAFF_TZ = "Australia/Perth";
const FRESH_HR = buildStaffHrNotificationNoLinkSummary();

/** Simulates syncLegacyWorkingHoursJson after saveStaffStandardHours. */
function syncedWorkingHoursFromFourTenTemplate(): Record<string, unknown> {
  const days = applyStandardHoursTemplate("four_ten");
  const weekly = standardHoursToWeeklyHoursMap(days);
  return serializeStaffWeeklyHours(weekly) as Record<string, unknown>;
}

test("four_ten standard hours sync enables Mon/Tue/Thu/Fri and marks Wed as RDO", () => {
  const days = applyStandardHoursTemplate("four_ten");
  const weekly = standardHoursToWeeklyHoursMap(days);

  assert.equal(weekly.mon?.enabled, true);
  assert.equal(weekly.mon?.start, "07:30");
  assert.equal(weekly.mon?.end, "17:30");
  assert.equal(weekly.tue?.enabled, true);
  assert.equal(weekly.wed?.enabled, false);
  assert.equal(weekly.thu?.enabled, true);
  assert.equal(weekly.fri?.enabled, true);
  assert.equal(days.find((d) => d.weekday === 2)?.is_working_day, false);
});

test("synced four_ten working_hours makes Anna selectable in clinical picker when HR ready", () => {
  const workingHours = syncedWorkingHoursFromFourTenTemplate();
  const option = enrichCrmShellStaffPickerOption(
    {
      id: "anna",
      email: "anna@example.com",
      full_name: "Anna",
      staff_role: "consultant",
      is_active: true,
      working_hours: workingHours,
    },
    FRESH_HR
  );

  assert.equal(canSelectStaffForClinicalPicker(option), true);
  assert.equal(option.clinical_readiness.clinically_available, true);
});

test("without synced working_hours Anna is blocked from clinical picker (original blocker)", () => {
  const readiness = buildClinicalStaffPickerReadiness({
    full_name: "Anna",
    staff_role: "consultant",
    is_active: true,
    working_hours: {},
    hr: FRESH_HR,
  });
  assert.equal(readiness.clinically_available, false);
  assert.match(readiness.block_reason ?? "", /working hours/i);
});

test("Monday 10:00 consultation fits synced four_ten hours; Wednesday 10:00 does not", () => {
  const weekly = parseStaffWeeklyHours(syncedWorkingHoursFromFourTenTemplate());

  const mondaySlot = localWallTimeToUtcRange("2026-07-06", "10:00", "10:30", STAFF_TZ);
  const wednesdaySlot = localWallTimeToUtcRange("2026-07-08", "10:00", "10:30", STAFF_TZ);

  assert.equal(
    isUtcRangeWithinStaffWeeklyHours(
      Date.parse(mondaySlot.startsAt),
      Date.parse(mondaySlot.endsAt),
      weekly,
      STAFF_TZ
    ),
    true
  );
  assert.equal(
    isUtcRangeWithinStaffWeeklyHours(
      Date.parse(wednesdaySlot.startsAt),
      Date.parse(wednesdaySlot.endsAt),
      weekly,
      STAFF_TZ
    ),
    false
  );
});

test("weeklyHoursMap round-trip preserves four_ten working pattern", () => {
  const days = applyStandardHoursTemplate("four_ten");
  const weekly = standardHoursToWeeklyHoursMap(days);
  const roundTripped = weeklyHoursMapToStandardHours(weekly);

  for (const weekday of [0, 1, 3, 4]) {
    const day = roundTripped.find((d) => d.weekday === weekday);
    assert.ok(day?.is_working_day);
    assert.equal(day?.start_time, "07:30");
    assert.equal(day?.end_time, "17:30");
  }
  const wed = roundTripped.find((d) => d.weekday === 2);
  assert.equal(wed?.is_working_day, false);
});
