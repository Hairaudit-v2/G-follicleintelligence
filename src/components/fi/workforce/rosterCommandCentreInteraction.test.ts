import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  resolveRosterCellClickOutcome,
  resolveRosterStandardHoursEditorNavigation,
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
  // Drawer must fall back to the shift's own staff name — a shift click can
  // never silently fail when staff options are filtered.
  assert.ok(src.includes("drawerShift.staffName"));
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
  assert.ok(src.includes("onClick={() => onCellClick?.(staff.id, date)}"));
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
