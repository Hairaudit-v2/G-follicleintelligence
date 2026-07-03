import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyStandardHoursTemplate,
  flattenFortnightlyStandardHours,
  groupStandardHoursByCycleWeek,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import {
  copyPreviousRosterPeriodShifts,
  generateRosterFromStandardHours,
  localWallTimeToUtcRange,
} from "@/src/lib/workforce-os/rosterGenerationCore";
import {
  defaultRosterPlanningPolicyForDeploymentTemplate,
  DEFAULT_WORKFORCE_ROSTER_PLANNING_POLICY,
  mergeWorkforceRosterPlanningPolicyIntoMetadata,
  parseWorkforceRosterPlanningPolicy,
  resolveFortnightCycleWeek,
  resolveRosterPeriodStart,
  rosterDateRangeFromPeriodStart,
  rosterGenerateActionLabel,
  rosterCopyPreviousActionLabel,
  shiftRosterPeriodStart,
} from "@/src/lib/workforce/rosterCadencePolicyCore";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const STAFF_ANNA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("roster cadence policy", () => {
  it("existing tenant without cadence defaults to weekly", () => {
    const policy = parseWorkforceRosterPlanningPolicy({});
    assert.equal(policy.rosterCadence, "weekly");
    assert.equal(policy.explicitlyConfigured, false);
    assert.equal(policy.rosterWeekStartDay, "monday");
  });

  it("parses and merges workforce_roster_planning metadata", () => {
    const merged = mergeWorkforceRosterPlanningPolicyIntoMetadata(null, {
      rosterCadence: "fortnightly",
      rosterCycleAnchorDate: "2026-03-02",
    });
    const policy = parseWorkforceRosterPlanningPolicy(merged);
    assert.equal(policy.rosterCadence, "fortnightly");
    assert.equal(policy.rosterCycleAnchorDate, "2026-03-02");
    assert.equal(policy.explicitlyConfigured, true);
  });

  it("tenant settings are isolated via separate metadata roots", () => {
    const tenantA = parseWorkforceRosterPlanningPolicy({
      workforce_roster_planning: { roster_cadence: "monthly" },
    });
    const tenantB = parseWorkforceRosterPlanningPolicy(null);
    assert.equal(tenantA.rosterCadence, "monthly");
    assert.equal(tenantB.rosterCadence, "weekly");
  });

  it("roster top controls display week / fortnight / month labels correctly", () => {
    assert.equal(rosterGenerateActionLabel("weekly"), "Generate week");
    assert.equal(rosterGenerateActionLabel("fortnightly"), "Generate fortnight");
    assert.equal(rosterGenerateActionLabel("monthly"), "Generate month");
    assert.equal(rosterCopyPreviousActionLabel("weekly"), "Copy previous week");
    assert.equal(rosterCopyPreviousActionLabel("fortnightly"), "Copy previous fortnight");
    assert.equal(rosterCopyPreviousActionLabel("monthly"), "Copy previous month");
  });

  it("onboarding deployment templates set roster cadence defaults", () => {
    assert.equal(
      defaultRosterPlanningPolicyForDeploymentTemplate("standard_hair_restoration").rosterCadence,
      "weekly"
    );
    assert.equal(
      defaultRosterPlanningPolicyForDeploymentTemplate("surgical_hair_restoration").rosterCadence,
      "fortnightly"
    );
    assert.equal(
      defaultRosterPlanningPolicyForDeploymentTemplate("enterprise_multi_clinic").rosterCadence,
      "monthly"
    );
    assert.equal(
      defaultRosterPlanningPolicyForDeploymentTemplate("enterprise_multi_clinic")
        .rosterPlanningHorizonWeeks,
      8
    );
  });
});

