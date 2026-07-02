import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveCalendarEmptySlotClick } from "./calendarEmptySlotClick";
import type { BusinessGridConfig } from "./operationalCalendarLayout";

const gridConfig: BusinessGridConfig = {
  dayStartHourUtc: 8,
  dayEndHourUtc: 18,
  slotMinutes: 15,
  timeZone: "Australia/Sydney",
};

describe("resolveCalendarEmptySlotClick", () => {
  it("snaps click Y to clinic-local datetime-local prefill", () => {
    const pxPerMinute = 56 / 60;
    const nineAmOffsetPx = 60 * pxPerMinute;

    const result = resolveCalendarEmptySlotClick({
      dayKey: "2026-07-03",
      columnId: "s:staff-1",
      clientY: nineAmOffsetPx,
      targetRect: { top: 0 },
      gridConfig,
      pxPerMinute,
    });

    assert.ok(result);
    assert.equal(result!.dayKey, "2026-07-03");
    assert.equal(result!.columnId, "s:staff-1");
    assert.match(result!.localStart, /^2026-07-03T09:00$/);
  });

  it("returns null when pxPerMinute is invalid", () => {
    assert.equal(
      resolveCalendarEmptySlotClick({
        dayKey: "2026-07-03",
        columnId: "s:staff-1",
        clientY: 100,
        targetRect: { top: 0 },
        gridConfig,
        pxPerMinute: 0,
      }),
      null
    );
  });
});
