import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysToCalendarDate,
  calendarDateStringFromInstant,
  isoFromLocalDayMinutes,
  minutesFromLaneStart,
  resolveTenantCalendarTimezone,
  zonedMidnightUtcMs,
} from "./calendarTimezone";
import { parseCalendarSearchParams } from "@/src/lib/bookings/calendarQuery";
import { buildCalendarWeek } from "@/src/lib/bookings/calendarView";

describe("calendarTimezone — tenant resolution", () => {
  it("prefers default_timezone over metadata.timezone", () => {
    assert.equal(
      resolveTenantCalendarTimezone({
        default_timezone: "Europe/London",
        metadata: { timezone: "America/New_York" },
      }),
      "Europe/London"
    );
  });

  it("falls back to metadata.timezone", () => {
    assert.equal(resolveTenantCalendarTimezone({ metadata: { timezone: "Europe/Dublin" } }), "Europe/Dublin");
  });
});

describe("calendarTimezone — Europe/London anchors", () => {
  const tz = "Europe/London";

  it("parses search params with clinic today", () => {
    const q = parseCalendarSearchParams({}, new Date("2026-06-05T23:30:00.000Z"), {
      calendarTimezone: tz,
    });
    assert.equal(q.calendarTimezone, tz);
    assert.equal(q.dateAnchor, "2026-06-06");
  });

  it("builds week lanes on local midnights", () => {
    const lanes = buildCalendarWeek("2026-06-10", tz);
    assert.equal(lanes.length, 7);
    assert.equal(lanes[0].timeZone, tz);
    const mondayStart = zonedMidnightUtcMs("2026-06-08", tz);
    assert.equal(lanes[0].startMs, mondayStart);
  });

  it("converts local day minutes to ISO (BST)", () => {
    const iso = isoFromLocalDayMinutes("2026-06-10", 10 * 60, tz);
    assert.equal(iso, "2026-06-10T09:00:00.000Z");
  });

  it("lane-relative minutes for DnD", () => {
    const dayStart = zonedMidnightUtcMs("2026-06-10", tz)!;
    const bookingMs = Date.parse("2026-06-10T09:00:00.000Z");
    assert.equal(minutesFromLaneStart(dayStart, bookingMs), 600);
  });

  it("addDays respects DST boundaries", () => {
    assert.equal(addDaysToCalendarDate("2026-03-28", 1, tz), "2026-03-29");
  });
});

describe("calendarTimezone — UTC compat", () => {
  it("UTC calendar date matches legacy helper", () => {
    const d = new Date("2026-01-05T23:59:59.999Z");
    assert.equal(calendarDateStringFromInstant(d, "UTC"), "2026-01-05");
  });
});
