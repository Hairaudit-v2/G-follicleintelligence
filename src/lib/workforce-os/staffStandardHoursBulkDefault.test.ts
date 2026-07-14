import assert from "node:assert/strict";
import test from "node:test";

import { defaultClinicStandardHoursWeek } from "@/src/lib/workforce-os/staffStandardHours.server";

test("defaultClinicStandardHoursWeek is Mon–Fri 08:30–17:00 with 30 minute break", () => {
  const days = defaultClinicStandardHoursWeek();
  assert.equal(days.length, 7);
  assert.equal(days.filter((d) => d.is_working_day).length, 5);
  assert.equal(days.filter((d) => !d.is_working_day).length, 2);

  for (const weekday of [0, 1, 2, 3, 4]) {
    const day = days.find((d) => d.weekday === weekday);
    assert.equal(day?.start_time, "08:30");
    assert.equal(day?.end_time, "17:00");
    assert.equal(day?.break_minutes, 30);
  }

  for (const weekday of [5, 6]) {
    const day = days.find((d) => d.weekday === weekday);
    assert.equal(day?.is_working_day, false);
  }
});
