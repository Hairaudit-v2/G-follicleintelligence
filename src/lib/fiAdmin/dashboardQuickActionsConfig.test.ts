import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DASHBOARD_QUICK_ACTION_DEFINITIONS,
  filterDashboardQuickActionDefinitions,
  filterResolvedDashboardQuickActions,
  resolveDashboardQuickActions,
} from "./dashboardQuickActionsConfig";

const TID = "b0000000-0000-4000-8000-0000000000b2";
const base = `/fi-admin/${TID}`;

test("resolveDashboardQuickActions: consultation and case always enabled", () => {
  const items = resolveDashboardQuickActions(base, { showCrmNav: false, showBookingsBoard: false });
  assert.equal(items.find((i) => i.key === "consultation")?.enabled, true);
  assert.equal(items.find((i) => i.key === "case")?.enabled, true);
  assert.equal(items.find((i) => i.key === "booking")?.href, `${base}/calendar`);
});

test("resolveDashboardQuickActions: patient gated by bookings board", () => {
  const off = resolveDashboardQuickActions(base, { showCrmNav: true, showBookingsBoard: false });
  const on = resolveDashboardQuickActions(base, { showCrmNav: true, showBookingsBoard: true });
  assert.equal(off.find((i) => i.key === "patient")?.enabled, false);
  assert.equal(on.find((i) => i.key === "patient")?.enabled, true);
});

test("resolveDashboardQuickActions: lead modal gated by CRM nav", () => {
  const off = resolveDashboardQuickActions(base, { showCrmNav: false, showBookingsBoard: true });
  const on = resolveDashboardQuickActions(base, { showCrmNav: true, showBookingsBoard: true });
  assert.equal(off.find((i) => i.key === "lead")?.enabled, false);
  assert.equal(on.find((i) => i.key === "lead")?.enabled, true);
  assert.equal(on.find((i) => i.key === "lead")?.href, `${base}/crm#fi-os-crm-create-lead`);
});

test("filterDashboardQuickActionDefinitions: subset before resolve", () => {
  const subset = filterDashboardQuickActionDefinitions(
    DASHBOARD_QUICK_ACTION_DEFINITIONS,
    (d) => d.key === "booking"
  );
  const items = resolveDashboardQuickActions(
    base,
    { showCrmNav: false, showBookingsBoard: false },
    subset
  );
  assert.equal(items.length, 1);
  assert.equal(items[0]?.key, "booking");
});

test("filterResolvedDashboardQuickActions: post-filter hook", () => {
  const items = resolveDashboardQuickActions(base, { showCrmNav: true, showBookingsBoard: true });
  const noCases = filterResolvedDashboardQuickActions(items, (i) => i.key !== "case");
  assert.ok(!noCases.some((i) => i.key === "case"));
  assert.ok(noCases.some((i) => i.key === "booking"));
});
