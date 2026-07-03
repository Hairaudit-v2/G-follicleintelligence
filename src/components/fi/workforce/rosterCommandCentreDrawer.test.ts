import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ROSTER_VIEW = "src/components/fi/workforce/RosterCommandCentreView.tsx";
const ROSTER_GRID = "src/components/fi/workforce/RosterWeekGrid.tsx";
const ROSTER_DRAWER = "src/components/fi/workforce/RosterRightDrawer.tsx";
const ROSTER_SHIFT_DRAWER = "src/components/fi/workforce/RosterShiftDrawer.tsx";
const STANDARD_HOURS_PANEL = "src/components/fi/workforce/StaffStandardHoursPanel.tsx";
const STANDARD_HOURS_PAGE = "src/components/fi/workforce/StaffStandardHoursPageClient.tsx";

test("RosterCommandCentreView navigates to dedicated standard-hours routes", () => {
  const src = readFileSync(ROSTER_VIEW, "utf8");

  assert.match(src, /"use client"/);
  assert.match(src, /buildStaffStandardHoursSetupIndexHref/);
  assert.match(src, /buildStaffStandardHoursEditorHref/);
  assert.match(src, /data-testid="roster-standard-hours-banner-cta"/);
  assert.match(src, /canManage/);
  assert.match(src, /router\.push\(buildStaffStandardHoursEditorHref/);
  assert.match(src, /onEditStandardHours=\{openStandardHoursDrawer\}/);
  assert.doesNotMatch(src, /<StaffStandardHoursPanel/);
});

test("RosterWeekGrid links per-staff standard-hours buttons to editor route", () => {
  const src = readFileSync(ROSTER_GRID, "utf8");

  assert.match(src, /"use client"/);
  assert.match(src, /buildStaffStandardHoursEditorHref/);
  assert.match(src, /data-testid=\{`standard-hours-button-\$\{staff\.id\}`\}/);
  assert.match(src, /data-testid=\{`standard-hours-button-disabled-\$\{staff\.id\}`\}/);
  assert.match(src, /onClick=\{\(\) => onCellClick\?\.\(staff\.id, date\)\}/);
  assert.match(src, /Set standard hours first/);
});

test("RosterRightDrawer portals to document.body with chrome-aware and full-viewport fallback", () => {
  const src = readFileSync(ROSTER_DRAWER, "utf8");

  assert.match(src, /"use client"/);
  assert.match(src, /createPortal/);
  assert.match(src, /document\.body/);
  assert.match(src, /fiOsChromeClasses\.rightDrawerOverlay/);
  assert.match(src, /z-\[200\]/);
  assert.match(src, /data-roster-drawer-viewport/);
  assert.match(src, /useLayoutEffect/);
});

test("shift drawer edit-standard-hours action is a non-submit button", () => {
  const shiftDrawer = readFileSync(ROSTER_SHIFT_DRAWER, "utf8");
  const standardHoursPanel = readFileSync(STANDARD_HOURS_PANEL, "utf8");

  assert.match(shiftDrawer, /Edit standard hours/);
  assert.match(shiftDrawer, /type="button"/);
  assert.match(shiftDrawer, /onEditStandardHours\(staffId\)/);
  assert.match(standardHoursPanel, /Save and generate roster/);
  assert.match(standardHoursPanel, /type="button"/);
});

test("StaffStandardHoursPageClient exposes index and editor surfaces", () => {
  const src = readFileSync(STANDARD_HOURS_PAGE, "utf8");

  assert.match(src, /StaffStandardHoursIndexClient/);
  assert.match(src, /StaffStandardHoursEditorClient/);
  assert.match(src, /buildStaffStandardHoursEditorHref/);
  assert.match(src, /data-testid="standard-hours-manage-denied"/);
});