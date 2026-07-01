import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addDaysIso,
  computeDailyRosterCost,
  computeLabourEfficiencyMetrics,
  computeProcedureLabourCosts,
  computeSurgeryTeamCost,
  computeWeeklyWageExposure,
  enrichShiftCostLine,
} from "@/src/lib/workforce/shiftCostIntelligenceCore";

const baseLine = {
  shiftId: "s1",
  staffMemberId: "m1",
  fiStaffId: "f1",
  fullName: "Alex",
  shiftType: "clinic_day",
  minutesWorked: 480,
  rateType: "hourly" as const,
  baseRateCents: 5000,
  awardLoadings: [] as { loadingCode: string; displayName: string; multiplier: number }[],
};

describe("shiftCostIntelligenceCore", () => {
  it("enrichShiftCostLine computes gross from wage profile", () => {
    const line = enrichShiftCostLine(baseLine);
    assert.equal(line.hasWageProfile, true);
    assert.equal(line.grossCostCents, 40_000);
  });

  it("computeDailyRosterCost aggregates by shift type", () => {
    const summary = computeDailyRosterCost({
      workDate: "2026-07-01",
      lines: [
        baseLine,
        { ...baseLine, shiftId: "s2", shiftType: "surgery_day" },
        { ...baseLine, shiftId: "s3", baseRateCents: 0 },
      ],
    });
    assert.equal(summary.shiftCount, 3);
    assert.equal(summary.staffedCount, 2);
    assert.equal(summary.missingProfileCount, 1);
    assert.equal(summary.byShiftType.clinic_day?.shiftCount, 2);
    assert.equal(summary.byShiftType.surgery_day?.shiftCount, 1);
  });

  it("computeSurgeryTeamCost totals assignment labour", () => {
    const summary = computeSurgeryTeamCost({
      workDate: "2026-07-01",
      surgeryCount: 2,
      lines: [baseLine, { ...baseLine, shiftId: null, staffMemberId: "m2", fullName: "Blair" }],
    });
    assert.equal(summary.assignmentCount, 2);
    assert.equal(summary.totalGrossCostCents, 80_000);
  });

  it("computeProcedureLabourCosts derives cost per procedure hour", () => {
    const rows = computeProcedureLabourCosts({
      procedures: [
        {
          surgeryId: "sx1",
          scheduledDate: "2026-07-01",
          procedureLabel: "FUE 2500",
          status: "scheduled",
          minutesWorked: 240,
          lines: [{ ...baseLine, minutesWorked: 240 }],
        },
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.totalGrossCostCents, 20_000);
    assert.equal(rows[0]?.costPerProcedureHourCents, 5000);
  });

  it("computeLabourEfficiencyMetrics derives coverage and cost per hour", () => {
    const roster = computeDailyRosterCost({
      workDate: "2026-07-01",
      lines: [baseLine, { ...baseLine, shiftId: "s2", baseRateCents: 0 }],
    });
    const metrics = computeLabourEfficiencyMetrics(roster);
    assert.equal(metrics.profileCoveragePercent, 50);
    assert.equal(metrics.costPerScheduledHourCents, 2500);
  });

  it("computeWeeklyWageExposure sums seven days", () => {
    const forecast = computeWeeklyWageExposure({
      weekStart: "2026-07-01",
      days: [
        { workDate: "2026-07-01", lines: [baseLine] },
        { workDate: "2026-07-02", lines: [] },
      ],
    });
    assert.equal(forecast.totalForecastGrossCostCents, 40_000);
    assert.equal(forecast.days.length, 2);
  });

  it("addDaysIso advances calendar dates", () => {
    assert.equal(addDaysIso("2026-07-01", 1), "2026-07-02");
    assert.equal(addDaysIso("2026-07-01", 6), "2026-07-07");
  });
});