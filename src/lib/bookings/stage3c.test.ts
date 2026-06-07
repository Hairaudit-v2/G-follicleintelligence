import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bookingTypeCalendarEventClasses, formatCalendarRangeTitle } from "./calendarLabels";
import {
  buildCalendarHref,
  calendarRangeIsoForQuery,
  calendarVisibleUtcRangeMs,
  mergeCalendarHrefQuery,
  parseCalendarRangeOverride,
  parseCalendarSearchParams,
  parseUtcCalendarDateString,
  utcCalendarDateStringFromDate,
} from "./calendarQuery";
import {
  addUtcDaysToCalendarDate,
  bucketBookingsIntoCalendar,
  buildCalendarDay,
  buildCalendarThreeDay,
  buildCalendarWeek,
  calendarNavigationHelpers,
  layoutBookingUtcDayColumn,
  utcHourSlotIsoRange,
} from "./calendarView";
import type { FiBookingRow } from "./types";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function row(p: Partial<FiBookingRow> & Pick<FiBookingRow, "id">): FiBookingRow {
  return {
    tenant_id: TID,
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: null,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: "consultation",
    booking_status: "scheduled",
    title: null,
    description: null,
    start_at: "2026-06-01T10:00:00.000Z",
    end_at: "2026-06-01T11:00:00.000Z",
    timezone: null,
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

describe("Stage 3C — calendar query & URL", () => {
  it("parses role=doctor|nurse into staffRoleBucket", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    assert.equal(parseCalendarSearchParams({ role: "doctor" }, now).staffRoleBucket, "doctor");
    assert.equal(parseCalendarSearchParams({ role: "NURSE" }, now).staffRoleBucket, "nurse");
    assert.equal(parseCalendarSearchParams({ role: "x" }, now).staffRoleBucket, null);
  });

  it("mergeCalendarHrefQuery clears staffId when setting role bucket", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const q = parseCalendarSearchParams({ staffId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "doctor" }, now);
    assert.equal(q.staffId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const merged = mergeCalendarHrefQuery(q, { role: "doctor", staffId: null });
    assert.equal(merged.staffId, undefined);
    assert.equal(merged.role, "doctor");
  });

  it("parses calendar search params with week default and UTC date anchor", () => {
    const now = new Date("2026-06-05T12:00:00.000Z");
    const q = parseCalendarSearchParams({}, now);
    assert.equal(q.view, "week");
    assert.equal(q.dateAnchor, "2026-06-05");
    assert.equal(q.calendarTimezone, "UTC");
    assert.equal(q.includeCancelled, false);
    assert.equal(q.search, null);
    assert.equal(q.sampleMode, false);
  });

  it("parses sample=1 as sampleMode", () => {
    const q = parseCalendarSearchParams({ sample: "1" }, new Date("2026-06-01T00:00:00.000Z"));
    assert.equal(q.sampleMode, true);
  });

  it("parses search q param", () => {
    const q = parseCalendarSearchParams({ q: "Jordan" }, new Date("2026-06-01T00:00:00.000Z"));
    assert.equal(q.search, "Jordan");
  });

  it("buildCalendarHref preserves filters and omits default week view", () => {
    const href = buildCalendarHref("tenant-uuid", {
      date: "2026-06-10",
      view: "day",
      type: "prp",
      includeCancelled: true,
    });
    assert.ok(href.includes("view=day"));
    assert.ok(href.includes("date=2026-06-10"));
    assert.ok(href.includes("type=prp"));
    assert.ok(href.includes("includeCancelled=1"));
    const weekOnly = buildCalendarHref("tenant-uuid", { date: "2026-06-01" });
    assert.ok(!weekOnly.includes("view="));
  });

  it("mergeCalendarHrefQuery overlays partial patch", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const q = parseCalendarSearchParams({ type: "surgery", assignedUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, now);
    const merged = mergeCalendarHrefQuery(q, calendarNavigationHelpers.goToToday(new Date("2026-06-09T00:00:00.000Z")));
    assert.equal(merged.date, "2026-06-09");
    assert.equal(merged.view, "week");
    assert.equal(merged.type, "surgery");
  });

  it("mergeCalendarHrefQuery preserves sample=1 when navigating", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const q = parseCalendarSearchParams({ sample: "1", type: "prp" }, now);
    const merged = mergeCalendarHrefQuery(q, calendarNavigationHelpers.goToToday(new Date("2026-06-09T00:00:00.000Z")));
    assert.equal(merged.date, "2026-06-09");
    assert.equal(merged.sample, true);
    assert.equal(merged.type, "prp");
  });

  it("parseCalendarRangeOverride accepts valid start/end override", () => {
    const fb = { rangeStartIso: "2026-01-01T00:00:00.000Z", rangeEndIso: "2026-01-02T00:00:00.000Z" };
    const r = parseCalendarRangeOverride(
      { start: "2026-03-01T00:00:00.000Z", end: "2026-03-10T00:00:00.000Z" },
      fb
    );
    assert.equal(r.rangeStartIso, "2026-03-01T00:00:00.000Z");
    assert.equal(r.rangeEndIso, "2026-03-10T00:00:00.000Z");
  });

  it("parseCalendarRangeOverride rejects invalid range", () => {
    const fb = { rangeStartIso: "2026-01-01T00:00:00.000Z", rangeEndIso: "2026-01-02T00:00:00.000Z" };
    const r = parseCalendarRangeOverride(
      { start: "2026-03-10T00:00:00.000Z", end: "2026-03-01T00:00:00.000Z" },
      fb
    );
    assert.deepEqual(r, fb);
  });
});