describe("fortnightly standard hours and generation", () => {
  const weekA = applyStandardHoursTemplate("four_ten").map((d) => ({ ...d, cycle_week: 1 as const }));
  const weekB = applyStandardHoursTemplate("five_eight").map((d) => ({ ...d, cycle_week: 2 as const }));
  const fortnightDays = flattenFortnightlyStandardHours(weekA, weekB);

  it("fortnightly Week A / Week B pattern saves shape", () => {
    const grouped = groupStandardHoursByCycleWeek(fortnightDays);
    assert.equal(grouped.get(1)?.filter((d) => d.is_working_day).length, 4);
    assert.equal(grouped.get(2)?.filter((d) => d.is_working_day).length, 5);
  });

  it("fortnightly generation maps correct dates to Week A / Week B", () => {
    const anchor = "2026-01-05";
    assert.equal(resolveFortnightCycleWeek("2026-01-05", anchor), 1);
    assert.equal(resolveFortnightCycleWeek("2026-01-12", anchor), 2);
    assert.equal(resolveFortnightCycleWeek("2026-01-19", anchor), 1);

    const range = rosterDateRangeFromPeriodStart("2026-01-05", "fortnightly");
    assert.equal(range.periodDayDates.length, 14);

    const plan = generateRosterFromStandardHours({
      tenantId: TENANT_A,
      staffIds: [STAFF_ANNA],
      standardHoursByStaff: new Map([[STAFF_ANNA, fortnightDays]]),
      staffTimezoneById: new Map([[STAFF_ANNA, "Australia/Perth"]]),
      rangeStartIso: range.startsAt,
      rangeEndIso: range.endsAt,
      existingShifts: [],
      availabilityBlocks: [],
      rosterCadence: "fortnightly",
      rosterCycleAnchorDate: anchor,
    });

    assert.equal(plan.cadence, "fortnightly");
    assert.equal(plan.candidates.length, 9);
    assert.equal(plan.summary.generatedCount, 9);
  });

  it("fortnightly copy previous period works", () => {
    const range = rosterDateRangeFromPeriodStart("2026-01-19", "fortnightly");
    const copied = copyPreviousRosterPeriodShifts({
      existingShifts: [
        {
          id: "s1",
          staff_id: STAFF_ANNA,
          starts_at: localWallTimeToUtcRange("2026-01-05", "07:30", "17:30", "Australia/Perth").startsAt,
          ends_at: localWallTimeToUtcRange("2026-01-05", "07:30", "17:30", "Australia/Perth").endsAt,
          shift_source: "manual",
        },
      ],
      staffIds: [STAFF_ANNA],
      targetPeriodStartIso: "2026-01-19",
      staffTimezoneById: new Map([[STAFF_ANNA, "Australia/Perth"]]),
      cadence: "fortnightly",
    });
    assert.equal(copied.length, 1);
    assert.equal(copied[0]?.localDate, "2026-01-19");
    assert.match(copied[0]?.notes ?? "", /fortnight/i);
  });
});

describe("monthly roster generation", () => {
  const days = applyStandardHoursTemplate("five_eight");

  it("monthly generation creates shifts across selected month", () => {
    const range = rosterDateRangeFromPeriodStart("2026-07-01", "monthly");
    assert.equal(range.periodDayDates.length, 31);

    const plan = generateRosterFromStandardHours({
      tenantId: TENANT_A,
      staffIds: [STAFF_ANNA],
      standardHoursByStaff: new Map([[STAFF_ANNA, days]]),
      staffTimezoneById: new Map([[STAFF_ANNA, "Australia/Perth"]]),
      rangeStartIso: range.startsAt,
      rangeEndIso: range.endsAt,
      existingShifts: [],
      availabilityBlocks: [],
      rosterCadence: "monthly",
    });

    assert.equal(plan.cadence, "monthly");
    assert.ok(plan.candidates.length >= 20);
  });

  it("monthly generation preserves manual edits", () => {
    const range = rosterDateRangeFromPeriodStart("2026-07-01", "monthly");
    const existing = [
      {
        id: "manual-1",
        staff_id: STAFF_ANNA,
        starts_at: "2026-07-06T01:00:00.000Z",
        ends_at: "2026-07-06T09:00:00.000Z",
        shift_source: "manual" as const,
      },
    ];

    const plan = generateRosterFromStandardHours({
      tenantId: TENANT_A,
      staffIds: [STAFF_ANNA],
      standardHoursByStaff: new Map([[STAFF_ANNA, days]]),
      staffTimezoneById: new Map([[STAFF_ANNA, "Australia/Perth"]]),
      rangeStartIso: range.startsAt,
      rangeEndIso: range.endsAt,
      existingShifts: existing,
      availabilityBlocks: [],
      rosterCadence: "monthly",
    });

    assert.ok(plan.skips.some((s) => s.reason === "manual_shift_preserved"));
    assert.equal(plan.candidates.filter((c) => c.localDate === "2026-07-06").length, 0);
  });

  it("leave/unavailability blocks monthly generation", () => {
    const range = rosterDateRangeFromPeriodStart("2026-07-01", "monthly");
    const plan = generateRosterFromStandardHours({
      tenantId: TENANT_A,
      staffIds: [STAFF_ANNA],
      standardHoursByStaff: new Map([[STAFF_ANNA, days]]),
      staffTimezoneById: new Map([[STAFF_ANNA, "Australia/Perth"]]),
      rangeStartIso: range.startsAt,
      rangeEndIso: range.endsAt,
      existingShifts: [],
      availabilityBlocks: [
        {
          block_type: "leave",
          starts_at: "2026-07-06T00:00:00.000Z",
          ends_at: "2026-07-07T00:00:00.000Z",
        },
      ],
      rosterCadence: "monthly",
    });
    assert.ok(plan.skips.some((s) => s.reason === "leave_blocked"));
  });
});

