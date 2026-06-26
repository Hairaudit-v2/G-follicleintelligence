import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { VieAlignmentCaptureInput, VieAlignmentReferenceCandidate, VieAlignmentStatus } from "./vieAlignmentTypes";
import {
  buildPatientTwinAlignmentSummary,
  evaluateSameAngleAlignment,
  isStandardizedEvidence,
  selectBestReferenceImage,
} from "./vieSameAngleAlignmentCore";
import { evaluateVieAlignmentBestEffort } from "./vieSameAngleAlignment.server";

const patientId = "00000000-0000-4000-8000-000000000001";

function captureInput(overrides: Partial<VieAlignmentCaptureInput> = {}): VieAlignmentCaptureInput {
  return {
    image_id: "img-new",
    patient_id: patientId,
    anatomical_region: "hairline",
    slot_family: "front",
    framing: "overview",
    protocol_template_slug: "follow_up_review",
    protocol_slot_slug: "fu_front",
    quality_score: 82,
    captured_at: "2025-07-01T10:00:00.000Z",
    visit_type: "follow_up",
    image_width: 1200,
    image_height: 1600,
    orientation: "portrait",
    capture_distance_hint: "arm's length",
    capture_guide: "front",
    journey_stage: "follow_up_6m",
    ...overrides,
  };
}

function referenceCandidate(
  overrides: Partial<VieAlignmentReferenceCandidate> & Pick<VieAlignmentReferenceCandidate, "image_id" | "captured_at">
): VieAlignmentReferenceCandidate {
  return {
    patient_id: patientId,
    anatomical_region: "hairline",
    slot_family: "front",
    framing: "overview",
    protocol_template_slug: "baseline_consultation",
    protocol_slot_slug: "front",
    quality_score: 90,
    visit_type: "consultation",
    image_width: 1180,
    image_height: 1580,
    orientation: "portrait",
    capture_distance_hint: "arm's length",
    capture_guide: "front",
    journey_stage: "baseline",
    ...overrides,
  };
}

