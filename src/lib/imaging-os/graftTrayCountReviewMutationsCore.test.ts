import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseGraftTrayAiEstimateRow } from "./graftTrayAiEstimateRowParser";
import {
  buildGraftTrayEstimateReviewMetadata,
  buildGraftTrayImageMetadataReviewPatch,
  resolveCorrectedCountForReviewAction,
  resolveGraftTrayLinkStatusAfterReview,
} from "./graftTrayCountReviewMutationsCore";
import { parseGraftTrayReviewAuditTrail } from "./graftTrayReviewUxCore";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const IMAGE = "55555555-5555-4555-8555-555555555555";
const ESTIMATE = "66666666-6666-4666-8666-666666666666";
const NOW = "2026-07-04T12:00:00.000Z";

function sampleEstimateRow() {
  return parseGraftTrayAiEstimateRow({
    id: ESTIMATE,
    tenant_id: TENANT,
    patient_id: PATIENT,
    image_id: IMAGE,
    graft_tray_link_id: "77777777-7777-4777-8777-777777777777",
    surgery_id: null,
    estimated_graft_count: 120,
    manual_graft_count: 118,
    manual_count_source: "confirmed_tray_latest",
    corrected_graft_count: null,
    delta: 2,
    mismatch_band: "minor_mismatch",
    confidence: 0.82,
    confidence_band: "high",
    image_quality: "suitable",
    assessable: true,
    review_status: "pending_review",
    reviewer_decision: null,
    provider: "stub",
    provider_version: "graft_tray_stub_v1",
    review_reasons: ["graft_tray_ai_count_needs_review"],
    created_at: NOW,
    updated_at: NOW,
  });
}

describe("graftTrayCountReviewMutationsCore", () => {
  it("accept_ai_estimate maps to accepted_ai link state", () => {
    const link = resolveGraftTrayLinkStatusAfterReview({
      action: "accept_ai_estimate",
      mismatchBand: "within_tolerance",
    });
    assert.deepEqual(link, { status: "linked", reviewRequired: false });
  });

  it("reject_ai_estimate keeps link in review_required", () => {
    const link = resolveGraftTrayLinkStatusAfterReview({
      action: "reject_ai_estimate",
      mismatchBand: "material_mismatch",
    });
    assert.deepEqual(link, { status: "review_required", reviewRequired: true });
  });

  it("correct_count requires a non-negative override", () => {
    assert.throws(() =>
      resolveCorrectedCountForReviewAction({
        action: "correct_count",
        correctedCount: -1,
      })
    );
    assert.equal(
      resolveCorrectedCountForReviewAction({
        action: "correct_count",
        correctedCount: 119,
      }),
      119
    );
  });

  it("builds estimate metadata audit trail with preserved AI estimate", () => {
    const estimate = sampleEstimateRow();
    const metadata = buildGraftTrayEstimateReviewMetadata({
      estimate,
      action: "correct_count",
      reviewedByUserId: "staff-1",
      reviewedAt: NOW,
      correctedCount: 119,
      staffNote: "Adjusted after tray edge occlusion",
      existingMetadata: {},
    });
    const trail = parseGraftTrayReviewAuditTrail(metadata.review_audit_trail);
    assert.equal(metadata.original_ai_estimate, 120);
    assert.equal(trail.length, 1);
    assert.equal(trail[0]?.previous_ai_estimate, 120);
    assert.equal(trail[0]?.final_accepted_count, 119);
  });

  it("image metadata patch stores updated summary and audit trail", () => {
    const estimate = sampleEstimateRow();
    const patch = buildGraftTrayImageMetadataReviewPatch({
      estimate,
      action: "accept_ai_estimate",
      reviewedByUserId: "staff-1",
      reviewedAt: NOW,
      correctedCount: null,
      staffNote: "Within tolerance",
      existingMetadata: {},
      staffReviewMetadata: { imaging_staff_review: { status: "reviewed" } },
    });
    const summary = patch.graft_tray_ai_estimate as { review_status?: string };
    const trail = parseGraftTrayReviewAuditTrail(patch.graft_tray_ai_review_audit);
    assert.equal(summary.review_status, "accepted_ai");
    assert.equal(trail[0]?.decision, "accept_ai_estimate");
    assert.equal(trail[0]?.final_accepted_count, 120);
  });
});
