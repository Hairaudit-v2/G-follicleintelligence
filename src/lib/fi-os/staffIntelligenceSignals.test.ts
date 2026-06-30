import assert from "node:assert/strict";
import test from "node:test";

import { FI_ORGANISATIONAL_INTELLIGENCE_SIGNAL_KEYS } from "@/src/config/fiOrganisationalIntelligenceSignals";
import {
  buildStaffSignalCards,
  severityForSignalCount,
} from "@/src/lib/fi-os/staffIntelligenceSignals";

test("severity: zero count is always info", () => {
  for (const k of FI_ORGANISATIONAL_INTELLIGENCE_SIGNAL_KEYS) {
    assert.equal(severityForSignalCount(k, 0), "info");
    assert.equal(severityForSignalCount(k, -3), "info");
  }
});

test("severity: consultations_assigned uses registry thresholds", () => {
  assert.equal(severityForSignalCount("consultations_assigned", 2), "info");
  assert.equal(severityForSignalCount("consultations_assigned", 3), "attention");
  assert.equal(severityForSignalCount("consultations_assigned", 7), "attention");
  assert.equal(severityForSignalCount("consultations_assigned", 8), "critical");
});

test("signal cards: empty counts yield info severity and full key coverage", () => {
  const cards = buildStaffSignalCards({});
  assert.equal(cards.length, FI_ORGANISATIONAL_INTELLIGENCE_SIGNAL_KEYS.length);
  assert.ok(cards.every((c) => c.severity === "info" && c.count === 0));
  const keys = new Set(cards.map((c) => c.key));
  for (const k of FI_ORGANISATIONAL_INTELLIGENCE_SIGNAL_KEYS) {
    assert.ok(keys.has(k));
  }
});
