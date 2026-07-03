import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  pushRosterStandardHoursEditorNavigation,
  resolveRosterCellClickIntent,
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

test("cell click without standard hours navigates to the same editor href", () => {
  const intent = resolveRosterCellClickIntent({ hasStandardHours: false });
  assert.equal(intent, "open_standard_hours");

  const router = createNavigationRecorder();
  const result = pushRosterStandardHoursEditorNavigation(router, {
    tenantId: TENANT,
    staffMemberId: STAFF,
    canManage: true,
  });

  assert.equal(result.outcome, "navigate");
  assert.deepEqual(router.pushes, [expectedEditorHref(TENANT, STAFF)]);
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

test("RosterCommandCentreView exposes standard-hours banner CTA and wires editor navigation helper", () => {
  sourceIncludes(
    ROSTER_VIEW,
    'data-testid="roster-standard-hours-banner-cta"',
    'data-testid="roster-apply-default-clinic-hours"',
    "pushRosterStandardHoursEditorNavigation",
    "onEditStandardHours={openStandardHoursDrawer}"
  );
  assert.equal(
    buildStaffStandardHoursSetupIndexHref(TENANT),
    `/fi-admin/${TENANT}/workforce-os/roster/standard-hours`
  );
});

test("RosterWeekGrid exposes per-staff standard-hours CTA and missing-hours cell hint", () => {
  sourceIncludes(
    ROSTER_GRID,
    "buildStaffStandardHoursEditorHref",
    "data-testid={`standard-hours-button-${staff.id}`}",
    "data-testid={`standard-hours-button-disabled-${staff.id}`}",
    "onEditStandardHours?.(staff.id)",
    "Set standard hours first"
  );
  assert.equal(expectedEditorHref(TENANT, STAFF).includes(STAFF), true);
});

test("RosterRightDrawer portals to document.body with chrome-aware and full-viewport fallback", () => {
  sourceIncludes(
    ROSTER_DRAWER,
    '"use client"',
    "createPortal",
    "document.body",
    "fiOsChromeClasses.rightDrawerOverlay",
    "z-[200]",
    "data-roster-drawer-viewport",
    "useLayoutEffect"
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