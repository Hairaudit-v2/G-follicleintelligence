import assert from "node:assert/strict";
import { test } from "node:test";

import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import { computeOperationalLocalDayUtcWindow } from "@/src/lib/fiOs/tenantOperationalLocalDay";

test("computeOperationalLocalDayUtcWindow: local bounds align with operational calendar day (NYC)", () => {
  const tz = "America/New_York";
  const now = new Date("2026-03-10T05:30:00.000Z");
  const w = computeOperationalLocalDayUtcWindow(now, tz);
  const ymd = calendarDateStringFromInstant(now, tz);

  assert.equal(w.todayYmd, ymd);
  assert.equal(calendarDateStringFromInstant(new Date(w.localStartIso), tz), ymd);
  assert.ok(Date.parse(w.localEndIso) > Date.parse(w.localStartIso));
  const spanHours = (Date.parse(w.localEndIso) - Date.parse(w.localStartIso)) / 3_600_000;
  assert.ok(spanHours >= 23 && spanHours <= 25, `expected ~24h span, got ${spanHours}h`);
});

test("computeOperationalLocalDayUtcWindow: matches new-leads-today half-open window [start, end)", () => {
  const tz = "Australia/Brisbane";
  const now = new Date("2026-06-15T14:00:00.000Z");
  const w = computeOperationalLocalDayUtcWindow(now, tz);
  const ymd = calendarDateStringFromInstant(now, tz);
  assert.equal(w.todayYmd, ymd);
  assert.equal(calendarDateStringFromInstant(new Date(Date.parse(w.localEndIso) - 1), tz), ymd);
  assert.notEqual(calendarDateStringFromInstant(new Date(w.localEndIso), tz), ymd);
});
