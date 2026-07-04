import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMaternityLeaveConfirmationSummary,
  findFutureShiftsDuringLeave,
  isMaternityLeaveBlock,
  resolveActiveLeavePeriod,
  resolveStaffLeavePresentation,
} from "@/src/lib/workforce/staffLeaveWorkflowCore";
import {
  applyStandardHoursTemplate,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import {
  evaluateRosterStaffEligibility,
  listStaffMissingStandardHoursForRoster,
  resolveRosterEligibleStaffIds,
} from "@/src/lib/workforce-os/rosterEligibleStaffCore";
import {
  generateRosterFromStandardHours,
} from "@/src/lib/workforce-os/rosterGenerationCore";

const TENANT = "11111111-1111-1111-1111-111111111111";
const STAFF_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const MATERNITY_START = "2026-07-01T00:00:00.000Z";
const MATERNITY_END = "2026-12-31T23:59:59.999Z";

const maternityBlock = {
  id: "block-maternity",
  block_type: "maternity_leave" as const,
  starts_at: MATERNITY_START,
  ends_at: MATERNITY_END,
  status: "active" as const,
  reason: "maternity_leave",
};

describe("maternity leave workflow core", () => {
  it("detects maternity_leave block type", () => {
    assert.equal(isMaternityLeaveBlock(maternityBlock), true);
  });

  it("resolves active maternity leave period", () => {
    const period = resolveActiveLeavePeriod({
      employmentStatus: "on_leave",
      availabilityBlocks: [maternityBlock],
      referenceDate: "2026-08-15T12:00:00.000Z",
    });
    assert.equal(period?.kind, "maternity_leave");
  });

  it("presentation shows maternity leave instead of roster eligible", () => {
    const presentation = resolveStaffLeavePresentation({
      employmentStatus: "on_leave",
      availabilityBlocks: [maternityBlock],
      futureShifts: [],
      nextShiftLabel: "Mon 8 Jul · 09:00",
      referenceDate: "2026-08-15T12:00:00.000Z",
    });
    assert.equal(presentation.isMaternityLeave, true);
    assert.equal(presentation.rosterStatusLabel, "On maternity leave");
    assert.match(presentation.primaryStatusLabel ?? "", /maternity leave until/i);
    assert.equal(presentation.suppressStandardHoursRequirement, true);
    assert.equal(presentation.hideNextShift, true);
  });

  it("flags future shifts during maternity leave", () => {
    const futureShifts = findFutureShiftsDuringLeave(
      [
        {
          id: "shift-future",
          starts_at: "2026-09-01T09:00:00.000Z",
          ends_at: "2026-09-01T17:00:00.000Z",
          status: "scheduled",
        },
        {
          id: "shift-past",
          starts_at: "2026-06-01T09:00:00.000Z",
          ends_at: "2026-06-01T17:00:00.000Z",
          status: "completed",
        },
      ],
      MATERNITY_START,
      MATERNITY_END
    );
    assert.equal(futureShifts.length, 1);
    assert.equal(futureShifts[0]?.id, "shift-future");
  });

  it("confirmation summary explains preserved history", () => {
    const summary = buildMaternityLeaveConfirmationSummary({
      staffName: "Anita Katherine Cottee",
      startDate: "2026-07-01",
      expectedReturnDate: "2026-12-31",
      keepLoginAccess: true,
      pauseRosterEligibility: true,
      pauseStandardHours: true,
    });
    assert.match(summary.changes[0], /remain an active staff profile/i);
    assert.ok(summary.preserves.some((line) => /historical shifts/i.test(line)));
    assert.ok(summary.preserves.some((line) => /not archived/i.test(line)));
  });
});

describe("maternity leave roster exclusion", () => {
  const periodDays = [
    "2026-07-06",
    "2026-07-07",
    "2026-07-08",
    "2026-07-09",
    "2026-07-10",
    "2026-07-11",
    "2026-07-12",
  ];

  it("staff on maternity leave employment status is not roster-eligible", () => {
    const result = evaluateRosterStaffEligibility({
      staffId: STAFF_ID,
      isActive: true,
      employmentStatus: "on_leave",
      archivedAt: null,
      tenantId: TENANT,
      periodDayDates: periodDays,
      availabilityBlocks: [maternityBlock],
    });
    assert.equal(result.eligible, false);
    assert.ok(result.reason === "employment_status" || result.reason === "full_period_unavailable");
  });

  it("staff on maternity leave does not count as missing standard hours", () => {
    const eligibleIds = new Set<string>();
    const missing = listStaffMissingStandardHoursForRoster(
      [{ id: STAFF_ID, name: "Anita" }],
      {},
      eligibleIds
    );
    assert.equal(missing.length, 0);
  });

  it("maternity leave blocks roster generation for leave period", () => {
    const eligibility = new Map([
      [STAFF_ID, { eligible: false, reason: "full_period_unavailable" as const }],
    ]);
    const staffIds = resolveRosterEligibleStaffIds([STAFF_ID], eligibility);
    assert.deepEqual(staffIds, []);

    const plan = generateRosterFromStandardHours({
      tenantId: TENANT,
      staffIds: [STAFF_ID],
      standardHoursByStaff: new Map([[STAFF_ID, applyStandardHoursTemplate("five_eight")]]),
      staffTimezoneById: new Map([[STAFF_ID, "Australia/Perth"]]),
      rangeStartIso: "2026-07-06T00:00:00.000Z",
      rangeEndIso: "2026-07-13T00:00:00.000Z",
      existingShifts: [],
      availabilityBlocks: [maternityBlock],
    });
    assert.equal(plan.candidates.length, 0);
    assert.ok(plan.skips.some((skip) => skip.reason === "leave_blocked"));
  });

  it("historical shifts before leave are not flagged as conflicts", () => {
    const conflicts = findFutureShiftsDuringLeave(
      [
        {
          id: "historical",
          starts_at: "2026-06-15T09:00:00.000Z",
          ends_at: "2026-06-15T17:00:00.000Z",
          status: "completed",
        },
      ],
      MATERNITY_START,
      MATERNITY_END
    );
    assert.equal(conflicts.length, 0);
  });

  it("after return date staff with active employment becomes eligible again", () => {
    const postLeave = evaluateRosterStaffEligibility({
      staffId: STAFF_ID,
      isActive: true,
      employmentStatus: "active",
      archivedAt: null,
      tenantId: TENANT,
      periodDayDates: ["2027-01-05", "2027-01-06", "2027-01-07"],
      availabilityBlocks: [maternityBlock],
      staffTimezone: "Australia/Perth",
    });
    assert.equal(postLeave.eligible, true);
  });
});
