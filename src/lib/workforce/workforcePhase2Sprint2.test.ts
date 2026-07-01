import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyAwardLoadingPremiums,
  computeBaseLabourCostCents,
  computeGrossLabourCostCents,
  computeSurgeryDayStaffingCost,
  countWageProfilesByRateType,
  dollarsToCents,
  formatCentsAsCurrency,
  resolveAwardLoadingsForProfile,
} from "@/src/lib/workforce/wageProfileCore";

describe("wageProfileCore", () => {
  it("dollarsToCents rounds to integer cents", () => {
    assert.equal(dollarsToCents(42.5), 4250);
    assert.throws(() => dollarsToCents(0), /positive/);
  });

  it("computeBaseLabourCostCents handles hourly and daily rates", () => {
    assert.equal(
      computeBaseLabourCostCents({ rateType: "hourly", baseRateCents: 6000, minutesWorked: 60 }),
      6000
    );
    assert.equal(
      computeBaseLabourCostCents({ rateType: "daily", baseRateCents: 80000, minutesWorked: 480 }),
      80000
    );
    assert.equal(
      computeBaseLabourCostCents({ rateType: "contractor", baseRateCents: 120000, minutesWorked: 240 }),
      60000
    );
  });

  it("applyAwardLoadingPremiums stacks additive premiums", () => {
    const gross = applyAwardLoadingPremiums(10_000, [{ multiplier: 1.5 }, { multiplier: 2 }]);
    assert.equal(gross, 10_000 + 5_000 + 10_000);
  });

  it("computeGrossLabourCostCents combines base and loadings", () => {
    const gross = computeGrossLabourCostCents({
      rateType: "hourly",
      baseRateCents: 5000,
      minutesWorked: 120,
      awardLoadings: [{ multiplier: 1.5 }],
    });
    assert.equal(gross, 10_000 + 5_000);
  });

  it("computeSurgeryDayStaffingCost totals lines and missing profiles", () => {
    const summary = computeSurgeryDayStaffingCost({
      workDate: "2026-07-01",
      lines: [
        {
          staffMemberId: "a",
          fiStaffId: "fa",
          fullName: "Alex",
          shiftId: "s1",
          shiftType: "surgery_day",
          minutesWorked: 480,
          rateType: "daily",
          baseRateCents: 100_000,
          awardLoadings: [],
        },
        {
          staffMemberId: "b",
          fiStaffId: "fb",
          fullName: "Blair",
          shiftId: "s2",
          shiftType: "surgery_day",
          minutesWorked: 480,
          rateType: "hourly",
          baseRateCents: 0,
          awardLoadings: [],
        },
      ],
    });
    assert.equal(summary.shiftCount, 2);
    assert.equal(summary.staffedCount, 1);
    assert.equal(summary.missingProfileCount, 1);
    assert.equal(summary.totalGrossCostCents, 100_000);
  });

  it("resolveAwardLoadingsForProfile matches award and loading codes", () => {
    const loadings = resolveAwardLoadingsForProfile({
      awardCode: "PLACEHOLDER_AWARD",
      awardLoadingCodes: ["weekend", "overtime"],
      placeholders: [
        {
          id: "1",
          tenantId: "t",
          awardCode: "PLACEHOLDER_AWARD",
          loadingCode: "weekend",
          displayName: "Weekend",
          loadingMultiplier: 1.5,
          description: null,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "2",
          tenantId: "t",
          awardCode: "OTHER",
          loadingCode: "overtime",
          displayName: "OT",
          loadingMultiplier: 1.5,
          description: null,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    assert.equal(loadings.length, 1);
    assert.equal(loadings[0]?.loadingCode, "weekend");
  });

  it("countWageProfilesByRateType ignores inactive profiles", () => {
    const counts = countWageProfilesByRateType([
      { rateType: "hourly", isActive: true },
      { rateType: "hourly", isActive: true },
      { rateType: "daily", isActive: false },
    ]);
    assert.equal(counts.hourly, 2);
    assert.equal(counts.daily, 0);
  });

  it("formatCentsAsCurrency renders AUD", () => {
    const s = formatCentsAsCurrency(12345, "AUD");
    assert.ok(s.includes("123.45") || s.includes("123"));
  });
});