describe("Stage 3C — visible range & week boundaries (UTC)", () => {
  it("day view covers single UTC day", () => {
    const q = parseCalendarSearchParams({ view: "day", date: "2026-06-10" }, new Date("2026-01-01T00:00:00.000Z"));
    const { rangeStartMs, rangeEndMs } = calendarVisibleUtcRangeMs(q);
    assert.equal(rangeEndMs - rangeStartMs, 86400000);
    assert.equal(new Date(rangeStartMs).toISOString(), "2026-06-10T00:00:00.000Z");
  });

  it("week view is Monday 00:00 UTC through the following Monday (exclusive)", () => {
    const q = parseCalendarSearchParams({ view: "week", date: "2026-06-04" }, new Date("2026-01-01T00:00:00.000Z"));
    const { rangeStartIso, rangeEndIso } = calendarRangeIsoForQuery(q);
    assert.equal(rangeStartIso, "2026-06-01T00:00:00.000Z");
    assert.equal(rangeEndIso, "2026-06-08T00:00:00.000Z");
  });

  it("buildCalendarWeek returns seven lanes starting Monday", () => {
    const lanes = buildCalendarWeek("2026-06-04");
    assert.equal(lanes.length, 7);
    assert.equal(lanes[0].dayKey, "2026-06-01");
    assert.equal(lanes[6].dayKey, "2026-06-07");
  });

  it("buildCalendarDay returns one lane", () => {
    const lanes = buildCalendarDay("2026-06-10");
    assert.equal(lanes.length, 1);
    assert.equal(lanes[0].dayKey, "2026-06-10");
  });

  it("3day view covers three UTC days from anchor", () => {
    const q = parseCalendarSearchParams({ view: "3day", date: "2026-06-10" }, new Date("2026-01-01T00:00:00.000Z"));
    const { rangeStartMs, rangeEndMs } = calendarVisibleUtcRangeMs(q);
    assert.equal(rangeEndMs - rangeStartMs, 3 * 86400000);
    assert.equal(new Date(rangeStartMs).toISOString(), "2026-06-10T00:00:00.000Z");
  });

  it("buildCalendarThreeDay returns three consecutive lanes", () => {
    const lanes = buildCalendarThreeDay("2026-06-10");
    assert.equal(lanes.length, 3);
    assert.equal(lanes[0].dayKey, "2026-06-10");
    assert.equal(lanes[2].dayKey, "2026-06-12");
  });
});

