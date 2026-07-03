import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyStandardHoursTemplate,
  computeStandardHoursWeeklyTotal,
  validateStandardHoursPattern,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import {
  buildCoverageRoleGapLabels,
  generateRosterFromStandardHours,
  localWallTimeToUtcRange,
} from "@/src/lib/workforce-os/rosterGenerationCore";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const STAFF_ANNA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

test("validateStandardHoursPattern rejects zero weekly hours", () => {
  const days = applyStandardHoursTemplate("custom");
  const result = validateStandardHoursPattern(days);
  assert.equal(result.valid, false);
  assert.ok(result.warnings.some((w) => w.code === "zero_weekly_hours"));
});

test("4 x 10-hour pattern totals 40 hours per week", () => {
  const days = applyStandardHoursTemplate("four_ten");
  const mins = computeStandardHoursWeeklyTotal(days);
  assert.equal(mins, 40 * 60);
  const validation = validateStandardHoursPattern(days);
  assert.equal(validation.valid, true);
  assert.equal(days.find((d) => d.weekday === 2)?.is_working_day, false);
});

test("validateStandardHoursPattern rejects end before start", () => {
  const days = applyStandardHoursTemplate("five_eight");
  days[0] = { ...days[0], start_time: "17:00", end_time: "09:00" };
  const result = validateStandardHoursPattern(days);
  assert.equal(result.valid, false);
  assert.ok(result.warnings.some((w) => w.code === "end_before_start"));
});

test("generateRosterFromStandardHours creates Mon-Fri shifts for four_ten template", () => {
  const days = applyStandardHoursTemplate("four_ten");
  const range = localWallTimeToUtcRange("2026-07-06", "07:30", "17:30", "Australia/Perth");
  assert.ok(Date.parse(range.endsAt) > Date.parse(range.startsAt));

  const plan = generateRosterFromStandardHours({
    tenantId: TENANT_A,
    staffIds: [STAFF_ANNA],
    standardHoursByStaff: new Map([[STAFF_ANNA, days]]),
    staffTimezoneById: new Map([[STAFF_ANNA, "Australia/Perth"]]),
    rangeStartIso: "2026-07-06T00:00:00.000Z",
    rangeEndIso: "2026-07-13T00:00:00.000Z",
    existingShifts: [],
    availabilityBlocks: [],
  });

  assert.equal(plan.candidates.length, 4);
  assert.ok(plan.skips.some((s) => s.reason === "not_working_day" && s.detail === "RDO"));
  assert.equal(plan.cadence, "weekly");
});

test("generateRosterFromStandardHours skips duplicate standard_hours shifts", () => {
  const days = applyStandardHoursTemplate("five_eight");
  const existing = [
    {
      id: "shift-1",
      staff_id: STAFF_ANNA,
      starts_at: "2026-07-06T01:00:00.000Z",
      ends_at: "2026-07-06T09:00:00.000Z",
      shift_source: "standard_hours" as const,
    },
  ];

  const plan = generateRosterFromStandardHours({
    tenantId: TENANT_A,
    staffIds: [STAFF_ANNA],
    standardHoursByStaff: new Map([[STAFF_ANNA, days]]),
    staffTimezoneById: new Map([[STAFF_ANNA, "Australia/Perth"]]),
    rangeStartIso: "2026-07-06T00:00:00.000Z",
    rangeEndIso: "2026-07-13T00:00:00.000Z",
    existingShifts: existing,
    availabilityBlocks: [],
  });

  assert.ok(plan.skips.some((s) => s.reason === "duplicate_shift"));
  assert.ok(plan.candidates.length < 5);
});

test("generateRosterFromStandardHours preserves manual shifts", () => {
  const days = applyStandardHoursTemplate("five_eight");
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
    rangeStartIso: "2026-07-06T00:00:00.000Z",
    rangeEndIso: "2026-07-13T00:00:00.000Z",
    existingShifts: existing,
    availabilityBlocks: [],
  });

  assert.ok(plan.skips.some((s) => s.reason === "manual_shift_preserved"));
  assert.equal(plan.candidates.filter((c) => c.localDate === "2026-07-06").length, 0);
});

test("generateRosterFromStandardHours blocks generation on leave", () => {
  const days = applyStandardHoursTemplate("five_eight");

  const plan = generateRosterFromStandardHours({
    tenantId: TENANT_A,
    staffIds: [STAFF_ANNA],
    standardHoursByStaff: new Map([[STAFF_ANNA, days]]),
    staffTimezoneById: new Map([[STAFF_ANNA, "Australia/Perth"]]),
    rangeStartIso: "2026-07-06T00:00:00.000Z",
    rangeEndIso: "2026-07-13T00:00:00.000Z",
    existingShifts: [],
    availabilityBlocks: [
      {
        block_type: "leave",
        starts_at: "2026-07-06T00:00:00.000Z",
        ends_at: "2026-07-07T00:00:00.000Z",
      },
    ],
  });

  assert.ok(plan.skips.some((s) => s.reason === "leave_blocked"));
});

test("buildCoverageRoleGapLabels handles undefined missing roles", () => {
  assert.deepEqual(buildCoverageRoleGapLabels(undefined), []);
});

test("buildCoverageRoleGapLabels formats missing clinical roles", () => {
  const labels = buildCoverageRoleGapLabels([
    { role: "rn", required: 2, assigned: 0 },
    { role: "consultant", required: 1, assigned: 0 },
    { role: "doctor", required: 1, assigned: 1 },
  ]);
  assert.deepEqual(labels, ["Missing 2 × RN", "Missing consultant"]);
});

test("tenant isolation — generation plans are scoped per tenant input", () => {
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
