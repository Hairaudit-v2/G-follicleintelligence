import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  pushRosterStandardHoursEditorNavigation,
  resolveRosterCellClickIntent,
  openRosterShiftDrawer,
  resolveRosterStandardHoursEditorNavigation,
} from "@/src/lib/workforce-os/rosterCommandCentreUxCore";
import {
  buildStaffStandardHoursEditorHref,
  buildStaffStandardHoursReturnToRosterHref,
  buildStaffStandardHoursSetupIndexHref,
  STAFF_STANDARD_HOURS_MANAGE_DENIED_REASON,
} from "@/src/lib/workforce-os/staffStandardHoursRoutes";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STAFF = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const ROSTER_VIEW = "src/components/fi/workforce/RosterCommandCentreView.tsx";
const ROSTER_GRID = "src/components/fi/workforce/RosterWeekGrid.tsx";
const ROSTER_DRAWER = "src/components/fi/workforce/RosterRightDrawer.tsx";
const ROSTER_SHIFT_DRAWER = "src/components/fi/workforce/RosterShiftDrawer.tsx";
const STANDARD_HOURS_PANEL = "src/components/fi/workforce/StaffStandardHoursPanel.tsx";
const STANDARD_HOURS_PAGE = "src/components/fi/workforce/StaffStandardHoursPageClient.tsx";

function expectedEditorHref(tenantId: string, staffId: string): string {
  return buildStaffStandardHoursEditorHref(tenantId, staffId, {
    returnTo: buildStaffStandardHoursReturnToRosterHref(tenantId),
  });
}

type NavigationRecorder = { pushes: string[]; push: (href: string) => void };

function createNavigationRecorder(): NavigationRecorder {
  const pushes: string[] = [];
  return {
    pushes,
    push(href: string) {
      pushes.push(href);
    },
  };
}

function sourceIncludes(path: string, ...tokens: string[]): void {
  const src = readFileSync(path, "utf8");
  for (const token of tokens) {
    assert.ok(src.includes(token), `expected ${path} to include ${token}`);
  }
}

test("resolveRosterStandardHoursEditorNavigation returns the editor href when manage is allowed", () => {
  const result = resolveRosterStandardHoursEditorNavigation({
    tenantId: TENANT,
    staffMemberId: STAFF,
    canManage: true,
  });

  assert.deepEqual(result, {
    outcome: "navigate",
    href: expectedEditorHref(TENANT, STAFF),
  });
});

test("pushRosterStandardHoursEditorNavigation calls router.push with the editor href", () => {
  const router = createNavigationRecorder();
  const result = pushRosterStandardHoursEditorNavigation(router, {
    tenantId: TENANT,
    staffMemberId: STAFF,
    canManage: true,
  });

  assert.equal(result.outcome, "navigate");
  assert.deepEqual(router.pushes, [expectedEditorHref(TENANT, STAFF)]);
});

test("pushRosterStandardHoursEditorNavigation denies when manage permission is missing", () => {
  const router = createNavigationRecorder();
  const result = pushRosterStandardHoursEditorNavigation(router, {
    tenantId: TENANT,
    staffMemberId: STAFF,
    canManage: false,
    manageDeniedReason: "Denied",
  });

  assert.deepEqual(result, { outcome: "deny", reason: "Denied" });
  assert.deepEqual(router.pushes, []);
});

test("cell click opens the shift drawer for eligible managers", () => {
  const intent = resolveRosterCellClickIntent({ hasStandardHours: false });
  assert.equal(intent, "open_cell_actions");

  const drawer = openRosterShiftDrawer({
    mode: "cell-actions",
    staffMemberId: STAFF,
    localDate: "2026-07-06",
    shiftId: null,
  });
  assert.equal(drawer.kind, "shift");
});

test("per-staff onEditStandardHours uses the same editor navigation contract", () => {
  const router = createNavigationRecorder();
  const openStandardHoursDrawer = (staffMemberId: string) =>
    pushRosterStandardHoursEditorNavigation(router, {
      tenantId: TENANT,
      staffMemberId,
      canManage: true,
      manageDeniedReason: STAFF_STANDARD_HOURS_MANAGE_DENIED_REASON,
    });

  const result = openStandardHoursDrawer(STAFF);
  assert.equal(result.outcome, "navigate");
  assert.deepEqual(router.pushes, [expectedEditorHref(TENANT, STAFF)]);
});

test("RosterCommandCentreView exposes roster workflow actions and editor navigation helper", () => {
  sourceIncludes(
    ROSTER_VIEW,
    'data-testid="roster-standard-hours-banner-cta"',
    'data-testid="roster-apply-default-clinic-hours"',
    'data-testid="roster-create-blank-button"',
    'data-testid="roster-clear-generated-button"',
    'data-testid="roster-regenerate-button"',
    "clearGeneratedRosterShiftsAction",
    "pushRosterStandardHoursEditorNavigation",
    "onEditStandardHours={openStandardHoursDrawer}",
    "data-roster-cadence={rosterCadence}",
    "copyPreviousRosterPeriodAction",
    "rosterGenerateActionLabel",
    "shiftRosterPeriodStart"
  );
  assert.equal(
    buildStaffStandardHoursSetupIndexHref(TENANT),
    `/fi-admin/${TENANT}/workforce-os/roster/standard-hours`
  );
});

