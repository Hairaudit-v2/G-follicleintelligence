import assert from "node:assert/strict";
import test from "node:test";

import { mergeFeatureAccessWithOrganisationalLayers, parseFeatureAccessJsonObject } from "@/src/lib/fi-os/organisationalProfile.merge";

test("parseFeatureAccessJsonObject ignores unknown keys", () => {
  assert.deepEqual(parseFeatureAccessJsonObject({ crm: false, unknown: true }), { crm: false });
});

test("merge order: template then staff overrides win", () => {
  const m = mergeFeatureAccessWithOrganisationalLayers({
    tenantModeDefaults: {},
    templateDefaults: { crm: false, patients: true },
    staffOverrides: { crm: true },
  });
  assert.equal(m.get("crm"), true);
  assert.equal(m.get("patients"), true);
});

test("tenant mode applies before template; override still wins", () => {
  const m = mergeFeatureAccessWithOrganisationalLayers({
    tenantModeDefaults: { academy: false },
    templateDefaults: { academy: true },
    staffOverrides: { academy: false },
  });
  assert.equal(m.get("academy"), false);
});

test("empty tenant mode leaves Stage 2+template behaviour", () => {
  const m = mergeFeatureAccessWithOrganisationalLayers({
    tenantModeDefaults: {},
    templateDefaults: { crm: false },
    staffOverrides: {},
  });
  assert.equal(m.get("crm"), false);
});