describe("weekly generation unchanged", () => {
  it("weekly generation unchanged for four_ten template", () => {
    const days = applyStandardHoursTemplate("four_ten");
    const plan = generateRosterFromStandardHours({
      tenantId: TENANT_A,
      staffIds: [STAFF_ANNA],
      standardHoursByStaff: new Map([[STAFF_ANNA, days]]),
      staffTimezoneById: new Map([[STAFF_ANNA, "Australia/Perth"]]),
      rangeStartIso: "2026-07-06T00:00:00.000Z",
      rangeEndIso: "2026-07-13T00:00:00.000Z",
      existingShifts: [],
      availabilityBlocks: [],
      rosterCadence: "weekly",
    });
    assert.equal(plan.candidates.length, 4);
    assert.equal(plan.cadence, "weekly");
  });
});

describe("period navigation", () => {
  it("shiftRosterPeriodStart moves weekly, fortnightly, and monthly", () => {
    assert.equal(shiftRosterPeriodStart("2026-07-06", "weekly", 1), "2026-07-13");
    assert.equal(shiftRosterPeriodStart("2026-01-05", "fortnightly", 1), "2026-01-19");
    assert.equal(shiftRosterPeriodStart("2026-07-01", "monthly", 1), "2026-08-01");
  });

  it("resolveRosterPeriodStart aligns fortnight to anchor week", () => {
    const start = resolveRosterPeriodStart({
      refDateIso: "2026-01-15",
      cadence: "fortnightly",
      rosterCycleAnchorDate: DEFAULT_WORKFORCE_ROSTER_PLANNING_POLICY.rosterCycleAnchorDate,
    });
    assert.equal(start, "2026-01-05");
  });
});

describe("tenant isolation — generation plans", () => {
  it("scopes generation per tenant staff input", () => {
    const days = applyStandardHoursTemplate("five_eight");
    const planA = generateRosterFromStandardHours({
      tenantId: TENANT_A,
      staffIds: [STAFF_ANNA],
      standardHoursByStaff: new Map([[STAFF_ANNA, days]]),
      staffTimezoneById: new Map([[STAFF_ANNA, "Australia/Perth"]]),
      rangeStartIso: "2026-07-06T00:00:00.000Z",
      rangeEndIso: "2026-07-13T00:00:00.000Z",
      existingShifts: [],
      availabilityBlocks: [],
    });
    const planB = generateRosterFromStandardHours({
      tenantId: TENANT_B,
      staffIds: [],
      standardHoursByStaff: new Map(),
      staffTimezoneById: new Map(),
      rangeStartIso: "2026-07-06T00:00:00.000Z",
      rangeEndIso: "2026-07-13T00:00:00.000Z",
      existingShifts: [],
      availabilityBlocks: [],
    });
    assert.ok(planA.candidates.length > 0);
    assert.equal(planB.candidates.length, 0);
  });
});
