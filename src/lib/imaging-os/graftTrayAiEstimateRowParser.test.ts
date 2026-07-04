import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapEstimateRowToSummary,
  parseGraftTrayAiEstimateRow,
  parseGraftTrayAiEstimateSummaryFromMetadata,
  parseGraftTrayAiProviderName,
  parseGraftTrayAiReviewStatus,
  parseGraftTrayMismatchBand,
} from "./graftTrayAiEstimateRowParser";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const IMAGE = "55555555-5555-4555-8555-555555555555";
const ESTIMATE = "66666666-6666-4666-8666-666666666666";
const NOW = "2026-07-04T12:00:00.000Z";

function validRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ESTIMATE,
    tenant_id: TENANT,
    patient_id: PATIENT,
    image_id: IMAGE,
    graft_tray_link_id: null,
    surgery_id: null,
    estimated_graft_count: 120,
    manual_graft_count: 118,
    manual_count_source: "confirmed_tray_latest",
    corrected_graft_count: null,
    delta: 2,
    mismatch_band: "within_tolerance",
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
    ...overrides,
  };
}

describe("parseGraftTrayAiEstimateRow", () => {
  it("parses a valid DB row into typed summary", () => {
    const row = parseGraftTrayAiEstimateRow(validRow());
    const summary = mapEstimateRowToSummary(row);

    assert.equal(summary.estimate_id, ESTIMATE);
    assert.equal(summary.image_id, IMAGE);
    assert.equal(summary.mismatch_band, "within_tolerance");
    assert.equal(summary.review_status, "pending_review");
    assert.equal(summary.provider, "stub");
    assert.equal(summary.confidence_band, "high");
    assert.equal(summary.image_quality, "suitable");
    assert.equal(summary.manual_count_source, "confirmed_tray_latest");
    assert.equal(summary.corrected_count, null);
    assert.equal(summary.generated_at, NOW);
  });

  it("rejects invalid mismatch_band", () => {
    assert.throws(
      () => parseGraftTrayAiEstimateRow(validRow({ mismatch_band: "totally_invalid" })),
      /Invalid graft tray mismatch_band/
    );
  });

  it("rejects invalid review_status", () => {
    assert.throws(
      () => parseGraftTrayAiEstimateRow(validRow({ review_status: "auto_approved" })),
      /Invalid graft tray review_status/
    );
  });

  it("rejects invalid provider", () => {
    assert.throws(
      () => parseGraftTrayAiEstimateRow(validRow({ provider: "mystery_vendor" })),
      /Invalid graft tray provider/
    );
  });

  it("preserves representative summary output for accepted_ai row", () => {
    const row = parseGraftTrayAiEstimateRow(
      validRow({
        review_status: "accepted_ai",
        reviewer_decision: "accept_ai_estimate",
        mismatch_band: "minor_mismatch",
        confidence_band: "medium",
        image_quality: "marginal",
        provider: "openai_vision",
      })
    );
    assert.deepEqual(mapEstimateRowToSummary(row), {
      estimate_id: ESTIMATE,
      image_id: IMAGE,
      graft_tray_link_id: null,
      estimated_graft_count: 120,
      manual_graft_count: 118,
      manual_count_source: "confirmed_tray_latest",
      mismatch_band: "minor_mismatch",
      delta: 2,
      confidence: 0.82,
      confidence_band: "medium",
      image_quality: "marginal",
      assessable: true,
      review_status: "accepted_ai",
      reviewer_decision: "accept_ai_estimate",
      reviewed_by_fi_user_id: null,
      reviewed_at: null,
      analysis_job_id: null,
      corrected_count: null,
      provider: "openai_vision",
      provider_version: "graft_tray_stub_v1",
      generated_at: NOW,
    });
  });
});

describe("parseGraftTrayAiEstimateSummaryFromMetadata", () => {
  it("parses valid metadata snapshot", () => {
    const row = parseGraftTrayAiEstimateRow(validRow());
    const summary = mapEstimateRowToSummary(row);
    const parsed = parseGraftTrayAiEstimateSummaryFromMetadata({
      graft_tray_ai_estimate: summary,
    });
    assert.deepEqual(parsed, summary);
  });

  it("falls back safely for invalid metadata values", () => {
    const parsed = parseGraftTrayAiEstimateSummaryFromMetadata({
      graft_tray_ai_estimate: {
        estimate_id: ESTIMATE,
        image_id: IMAGE,
        mismatch_band: "not_a_real_band",
        review_status: "auto_approved",
        provider: "mystery_vendor",
        confidence_band: "extreme",
        image_quality: "blurry",
        manual_count_source: "guesswork",
      },
    });
    assert.ok(parsed);
    assert.equal(parsed?.mismatch_band, "unable_to_assess");
    assert.equal(parsed?.review_status, "pending_review");
    assert.equal(parsed?.provider, "stub");
    assert.equal(parsed?.confidence_band, "unknown");
    assert.equal(parsed?.image_quality, "unknown");
    assert.equal(parsed?.manual_count_source, "missing");
  });
});

describe("graft tray AI union parsers", () => {
  it("parseGraftTrayMismatchBand accepts known values and supports fallback", () => {
    assert.equal(parseGraftTrayMismatchBand("material_mismatch"), "material_mismatch");
    assert.equal(
      parseGraftTrayMismatchBand("bogus", { fallback: "unable_to_assess" }),
      "unable_to_assess"
    );
  });

  it("parseGraftTrayAiReviewStatus validates review statuses", () => {
    assert.equal(parseGraftTrayAiReviewStatus("corrected"), "corrected");
    assert.throws(() => parseGraftTrayAiReviewStatus("bogus"), /Invalid graft tray review_status/);
  });

  it("parseGraftTrayAiProviderName validates providers", () => {
    assert.equal(parseGraftTrayAiProviderName("unavailable"), "unavailable");
    assert.throws(() => parseGraftTrayAiProviderName("bogus"), /Invalid graft tray provider/);
  });
});