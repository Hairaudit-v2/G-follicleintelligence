import assert from "node:assert/strict";
import test from "node:test";

import {
  assertFiOutcomeIntelligenceRegistryComplete,
  FI_OUTCOME_CHECKPOINT_KEYS,
  fiOutcomeCheckpointOrderIndex,
} from "@/src/config/fiOutcomeIntelligenceRegistry";
import { applyPartialFeatureOverrides, buildDefaultFeatureAccessAllEnabled } from "@/src/config/fiFeatureAccessRegistry";
import {
  aggregateOutcomeMetricSummaries,
  detectOutcomeIdentifierLeakage,
  FI_OUTCOME_ANONYMISATION_MIN_SAMPLE,
  FI_OUTCOME_ANONYMISATION_MIN_TENANTS,
  mergeOutcomeMetricSummaries,
  outcomeAnonymisationThresholdsMet,
  parseOutcomeMetricSummary,
  refuseNetworkOutcomeAggregation,
} from "@/src/lib/fi-os/outcomeAggregation";
import {
  computeGlobalOutcomeAggregateDraft,
  computeTenantOutcomeAggregateDraft,
} from "@/src/lib/fi-os/outcomeIntelligenceDrafts";
import { buildCaseOutcomeIntelligenceView } from "@/src/lib/fi-os/outcomeIntelligence.server";
import {
  deriveOutcomeConfidenceLevel,
  missingOutcomeCheckpoints,
  normalizeOutcomeMetricValue,
  normalizeOutcomeMetricValues,
} from "@/src/lib/fi-os/outcomeIntelligenceSignals";
import { fiDashboardWidgetVisibleByFeatureAccess } from "@/src/lib/fi-os/stage2FeatureVisibility";

test("registry: complete and checkpoint ordering is chronological", () => {
  assertFiOutcomeIntelligenceRegistryComplete();
  const order = [...FI_OUTCOME_CHECKPOINT_KEYS];
  const sorted = [...order].sort((a, b) => fiOutcomeCheckpointOrderIndex(a) - fiOutcomeCheckpointOrderIndex(b));
  assert.deepEqual(sorted, order);
  assert.ok(fiOutcomeCheckpointOrderIndex("baseline") < fiOutcomeCheckpointOrderIndex("month_24"));
});

test("signals: normalize metric values", () => {
  assert.equal(normalizeOutcomeMetricValue("  yes "), true);
  assert.equal(normalizeOutcomeMetricValue("false"), false);
  assert.equal(normalizeOutcomeMetricValue(7.2), 7.2);
  assert.equal(normalizeOutcomeMetricValue(Number.NaN), null);
});

test("signals: normalizeOutcomeMetricValues drops unknown keys by default", () => {
  const got = normalizeOutcomeMetricValues({ patient_satisfaction_score: 9, unknown_x: 1 });
  assert.equal(got.patient_satisfaction_score, 9);
  assert.equal(got.unknown_x, undefined);
});

test("signals: confidence from source + density", () => {
  assert.equal(
    deriveOutcomeConfidenceLevel({ sourceTable: null, sourceId: null, metricValues: {} }),
    "unknown"
  );
  assert.equal(
    deriveOutcomeConfidenceLevel({
      sourceTable: "fi_case_follow_ups",
      sourceId: "00000000-0000-4000-8000-000000000001",
      metricValues: { patient_satisfaction_score: 8, imaging_available: true },
    }),
    "high"
  );
});

test("aggregation: refuse network when sample or tenants too small", () => {
  const bad = refuseNetworkOutcomeAggregation({
    sampleSize: 10,
    contributingTenantCount: 5,
    metricSummary: { a: 1 },
    protocolMix: { fue: 2 },
  });
  assert.equal(bad.ok, false);
  const ok = refuseNetworkOutcomeAggregation({
    sampleSize: FI_OUTCOME_ANONYMISATION_MIN_SAMPLE,
    contributingTenantCount: FI_OUTCOME_ANONYMISATION_MIN_TENANTS,
    metricSummary: { n: 1 },
    protocolMix: { fue: 3 },
  });
  assert.equal(ok.ok, true);
  assert.equal(
    outcomeAnonymisationThresholdsMet({
      sampleSize: 30,
      contributingTenantCount: 4,
      metricSummary: { n: 1 },
      protocolMix: { fue: 3 },
    }),
    true
  );
});

test("aggregation: identifier leakage rejects UUID-like strings", () => {
  const bad = detectOutcomeIdentifierLeakage({ note: "patient 123e4567-e89b-12d3-a456-426614174000 seen" });
  assert.equal(bad.ok, false);
  const badKey = detectOutcomeIdentifierLeakage({ patient_id: "x" });
  assert.equal(badKey.ok, false);
  const ok = detectOutcomeIdentifierLeakage({ cohort: "all_fue", avg: 4.2 });
  assert.equal(ok.ok, true);
});