describe("VIE same angle alignment core", () => {
  it("no reference image returns no_reference_available", () => {
    const result = evaluateSameAngleAlignment(captureInput(), null);
    assert.equal(result.alignment_status, "no_reference_available");
    assert.equal(result.reference_image_id, null);
    assert.equal(result.angle_match_status, "pending_ai_vision");
  });

  it("same slot images create reference link", () => {
    const ref = referenceCandidate({
      image_id: "img-baseline",
      captured_at: "2025-01-01T10:00:00.000Z",
    });
    const selected = selectBestReferenceImage([ref], captureInput());
    assert.equal(selected?.image_id, "img-baseline");

    const result = evaluateSameAngleAlignment(captureInput(), ref);
    assert.equal(result.reference_image_id, "img-baseline");
    assert.ok(result.alignment_score > 0);
  });

  it("high quality baseline chosen as reference over lower quality follow-up", () => {
    const baseline = referenceCandidate({
      image_id: "img-baseline",
      captured_at: "2025-01-01T10:00:00.000Z",
      quality_score: 92,
      journey_stage: "baseline",
    });
    const olderFollowUp = referenceCandidate({
      image_id: "img-fu-old",
      captured_at: "2025-03-01T10:00:00.000Z",
      quality_score: 95,
      journey_stage: "follow_up_3m",
      protocol_template_slug: "follow_up_review",
      protocol_slot_slug: "fu_front",
    });

    const selected = selectBestReferenceImage([olderFollowUp, baseline], captureInput());
    assert.equal(selected?.image_id, "img-baseline");
  });

  it("framing mismatch reduces score", () => {
    const ref = referenceCandidate({
      image_id: "img-ref",
      captured_at: "2025-01-01T10:00:00.000Z",
      framing: "overview",
    });
    const matched = evaluateSameAngleAlignment(captureInput({ framing: "overview" }), ref);
    const mismatchedVsOverviewRef = evaluateSameAngleAlignment(captureInput({ framing: "close_up" }), ref);

    assert.ok(matched.alignment_score > mismatchedVsOverviewRef.alignment_score);
    assert.ok(mismatchedVsOverviewRef.warnings.some((w) => w.includes("framing")));
  });

  it("distance mismatch reduces score", () => {
    const ref = referenceCandidate({
      image_id: "img-ref",
      captured_at: "2025-01-01T10:00:00.000Z",
      capture_distance_hint: "arm's length",
    });
    const close = evaluateSameAngleAlignment(
      captureInput({ capture_distance_hint: "very close macro" }),
      ref
    );
    const matched = evaluateSameAngleAlignment(captureInput({ capture_distance_hint: "arm's length" }), ref);
    assert.ok(matched.alignment_score > close.alignment_score);
    assert.ok(close.warnings.some((w) => w.includes("closer") || w.includes("distance")));
  });

  it("low alignment triggers retake_recommended", () => {
    const ref = referenceCandidate({
      image_id: "img-ref",
      captured_at: "2025-01-01T10:00:00.000Z",
      framing: "overview",
      orientation: "landscape",
      image_width: 2000,
      image_height: 1000,
      capture_distance_hint: "wide overview",
      quality_score: 95,
    });
    const poor = evaluateSameAngleAlignment(
      captureInput({
        framing: "close_up",
        orientation: "portrait",
        image_width: 800,
        image_height: 2000,
        capture_distance_hint: "macro close-up",
        quality_score: 55,
        protocol_slot_slug: "fu_front_close",
      }),
      ref
    );
    assert.equal(poor.alignment_status, "retake_recommended");
  });

  it("compare tab standardized evidence filter predicate", () => {
    assert.equal(isStandardizedEvidence("excellent", 90), true);
    assert.equal(isStandardizedEvidence("acceptable", 75), true);
    assert.equal(isStandardizedEvidence("poor", 60), false);
    assert.equal(isStandardizedEvidence("retake_recommended", 40), false);
    assert.equal(isStandardizedEvidence("no_reference_available", 0), false);
  });

  it("patient twin alignment summary builds correctly", () => {
    const summary = buildPatientTwinAlignmentSummary([
      {
        anatomical_region: "hairline",
        slot_family: "front",
        alignment_score: 88,
        alignment_status: "excellent",
        protocol_slot_slug: "front",
        protocol_template_slug: "baseline_consultation",
      },
      {
        anatomical_region: "donor",
        slot_family: "donor",
        alignment_score: 42,
        alignment_status: "retake_recommended",
        protocol_slot_slug: "donor_before_extraction",
        protocol_template_slug: "surgery_day",
      },
    ]);

    assert.equal(summary.alignment_consistency_score, 65);
    assert.deepEqual(summary.regions_with_poor_consistency, ["donor"]);
    assert.equal(summary.standardized_evidence_coverage_percent, 50);
    assert.ok(summary.next_recommended_standardized_recapture.slot_slug);
  });
});

describe("VIE alignment server best-effort", () => {
  it("accept flow never fails if alignment engine errors", async () => {
    await assert.doesNotReject(async () => {
      await evaluateVieAlignmentBestEffort({
        tenantId: "00000000-0000-4000-8000-000000000099",
        patientId: "00000000-0000-4000-8000-000000000098",
        imageId: "00000000-0000-4000-8000-000000000097",
      });
    });
  });
});

describe("VIE compare tab alignment filters", () => {
  it("high alignment and poor alignment filters partition pairs", () => {
    const pairs: Array<{
      alignment_score: number;
      alignment_status: VieAlignmentStatus;
      is_standardized_evidence: boolean;
    }> = [
      { alignment_score: 85, alignment_status: "excellent" as const, is_standardized_evidence: true },
      { alignment_score: 45, alignment_status: "retake_recommended" as const, is_standardized_evidence: false },
      { alignment_score: 72, alignment_status: "acceptable" as const, is_standardized_evidence: true },
    ];

    const high = pairs.filter((p) => p.alignment_score != null && p.alignment_score >= 70);
    const poor = pairs.filter(
      (p) => p.alignment_status === "poor" || p.alignment_status === "retake_recommended"
    );
    const standardized = pairs.filter((p) => p.is_standardized_evidence);

    assert.equal(high.length, 2);
    assert.equal(poor.length, 1);
    assert.equal(standardized.length, 2);
  });
});
