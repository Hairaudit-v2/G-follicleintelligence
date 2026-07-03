import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ROSTER_VIEW = "src/components/fi/workforce/RosterCommandCentreView.tsx";
const ROSTER_GRID = "src/components/fi/workforce/RosterWeekGrid.tsx";
const ROSTER_DRAWER = "src/components/fi/workforce/RosterRightDrawer.tsx";
const ROSTER_SHIFT_DRAWER = "src/components/fi/workforce/RosterShiftDrawer.tsx";
const STANDARD_HOURS_PANEL = "src/components/fi/workforce/StaffStandardHoursPanel.tsx";

test("RosterCommandCentreView uses unified drawer state and standard-hours entry points", () => {
  const src = readFileSync(ROSTER_VIEW, "utf8");

  assert.match(src, /"use client"/);
  assert.match(src, /useState<RosterCommandCentreDrawerState>/);
  assert.match(src, /openRosterStandardHoursDrawer/);
  assert.match(src, /openRosterMissingStandardHoursSetupDrawer/);
  assert.match(src, /openStandardHoursDrawer/);
  assert.match(src, /openMissingStandardHoursSetupDrawer/);
  assert.match(src, /data-roster-drawer-kind=\{drawerState\.kind\}/);
  assert.match(src, /data-testid="roster-standard-hours-banner-cta"/);
  assert.match(src, /onEditStandardHours=\{openStandardHoursDrawer\}/);
  assert.match(src, /resolveRosterPayloadWeekDayDates/);
  assert.match(src, /resolveRosterCellClickIntent/);
  assert.match(src, /formatStandardHoursDrawerTitle\(drawerStaffName\)/);
  assert.match(src, /<StaffStandardHoursPanel/);
  assert.match(src, /data-testid="roster-standard-hours-open-error"/);
});

test("RosterWeekGrid wires standard-hours buttons and cell clicks with type=button", () => {
  const src = readFileSync(ROSTER_GRID, "utf8");

  assert.match(src, /"use client"/);
  assert.match(src, /onClick=\{\(\) => onEditStandardHours\(staff\.id\)\}/);
  assert.match(src, /data-testid=\{`standard-hours-button-\$\{staff\.id\}`\}/);
  assert.match(src, /onClick=\{\(\) => onCellClick\?\.\(staff\.id, date\)\}/);
  assert.match(src, /type="button"/);
  assert.match(src, /Set standard hours first/);
});

test("RosterRightDrawer portals to document.body and uses FI OS drawer chrome", () => {
  const src = readFileSync(ROSTER_DRAWER, "utf8");

  assert.match(src, /"use client"/);
  assert.match(src, /createPortal/);
  assert.match(src, /document\.body/);
  assert.match(src, /typeof document === "undefined"/);
  assert.match(src, /fiOsChromeClasses\.rightDrawerOverlay/);
  assert.match(src, /z-\[190\]/);
  assert.match(src, /type="button"/);
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