test("aggregation: tenant + global drafts", () => {
  const tenantDraft = computeTenantOutcomeAggregateDraft({
    tenantId: "00000000-0000-4000-8000-0000000000aa",
    aggregatePeriodStart: "2026-01-01",
    aggregatePeriodEnd: "2026-01-31",
    cohortKey: "month:2026-01:fue",
    cohortDescription: "FUE cohort",
    measurements: [{ metric_values: { patient_satisfaction_score: 8 } }, { metric_values: { patient_satisfaction_score: 9 } }],
    protocols: [{ protocol_key: "fue" }, { protocol_key: "fue" }],
    visibilityScope: "tenant_only",
    metadata: {},
  });
  assert.equal(tenantDraft.sample_size, 2);
  assert.ok((tenantDraft.protocol_mix as Record<string, number>).fue >= 2);

  const globalDraft = computeGlobalOutcomeAggregateDraft({
    cohortKey: "net:fue",
    cohortDescription: null,
    aggregatePeriodStart: "2026-01-01",
    aggregatePeriodEnd: "2026-01-31",
    tenantMetricSummaries: [
      { patient_satisfaction_score: { n: 10, sum: 80 } },
      { patient_satisfaction_score: { n: 15, sum: 120 } },
    ],
    tenantProtocolMixes: [{ fue: 10 }, { fue: 12 }],
    contributingTenantCount: 3,
    sampleSize: 25,
    metadata: {},
  });
  assert.equal(globalDraft.anonymisation_threshold_met, true);
  assert.ok((globalDraft.metric_summary as Record<string, { n: number }>).patient_satisfaction_score.n >= 25);
});

test("aggregation: global draft fails threshold when merged payload would leak (direct gate)", () => {
  const gate = refuseNetworkOutcomeAggregation({
    sampleSize: 30,
    contributingTenantCount: 3,
    metricSummary: { cohort_note: "linked id 123e4567-e89b-12d3-a456-426614174000" },
    protocolMix: { fue: 12 },
  });
  assert.equal(gate.ok, false);
});

test("aggregation: mergeOutcomeMetricSummaries + parseOutcomeMetricSummary", () => {
  const a = parseOutcomeMetricSummary({ x: { n: 2, sum: 10 } });
  const b = parseOutcomeMetricSummary({ x: { n: 1, sum: 4 } });
  const m = mergeOutcomeMetricSummaries([a, b]);
  assert.equal(m.x?.n, 3);
  assert.equal(m.x?.sum, 14);
});

test("dashboard: outcome widget visibility matches Stage 6 rule", () => {
  const off = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    dashboard: true,
    cases: false,
    patient_twin: false,
    analytics: false,
    audit: false,
  });
  assert.equal(fiDashboardWidgetVisibleByFeatureAccess("outcome_intelligence_summary", off), false);
});

test("case view: buildCaseOutcomeIntelligenceView empty fallback", () => {
  const v = buildCaseOutcomeIntelligenceView({
    followUpCheckpoints: [],
    measurementRows: [],
    protocolRows: [],
    linkedImageCount: 0,
  });
  assert.ok(v.checkpointsMissing.length > 0);
  assert.equal(missingOutcomeCheckpoints(v.checkpointsCaptured).length, v.checkpointsMissing.length);
  assert.equal(v.networkEligibleHint, "insufficient_data");
});

test("case view: merges follow-up checkpoints with measurements", () => {
  const v = buildCaseOutcomeIntelligenceView({
    followUpCheckpoints: ["month_1"],
    measurementRows: [
      {
        id: "m1",
        checkpoint_key: "month_3",
        measurement_date: null,
        metric_values: {},
        imaging_refs: [],
        audit_refs: [],
        case_id: "c1",
      },
    ],
    protocolRows: [],
    linkedImageCount: 2,
  });
  assert.ok(v.checkpointsCaptured.includes("month_1"));
  assert.ok(v.checkpointsCaptured.includes("month_3"));
});

test("aggregation: aggregateOutcomeMetricSummaries counts booleans and numbers", () => {
  const s = aggregateOutcomeMetricSummaries([
    { metric_values: { complication_flag: true, patient_satisfaction_score: 8 } },
    { metric_values: { complication_flag: false, patient_satisfaction_score: 9 } },
  ]);
  assert.equal(s.complication_flag?.trueCount, 1);
  assert.equal(s.complication_flag?.falseCount, 1);
  assert.equal(s.patient_satisfaction_score?.n, 2);
  assert.equal(s.patient_satisfaction_score?.sum, 17);
});
