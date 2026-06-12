import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPartialFeatureOverrides,
  assertRegistryCoversAllKeys,
  buildDefaultFeatureAccessAllEnabled,
  FI_FEATURE_KEYS,
  FI_FEATURE_REGISTRY,
} from "@/src/config/fiFeatureAccessRegistry";

test("fi feature registry: covers every key", () => {
  assertRegistryCoversAllKeys();
  assert.equal(FI_FEATURE_KEYS.length, Object.keys(FI_FEATURE_REGISTRY).length);
});

test("default merge: all enabled without overrides", () => {
  const m = buildDefaultFeatureAccessAllEnabled();
  for (const k of FI_FEATURE_KEYS) assert.equal(m.get(k), true);
});

test("explicit override disables feature", () => {
  const m = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), { crm: false });
  assert.equal(m.get("crm"), false);
  assert.equal(m.get("patients"), true);
});
