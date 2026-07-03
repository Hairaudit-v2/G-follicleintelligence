import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { fiOsPendingActionLabel } from "@/src/components/fi-os/FiOsPendingActionButton";

const ACTION_MENU = "src/components/fi/workforce/StaffProfileActionMenu.tsx";
const OVERVIEW = "src/components/fi/workforce/StaffProfileOverviewPanel.tsx";
const PROFILE_CLIENT = "src/components/fi/workforce/WorkforceOsStaffProfileClient.tsx";

test("StaffProfileActionMenu renders sections and pending actions", () => {
  const src = readFileSync(ACTION_MENU, "utf8");
  assert.match(src, /StaffProfileActionMenu/);
  assert.match(src, /FiOsPendingActionButton/);
  assert.match(src, /staff-profile-action-menu/);
  assert.match(src, /staff-profile-action-menu-mobile/);
  assert.match(src, /Primary action/);
  assert.match(src, /sendStaffLoginInviteAction/);
  assert.match(src, /sendOnboardingInviteAction/);
  assert.match(src, /navigator\.clipboard\.writeText/);
  assert.match(src, /Copy manually/);
});

test("StaffProfileActionMenu copy action shows copied pending label", () => {
  assert.equal(fiOsPendingActionLabel("staff-1:copy", "Copy link"), "Copying…");
});

test("StaffProfileOverviewPanel wires action menu in sidebar layout", () => {
  const src = readFileSync(OVERVIEW, "utf8");
  assert.match(src, /StaffProfileActionMenu/);
  assert.match(src, /Recommended next step/);
  assert.match(src, /lg:grid-cols/);
  assert.match(src, /compact/);
  assert.doesNotMatch(src, /Next actions/);
});

test("WorkforceOsStaffProfileClient passes action menu props to overview", () => {
  const src = readFileSync(PROFILE_CLIENT, "utf8");
  assert.match(src, /actionMenu=\{overview\.actionMenu\}/);
  assert.match(src, /actionContext=\{overview\.actionContext\}/);
});

test("Staff profile action menu dangerous actions require confirmation", () => {
  const src = readFileSync(ACTION_MENU, "utf8");
  assert.match(src, /window\.confirm/);
  assert.match(src, /confirmTitle/);
});
