import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compareShiftToPunch } from "./rosterActualVarianceCore";

describe("rosterActualVarianceCore", () => {
  it("flags no_punch when shift has no punch", () => {
    const row = compareShiftToPunch(
      {
        shiftId: "s1",
        fiStaffId: "staff-1",
        staffFullName: "Alex",
        workDate: "2026-07-01",
        shiftStartsAt: "2026-07-01T00:00:00.000Z",
        shiftEndsAt: "2026-07-01T08:00:00.000Z",
        shiftType: "regular",
      },
      null
    );
    assert.equal(row.kind, "no_punch");
  });

  it("flags late_in beyond grace", () => {
    const row = compareShiftToPunch(
      {
        shiftId: "s1",
        fiStaffId: "staff-1",
        staffFullName: "Alex",
        workDate: "2026-07-01",
        shiftStartsAt: "2026-07-01T00:00:00.000Z",
        shiftEndsAt: "2026-07-01T08:00:00.000Z",
        shiftType: "regular",
      },
      {
        punchId: "p1",
        fiStaffId: "staff-1",
        workDate: "2026-07-01",
        clockInAt: "2026-07-01T00:20:00.000Z",
        clockOutAt: "2026-07-01T08:00:00.000Z",
        minutesWorked: 460,
      }
    );
    assert.equal(row.kind, "late_in");
  });
});