test("RosterWeekGrid exposes per-staff standard-hours CTA and add-shift cell hint", () => {
  sourceIncludes(
    ROSTER_GRID,
    "buildStaffStandardHoursEditorHref",
    "data-testid={`standard-hours-button-${staff.id}`}",
    "data-testid={`standard-hours-button-disabled-${staff.id}`}",
    "onEditStandardHours?.(staff.id)",
    "Add shift"
  );
  assert.equal(expectedEditorHref(TENANT, STAFF).includes(STAFF), true);
});

test("RosterRightDrawer portals full-viewport overlay to document.body (no chrome-offset collapse)", () => {
  sourceIncludes(
    ROSTER_DRAWER,
    '"use client"',
    "createPortal",
    "document.body",
    'data-roster-drawer-viewport="full"',
    "fixed inset-0 z-[400]",
    "max-h-[100dvh]"
  );
  const src = readFileSync(ROSTER_DRAWER, "utf8");
  assert.ok(
    !src.includes("rightDrawerOverlay"),
    "must not use chrome-offset overlay that can collapse to zero height"
  );
});

test("shift drawer edit-standard-hours action is a non-submit button", () => {
  const shiftDrawer = readFileSync(ROSTER_SHIFT_DRAWER, "utf8");
  const standardHoursPanel = readFileSync(STANDARD_HOURS_PANEL, "utf8");
  const router = createNavigationRecorder();

  assert.ok(shiftDrawer.includes("Edit standard hours"));
  assert.ok(shiftDrawer.includes('type="button"'));
  assert.ok(shiftDrawer.includes("onEditStandardHours(staffId)"));
  assert.ok(standardHoursPanel.includes("Save and generate roster"));
  assert.ok(standardHoursPanel.includes('type="button"'));

  const result = pushRosterStandardHoursEditorNavigation(router, {
    tenantId: TENANT,
    staffMemberId: STAFF,
    canManage: true,
  });
  assert.equal(result.outcome, "navigate");
  assert.deepEqual(router.pushes, [expectedEditorHref(TENANT, STAFF)]);
});

test("StaffStandardHoursPageClient exposes index and editor surfaces", () => {
  sourceIncludes(
    STANDARD_HOURS_PAGE,
    "StaffStandardHoursIndexClient",
    "StaffStandardHoursEditorClient",
    "buildStaffStandardHoursEditorHref",
    'data-testid="standard-hours-manage-denied"'
  );
});

test("RosterShiftDrawer passes canManage from command centre and supports generated shift edit/remove", () => {
  sourceIncludes(
    ROSTER_VIEW,
    "canManage={canManage}",
    "canManageStandardHours={canManageStandardHours}",
    "resolveRosterManageDeniedMessage",
    "manageDeniedMessage",
    "tenantTimezone={payload.tenantTimezone}",
    "staffTimezone={payload.staffTimezoneByStaffId",
    "handleShiftClick",
    "dayShifts={drawerDayShifts}",
    "buildWorkforceStaffProfileHref",
    "onQuickCancelShift",
    "onMarkPeriodAway",
    "roster-quick-cancel-modal",
    "handleMarkPeriodAway"
  );
  sourceIncludes(
    ROSTER_SHIFT_DRAWER,
    "canManage?: boolean",
    "canManageStandardHours?: boolean",
    "tenantTimezone: string",
    "staffTimezone?: string | null",
    "collectCancellableRosterDayShifts",
    "resolveRosterManageDeniedMessage",
    'data-testid="roster-shift-manage-denied"',
    'data-testid="roster-shift-cancel-confirm"',
    "ROSTER_SHIFT_DRAWER_CANCELLATION_REASONS",
    "createRosterShiftAction",
    "createAvailabilityBlockAction",
    "roster-mark-day-away-panel",
    "roster-mark-sick-leave",
    "roster-mark-personal-leave",
    "rosterShiftDatetimeLocalToUtcIso",
    "updateRosterShiftAction",
    "openInEditMode",
    "isGeneratedShiftSource",
    "Remove this shift"
  );
});

test("cancelRosterShiftAction uses audited manual adjustment cancel path", () => {
  const actions = readFileSync("src/lib/actions/workforce-roster-actions.ts", "utf8");
  assert.ok(actions.includes("cancelStaffShiftWithReason"));
  assert.ok(!actions.includes("cancelStaffShift("));
  assert.ok(actions.includes("ROSTER_SHIFT_CANCELLATION_REASON_REQUIRED_MESSAGE"));
});