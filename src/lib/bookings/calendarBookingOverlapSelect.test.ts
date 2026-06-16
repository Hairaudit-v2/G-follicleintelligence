import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CALENDAR_VIEW_BOOKINGS_LIMIT } from "@/src/lib/bookings/operatorBookingConstants";
import { FI_BOOKINGS_CALENDAR_OVERLAP_SELECT } from "./calendarBookingOverlapSelect";

describe("FI_BOOKINGS_CALENDAR_OVERLAP_SELECT", () => {
  it("never uses select('*') — explicit column projection for calendar overlap reads", () => {
    assert.notEqual(FI_BOOKINGS_CALENDAR_OVERLAP_SELECT.trim(), "*");
    assert.ok(!FI_BOOKINGS_CALENDAR_OVERLAP_SELECT.includes("*"));
    assert.ok(FI_BOOKINGS_CALENDAR_OVERLAP_SELECT.includes("tenant_id"));
    assert.ok(FI_BOOKINGS_CALENDAR_OVERLAP_SELECT.includes("start_at"));
    assert.ok(FI_BOOKINGS_CALENDAR_OVERLAP_SELECT.includes("end_at"));
  });
});

describe("CALENDAR_VIEW_BOOKINGS_LIMIT", () => {
  it("matches the default cap applied in loadBookingsForCalendarOverlap (Postgres LIMIT)", () => {
    assert.equal(CALENDAR_VIEW_BOOKINGS_LIMIT, 800);
  });
});
