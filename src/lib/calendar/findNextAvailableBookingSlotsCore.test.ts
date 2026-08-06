import assert from "node:assert/strict";
import test from "node:test";

import { isCandidateSlotWithinStaffEffectiveAvailability } from "@/src/lib/calendar/findNextAvailableBookingSlotsCore";
import {
  serializeStaffWeeklyHours,
  type StaffAvailabilityBlockRecord,
} from "@/src/lib/team/roster/availability";

const START = "2026-06-08T00:30:00.000Z"; // Mon ~08:30 AWST
const END = "2026-06-08T01:30:00.000Z";

function weekly() {
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
    id: overrides.id ?? "b1",
    block_type: overrides.block_type,
    starts_at: overrides.starts_at ?? START,
    ends_at: overrides.ends_at ?? END,
    status: overrides.status ?? "active",
    reason: overrides.reason ?? null,
  };
}

test("slot finder core: weekly hours allow", () => {
  assert.equal(
    isCandidateSlotWithinStaffEffectiveAvailability({
      staffId: "s1",
      startIso: START,
      endIso: END,
      workingHours: weekly(),
      staffTimezone: "Australia/Perth",
      availabilityBlocks: [],
    }),
    true
  );
});

test("slot finder core: leave blocks suggestion", () => {
  assert.equal(
    isCandidateSlotWithinStaffEffectiveAvailability({
      staffId: "s1",
      startIso: START,
      endIso: END,
      workingHours: weekly(),
      staffTimezone: "Australia/Perth",
      availabilityBlocks: [block({ block_type: "leave" })],
    }),
    false
  );
});

test("slot finder core: sick_leave blocks suggestion", () => {
  assert.equal(
    isCandidateSlotWithinStaffEffectiveAvailability({
      staffId: "s1",
      startIso: START,
      endIso: END,
      workingHours: weekly(),
      staffTimezone: "Australia/Perth",
      availabilityBlocks: [block({ block_type: "sick_leave" })],
    }),
    false
  );
});

test("slot finder core: unavailable blocks suggestion", () => {
  assert.equal(
    isCandidateSlotWithinStaffEffectiveAvailability({
      staffId: "s1",
      startIso: START,
      endIso: END,
      workingHours: weekly(),
      staffTimezone: "Australia/Perth",
      availabilityBlocks: [block({ block_type: "unavailable" })],
    }),
    false
  );
});

test("slot finder core: available_override allows outside weekly template", () => {
  assert.equal(
    isCandidateSlotWithinStaffEffectiveAvailability({
      staffId: "s1",
      startIso: "2026-06-07T02:00:00.000Z",
      endIso: "2026-06-07T03:00:00.000Z",
      workingHours: weekly(),
      staffTimezone: "Australia/Perth",
      availabilityBlocks: [
        block({
          block_type: "available_override",
          starts_at: "2026-06-07T01:00:00.000Z",
          ends_at: "2026-06-07T04:00:00.000Z",
        }),
      ],
    }),
    true
  );
});

test("slot finder core: leave wins over available_override", () => {
  assert.equal(
    isCandidateSlotWithinStaffEffectiveAvailability({
      staffId: "s1",
      startIso: START,
      endIso: END,
      workingHours: weekly(),
      staffTimezone: "Australia/Perth",
      availabilityBlocks: [
        block({ id: "ov", block_type: "available_override" }),
        block({ id: "lv", block_type: "leave" }),
      ],
    }),
    false
  );
});
