import test from "node:test";
import assert from "node:assert/strict";

import { buildCalendarHref, parseCalendarSearchParams } from "@/src/lib/bookings/calendarQuery";
import {
  buildCalendarNavigationHref,
  updateCalendarSearchParams,
} from "@/src/lib/calendar/calendarViewNavigation";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TZ_OPTS = { calendarTimezone: "Australia/Brisbane" };

function q(
  sp: Record<string, string | string[] | undefined>,
  now = new Date("2026-06-10T12:00:00.000Z")
) {
  return parseCalendarSearchParams(sp, now, TZ_OPTS);
}

test("updateCalendarSearchParams: day → week preserves clinicId and resourceView", () => {
  const current = q({
    view: "day",
    date: "2026-06-02",
    clinicId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    resourceView: "staff",
  });
  const merged = updateCalendarSearchParams(current, { view: "week" });
  assert.equal(merged.view, "week");
  assert.equal(merged.date, "2026-06-02");
  assert.equal(merged.clinicId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  assert.equal(merged.resourceView, "staff");
});

test("updateCalendarSearchParams: week → month preserves date", () => {
  const current = q({ date: "2026-06-15" });
  assert.equal(current.view, "week");
  const merged = updateCalendarSearchParams(current, { view: "month" });
  assert.equal(merged.view, "month");
  assert.equal(merged.date, "2026-06-15");
});

test("updateCalendarSearchParams: room week → month preserves resourceView=room", () => {
  const current = q({ view: "week", resourceView: "room", date: "2026-06-01" });
  const merged = updateCalendarSearchParams(current, { view: "month" });
  assert.equal(merged.view, "month");
  assert.equal(merged.resourceView, "room");
  assert.equal(merged.date, "2026-06-01");
});

test("buildCalendarNavigationHref: month href includes view=month (does not rely on slot click)", () => {
  const current = q({ view: "day", date: "2026-06-03" });
  const href = buildCalendarNavigationHref(TENANT, current, { view: "month" });
  assert.ok(href.includes("view=month"), href);
  assert.ok(href.includes("date=2026-06-03"), href);
  assert.ok(!href.includes("quick"), href);
});

test("invalid view param parses to week; explicit month patch still applies", () => {
  const current = q({ view: "not-a-real-view", date: "2026-05-01" });
  assert.equal(current.view, "week");
  const merged = updateCalendarSearchParams(current, { view: "month" });
  assert.equal(merged.view, "month");
});

test("week canonical href omits view= but merge still encodes week for loaders that read merged object", () => {
  const current = q({ date: "2026-06-04" });
  const merged = updateCalendarSearchParams(current, { view: "week" });
  assert.equal(merged.view, "week");
  const href = buildCalendarHref(TENANT, merged);
  assert.ok(!href.includes("view="), href);
});
