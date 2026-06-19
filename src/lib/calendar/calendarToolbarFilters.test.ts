import test from "node:test";
import assert from "node:assert/strict";

import {
  calendarClinicFilterSelectValue,
  calendarStaffFilterSelectValue,
} from "@/src/lib/calendar/calendarToolbarFilters";

test("calendarClinicFilterSelectValue: null/empty clinicId maps to All locations", () => {
  assert.equal(calendarClinicFilterSelectValue(null), "");
  assert.equal(calendarClinicFilterSelectValue(undefined), "");
  assert.equal(calendarClinicFilterSelectValue(""), "");
  assert.equal(calendarClinicFilterSelectValue("   "), "");
});

test("calendarClinicFilterSelectValue: preserves explicit clinic id", () => {
  const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assert.equal(calendarClinicFilterSelectValue(id), id);
});

test("calendarStaffFilterSelectValue: null/empty staffId maps to All staff", () => {
  assert.equal(calendarStaffFilterSelectValue(null), "");
  assert.equal(calendarStaffFilterSelectValue(undefined), "");
  assert.equal(calendarStaffFilterSelectValue(""), "");
});

test("calendarStaffFilterSelectValue: preserves explicit staff id", () => {
  const id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  assert.equal(calendarStaffFilterSelectValue(id), id);
});
