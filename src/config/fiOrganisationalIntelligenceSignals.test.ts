import assert from "node:assert/strict";
import test from "node:test";

import {
  FI_ORGANISATIONAL_INTELLIGENCE_SIGNAL_KEYS,
  FI_ORGANISATIONAL_INTELLIGENCE_SIGNALS,
} from "@/src/config/fiOrganisationalIntelligenceSignals";
import { FI_WORKSPACE_PROFILES } from "@/src/config/fiWorkspaceProfiles";

const workspaceKeys = new Set(Object.keys(FI_WORKSPACE_PROFILES));

test("intelligence signals: every declared key has a definition and matches record keys", () => {
  const recordKeys = Object.keys(FI_ORGANISATIONAL_INTELLIGENCE_SIGNALS).sort();
  const declared = [...FI_ORGANISATIONAL_INTELLIGENCE_SIGNAL_KEYS].sort();
  assert.deepEqual(recordKeys, declared);
  for (const k of FI_ORGANISATIONAL_INTELLIGENCE_SIGNAL_KEYS) {
    const def = FI_ORGANISATIONAL_INTELLIGENCE_SIGNALS[k];
    assert.equal(def.key, k);
    assert.ok(def.label.length > 0);
    assert.ok(def.description.length > 0);
    assert.ok(def.attention_min >= 0);
    if (def.critical_min != null) {
      assert.ok(
        def.critical_min >= def.attention_min,
        `${k}: critical_min should be >= attention_min`
      );
    }
    for (const wp of def.related_workspace_profiles) {
      assert.ok(workspaceKeys.has(wp), `${k}: unknown workspace profile ${wp}`);
    }
  }
});
