import assert from "node:assert/strict";
import test from "node:test";

import {
  getStaffAvailabilityForRange,
  serializeStaffWeeklyHours,
  type StaffAvailabilityBlockRecord,
  type StaffShiftRecord,
} from "@/src/lib/team/roster/availability";

const RANGE_START = "2026-06-08T00:30:00.000Z"; // Mon ~08:30 AWST
const RANGE_END = "2026-06-08T01:30:00.000Z";

function workingHours() {
  return serializeStaffWeeklyHours({
    mon: { enabled: true, start: "08:30", end: "17:30" },
    tue: { enabled: true, start: "08:30", end: "17:30" },
    wed: { enabled: true, start: "08:30", end: "17:30" },
    thu: { enabled: true, start: "08:30", end: "17:30" },
    fri: { enabled: true, start: "08:30", end: "17:30" },
    sat: { enabled: false },
    sun: { enabled: false },
  }) as Record<string, unknown>;
}

function block(
  overrides: Partial<StaffAvailabilityBlockRecord> &
    Pick<StaffAvailabilityBlockRecord, "block_type">
): StaffAvailabilityBlockRecord {
  return {
    id: overrides.id ?? "block-1",
    block_type: overrides.block_type,
    starts_at: overrides.starts_at ?? RANGE_START,
    ends_at: overrides.ends_at ?? RANGE_END,
    status: overrides.status ?? "active",
    reason: overrides.reason ?? null,
  };
}

function shift(overrides: Partial<StaffShiftRecord> = {}): StaffShiftRecord {
  return {
    id: overrides.id ?? "shift-1",
    shift_type: overrides.shift_type ?? "clinic",
    starts_at: overrides.starts_at ?? RANGE_START,
    ends_at: overrides.ends_at ?? RANGE_END,
    status: overrides.status ?? "scheduled",
  };
}

test("effective availability: within weekly hours", () => {
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    workingHours: workingHours(),
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [],
    shifts: [shift()],
  });
  assert.equal(result.available, true);
});

test("effective availability: leave block denies", () => {
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    workingHours: workingHours(),
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [block({ block_type: "leave", reason: "annual leave" })],
    shifts: [],
  });
  assert.equal(result.available, false);
  assert.ok(result.reasons.some((r) => r.includes("leave")));
});

test("effective availability: sick_leave block denies", () => {
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    workingHours: workingHours(),
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [block({ block_type: "sick_leave" })],
    shifts: [],
  });
  assert.equal(result.available, false);
});

test("effective availability: cancelled leave ignored", () => {
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    workingHours: workingHours(),
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [block({ block_type: "leave", status: "cancelled" })],
    shifts: [],
  });
  assert.equal(result.available, true);
});

test("effective availability: available_override allows outside weekly hours", () => {
  // Sunday 10:00–11:00 AWST — template has Sunday closed.
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: "2026-06-07T02:00:00.000Z",
    endsAt: "2026-06-07T03:00:00.000Z",
    workingHours: workingHours(),
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [
      block({
        block_type: "available_override",
        starts_at: "2026-06-07T01:00:00.000Z",
        ends_at: "2026-06-07T04:00:00.000Z",
      }),
    ],
    shifts: [],
  });
  assert.equal(result.available, true);
});

test("effective availability: override does not bypass leave", () => {
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    workingHours: workingHours(),
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [
      block({ id: "ov", block_type: "available_override" }),
      block({ id: "lv", block_type: "leave" }),
    ],
    shifts: [],
  });
  assert.equal(result.available, false);
});

test("effective availability: empty weekly hours deny without override", () => {
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    workingHours: {},
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [],
    shifts: [],
  });
  assert.equal(result.available, false);
});

test("effective availability: empty weekly hours allow with override", () => {
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    workingHours: {},
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [block({ block_type: "available_override" })],
    shifts: [],
  });
  assert.equal(result.available, true);
  assert.equal(result.explanation.source, "available_override");
  assert.equal(result.explanation.overrideType, "available_override");
});

test("effective availability: explanation for weekly hours", () => {
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    workingHours: workingHours(),
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [],
    shifts: [],
  });
  assert.equal(result.explanation.available, true);
  assert.equal(result.explanation.source, "weekly_hours");
  assert.equal(result.explanation.reason, "Normal weekly hours");
});

test("effective availability: explanation for leave includes blocking id", () => {
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    workingHours: workingHours(),
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [block({ id: "leave-99", block_type: "leave", reason: "annual leave" })],
    shifts: [],
  });
  assert.equal(result.explanation.available, false);
  assert.equal(result.explanation.source, "leave");
  assert.equal(result.explanation.blockingRecordId, "leave-99");
  assert.match(result.explanation.reason, /annual leave/);
});

test("effective availability: explanation for outside weekly hours", () => {
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: "2026-06-07T02:00:00.000Z",
    endsAt: "2026-06-07T03:00:00.000Z",
    workingHours: workingHours(),
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [],
    shifts: [],
  });
  assert.equal(result.explanation.available, false);
  assert.equal(result.explanation.source, "outside_weekly_hours");
});
