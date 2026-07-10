import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { fiOsPendingActionLabel } from "@/src/components/fi-os/FiOsPendingActionButton";

const APP_SHELL = "src/components/fi-os/FiOsAppShell.tsx";
const LOADING = "app/(fi-admin)/fi-admin/[tenantId]/loading.tsx";
const GLOBALS = "app/globals.css";
const STAFF_ACCESS = "src/components/fi/workforce/StaffAccessCentreClient.tsx";
const ONBOARDING = "src/components/fi-admin/hr/OnboardingCentreClient.tsx";
const STAFF_PROFILE_ACTION_MENU = "src/components/fi/workforce/StaffProfileActionMenu.tsx";
const CALENDAR_QC = "src/components/fi/calendar/CalendarQuickCreateDrawer.tsx";
const PROVIDER = "src/components/fi-os/FiOsNavigationPendingProvider.tsx";

test("FiOsAppShell wires navigation pending shell attributes and progress strip", () => {
  const src = readFileSync(APP_SHELL, "utf8");
  assert.match(src, /data-navigation-pending/);
  assert.match(src, /fi-os-shell/);
  assert.match(src, /FiOsNavigationProgressStrip/);
  assert.match(src, /aria-busy=\{navigationPending/);
  assert.match(src, /onClickCapture=\{navigationPendingEnabled \? onInternalNavClick/);
});

test("root layout mounts site-wide RouteProgressRoot", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /RouteProgressRoot/);
});

test("tenant loading.tsx renders shared FiOsPageLoading", () => {
  const src = readFileSync(LOADING, "utf8");
  assert.match(src, /FiOsPageLoading/);
});

test("globals.css includes shell-scoped progress cursor and reduced-motion-safe animation", () => {
  const css = readFileSync(GLOBALS, "utf8");
  assert.match(css, /\.fi-os-shell\[data-navigation-pending="true"\]/);
  assert.match(css, /cursor: progress/);
  assert.match(css, /@keyframes fi-os-nav-progress/);
});

test("Staff Access resend action exposes pending label mapping", () => {
  const src = readFileSync(STAFF_ACCESS, "utf8");
  assert.match(src, /FiOsPendingActionButton/);
  assert.match(src, /pendingActionKey/);
  assert.equal(fiOsPendingActionLabel("staff-1:resend", "Resend"), "Resending…");
});

test("Onboarding resend action exposes pending label mapping", () => {
  const src = readFileSync(ONBOARDING, "utf8");
  assert.match(src, /FiOsPendingActionButton/);
  assert.match(src, /pendingActionKey/);
  assert.equal(fiOsPendingActionLabel("staff-1:send", "Send invite"), "Sending…");
});

test("Staff profile action menu uses pending action buttons", () => {
  const src = readFileSync(STAFF_PROFILE_ACTION_MENU, "utf8");
  assert.match(src, /FiOsPendingActionButton/);
  assert.match(src, /pendingActionKey/);
  assert.equal(fiOsPendingActionLabel("staff-1:resetPin", "Reset PIN"), "Resetting…");
});

test("Calendar quick create submit shows creating pending copy", () => {
  const src = readFileSync(CALENDAR_QC, "utf8");
  assert.match(src, /Creating…/);
  assert.match(src, /aria-busy=\{busy/);
  assert.match(src, /disabled=\{busy/);
});

test("navigation provider is backed by site-wide RouteProgress", () => {
  const src = readFileSync(PROVIDER, "utf8");
  assert.match(src, /useRouteProgress/);
  assert.match(src, /startPending/);
  assert.match(src, /isNavigationPending: isPending/);
});

test("FiOsPageLoading keeps visible non-animated busy state hooks", () => {
  const src = readFileSync("src/components/fi-os/FiOsPageLoading.tsx", "utf8");
  assert.match(src, /aria-busy="true"/);
  assert.match(src, /motion-safe:animate-pulse/);
  assert.match(src, /sr-only/);
});
