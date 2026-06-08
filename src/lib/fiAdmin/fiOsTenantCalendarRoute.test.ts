import test from "node:test";
import assert from "node:assert/strict";

import { isFiOsTenantCalendarPath } from "@/src/lib/fiAdmin/fiOsTenantCalendarRoute";

test("isFiOsTenantCalendarPath matches tenant calendar and nested routes", () => {
  assert.equal(isFiOsTenantCalendarPath("/fi-admin/t1/calendar"), true);
  assert.equal(isFiOsTenantCalendarPath("/fi-admin/t1/calendar/testing"), true);
  assert.equal(isFiOsTenantCalendarPath("/fi-admin/t1"), false);
  assert.equal(isFiOsTenantCalendarPath("/fi-admin/t1/crm"), false);
  assert.equal(isFiOsTenantCalendarPath("/fi-admin"), false);
  assert.equal(isFiOsTenantCalendarPath(""), false);
});
