import assert from "node:assert/strict";
import test from "node:test";

import { FI_DASHBOARD_HOME_WIDGET_ORDER } from "@/src/config/fiDashboardRegistry";
import {
  applyPartialFeatureOverrides,
  buildDefaultFeatureAccessAllEnabled,
} from "@/src/config/fiFeatureAccessRegistry";
import { resolveDashboardQuickActions } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";
import {
  filterFiOsPrimarySidebarItemsByFeatureAccess,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import {
  fiDashboardWidgetVisibleByFeatureAccess,
  filterResolvedQuickActionsByFeatureAccess,
} from "@/src/lib/fi-os/stage2FeatureVisibility";

const base = "/fi-admin/t-1";

test("dashboard widgets: clinical_intelligence_summary needs dashboard plus clinical slice", () => {
  const off = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    dashboard: true,
    patients: false,
    cases: false,
    pathology: false,
    imaging: false,
    audit: false,
  });
  assert.equal(
    fiDashboardWidgetVisibleByFeatureAccess("clinical_intelligence_summary", off),
    false
  );

  const on = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    dashboard: true,
    pathology: true,
  });
  assert.equal(fiDashboardWidgetVisibleByFeatureAccess("clinical_intelligence_summary", on), true);
});

test("dashboard widgets: outcome_intelligence_summary needs dashboard plus analytics|audit|cases|patient_twin", () => {
  const off = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    dashboard: true,
    analytics: false,
    audit: false,
    cases: false,
    patient_twin: false,
  });
  assert.equal(fiDashboardWidgetVisibleByFeatureAccess("outcome_intelligence_summary", off), false);

  const on = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    dashboard: true,
    cases: true,
  });
  assert.equal(fiDashboardWidgetVisibleByFeatureAccess("outcome_intelligence_summary", on), true);
});

test("dashboard widgets: null access keeps full order", () => {
  const filtered = FI_DASHBOARD_HOME_WIDGET_ORDER.filter((w) =>
    fiDashboardWidgetVisibleByFeatureAccess(w, null)
  );
  assert.deepEqual(filtered, [...FI_DASHBOARD_HOME_WIDGET_ORDER]);
});

test("dashboard widgets: clinic_metrics hidden when dashboard and analytics off", () => {
  const m = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    dashboard: false,
    analytics: false,
  });
  assert.equal(fiDashboardWidgetVisibleByFeatureAccess("clinic_metrics", m), false);
});

test("dashboard widgets: clinic_metrics visible when analytics on", () => {
  const m = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    dashboard: false,
    analytics: true,
  });
  assert.equal(fiDashboardWidgetVisibleByFeatureAccess("clinic_metrics", m), true);
});

test("dashboard widgets: staff_intelligence_summary requires dashboard and staff", () => {
  const off = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    dashboard: false,
    staff: true,
  });
  assert.equal(fiDashboardWidgetVisibleByFeatureAccess("staff_intelligence_summary", off), false);

  const offStaff = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    dashboard: true,
    staff: false,
  });
  assert.equal(
    fiDashboardWidgetVisibleByFeatureAccess("staff_intelligence_summary", offStaff),
    false
  );

  const on = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    dashboard: true,
    staff: true,
  });
  assert.equal(fiDashboardWidgetVisibleByFeatureAccess("staff_intelligence_summary", on), true);
});

test("quick actions: filters enabled booking when calendar feature off", () => {
  const items = resolveDashboardQuickActions(base, { showCrmNav: true, showBookingsBoard: true });
  const booking = items.find((i) => i.key === "booking");
  assert.ok(booking?.enabled);
  const m = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    calendar: false,
  });
  const next = filterResolvedQuickActionsByFeatureAccess(items, m);
  assert.ok(!next.some((i) => i.key === "booking"));
});

test("quick actions: keeps disabled rows even when feature would allow", () => {
  const items = resolveDashboardQuickActions(base, { showCrmNav: false, showBookingsBoard: true });
  const lead = items.find((i) => i.key === "lead");
  assert.ok(lead && !lead.enabled);
  const m = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), { crm: true });
  const next = filterResolvedQuickActionsByFeatureAccess(items, m);
  assert.ok(next.some((i) => i.key === "lead"));
});

test("sidebar: hides CRM when crm feature off", () => {
  const raw = resolveFiOsPrimarySidebarItems(base, true, true, null, true, true);
  const m = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), { crm: false });
  const filtered = filterFiOsPrimarySidebarItemsByFeatureAccess(raw, m);
  assert.ok(!filtered.some((i) => i.id === "crm"));
});

test("sidebar: null access leaves items in place", () => {
  const raw = resolveFiOsPrimarySidebarItems(base, true, true, null, true, true);
  const filtered = filterFiOsPrimarySidebarItemsByFeatureAccess(raw, null);
  assert.equal(filtered.length, raw.length);
});

test("sidebar: procedure_day sub removed when procedure_day off", () => {
  const raw = resolveFiOsPrimarySidebarItems(base, true, true, null, true, true, false, false, true);
  const cases = raw.find((i) => i.id === "cases");
  const m = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    procedure_day: false,
  });
  const filtered = filterFiOsPrimarySidebarItemsByFeatureAccess(raw, m);
  const cases2 = filtered.find((i) => i.id === "cases");
  assert.ok(cases?.subItems?.some((s) => s.id === "procedure-day-board"));
  assert.ok(cases2?.subItems?.every((s) => s.id !== "procedure-day-board"));
});
