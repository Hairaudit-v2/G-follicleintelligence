import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysToCalendarDate,
  buildClinicZonedDateTime,
  calendarDateStringFromInstant,
  clinicLocalSlotToUtcIso,
  formatCalendarLongWeekdayDate,
  fromDatetimeLocalValueInTimezone,
  getCalendarTimeZone,
  isoFromLocalDayMinutes,
  localClockMinutesFromInstant,
  minutesFromLaneStart,
  resolveTenantCalendarTimezone,
  toDatetimeLocalValueInTimezone,
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
    assert.equal(
      resolveTenantCalendarTimezone({ metadata: { timezone: "Europe/Dublin" } }),
      "Europe/Dublin"
    );
  });

  it("falls back to Australia/Brisbane when tenant row is absent", () => {
    assert.equal(resolveTenantCalendarTimezone(null), "Australia/Brisbane");
  });

  it("normalizes invalid IANA to Brisbane fallback", () => {
    assert.equal(
      resolveTenantCalendarTimezone({ default_timezone: "Not/A_Real_Zone" }),
      "Australia/Brisbane"
    );
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

describe("calendarTimezone — Australia/Perth (Evolved tenant default)", () => {
  const tz = "Australia/Perth";

  it("localClockMinutesFromInstant matches noon wall time", () => {
    const ms = Date.parse("2026-06-05T04:00:00.000Z");
    assert.equal(localClockMinutesFromInstant(ms, tz), 12 * 60);
  });

  it("month-style cross-day move preserves local clock time", () => {
    const origMs = Date.parse("2026-06-05T04:00:00.000Z");
    const startMin = localClockMinutesFromInstant(origMs, tz)!;
    const startIso = isoFromLocalDayMinutes("2026-06-10", startMin, tz);
    assert.ok(startIso);
    assert.equal(localClockMinutesFromInstant(Date.parse(startIso), tz), startMin);
    assert.equal(calendarDateStringFromInstant(new Date(startIso), tz), "2026-06-10");
  });
});

describe("calendarTimezone — Australia/Brisbane wall time → UTC", () => {
  const tz = "Australia/Brisbane";

  it("10:00 local on a winter day maps to correct UTC instant", () => {
    const iso = buildClinicZonedDateTime("2026-06-10", { hour: 10, minute: 0 }, tz);
    assert.equal(iso, "2026-06-10T00:00:00.000Z");
    assert.equal(fromDatetimeLocalValueInTimezone("2026-06-10T10:00", tz), iso);
    assert.equal(fromDatetimeLocalValueInTimezone("2026-06-10T10:00:00", tz), iso);
    assert.equal(toDatetimeLocalValueInTimezone(iso!, tz), "2026-06-10T10:00");
  });

  it("clinicLocalSlotToUtcIso matches isoFromLocalDayMinutes for 10:00", () => {
    assert.equal(
      clinicLocalSlotToUtcIso("2026-06-10", 10 * 60, tz),
      isoFromLocalDayMinutes("2026-06-10", 10 * 60, tz)
    );
  });

  it("formatCalendarLongWeekdayDate uses en-GB weekday ordering", () => {
    assert.equal(formatCalendarLongWeekdayDate("2026-06-10", tz), "Wednesday, 10 June 2026");
  });
});

describe("calendarTimezone — Australia/Perth", () => {
  const tz = "Australia/Perth";

  it("10:00 local saves as UTC+8 offset in June", () => {
    const iso = buildClinicZonedDateTime("2026-06-10", { hour: 10, minute: 0 }, tz);
    assert.equal(iso, "2026-06-10T02:00:00.000Z");
    assert.equal(toDatetimeLocalValueInTimezone(iso!, tz), "2026-06-10T10:00");
  });
});

describe("calendarTimezone — getCalendarTimeZone", () => {
  it("uses clinic timezone when provided", () => {
    assert.equal(
      getCalendarTimeZone({
        clinic: { timezone: "Australia/Perth" },
        tenant: { default_timezone: "Australia/Brisbane" },
      }),
      "Australia/Perth"
    );
  });
});

describe("calendarTimezone — Europe/Melbourne DST week lanes", () => {
  const tz = "Australia/Melbourne";

  it("week lane dayKeys are seven consecutive calendar dates (no 24h ms drift)", () => {
    const lanes = buildCalendarWeek("2026-10-04", tz);
    assert.equal(lanes.length, 7);
    for (let i = 1; i < lanes.length; i++) {
      assert.equal(lanes[i]!.dayKey, addDaysToCalendarDate(lanes[i - 1]!.dayKey, 1, tz));
    }
  });
});

describe("calendarTimezone — UTC compat", () => {
  it("UTC calendar date matches legacy helper", () => {
    const d = new Date("2026-01-05T23:59:59.999Z");
    assert.equal(calendarDateStringFromInstant(d, "UTC"), "2026-01-05");
  });

  it("datetime-local round trip in explicit UTC mode", () => {
    const iso = fromDatetimeLocalValueInTimezone("2026-06-10T10:00", "UTC");
    assert.equal(iso, "2026-06-10T10:00:00.000Z");
    assert.equal(toDatetimeLocalValueInTimezone(iso!, "UTC"), "2026-06-10T10:00");
  });
});
