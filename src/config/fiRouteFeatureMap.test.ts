import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeFiAdminTenantPathSuffix,
  resolveRequiredFiFeatureForTenantSuffix,
} from "@/src/config/fiRouteFeatureMap";

test("normalize: strips tenant base and query", () => {
  assert.equal(
    normalizeFiAdminTenantPathSuffix("/fi-admin/t1/calendar?view=day", "/fi-admin/t1"),
    "calendar"
  );
});

test("resolve: tenant root → dashboard", () => {
  assert.equal(resolveRequiredFiFeatureForTenantSuffix(""), "dashboard");
});

test("resolve: unknown experimental route → null", () => {
  assert.equal(resolveRequiredFiFeatureForTenantSuffix("experimental-lab/foo"), null);
});

test("resolve: patients twin override", () => {
  assert.equal(resolveRequiredFiFeatureForTenantSuffix("patients/u1/twin"), "patient_twin");
});

test("resolve: patients default", () => {
  assert.equal(resolveRequiredFiFeatureForTenantSuffix("patients/u1"), "patients");
});

test("resolve: payments inbox → settings feature gate", () => {
  assert.equal(resolveRequiredFiFeatureForTenantSuffix("payments"), "settings");
});

test("resolve: procedure day nested under cases", () => {
  assert.equal(resolveRequiredFiFeatureForTenantSuffix("cases/u1/procedure-day"), "procedure_day");
});

test("resolve: top-level procedure-day", () => {
  assert.equal(resolveRequiredFiFeatureForTenantSuffix("procedure-day"), "procedure_day");
});