describe("Stage 3C — navigation helpers", () => {
  it("shifts day anchor by one for day view", () => {
    const q = parseCalendarSearchParams({ view: "day", date: "2026-06-10" }, new Date("2026-01-01T00:00:00.000Z"));
    const prev = calendarNavigationHelpers.previousPeriod(q);
    assert.equal(prev.date, "2026-06-09");
    const next = calendarNavigationHelpers.nextPeriod(q);
    assert.equal(next.date, "2026-06-11");
  });

  it("shifts week anchor by seven for week view", () => {
    const q = parseCalendarSearchParams({ view: "week", date: "2026-06-04" }, new Date("2026-01-01T00:00:00.000Z"));
    const prev = calendarNavigationHelpers.previousPeriod(q);
    assert.equal(prev.date, "2026-05-28");
  });

  it("addUtcDaysToCalendarDate rolls month correctly", () => {
    assert.equal(addUtcDaysToCalendarDate("2026-06-30", 1), "2026-07-01");
  });
});

describe("Stage 3C — bucketing & layout", () => {
  it("bucketBookingsIntoCalendar places overlapping rows in correct day buckets", () => {
    const lanes = buildCalendarWeek("2026-06-04");
    const bookings = [
      row({
        id: "a",
        start_at: "2026-06-02T22:00:00.000Z",
        end_at: "2026-06-03T02:00:00.000Z",
      }),
      row({ id: "b", start_at: "2026-06-07T12:00:00.000Z", end_at: "2026-06-07T13:00:00.000Z" }),
    ];
    const map = bucketBookingsIntoCalendar(bookings, lanes);
    assert.equal((map.get("2026-06-02") ?? []).some((x) => x.id === "a"), true);
    assert.equal((map.get("2026-06-03") ?? []).some((x) => x.id === "a"), true);
    assert.equal((map.get("2026-06-08") ?? []).length, 0);
    assert.equal((map.get("2026-06-07") ?? []).length, 1);
  });

  it("layoutBookingUtcDayColumn clamps to lane bounds", () => {
    const lane = buildCalendarDay("2026-06-10")[0];
    const b = row({
      id: "x",
      start_at: "2026-06-09T20:00:00.000Z",
      end_at: "2026-06-10T04:00:00.000Z",
    });
    const layout = layoutBookingUtcDayColumn(b, lane);
    assert.ok(layout && layout.topPx === 0);
    assert.ok(layout && layout.heightPx > 40);
  });

  it("utcHourSlotIsoRange returns one-hour window", () => {
    const s = utcHourSlotIsoRange("2026-06-10", 14);
    assert.ok(s);
    assert.equal(s.startIso, "2026-06-10T14:00:00.000Z");
    assert.equal(s.endIso, "2026-06-10T15:00:00.000Z");
  });
});

describe("Stage 3C — labels", () => {
  it("formatCalendarRangeTitle for week spans", () => {
    const lanes = buildCalendarWeek("2026-06-04");
    const t = formatCalendarRangeTitle("week", lanes);
    assert.ok(t.includes("June"));
    assert.ok(t.includes("2026"));
  });

  it("bookingTypeCalendarEventClasses returns theme-token class strings", () => {
    const c = bookingTypeCalendarEventClasses("consultation");
    assert.ok(c.includes("primary"));
    assert.ok(!c.includes("#"));
  });
});

describe("Stage 3C — date parsing edge cases", () => {
  it("parseUtcCalendarDateString rejects invalid calendar dates", () => {
    assert.equal(parseUtcCalendarDateString("2026-02-30"), null);
    assert.equal(parseUtcCalendarDateString("bad"), null);
  });

  it("utcCalendarDateStringFromDate is stable for known instant", () => {
    assert.equal(utcCalendarDateStringFromDate(new Date("2026-01-05T23:59:59.999Z")), "2026-01-05");
  });
});
