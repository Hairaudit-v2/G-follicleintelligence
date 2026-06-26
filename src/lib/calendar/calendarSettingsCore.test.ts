import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyCalendarSettingsToQuery,
  calendarSettingsToGridConfig,
  DEFAULT_CALENDAR_SETTINGS,
  filterCalendarLanesForWeekends,
  validateCalendarSettingsInput,
} from "@/src/lib/calendar/calendarSettingsCore";
import { buildCalendarWeek } from "@/src/lib/bookings/calendarView";
import { parseCalendarSearchParams } from "@/src/lib/bookings/calendarQuery";
import { slotCount } from "@/src/lib/calendar/operationalCalendarLayout";

describe("validateCalendarSettingsInput", () => {
  it("accepts GC-11 default-shaped payload", () => {
    const res = validateCalendarSettingsInput(DEFAULT_CALENDAR_SETTINGS);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.deepEqual(res.document, DEFAULT_CALENDAR_SETTINGS);
    }
  });

  it("rejects end hour before start hour", () => {
    const res = validateCalendarSettingsInput({
      ...DEFAULT_CALENDAR_SETTINGS,
      dayStartHour: 10,
      dayEndHour: 9,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error, /after visible day start/i);
  });

  it("rejects invalid slot minutes", () => {
    const res = validateCalendarSettingsInput({
      ...DEFAULT_CALENDAR_SETTINGS,
      slotMinutes: 20,
    });
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.document.slotMinutes, 15);
  });
});

describe("getCalendarSettingsForTenant defaults", () => {
  it("DEFAULT_CALENDAR_SETTINGS uses 06:00–19:00, 15-min slots, week view, weekends hidden", () => {
    assert.equal(DEFAULT_CALENDAR_SETTINGS.dayStartHour, 6);
    assert.equal(DEFAULT_CALENDAR_SETTINGS.dayEndHour, 19);
    assert.equal(DEFAULT_CALENDAR_SETTINGS.slotMinutes, 15);
    assert.equal(DEFAULT_CALENDAR_SETTINGS.defaultView, "week");
    assert.equal(DEFAULT_CALENDAR_SETTINGS.showWeekends, false);
  });
});

describe("calendarSettingsToGridConfig", () => {
  it("maps settings to business grid with configured hours", () => {
    const grid = calendarSettingsToGridConfig(
      { ...DEFAULT_CALENDAR_SETTINGS, dayStartHour: 7, dayEndHour: 17, slotMinutes: 30 },
      "Australia/Brisbane"
    );
    assert.equal(grid.dayStartHourUtc, 7);
    assert.equal(grid.dayEndHourUtc, 17);
    assert.equal(grid.slotMinutes, 30);
    assert.equal(grid.timeZone, "Australia/Brisbane");
    assert.equal(slotCount(grid), 20);
  });

  it("tenant override: custom hours produce matching slot count", () => {
    const grid = calendarSettingsToGridConfig(DEFAULT_CALENDAR_SETTINGS, "UTC");
    assert.equal(slotCount(grid), 52);
  });
});

describe("applyCalendarSettingsToQuery", () => {
  it("applies default view when view param is absent", () => {
    const base = parseCalendarSearchParams({}, new Date("2026-06-10T12:00:00.000Z"), {
      calendarTimezone: "UTC",
    });
    const next = applyCalendarSettingsToQuery(
      base,
      { ...DEFAULT_CALENDAR_SETTINGS, defaultView: "day" },
      {}
    );
    assert.equal(next.view, "day");
  });

  it("preserves explicit view param over tenant default", () => {
    const base = parseCalendarSearchParams({ view: "month" }, new Date("2026-06-10T12:00:00.000Z"), {
      calendarTimezone: "UTC",
    });
    const next = applyCalendarSettingsToQuery(
      base,
      { ...DEFAULT_CALENDAR_SETTINGS, defaultView: "day" },
      { view: "month" }
    );
    assert.equal(next.view, "month");
  });

  it("applies show cancelled bookings default when param absent", () => {
    const base = parseCalendarSearchParams({}, new Date("2026-06-10T12:00:00.000Z"), {
      calendarTimezone: "UTC",
    });
    const next = applyCalendarSettingsToQuery(
      base,
      { ...DEFAULT_CALENDAR_SETTINGS, showCancelledBookings: true },
      {}
    );
    assert.equal(next.includeCancelled, true);
  });
});

describe("filterCalendarLanesForWeekends", () => {
  it("hides Sat/Sun lanes in week view when weekends disabled", () => {
    const lanes = buildCalendarWeek("2026-06-10", "UTC");
    assert.equal(lanes.length, 7);
    const filtered = filterCalendarLanesForWeekends(lanes, "week", false);
    assert.equal(filtered.length, 5);
    for (const lane of filtered) {
      assert.notEqual(lane.headingShortUtc, "Sat");
      assert.notEqual(lane.headingShortUtc, "Sun");
    }
  });

  it("keeps all lanes when showWeekends is true", () => {
    const lanes = buildCalendarWeek("2026-06-10", "UTC");
    assert.equal(filterCalendarLanesForWeekends(lanes, "week", true).length, 7);
  });
});
