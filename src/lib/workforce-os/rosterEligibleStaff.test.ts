import assert from "node:assert/strict";
import { describe, it, test } from "node:test";

import {
  applyStandardHoursTemplate,
  staffHasConfiguredStandardHours,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import {
  buildRosterStaffEligibilityContext,
  evaluateRosterStaffEligibility,
  evaluateRosterStaffLifecycleEligibility,
  isStaffFullyUnavailableForPeriod,
  listRosterEligibleStaffMissingStandardHours,
  listStaffMissingStandardHoursForRoster,
  resolveRosterEligibleStaffIds,
} from "@/src/lib/workforce-os/rosterEligibleStaffCore";
import {
  copyPreviousRosterPeriodShifts,
  generateRosterFromStandardHours,
} from "@/src/lib/workforce-os/rosterGenerationCore";
import type { FiStaffRow } from "@/src/lib/staff/staff.server";

const STAFF_ACTIVE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const STAFF_INACTIVE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const STAFF_ARCHIVED = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const STAFF_LEAVE = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const STAFF_PARTIAL = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const TENANT = "11111111-1111-1111-1111-111111111111";

function staffRow(overrides: Partial<FiStaffRow>): FiStaffRow {
  return {
    id: STAFF_ACTIVE,
    tenant_id: TENANT,
    fi_user_id: null,
    full_name: "Active Staff",
    staff_role: "nurse",
    position_type_id: null,
    email: null,
    mobile: null,
    default_timezone: "Australia/Perth",
    working_hours: {},
    staff_metadata: {},
    is_active: true,
    calendar_color: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const PERIOD_DAYS = [
  "2026-07-06",
  "2026-07-07",
  "2026-07-08",
  "2026-07-09",
  "2026-07-10",
  "2026-07-11",
  "2026-07-12",
];

describe("roster eligible staff lifecycle", () => {
  it("active staff with active employment status is lifecycle-eligible", () => {
    const result = evaluateRosterStaffLifecycleEligibility({
      staffId: STAFF_ACTIVE,
      isActive: true,
      employmentStatus: "active",
      archivedAt: null,
      tenantId: TENANT,
    });
    assert.equal(result.eligible, true);
  });

  it("inactive fi_staff row is not roster-eligible", () => {
    const result = evaluateRosterStaffLifecycleEligibility({
      staffId: STAFF_INACTIVE,
      isActive: false,
      employmentStatus: "active",
      archivedAt: null,
      tenantId: TENANT,
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "inactive");
  });

  it("archived staff member is not roster-eligible", () => {
    const result = evaluateRosterStaffLifecycleEligibility({
      staffId: STAFF_ARCHIVED,
      isActive: true,
      employmentStatus: "active",
      archivedAt: "2026-06-01T00:00:00.000Z",
      tenantId: TENANT,
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "archived");
  });

  it("terminated employment status is not roster-eligible", () => {
    const result = evaluateRosterStaffLifecycleEligibility({
      staffId: STAFF_INACTIVE,
      isActive: true,
      employmentStatus: "terminated",
      archivedAt: null,
      tenantId: TENANT,
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "departed");
  });

  it("pending onboarding staff is not roster-eligible", () => {
    const result = evaluateRosterStaffLifecycleEligibility({
      staffId: STAFF_INACTIVE,
      isActive: true,
      employmentStatus: "pending_onboarding",
      archivedAt: null,
      tenantId: TENANT,
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "pending_onboarding");
  });

  it("employment on_leave with maternity block is not roster-eligible", () => {
    const result = evaluateRosterStaffLifecycleEligibility({
      staffId: STAFF_LEAVE,
      isActive: true,
      employmentStatus: "on_leave",
      archivedAt: null,
      tenantId: TENANT,
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "employment_status");
  });

  it("maternity_leave block type makes staff fully unavailable for period", () => {
    const maternityLeave = [
      {
        block_type: "maternity_leave" as const,
        starts_at: "2026-07-01T00:00:00.000Z",
        ends_at: "2026-12-31T23:59:59.999Z",
        status: "active",
      },
    ];

    assert.equal(
      isStaffFullyUnavailableForPeriod({
        periodDayDates: PERIOD_DAYS,
        availabilityBlocks: maternityLeave,
        staffTimezone: "Australia/Perth",
      }),
      true
    );
  });
});

describe("roster eligible staff leave windows", () => {
  it("full-week leave blocks make staff ineligible for the period", () => {
    const fullPeriodLeave = [
      {
        block_type: "leave" as const,
        starts_at: "2026-07-01T00:00:00.000Z",
        ends_at: "2026-07-31T00:00:00.000Z",
        status: "active",
      },
    ];

    assert.equal(
      isStaffFullyUnavailableForPeriod({
        periodDayDates: PERIOD_DAYS,
        availabilityBlocks: fullPeriodLeave,
        staffTimezone: "Australia/Perth",
      }),
      true
    );

    const result = evaluateRosterStaffEligibility({
      staffId: STAFF_LEAVE,
      isActive: true,
      employmentStatus: "active",
      archivedAt: null,
      tenantId: TENANT,
      periodDayDates: PERIOD_DAYS,
      availabilityBlocks: fullPeriodLeave,
      staffTimezone: "Australia/Perth",
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "full_period_unavailable");
  });

  it("partial leave staff remain eligible but generation skips leave days", () => {
    const result = evaluateRosterStaffEligibility({
      staffId: STAFF_PARTIAL,
      isActive: true,
      employmentStatus: "active",
      archivedAt: null,
      tenantId: TENANT,
      periodDayDates: PERIOD_DAYS,
      availabilityBlocks: [
        {
          block_type: "leave",
          starts_at: "2026-07-06T00:00:00.000Z",
          ends_at: "2026-07-07T00:00:00.000Z",
          status: "active",
        },
      ],
      staffTimezone: "Australia/Perth",
    });
    assert.equal(result.eligible, true);

    const days = applyStandardHoursTemplate("five_eight");
    const plan = generateRosterFromStandardHours({
      tenantId: TENANT,
      staffIds: [STAFF_PARTIAL],
      standardHoursByStaff: new Map([[STAFF_PARTIAL, days]]),
      staffTimezoneById: new Map([[STAFF_PARTIAL, "Australia/Perth"]]),
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

    assert.ok(plan.skips.some((skip) => skip.reason === "leave_blocked"));
    assert.equal(plan.candidates.length, 4);
  });
});

describe("missing standard hours validation", () => {
  it("inactive staff with no hours are excluded from missing-hours list", () => {
    const missing = listStaffMissingStandardHoursForRoster(
      [
        { id: STAFF_ACTIVE, name: "Active" },
        { id: STAFF_INACTIVE, name: "Inactive" },
      ],
      {},
      [STAFF_ACTIVE]
    );
    assert.equal(missing.length, 1);
    assert.equal(missing[0]?.id, STAFF_ACTIVE);
  });

  it("active staff with no hours still count as missing", () => {
    assert.equal(staffHasConfiguredStandardHours(undefined), false);
    const missing = listStaffMissingStandardHoursForRoster(
      [{ id: STAFF_ACTIVE, name: "Active" }],
      {},
      [STAFF_ACTIVE]
    );
    assert.equal(missing.length, 1);
  });

  it("buildRosterStaffEligibilityContext partitions eligible and ineligible staff", () => {
    const context = buildRosterStaffEligibilityContext({
      staffRows: [
        staffRow({ id: STAFF_ACTIVE, full_name: "Active Staff" }),
        staffRow({ id: STAFF_INACTIVE, full_name: "Inactive Staff", is_active: false }),
      ],
      membersByFiStaffId: new Map([
        [
          STAFF_ACTIVE,
          {
            id: "member-active",
            tenant_id: TENANT,
            fi_staff_id: STAFF_ACTIVE,
            first_name: "Active",
            last_name: "Staff",
            full_name: "Active Staff",
            email: null,
            professional_title: null,
            phone: null,
            role_code: "nurse",
            employment_type: null,
            employment_status: "active",
            timezone: null,
            clinic_id: null,
            notes: null,
            identity_source: "local",
            internal_tags: [],
            iiohr_staff_record_id: null,
            iiohr_user_id: null,
            source_system: null,
            source_synced_at: null,
            source_snapshot: {},
            archived_at: null,
            employment_status_reason: null,
            employment_status_changed_at: null,
            employment_status_changed_by: null,
            last_manual_profile_update: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        [
          STAFF_INACTIVE,
          {
            id: "member-inactive",
            tenant_id: TENANT,
            fi_staff_id: STAFF_INACTIVE,
            first_name: "Inactive",
            last_name: "Staff",
            full_name: "Inactive Staff",
            email: null,
            professional_title: null,
            phone: null,
            role_code: "nurse",
            employment_type: null,
            employment_status: "inactive",
            timezone: null,
            clinic_id: null,
            notes: null,
            identity_source: "local",
            internal_tags: [],
            iiohr_staff_record_id: null,
            iiohr_user_id: null,
            source_system: null,
            source_synced_at: null,
            source_snapshot: {},
            archived_at: null,
            employment_status_reason: null,
            employment_status_changed_at: null,
            employment_status_changed_by: null,
            last_manual_profile_update: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      ]),
      periodDayDates: PERIOD_DAYS,
    });

    assert.deepEqual(context.eligibleStaffIds, [STAFF_ACTIVE]);
    assert.equal(context.ineligibleStaffOptions.length, 1);
    assert.equal(context.ineligibleStaffOptions[0]?.id, STAFF_INACTIVE);

    const missing = listRosterEligibleStaffMissingStandardHours({
      staffOptions: [{ id: STAFF_ACTIVE, name: "Active Staff" }],
      standardHoursByStaffId: {},
      eligibleStaffIds: context.eligibleStaffIds,
    });
    assert.equal(missing.length, 1);
  });
});

test("inactive staff with no standard hours do not produce generation skips when excluded", () => {
  const eligibility = new Map([
    [STAFF_ACTIVE, { eligible: true, reason: null }],
    [STAFF_INACTIVE, { eligible: false, reason: "inactive" as const }],
  ]);
  const staffIds = resolveRosterEligibleStaffIds([STAFF_ACTIVE, STAFF_INACTIVE], eligibility);
  assert.deepEqual(staffIds, [STAFF_ACTIVE]);

  const plan = generateRosterFromStandardHours({
    tenantId: TENANT,
    staffIds,
    standardHoursByStaff: new Map([[STAFF_ACTIVE, applyStandardHoursTemplate("five_eight")]]),
    staffTimezoneById: new Map([
      [STAFF_ACTIVE, "Australia/Perth"],
      [STAFF_INACTIVE, "Australia/Perth"],
    ]),
    rangeStartIso: "2026-07-06T00:00:00.000Z",
    rangeEndIso: "2026-07-13T00:00:00.000Z",
    existingShifts: [],
    availabilityBlocks: [],
  });

  assert.ok(plan.candidates.length > 0);
  assert.ok(!plan.skips.some((skip) => skip.staff_id === STAFF_INACTIVE));
});

test("copy previous week skips staff outside eligible scope", () => {
  const copied = copyPreviousRosterPeriodShifts({
    existingShifts: [
      {
        id: "shift-active",
        staff_id: STAFF_ACTIVE,
        starts_at: "2026-06-29T01:00:00.000Z",
        ends_at: "2026-06-29T09:00:00.000Z",
      },
      {
        id: "shift-inactive",
        staff_id: STAFF_INACTIVE,
        starts_at: "2026-06-29T01:00:00.000Z",
        ends_at: "2026-06-29T09:00:00.000Z",
      },
    ],
    staffIds: [STAFF_ACTIVE],
    targetPeriodStartIso: "2026-07-06",
    staffTimezoneById: new Map([
      [STAFF_ACTIVE, "Australia/Perth"],
      [STAFF_INACTIVE, "Australia/Perth"],
    ]),
    cadence: "weekly",
  });

  assert.equal(copied.length, 1);
  assert.equal(copied[0]?.staff_id, STAFF_ACTIVE);
});

test("archived and full-period leave staff without hours do not block roster generation scope", () => {
  const eligibility = new Map([
    [STAFF_ACTIVE, { eligible: true, reason: null }],
    [STAFF_ARCHIVED, { eligible: false, reason: "archived" as const }],
    [STAFF_LEAVE, { eligible: false, reason: "full_period_unavailable" as const }],
  ]);
  const staffIds = resolveRosterEligibleStaffIds(
    [STAFF_ACTIVE, STAFF_ARCHIVED, STAFF_LEAVE],
    eligibility
  );
  assert.deepEqual(staffIds, [STAFF_ACTIVE]);

  const plan = generateRosterFromStandardHours({
    tenantId: TENANT,
    staffIds,
    standardHoursByStaff: new Map([[STAFF_ACTIVE, applyStandardHoursTemplate("five_eight")]]),
    staffTimezoneById: new Map([[STAFF_ACTIVE, "Australia/Perth"]]),
    rangeStartIso: "2026-07-06T00:00:00.000Z",
    rangeEndIso: "2026-07-13T00:00:00.000Z",
    existingShifts: [],
    availabilityBlocks: [],
  });

  assert.ok(plan.candidates.length > 0);
  assert.equal(plan.skips.filter((skip) => skip.reason === "no_standard_hours").length, 0);
});

test("maternity leave staff appear in ineligible roster options", () => {
  const maternityBlock = {
    staff_id: STAFF_LEAVE,
    block_type: "maternity_leave" as const,
    starts_at: "2026-07-01T00:00:00.000Z",
    ends_at: "2026-12-31T23:59:59.999Z",
    status: "active" as const,
  };

  const context = buildRosterStaffEligibilityContext({
    staffRows: [
      staffRow({
        id: STAFF_LEAVE,
        full_name: "Anita Katherine Cottee",
        is_active: true,
      }),
    ],
    membersByFiStaffId: new Map([
      [
        STAFF_LEAVE,
        {
          employment_status: "on_leave",
          archived_at: null,
        },
      ],
    ]),
    periodDayDates: PERIOD_DAYS,
    availabilityBlocks: [maternityBlock],
  });

  assert.equal(context.eligibleStaffIds.length, 0);
  assert.equal(context.ineligibleStaffOptions.length, 1);
  assert.equal(context.ineligibleStaffOptions[0]?.name, "Anita Katherine Cottee");
  assert.match(context.ineligibleStaffOptions[0]?.reasonLabel ?? "", /leave|unavailable/i);
});
