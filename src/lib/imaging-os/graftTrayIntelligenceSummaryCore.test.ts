import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GraftTrayAiEstimateSummary } from "./graftTrayCountTypes";
import {
  buildGraftTrayIntelligenceSummary,
  buildSurgeryOsGraftTrayCaseIntelligenceSummary,
  isGraftTrayEstimateSupersededStale,
  mapGraftTrayIntelligenceToOutcomeFacts,
  resolveGraftTrayFinalCountSource,
} from "./graftTrayIntelligenceSummaryCore";
import { buildGraftTrayReviewAuditEntry } from "./graftTrayReviewUxCore";

const ESTIMATE_ID = "66666666-6666-4666-8666-666666666666";
const IMAGE_ID = "55555555-5555-4555-8555-555555555555";
const JOB_ID = "77777777-7777-4777-8777-777777777777";
const REVIEWED_AT = "2026-07-04T12:05:00.000Z";
const STAFF_ID = "88888888-8888-4888-8888-888888888888";

function baseEstimate(
  overrides: Partial<GraftTrayAiEstimateSummary> = {}
): GraftTrayAiEstimateSummary {
  return {
    estimate_id: ESTIMATE_ID,
    image_id: IMAGE_ID,
    graft_tray_link_id: null,
    estimated_graft_count: 120,
    manual_graft_count: 118,
    manual_count_source: "confirmed_tray_latest",
    mismatch_band: "within_tolerance",
    delta: 2,
    confidence: 0.82,
    confidence_band: "high",
    image_quality: "suitable",
    assessable: true,
    review_status: "pending_review",
    reviewer_decision: null,
    reviewed_by_fi_user_id: null,
    reviewed_at: null,
    analysis_job_id: null,
    corrected_count: null,
    provider: "stub",
    provider_version: "graft_tray_stub_v1",
    generated_at: "2026-07-04T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildGraftTrayIntelligenceSummary", () => {
  it("accepted AI estimate produces final count summary", () => {
    const summary = buildGraftTrayIntelligenceSummary({
      estimate: baseEstimate({
        review_status: "accepted_ai",
        reviewer_decision: "accept_ai_estimate",
        reviewed_at: REVIEWED_AT,
        reviewed_by_fi_user_id: STAFF_ID,
      }),
      reviewerLabel: "Dr Reviewer",
      sourceImageHref: "/imaging?image=1",
    });

    assert.equal(summary.hasFinalCount, true);
    assert.equal(summary.finalAcceptedCount, 120);
    assert.equal(summary.originalAiEstimate, 120);
    assert.equal(summary.finalCountSource, "ai");
    assert.equal(summary.reviewerLabel, "Dr Reviewer");
    assert.equal(summary.reviewedAt, REVIEWED_AT);
    assert.equal(summary.isReadOnly, true);
    assert.equal(summary.supersededStaleJob, false);
  });

  it("accepted manual produces final count summary", () => {
    const summary = buildGraftTrayIntelligenceSummary({
      estimate: baseEstimate({
        review_status: "accepted_manual",
        reviewer_decision: "accept_manual_count",
        reviewed_at: REVIEWED_AT,
      }),
    });

    assert.equal(summary.hasFinalCount, true);
    assert.equal(summary.finalAcceptedCount, 118);
    assert.equal(summary.finalCountSource, "manual");
  });

  it("override produces final count summary", () => {
    const summary = buildGraftTrayIntelligenceSummary({
      estimate: baseEstimate({
        review_status: "corrected",
        reviewer_decision: "correct_count",
        corrected_count: 119,
        reviewed_at: REVIEWED_AT,
      }),
    });

    assert.equal(summary.hasFinalCount, true);
    assert.equal(summary.finalAcceptedCount, 119);
    assert.equal(summary.finalCountSource, "override");
    assert.equal(summary.originalAiEstimate, 120);
  });

  it("pending estimate produces no final count", () => {
    const summary = buildGraftTrayIntelligenceSummary({
      estimate: baseEstimate({ review_status: "pending_review" }),
    });

    assert.equal(summary.hasFinalCount, false);
    assert.equal(summary.finalAcceptedCount, null);
    assert.equal(summary.finalCountSource, null);
    assert.equal(summary.isReadOnly, false);
  });

  it("rejected estimate produces no final count", () => {
    const summary = buildGraftTrayIntelligenceSummary({
      estimate: baseEstimate({
        review_status: "rejected_ai",
        reviewer_decision: "reject_ai_estimate",
      }),
    });

    assert.equal(summary.hasFinalCount, false);
    assert.equal(summary.finalAcceptedCount, null);
  });

  it("retake requested produces no final count", () => {
    const summary = buildGraftTrayIntelligenceSummary({
      estimate: baseEstimate({
        review_status: "retake_requested",
        reviewer_decision: "request_retake",
      }),
    });

    assert.equal(summary.hasFinalCount, false);
    assert.equal(summary.finalAcceptedCount, null);
  });

  it("variance and mismatch band display correctly", () => {
    const summary = buildGraftTrayIntelligenceSummary({
      estimate: baseEstimate({
        mismatch_band: "material_mismatch",
        delta: 40,
        confidence_band: "low",
        image_quality: "marginal",
      }),
    });

    assert.equal(summary.mismatchBand, "material_mismatch");
    assert.equal(summary.varianceDelta, 40);
    assert.equal(summary.confidenceBand, "low");
    assert.equal(summary.imageQuality, "marginal");
  });

  it("SurgeryOS summary excludes superseded stale replay jobs as final", () => {
    const summary = buildGraftTrayIntelligenceSummary({
      estimate: baseEstimate({
        review_status: "accepted_ai",
        reviewer_decision: "accept_ai_estimate",
        analysis_job_id: JOB_ID,
      }),
      estimateAnalysisJobId: JOB_ID,
      estimateAnalysisJobStatus: "superseded",
      hasNewerActiveJob: true,
    });

    assert.equal(
      isGraftTrayEstimateSupersededStale({
        estimateAnalysisJobId: JOB_ID,
        estimateAnalysisJobStatus: "superseded",
        hasNewerActiveJob: true,
      }),
      true
    );
    assert.equal(summary.supersededStaleJob, true);
    assert.equal(summary.hasFinalCount, false);
    assert.equal(summary.finalAcceptedCount, null);
    assert.equal(summary.originalAiEstimate, null);
    assert.ok(summary.warnings.some((w) => w.includes("Superseded")));
  });

  it("reads reviewer from audit trail when estimate row lacks reviewer fields", () => {
    const auditEntry = buildGraftTrayReviewAuditEntry({
      reviewedAt: REVIEWED_AT,
      reviewedByUserId: STAFF_ID,
      action: "accept_ai_estimate",
      reviewStatus: "accepted_ai",
      previousAiEstimate: 120,
      previousManualCount: 118,
      finalAcceptedCount: 120,
    });
    const summary = buildGraftTrayIntelligenceSummary({
      estimate: baseEstimate({
        review_status: "accepted_ai",
        reviewer_decision: "accept_ai_estimate",
      }),
      auditTrail: [auditEntry],
      reviewerLabel: "Staff Member",
    });

    assert.equal(summary.reviewedAt, REVIEWED_AT);
    assert.equal(summary.reviewerId, STAFF_ID);
    assert.equal(summary.reviewAuditTrail.length, 1);
  });
});

describe("buildSurgeryOsGraftTrayCaseIntelligenceSummary", () => {
  it("aggregates reviewed tray totals when all links finalized", () => {
    const accepted = buildGraftTrayIntelligenceSummary({
      estimate: baseEstimate({
        review_status: "accepted_ai",
        reviewer_decision: "accept_ai_estimate",
      }),
    });
    const rejected = buildGraftTrayIntelligenceSummary({
      estimate: baseEstimate({
        estimate_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        image_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        review_status: "rejected_ai",
        reviewer_decision: "reject_ai_estimate",
      }),
    });
    const rollup = buildSurgeryOsGraftTrayCaseIntelligenceSummary({
      linkSummaries: [accepted, rejected],
    });

    assert.equal(rollup.reviewedTrayCount, 1);
    assert.equal(rollup.pendingReviewCount, 0);
    assert.equal(rollup.totalFinalAcceptedGrafts, 120);
    assert.equal(rollup.hasSupersededStaleEstimate, false);
  });
});

describe("mapGraftTrayIntelligenceToOutcomeFacts", () => {
  it("outputs stable fields for reviewed summary", () => {
    const summary = buildGraftTrayIntelligenceSummary({
      estimate: baseEstimate({
        review_status: "accepted_ai",
        reviewer_decision: "accept_ai_estimate",
        reviewed_at: REVIEWED_AT,
      }),
    });
    const fact = mapGraftTrayIntelligenceToOutcomeFacts(summary);
    assert.ok(fact);
    assert.equal(fact.fact_kind, "graft_tray_reviewed_count");
    assert.equal(fact.source_table, "fi_imaging_graft_tray_ai_estimates");
    assert.equal(fact.source_id, ESTIMATE_ID);
    assert.equal(fact.image_id, IMAGE_ID);
    assert.equal(fact.metric_values.graft_tray_final_count, 120);
    assert.equal(fact.metric_values.graft_tray_ai_estimate, 120);
    assert.equal(fact.metric_values.graft_tray_manual_count, 118);
    assert.equal(fact.metric_values.graft_tray_variance_delta, 2);
    assert.equal(fact.metric_values.graft_tray_mismatch_band, "within_tolerance");
    assert.equal(fact.metric_values.graft_tray_confidence_band, "high");
    assert.equal(fact.metric_values.graft_tray_image_quality, "suitable");
    assert.equal(fact.metric_values.graft_tray_final_count_source, "ai");
    assert.equal(fact.metric_values.graft_tray_review_complete, true);
    assert.equal(fact.metric_values.graft_tray_superseded_stale, false);
    assert.equal(resolveGraftTrayFinalCountSource("accepted_ai"), "ai");
  });

  it("returns null when no final count", () => {
    const summary = buildGraftTrayIntelligenceSummary({
      estimate: baseEstimate({ review_status: "pending_review" }),
    });
    assert.equal(mapGraftTrayIntelligenceToOutcomeFacts(summary), null);
  });
});
