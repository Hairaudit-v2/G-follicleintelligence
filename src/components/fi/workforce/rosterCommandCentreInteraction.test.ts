import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  resolveRosterCellClickOutcome,
  resolveRosterDrawerStaffContext,
  resolveRosterStandardHoursEditorNavigation,
  openRosterShiftDrawer,
} from "@/src/lib/workforce-os/rosterCommandCentreUxCore";
import { STAFF_STANDARD_HOURS_MANAGE_DENIED_REASON } from "@/src/lib/workforce-os/staffStandardHoursRoutes";

const ROSTER_VIEW = "src/components/fi/workforce/RosterCommandCentreView.tsx";
const ROSTER_GRID = "src/components/fi/workforce/RosterWeekGrid.tsx";

const STAFF = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

test("roster view shows an explicit permission banner and error surfaces (no silent no-op)", () => {
  const src = readFileSync(ROSTER_VIEW, "utf8");
  assert.ok(src.includes('data-testid="roster-manage-denied-banner"'));
  assert.ok(src.includes('data-testid="roster-action-error"'));
  assert.ok(src.includes('role="alert"'));
  // Drawer staff must resolve from grid options and shift payload — never staffOptions alone.
  assert.ok(src.includes("resolveRosterDrawerStaffContext"));
  assert.ok(src.includes("rosterGridStaffOptions"));
  assert.ok(src.includes("openShiftDrawer"));
});

test("roster grid cells stay clickable without manage permission so the deny message can surface", () => {
  const src = readFileSync(ROSTER_GRID, "utf8");
  // The add/generate cell must not be a disabled dead button.
  assert.ok(
    !src.includes("disabled={!canManage && emptyCell}"),
    "grid cells must not be disabled into a silent no-op"
  );
  assert.ok(
    !src.includes("if (!canManage) return;"),
    "grid must delegate permission handling to the parent so a message is shown"
  );
  assert.ok(src.includes("onCellClick?.(staff.id, date)"));
  assert.ok(src.includes("data-roster-shift-id"));
  assert.ok(src.includes("onShiftClick?.(shift)"));
  assert.ok(
    !src.includes('role="presentation"'),
    "shift cards must not use nested click handlers inside the cell surface"
  );
  assert.ok(
    !src.match(/pointer-events-none/),
    "interactive roster cells must not use pointer-events-none"
  );
  // The no-permission standard-hours control is a real button wired to the
  // deny-messaging handler, not an inert span.
  assert.ok(src.includes("onClick={() => onEditStandardHours?.(staff.id)}"));
});

test("cell click without manage permission resolves an explicit deny message", () => {
  const outcome = resolveRosterCellClickOutcome({
    staffId: STAFF,
    eligibleStaffIds: [STAFF],
    canManage: false,
  });
  assert.deepEqual(outcome, {
    outcome: "deny",
    message: STAFF_STANDARD_HOURS_MANAGE_DENIED_REASON,
  });
});

test("cell click for a non-eligible staff member resolves an explicit ineligibility message", () => {
  const outcome = resolveRosterCellClickOutcome({
    staffId: STAFF,
    eligibleStaffIds: [],
    canManage: true,
  });
  assert.equal(outcome.outcome, "deny");
  assert.ok("message" in outcome && outcome.message.length > 0);
});

test("standard-hours editor navigation denies with a reason when manage is missing", () => {
  const result = resolveRosterStandardHoursEditorNavigation({
    tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    staffMemberId: STAFF,
    canManage: false,
  });
  assert.deepEqual(result, {
    outcome: "deny",
    reason: STAFF_STANDARD_HOURS_MANAGE_DENIED_REASON,
  });
});

test("resolveRosterDrawerStaffContext prefers grid staff when staffOptions omits the row", () => {
  const drawer = openRosterShiftDrawer({
    mode: "cell-actions",
    staffMemberId: STAFF,
    localDate: "2026-07-06",
    shiftId: null,
  });

  const staff = resolveRosterDrawerStaffContext({
    drawer,
    staffOptions: [],
    rosterGridStaffOptions: [{ id: STAFF, name: "Paul Green", role: "doctor" }],
  });

  assert.deepEqual(staff, { id: STAFF, name: "Paul Green", role: "doctor" });
});

test("resolveRosterDrawerStaffContext falls back to shift staff when lists omit the row", () => {
  const drawer = openRosterShiftDrawer({
    mode: "edit",
    staffMemberId: STAFF,
    localDate: "2026-07-06",
    shiftId: "shift-1",
  });

  const staff = resolveRosterDrawerStaffContext({
    drawer,
    staffOptions: [],
    rosterGridStaffOptions: [],
    selectedShift: {
      staff_id: STAFF,
      staffName: "Paul Green",
    },
  });

  assert.deepEqual(staff, { id: STAFF, name: "Paul Green", role: null });
});
