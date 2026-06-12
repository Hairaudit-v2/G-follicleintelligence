import assert from "node:assert/strict";
import { test } from "node:test";

import { attentionSeverityForRow } from "@/src/components/fi-admin/dashboard/DashboardActionCentre";

test("attentionSeverityForRow: surgery readiness critical when > 0", () => {
  assert.equal(attentionSeverityForRow("surgeryReadiness", 1), "critical");
  assert.equal(attentionSeverityForRow("surgeryReadiness", 0), "normal");
});

test("attentionSeverityForRow: leads thresholds", () => {
  assert.equal(attentionSeverityForRow("leads", 0), "normal");
  assert.equal(attentionSeverityForRow("leads", 25), "normal");
  assert.equal(attentionSeverityForRow("leads", 26), "warning");
  assert.equal(attentionSeverityForRow("leads", 100), "warning");
  assert.equal(attentionSeverityForRow("leads", 101), "critical");
});

test("attentionSeverityForRow: consultations and follow-ups", () => {
  assert.equal(attentionSeverityForRow("consultations", 5), "normal");
  assert.equal(attentionSeverityForRow("consultations", 6), "warning");
  assert.equal(attentionSeverityForRow("followUps", 3), "normal");
  assert.equal(attentionSeverityForRow("followUps", 4), "warning");
});
