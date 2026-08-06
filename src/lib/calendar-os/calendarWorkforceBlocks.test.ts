import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import { DEFAULT_BUSINESS_GRID } from "@/src/lib/calendar/operationalCalendarLayout";
import {
  calendarOsKindFromAvailabilitySource,
  deriveWorkforceBlocksForStaffRow,
} from "@/src/lib/calendar-os/calendarWorkforceBlocks";
import type { ClinicalStaffPickerOption } from "@/src/lib/team/directory";

const DAY = "2026-06-08"; // Monday

function staff(
  overrides: Partial<ClinicalStaffPickerOption> = {}
): ClinicalStaffPickerOption {
  return {
    id: "staff-1",
    full_name: "Dr Test",
    email: "a@test.com",
    fi_user_id: null,
    staff_role: "consultant",
    is_active: true,
    working_hours: {
      weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } },
    },
    clinical_readiness: {
      clinically_available: true,
      block_reason: null,
      readiness_state: "ready",
      warning_label: null,
    },
    ...overrides,
  };
}

function lane(): CalendarDayLane {
  return {
    dayKey: DAY,
    startMs: Date.parse("2026-06-08T00:00:00.000Z"),
    endMs: Date.parse("2026-06-09T00:00:00.000Z"),
    label: "Mon",
  };
}

const grid = {
  ...DEFAULT_BUSINESS_GRID,
  timeZone: "UTC",
  dayStartHourUtc: 6,
  dayEndHourUtc: 19,
};

describe("calendarOsKindFromAvailabilitySource", () => {
  it("maps canonical sources to chrome kinds", () => {
    assert.equal(calendarOsKindFromAvailabilitySource("weekly_hours"), "working_hours");
    assert.equal(calendarOsKindFromAvailabilitySource("available_override"), "available_override");
    assert.equal(calendarOsKindFromAvailabilitySource("leave"), "leave");
    assert.equal(calendarOsKindFromAvailabilitySource("sick_leave"), "sick_leave");
    assert.equal(calendarOsKindFromAvailabilitySource("unavailable"), "unavailable");
    assert.equal(calendarOsKindFromAvailabilitySource("outside_weekly_hours"), "outside_hours");
  });
});

describe("deriveWorkforceBlocksForStaffRow", () => {
  it("shows leave chrome from DB blocks using canonical explanation", () => {
    const blocks = deriveWorkforceBlocksForStaffRow({
      staff: staff(),
      dayKey: DAY,
      gridConfig: grid,
      lane: lane(),
      availabilityBlocks: [
        {
          id: "lv-1",
          block_type: "leave",
          starts_at: "2026-06-08T00:00:00.000Z",
          ends_at: "2026-06-09T00:00:00.000Z",
          status: "active",
          reason: "Annual leave",
        },
      ],
    });
    const leave = blocks.find((b) => b.id.includes("lv-1"));
    assert.ok(leave);
    assert.equal(leave!.kind, "leave");
    assert.match(leave!.label, /Leave/i);
    assert.equal(leave!.explanationSource, "leave");
  });

  it("shows sick leave chrome", () => {
    const blocks = deriveWorkforceBlocksForStaffRow({
      staff: staff(),
      dayKey: DAY,
      gridConfig: grid,
      lane: lane(),
      availabilityBlocks: [
        {
          id: "sk-1",
          block_type: "sick_leave",
          starts_at: "2026-06-08T00:00:00.000Z",
          ends_at: "2026-06-09T00:00:00.000Z",
          status: "active",
        },
      ],
    });
    const sick = blocks.find((b) => b.id.includes("sk-1"));
    assert.ok(sick);
    assert.equal(sick!.kind, "sick_leave");
    assert.match(sick!.label, /Sick leave/i);
  });

  it("shows available_override chrome with explanation", () => {
    const blocks = deriveWorkforceBlocksForStaffRow({
      staff: staff(),
      dayKey: DAY,
      gridConfig: grid,
      lane: lane(),
      availabilityBlocks: [
        {
          id: "ov-1",
          block_type: "available_override",
          starts_at: "2026-06-08T18:00:00.000Z",
          ends_at: "2026-06-08T20:00:00.000Z",
          status: "active",
          reason: "Late clinic",
        },
      ],
    });
    const ov = blocks.find((b) => b.id.includes("ov-1"));
    assert.ok(ov);
    assert.equal(ov!.kind, "available_override");
    assert.match(ov!.label, /Temporary available override/i);
    assert.ok(ov!.topPx != null);
  });

  it("shows outside normal hours bands from weekly template", () => {
    const blocks = deriveWorkforceBlocksForStaffRow({
      staff: staff(),
      dayKey: DAY,
      gridConfig: grid,
      lane: lane(),
      availabilityBlocks: [],
    });
    assert.ok(blocks.some((b) => b.kind === "outside_hours"));
    assert.ok(blocks.some((b) => b.kind === "working_hours"));
  });

  it("shows unavailable manual block", () => {
    const blocks = deriveWorkforceBlocksForStaffRow({
      staff: staff(),
      dayKey: DAY,
      gridConfig: grid,
      lane: lane(),
      availabilityBlocks: [
        {
          id: "u-1",
          block_type: "unavailable",
          starts_at: "2026-06-08T12:00:00.000Z",
          ends_at: "2026-06-08T14:00:00.000Z",
          status: "active",
        },
      ],
    });
    const u = blocks.find((b) => b.id.includes("u-1"));
    assert.ok(u);
    assert.equal(u!.kind, "unavailable");
    assert.match(u!.label, /Unavailable/i);
  });
});
