import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fromDatetimeLocalValueInTimezone } from "@/src/lib/calendar/calendarTimezone";
import { clinicOsGridPlacementForBooking } from "./clinicOsCalendarGrid";

describe("clinicOsGridPlacementForBooking", () => {
  it("places a Perth 10:00 booking at 120 minutes from an 8:00 grid start", () => {
    const tz = "Australia/Perth";
    const dayYmd = "2026-06-10";
    const startIso = fromDatetimeLocalValueInTimezone("2026-06-10T10:00", tz);
    const endIso = fromDatetimeLocalValueInTimezone("2026-06-10T10:30", tz);
    assert.ok(startIso && endIso);

    const placement = clinicOsGridPlacementForBooking(startIso, endIso, dayYmd, 8, 18, tz);
    assert.deepEqual(placement, { startMin: 120, durationMin: 30 });
  });

  it("returns null when the booking ends before the grid opens", () => {
    const tz = "Europe/London";
    const dayYmd = "2026-01-15";
    const startIso = fromDatetimeLocalValueInTimezone("2026-01-15T07:00", tz);
    const endIso = fromDatetimeLocalValueInTimezone("2026-01-15T07:30", tz);
    assert.ok(startIso && endIso);

    const placement = clinicOsGridPlacementForBooking(startIso, endIso, dayYmd, 8, 18, tz);
    assert.equal(placement, null);
  });
});