import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GraftTrayAiEstimateSummary } from "./graftTrayCountTypes";
import {
  appendGraftTrayReviewAuditTrail,
  buildGraftTrayAiReviewDisplayConfig,
  buildGraftTrayReviewAuditEntry,
  collectGraftTrayAiReviewWarnings,
  graftTrayAiRequiresStaffReview,
  resolveGraftTrayAiReviewDisplayState,
  resolveGraftTrayFinalAcceptedCount,
} from "./graftTrayReviewUxCore";

const BASE_ESTIMATE: GraftTrayAiEstimateSummary = {
  estimate_id: "66666666-6666-4666-8666-666666666666",
  image_id: "55555555-5555-4555-8555-555555555555",
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
};

describe("graftTrayReviewUxCore", () => {
  it("accepted estimate updates review status display and final count", () => {
    const accepted = { ...BASE_ESTIMATE, review_status: "accepted_ai" as const };
    assert.equal(resolveGraftTrayAiReviewDisplayState(accepted), "accepted_ai");
    assert.equal(resolveGraftTrayFinalAcceptedCount(accepted), 120);
    assert.equal(graftTrayAiRequiresStaffReview(accepted), false);
  });

  it("manual override preserves original AI estimate in audit entry", () => {
    const entry = buildGraftTrayReviewAuditEntry({
      reviewedAt: "2026-07-04T12:05:00.000Z",
      reviewedByUserId: "staff-1",
      action: "correct_count",
      reviewStatus: "corrected",
      previousAiEstimate: 120,
      previousManualCount: 118,
      finalAcceptedCount: 119,
      staffNote: "Tray partially obscured",
    });
    assert.equal(entry.previous_ai_estimate, 120);
    assert.equal(entry.final_accepted_count, 119);
    assert.equal(entry.decision, "correct_count");
  });

  it("rejected estimate remains excluded from final count", () => {
    const rejected = { ...BASE_ESTIMATE, review_status: "rejected_ai" as const };
    assert.equal(resolveGraftTrayFinalAcceptedCount(rejected), null);
    assert.equal(resolveGraftTrayAiReviewDisplayState(rejected), "rejected_needs_recount");
  });

  it("low-confidence estimate surfaces review warning and display state", () => {
    const lowConfidence = {
      ...BASE_ESTIMATE,
      confidence_band: "low" as const,
      image_quality: "marginal" as const,
    };
    assert.equal(resolveGraftTrayAiReviewDisplayState(lowConfidence), "low_confidence_review");
    const warnings = collectGraftTrayAiReviewWarnings(lowConfidence);
    assert.ok(warnings.some((w) => w.includes("Low AI confidence")));
    const display = buildGraftTrayAiReviewDisplayConfig(lowConfidence);
    assert.equal(display.requiresStaffReview, true);
    assert.equal(display.finalAcceptedCount, null);
  });

  it("material mismatch pending estimate uses mismatch display state", () => {
    const mismatch = {
      ...BASE_ESTIMATE,
      mismatch_band: "material_mismatch" as const,
      delta: 40,
    };
    assert.equal(resolveGraftTrayAiReviewDisplayState(mismatch), "mismatch_with_manual");
  });

  it("appends audit trail entries in order", () => {
    const first = buildGraftTrayReviewAuditEntry({
      reviewedAt: "2026-07-04T12:00:00.000Z",
      reviewedByUserId: "staff-1",
      action: "reject_ai_estimate",
      reviewStatus: "rejected_ai",
      previousAiEstimate: 120,
      previousManualCount: 118,
      finalAcceptedCount: null,
    });
    const second = buildGraftTrayReviewAuditEntry({
      reviewedAt: "2026-07-04T12:10:00.000Z",
      reviewedByUserId: "staff-2",
      action: "accept_manual_count",
      reviewStatus: "accepted_manual",
      previousAiEstimate: 120,
      previousManualCount: 118,
      finalAcceptedCount: 118,
    });
    const trail = appendGraftTrayReviewAuditTrail([first], second);
    assert.equal(trail.length, 2);
    assert.equal(trail[1]?.decision, "accept_manual_count");
  });
});
