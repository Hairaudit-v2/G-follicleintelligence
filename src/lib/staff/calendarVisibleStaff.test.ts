import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isCalendarVisibleClinicalStaff } from "@/src/lib/staff/calendarVisibleStaff";

describe("calendarVisibleStaff", () => {
  it("excludes receptionist from calendar providers", () => {
    assert.equal(
      isCalendarVisibleClinicalStaff({
        is_active: true,
        staff_role: "reception",
        calendar_visible: null,
      }),
      false
    );
  });

  it("excludes admin unless calendar_visible override", () => {
    assert.equal(
      isCalendarVisibleClinicalStaff({
        is_active: true,
        staff_role: "admin",
        calendar_visible: null,
      }),
      false
    );
    assert.equal(
      isCalendarVisibleClinicalStaff({
        is_active: true,
        staff_role: "admin",
        calendar_visible: true,
      }),
      true
    );
  });

  it("includes clinical roles when active", () => {
    assert.equal(
      isCalendarVisibleClinicalStaff({
        is_active: true,
        staff_role: "nurse",
        calendar_visible: null,
      }),
      true
    );
    assert.equal(
      isCalendarVisibleClinicalStaff({
        is_active: true,
        staff_role: "consultant",
        calendar_visible: null,
      }),
      true
    );
    assert.equal(
      isCalendarVisibleClinicalStaff({
        is_active: true,
        staff_role: "technician",
        calendar_visible: null,
      }),
      true
    );
  });
});
