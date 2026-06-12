import assert from "node:assert/strict";
import test from "node:test";

import { FI_DASHBOARD_HOME_WIDGET_ORDER, FI_DASHBOARD_WIDGET_KEYS } from "@/src/config/fiDashboardRegistry";
import { applyPartialFeatureOverrides, buildDefaultFeatureAccessAllEnabled } from "@/src/config/fiFeatureAccessRegistry";
import { composeWorkspaceDashboardWidgets } from "@/src/lib/fi-os/workspaceDashboardComposer";

test("composer: surgeon profile includes clinical intelligence widget", () => {
  const got = composeWorkspaceDashboardWidgets({
    workspaceProfile: "surgeon",
    featureAccess: null,
    registryBaselineOrder: FI_DASHBOARD_HOME_WIDGET_ORDER,
    availableWidgets: FI_DASHBOARD_WIDGET_KEYS,
  });
  assert.ok(got.includes("clinical_intelligence_summary"));
  assert.ok(got.includes("outcome_intelligence_summary"));
});

test("composer: consultant profile does not include clinical intelligence by default", () => {
  const got = composeWorkspaceDashboardWidgets({
    workspaceProfile: "consultant",
    featureAccess: null,
    registryBaselineOrder: FI_DASHBOARD_HOME_WIDGET_ORDER,
    availableWidgets: FI_DASHBOARD_WIDGET_KEYS,
  });
  assert.ok(!got.includes("clinical_intelligence_summary"));
  assert.ok(!got.includes("outcome_intelligence_summary"));
});

test("composer: default profile matches Stage 2 baseline order (filtered)", () => {
  const access = null;
  const got = composeWorkspaceDashboardWidgets({
    workspaceProfile: "default",
    featureAccess: access,
    registryBaselineOrder: FI_DASHBOARD_HOME_WIDGET_ORDER,
    availableWidgets: FI_DASHBOARD_WIDGET_KEYS,
  });
  assert.deepEqual(got, [...FI_DASHBOARD_HOME_WIDGET_ORDER]);
});

test("composer: surgeon profile reorders known widgets", () => {
  const got = composeWorkspaceDashboardWidgets({
    workspaceProfile: "surgeon",
    featureAccess: null,
    registryBaselineOrder: FI_DASHBOARD_HOME_WIDGET_ORDER,
    availableWidgets: FI_DASHBOARD_WIDGET_KEYS,
  });
  assert.equal(got[0], "surgery_pipeline");
  assert.ok(got.includes("operational_workspace"));
});

test("composer: feature access removes analytics for director stack", () => {
  const access = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    analytics: false,
    dashboard: false,
    audit: false,
  });
  const got = composeWorkspaceDashboardWidgets({
    workspaceProfile: "director",
    featureAccess: access,
    registryBaselineOrder: FI_DASHBOARD_HOME_WIDGET_ORDER,
    availableWidgets: FI_DASHBOARD_WIDGET_KEYS,
  });
  assert.ok(!got.includes("analytics_summary"));
  assert.ok(!got.includes("audit_summary"));
  assert.ok(got.length > 0);
});

test("composer: never returns an empty dashboard", () => {
  const access = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    quick_actions: false,
    dashboard: false,
    analytics: false,
    calendar: false,
    cases: false,
    surgery_pipeline: false,
    my_workspace: false,
    attention_centre: false,
    crm: false,
    consultations: false,
    imaging: false,
    patient_twin: false,
    pathology: false,
    audit: false,
  });
  const got = composeWorkspaceDashboardWidgets({
    workspaceProfile: "consultant",
    featureAccess: access,
    registryBaselineOrder: FI_DASHBOARD_HOME_WIDGET_ORDER,
    availableWidgets: FI_DASHBOARD_WIDGET_KEYS,
  });
  assert.ok(got.length > 0);
});
