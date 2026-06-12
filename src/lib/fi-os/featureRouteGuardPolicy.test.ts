import assert from "node:assert/strict";
import test from "node:test";

import { applyPartialFeatureOverrides, buildDefaultFeatureAccessAllEnabled } from "@/src/config/fiFeatureAccessRegistry";
import { resolveFiFeatureRouteDecision } from "@/src/lib/fi-os/featureRouteGuardPolicy";

const base = "/fi-admin/t1";

test("decision: null map always allows (platform-style bypass)", () => {
  const d = resolveFiFeatureRouteDecision({
    pathname: `${base}/calendar`,
    tenantBase: base,
    featureAccessMap: null,
    isActiveTenantBackendAdmin: false,
  });
  assert.equal(d.kind, "allow");
});

test("decision: unknown route allows with concrete map", () => {
  const m = buildDefaultFeatureAccessAllEnabled();
  const d = resolveFiFeatureRouteDecision({
    pathname: `${base}/experimental/thing`,
    tenantBase: base,
    featureAccessMap: m,
    isActiveTenantBackendAdmin: false,
  });
  assert.equal(d.kind, "allow");
});

test("decision: disabled feature denies", () => {
  const m = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), { calendar: false });
  const d = resolveFiFeatureRouteDecision({
    pathname: `${base}/calendar`,
    tenantBase: base,
    featureAccessMap: m,
    isActiveTenantBackendAdmin: false,
  });
  assert.equal(d.kind, "deny");
  if (d.kind === "deny") assert.equal(d.feature, "calendar");
});

test("decision: tenant admin may access settings routes when settings feature off", () => {
  const m = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), { settings: false });
  const d = resolveFiFeatureRouteDecision({
    pathname: `${base}/configuration`,
    tenantBase: base,
    featureAccessMap: m,
    isActiveTenantBackendAdmin: true,
  });
  assert.equal(d.kind, "allow");
});

test("decision: non-admin blocked from settings when settings off", () => {
  const m = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), { settings: false });
  const d = resolveFiFeatureRouteDecision({
    pathname: `${base}/settings/reminders`,
    tenantBase: base,
    featureAccessMap: m,
    isActiveTenantBackendAdmin: false,
  });
  assert.equal(d.kind, "deny");
});

test("decision: module-unavailable always allows", () => {
  const m = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), { calendar: false });
  const d = resolveFiFeatureRouteDecision({
    pathname: `${base}/module-unavailable?featureDenied=calendar`,
    tenantBase: base,
    featureAccessMap: m,
    isActiveTenantBackendAdmin: false,
  });
  assert.equal(d.kind, "allow");
});
