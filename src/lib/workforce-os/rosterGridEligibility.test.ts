import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, test } from "node:test";

import {
  buildRosterStaffEligibilityContext,
  filterRosterGridStaffOptions,
} from "@/src/lib/workforce-os/rosterEligibleStaffCore";
import {
  openRosterShiftDrawer,
  resolveRosterCellClickIntent,
  resolveRosterCellClickOutcome,
  resolveRosterEmptyCellLabel,
  staffHasWorkingStandardHoursForDate,
} from "@/src/lib/workforce-os/rosterCommandCentreUxCore";
import {
  applyStandardHoursTemplate,
  staffHasConfiguredStandardHours,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import type { FiStaffRow } from "@/src/lib/staff/staff.server";

const TENANT = "11111111-1111-1111-1111-111111111111";
const STAFF_ACTIVE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const STAFF_INACTIVE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const STAFF_OLD_DUPLICATE = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const STAFF_LEAVE = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const PERIOD_DAYS = [
  "2026-07-06",
  "2026-07-07",
  "2026-07-08",
  "2026-07-09",
  "2026-07-10",
  "2026-07-11",
  "2026-07-12",
];

function staffRow(overrides: Partial<FiStaffRow>): FiStaffRow {
  return {
    id: STAFF_ACTIVE,
    tenant_id: TENANT,
    fi_user_id: null,
    full_name: "Dr Seetal",
    staff_role: "doctor",
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

describe("roster grid eligibility rows", () => {
  it("filterRosterGridStaffOptions keeps only eligible staff for the main grid", () => {
    const staffOptions = [
      { id: STAFF_ACTIVE, name: "Active", role: "nurse", isActive: true },
      { id: STAFF_INACTIVE, name: "Inactive", role: "nurse", isActive: false },
    ];
    const gridStaff = filterRosterGridStaffOptions(staffOptions, [STAFF_ACTIVE]);
    assert.equal(gridStaff.length, 1);
    assert.equal(gridStaff[0]?.id, STAFF_ACTIVE);
  });

  it("inactive, archived, and full-period leave staff are excluded from eligible ids", () => {
    const context = buildRosterStaffEligibilityContext({
      staffRows: [
        staffRow({ id: STAFF_ACTIVE, full_name: "Active Staff", is_active: true }),
        staffRow({ id: STAFF_INACTIVE, full_name: "Clara Quinn", is_active: false }),
        staffRow({ id: STAFF_LEAVE, full_name: "Anita Katherine Cottee", is_active: true }),
      ],
      membersByFiStaffId: new Map([
        [STAFF_ACTIVE, { employment_status: "active", archived_at: null }],
        [STAFF_INACTIVE, { employment_status: "inactive", archived_at: null }],
        [STAFF_LEAVE, { employment_status: "on_leave", archived_at: null }],
      ]),
      periodDayDates: PERIOD_DAYS,
      availabilityBlocks: [
        {
          staff_id: STAFF_LEAVE,
          block_type: "maternity_leave",
          starts_at: "2026-07-01T00:00:00.000Z",
          ends_at: "2026-12-31T23:59:59.999Z",
          status: "active",
        },
      ],
    });

    assert.deepEqual(context.eligibleStaffIds, [STAFF_ACTIVE]);
    assert.equal(context.ineligibleStaffOptions.length, 2);
    assert.ok(
      context.ineligibleStaffOptions.some(
        (row) => row.id === STAFF_INACTIVE && row.reasonLabel === "Inactive"
      )
    );
    assert.ok(
      context.ineligibleStaffOptions.some(
        (row) => row.id === STAFF_LEAVE && /maternity leave until/i.test(row.reasonLabel)
      )
    );
  });

  it("marks inactive duplicate profiles when an active same-name staff member exists", () => {
    const context = buildRosterStaffEligibilityContext({
      staffRows: [
        staffRow({ id: STAFF_ACTIVE, full_name: "Dr Seetal", is_active: true }),
        staffRow({ id: STAFF_OLD_DUPLICATE, full_name: "Dr Seetal", is_active: false }),
      ],
      membersByFiStaffId: new Map([
        [STAFF_ACTIVE, { employment_status: "active", archived_at: null }],
        [STAFF_OLD_DUPLICATE, { employment_status: "inactive", archived_at: null }],
      ]),
      periodDayDates: PERIOD_DAYS,
    });

    assert.deepEqual(context.eligibleStaffIds, [STAFF_ACTIVE]);
    const duplicate = context.ineligibleStaffOptions.find((row) => row.id === STAFF_OLD_DUPLICATE);
    assert.equal(duplicate?.reason, "inactive_duplicate");
    assert.equal(duplicate?.reasonLabel, "Inactive duplicate profile");
  });
});

describe("roster grid cell actions", () => {
  it("cell click always opens the shift drawer for eligible managers", () => {
    assert.equal(resolveRosterCellClickIntent({ hasStandardHours: false }), "open_cell_actions");
    assert.equal(resolveRosterCellClickIntent({ hasStandardHours: true }), "open_cell_actions");

    const outcome = resolveRosterCellClickOutcome({
      staffId: STAFF_ACTIVE,
      eligibleStaffIds: [STAFF_ACTIVE],
      canManage: true,
    });
    assert.deepEqual(outcome, { outcome: "open_drawer", mode: "cell-actions" });

    const drawer = openRosterShiftDrawer({
      mode: "cell-actions",
      staffMemberId: STAFF_ACTIVE,
      localDate: "2026-07-06",
      shiftId: null,
    });
    assert.equal(drawer.kind, "shift");
  });

  it("empty cell labels distinguish add shift from generate-or-add", () => {
    assert.equal(resolveRosterEmptyCellLabel({ hasStandardHours: false }), "add_shift");
    assert.equal(
      resolveRosterEmptyCellLabel({ hasStandardHours: true }),
      "generate_or_add_shift"
    );
    assert.equal(staffHasConfiguredStandardHours(undefined), false);
  });

  it("generate-from-standard-hours requires a working day for the selected date", () => {
    const days = applyStandardHoursTemplate("five_eight");
    assert.equal(
      staffHasWorkingStandardHoursForDate({
        standardHours: days,
        localDate: "2026-07-06",
      }),
      true
    );
    assert.equal(
      staffHasWorkingStandardHoursForDate({
        standardHours: days,
        localDate: "2026-07-11",
      }),
      false
    );
  });

  it("denies cell actions for ineligible staff and non-managers", () => {
    const ineligible = resolveRosterCellClickOutcome({
      staffId: STAFF_INACTIVE,
      eligibleStaffIds: [STAFF_ACTIVE],
      canManage: true,
    });
    assert.equal(ineligible.outcome, "deny");

    const denied = resolveRosterCellClickOutcome({
      staffId: STAFF_ACTIVE,
      eligibleStaffIds: [STAFF_ACTIVE],
      canManage: false,
      manageDeniedReason: "No permission",
    });
    assert.deepEqual(denied, { outcome: "deny", message: "No permission" });
  });
});

test("RosterCommandCentreView wires eligible grid rows and ineligible section below grid", () => {
  const src = readFileSync("src/components/fi/workforce/RosterCommandCentreView.tsx", "utf8");
  assert.ok(src.includes("rosterGridStaffOptions"));
  assert.ok(src.includes("resolveRosterCellClickOutcome"));
  assert.ok(src.includes('data-testid="roster-ineligible-staff-toggle"'));
  assert.ok(src.includes("staffOptions={rosterGridStaffOptions}"));
  const gridIndex = src.indexOf("staffOptions={rosterGridStaffOptions}");
  const ineligibleIndex = src.indexOf('data-testid="roster-ineligible-staff-section"');
  assert.ok(gridIndex >= 0 && ineligibleIndex > gridIndex);
});

test("RosterWeekGrid exposes add shift and generate-or-add shift cell affordances", () => {
  const src = readFileSync("src/components/fi/workforce/RosterWeekGrid.tsx", "utf8");
  assert.ok(src.includes('data-testid={`add-shift-${staff.id}-${date}`}'));
  assert.ok(src.includes('data-testid={`generate-or-add-shift-${staff.id}-${date}`}'));
});

test("RosterShiftDrawer exposes generate and manual shift actions with reason field", () => {
  const src = readFileSync("src/components/fi/workforce/RosterShiftDrawer.tsx", "utf8");
  assert.ok(src.includes('data-testid="generate-day-from-standard-hours"'));
  assert.ok(src.includes('data-testid="roster-manual-shift-form"'));
  assert.ok(src.includes('data-testid="roster-shift-adjustment-reason"'));
  assert.ok(src.includes("No standard hours are set for this staff member on this day"));
});

test("RosterShiftDrawer gates mutations when canManage is false", () => {
  const src = readFileSync("src/components/fi/workforce/RosterShiftDrawer.tsx", "utf8");
  assert.ok(src.includes('data-testid="roster-shift-manage-denied"'));
  assert.ok(src.includes("You do not have permission to manage roster shifts."));
  assert.ok(src.includes("{editing && canManage ? ("));
  assert.ok(src.includes('data-testid="roster-shift-cancellation-reason"'));
  assert.ok(src.includes("disabled={pending || !cancellationReason.trim()}"));
});

test("RosterCommandCentreView passes canManage into RosterShiftDrawer", () => {
  const src = readFileSync("src/components/fi/workforce/RosterCommandCentreView.tsx", "utf8");
  assert.ok(src.includes("canManage={canManage}"));
  assert.ok(src.includes("manageDeniedReason={manageDeniedReason}"));
});
