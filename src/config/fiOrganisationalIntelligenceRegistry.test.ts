import assert from "node:assert/strict";
import test from "node:test";

import {
  assertFiOrganisationalIntelligenceRegistryComplete,
  FI_CLINICAL_ACCESS_LEVELS,
  FI_ORG_DEPARTMENT_KEYS,
  FI_STAFF_FEATURE_TEMPLATE_KEYS,
  FI_STAFF_POSITION_TYPE_CODES,
  FI_TENANT_OPERATING_MODE_KEYS,
} from "@/src/config/fiOrganisationalIntelligenceRegistry";

test("registry completeness guard", () => {
  assert.doesNotThrow(() => assertFiOrganisationalIntelligenceRegistryComplete());
});

test("position type codes are unique and upper snake", () => {
  const set = new Set(FI_STAFF_POSITION_TYPE_CODES);
  assert.equal(set.size, FI_STAFF_POSITION_TYPE_CODES.length);
  for (const c of FI_STAFF_POSITION_TYPE_CODES) {
    assert.match(c, /^[A-Z0-9_]+$/);
  }
});

test("template keys are unique slug_case", () => {
  const set = new Set(FI_STAFF_FEATURE_TEMPLATE_KEYS);
  assert.equal(set.size, FI_STAFF_FEATURE_TEMPLATE_KEYS.length);
});

test("operating mode keys are unique", () => {
  const set = new Set(FI_TENANT_OPERATING_MODE_KEYS);
  assert.equal(set.size, FI_TENANT_OPERATING_MODE_KEYS.length);
});

test("department and clinical level catalogues are non-empty", () => {
  assert.ok(FI_ORG_DEPARTMENT_KEYS.length >= 8);
  assert.ok(FI_CLINICAL_ACCESS_LEVELS.length >= 5);
});
