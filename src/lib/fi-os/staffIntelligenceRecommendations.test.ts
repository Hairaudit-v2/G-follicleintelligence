import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRecommendationCopyIsNonPunitive,
  buildStaffIntelligenceRecommendations,
} from "@/src/lib/fi-os/staffIntelligenceRecommendations";

test("recommendations: consultant + elevated stale leads suggests follow-up queue copy", () => {
  const recs = buildStaffIntelligenceRecommendations({
    counts: { leads_stale: 2 },
    workspaceProfileHint: "consultant",
    positionTypeCode: null,
  });
  assert.ok(recs.some((r) => r.id === "stale_leads"));
  for (const r of recs) {
    assertRecommendationCopyIsNonPunitive(`${r.title} ${r.body}`);
  }
});

test("recommendations: nurse + follow-ups due suggests review queue", () => {
  const recs = buildStaffIntelligenceRecommendations({
    counts: { follow_ups_due: 5 },
    workspaceProfileHint: "nurse",
    positionTypeCode: null,
  });
  assert.ok(recs.some((r) => r.id === "follow_up_queue"));
});

test("recommendations: surgeon + readiness alerts", () => {
  const recs = buildStaffIntelligenceRecommendations({
    counts: { surgery_readiness_alerts: 2 },
    workspaceProfileHint: "surgeon",
    positionTypeCode: null,
  });
  assert.ok(recs.some((r) => r.id === "readiness_blockers"));
});

test("recommendations: director + productivity composite", () => {
  const recs = buildStaffIntelligenceRecommendations({
    counts: { productivity_attention: 8 },
    workspaceProfileHint: "director",
    positionTypeCode: null,
  });
  assert.ok(recs.some((r) => r.id === "workload_support"));
});

test("recommendations: rejects punitive language", () => {
  assert.throws(() =>
    assertRecommendationCopyIsNonPunitive("This staff member is a poor performer")
  );
});
