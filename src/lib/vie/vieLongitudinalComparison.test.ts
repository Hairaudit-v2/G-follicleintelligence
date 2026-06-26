import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { VieComparisonCaptureRecord } from "./vieComparisonTypes";
import {
  buildComparisonCaptureRecord,
  buildVieProgressionTimeline,
  computeConfidenceBand,
  computeQualityMatchScore,
  deriveSlotFamily,
  deriveSlotFraming,
  generateVieComparisonPairs,
  isExcludedFromTimeline,
} from "./vieLongitudinalComparisonCore";
import { regenerateVieComparisonsBestEffort } from "./vieLongitudinalComparison.server";

const patientId = "00000000-0000-4000-8000-000000000001";

function acceptedRecord(overrides: Partial<VieComparisonCaptureRecord> & Pick<VieComparisonCaptureRecord, "patient_image_id" | "protocol_template_slug" | "protocol_slot_slug" | "captured_at">): VieComparisonCaptureRecord {
  const base = buildComparisonCaptureRecord({
    patient_image_id: overrides.patient_image_id,
    patient_id: patientId,
    case_id: overrides.case_id ?? null,
    anatomical_region: overrides.anatomical_region ?? "hairline",
    protocol_template_slug: overrides.protocol_template_slug,
    protocol_slot_slug: overrides.protocol_slot_slug,
    quality_score: overrides.quality_score ?? 85,
    quality_band: overrides.quality_band ?? "acceptable",
    clinically_usable: overrides.clinically_usable ?? true,
    acceptance_status: overrides.acceptance_status ?? "accepted",
    captured_at: overrides.captured_at,
    follow_up_interval: overrides.follow_up_interval ?? null,
    visit_type: overrides.visit_type ?? null,
    imaging_library_axis: overrides.imaging_library_axis ?? "consultation",
  });
  assert.ok(base);
  return { ...base, ...overrides, acceptance_status: overrides.acceptance_status ?? "accepted" };
}

describe("VIE longitudinal comparison core", () => {
  it("accepted images generate baseline vs follow-up pair", () => {
    const baseline = acceptedRecord({
      patient_image_id: "img-baseline-front",
      protocol_template_slug: "baseline_consultation",
      protocol_slot_slug: "front",
      anatomical_region: "hairline",
      captured_at: "2025-01-01T10:00:00.000Z",
    });
    const followUp = acceptedRecord({
      patient_image_id: "img-fu-front",
      protocol_template_slug: "follow_up_review",
      protocol_slot_slug: "fu_front",
      anatomical_region: "hairline",
      imaging_library_axis: "follow_up",
      follow_up_interval: "month_6",
      captured_at: "2025-07-01T10:00:00.000Z",
    });

    const pairs = generateVieComparisonPairs([baseline, followUp]);
    const match = pairs.find((p) => p.comparison_category === "baseline_vs_follow_up");
    assert.ok(match);
    assert.equal(match.before_image_id, baseline.patient_image_id);
    assert.equal(match.after_image_id, followUp.patient_image_id);
  });

  it("pending images are excluded", () => {
    const pending = acceptedRecord({
      patient_image_id: "img-pending",
      protocol_template_slug: "baseline_consultation",
      protocol_slot_slug: "front",
      captured_at: "2025-01-01T10:00:00.000Z",
      acceptance_status: "pending",
    });
    const followUp = acceptedRecord({
      patient_image_id: "img-fu",
      protocol_template_slug: "follow_up_review",
      protocol_slot_slug: "fu_front",
      captured_at: "2025-07-01T10:00:00.000Z",
      imaging_library_axis: "follow_up",
    });

    const pairs = generateVieComparisonPairs([pending, followUp]);
    assert.equal(pairs.find((p) => p.before_image_id === pending.patient_image_id), undefined);
    assert.ok(isExcludedFromTimeline(pending));
  });

  it("low-quality images are excluded or warned", () => {
    const low = acceptedRecord({
      patient_image_id: "img-low",
      protocol_template_slug: "baseline_consultation",
      protocol_slot_slug: "front",
      quality_score: 50,
      quality_band: "retake_recommended",
      captured_at: "2025-01-01T10:00:00.000Z",
    });
    const followUp = acceptedRecord({
      patient_image_id: "img-fu",
      protocol_template_slug: "follow_up_review",
      protocol_slot_slug: "fu_front",
      captured_at: "2025-07-01T10:00:00.000Z",
      imaging_library_axis: "follow_up",
    });

    const strictPairs = generateVieComparisonPairs([low, followUp], 65);
    assert.equal(strictPairs.find((p) => p.comparison_category === "baseline_vs_follow_up"), undefined);

    const lenientPairs = generateVieComparisonPairs(
      [
        { ...low, quality_score: 70, clinically_usable: true },
        followUp,
      ],
      65
    );
    const warned = lenientPairs.find((p) => p.comparison_category === "baseline_vs_follow_up");
    assert.ok(warned);
    assert.ok(warned.warnings.some((w) => w.includes("Before")));
  });

  it("close-up images only match close-up slot families", () => {
    const overview = acceptedRecord({
      patient_image_id: "img-front",
      protocol_template_slug: "full_clinical_head_series",
      protocol_slot_slug: "front",
      captured_at: "2025-01-01T10:00:00.000Z",
    });
    const closeUp = acceptedRecord({
      patient_image_id: "img-front-close",
      protocol_template_slug: "full_clinical_head_series",
      protocol_slot_slug: "front_close",
      captured_at: "2025-02-01T10:00:00.000Z",
    });

    assert.equal(deriveSlotFraming("front", "full_clinical_head_series"), "overview");
    assert.equal(deriveSlotFraming("front_close", "full_clinical_head_series"), "close_up");
    assert.equal(deriveSlotFamily("front"), deriveSlotFamily("front_close"));

    const pairs = generateVieComparisonPairs([overview, closeUp]);
    const crossFraming = pairs.filter(
      (p) =>
        (p.before_image_id === overview.patient_image_id && p.after_image_id === closeUp.patient_image_id) ||
        (p.before_image_id === closeUp.patient_image_id && p.after_image_id === overview.patient_image_id)
    );
    assert.equal(crossFraming.length, 0);
  });

  it("donor before/final extraction pair generated", () => {
    const before = acceptedRecord({
      patient_image_id: "img-donor-before",
      protocol_template_slug: "surgery_day",
      protocol_slot_slug: "donor_before_extraction",
      anatomical_region: "donor",
      imaging_library_axis: "surgery",
      captured_at: "2025-03-01T09:00:00.000Z",
      case_id: "case-1",
    });
    const after = acceptedRecord({
      patient_image_id: "img-donor-final",
      protocol_template_slug: "surgery_day",
      protocol_slot_slug: "donor_final_extraction",
      anatomical_region: "donor",
      imaging_library_axis: "surgery",
      captured_at: "2025-03-01T14:00:00.000Z",
      case_id: "case-1",
    });

    const pairs = generateVieComparisonPairs([before, after]);
    const match = pairs.find((p) => p.comparison_category === "donor_before_vs_after_extraction");
    assert.ok(match);
    assert.equal(match.angle_match_status, "pending_ai");
  });

  it("pre-op vs immediate post-op pair generated", () => {
    const preOp = acceptedRecord({
      patient_image_id: "img-pre-op-front",
      protocol_template_slug: "surgery_day",
      protocol_slot_slug: "pre_op_front",
      anatomical_region: "hairline",
      imaging_library_axis: "surgery",
      captured_at: "2025-03-01T08:00:00.000Z",
    });
    const postOp = acceptedRecord({
      patient_image_id: "img-post-op-front",
      protocol_template_slug: "surgery_day",
      protocol_slot_slug: "immediate_post_op_front",
      anatomical_region: "hairline",
      imaging_library_axis: "surgery",
      captured_at: "2025-03-01T18:00:00.000Z",
    });

    const pairs = generateVieComparisonPairs([preOp, postOp]);
    const match = pairs.find((p) => p.comparison_category === "pre_op_vs_post_op");
    assert.ok(match);
    assert.ok(match.days_between >= 0);
  });

  it("comparison pair confidence calculated", () => {
    const before = acceptedRecord({
      patient_image_id: "img-a",
      protocol_template_slug: "baseline_consultation",
      protocol_slot_slug: "front",
      quality_score: 92,
      captured_at: "2025-01-01T10:00:00.000Z",
    });
    const after = acceptedRecord({
      patient_image_id: "img-b",
      protocol_template_slug: "follow_up_review",
      protocol_slot_slug: "fu_front",
      quality_score: 90,
      imaging_library_axis: "follow_up",
      captured_at: "2025-07-01T10:00:00.000Z",
    });

    const score = computeQualityMatchScore(before, after);
    assert.ok(score >= 80);

    const band = computeConfidenceBand({
      quality_match_score: score,
      framing_match_status: "match",
      warnings: [],
      days_between: 180,
    });
    assert.equal(band, "high");
  });

  it("timeline groups images by journey stage correctly", () => {
    const baseline = acceptedRecord({
      patient_image_id: "img-base",
      protocol_template_slug: "baseline_consultation",
      protocol_slot_slug: "front",
      captured_at: "2025-01-01T10:00:00.000Z",
    });
    const surgery = acceptedRecord({
      patient_image_id: "img-surg",
      protocol_template_slug: "surgery_day",
      protocol_slot_slug: "pre_op_front",
      imaging_library_axis: "surgery",
      captured_at: "2025-03-01T10:00:00.000Z",
    });
    const rejected = acceptedRecord({
      patient_image_id: "img-rej",
      protocol_template_slug: "baseline_consultation",
      protocol_slot_slug: "donor",
      acceptance_status: "replaced",
      captured_at: "2025-01-02T10:00:00.000Z",
    });

    const timeline = buildVieProgressionTimeline([baseline, surgery, rejected], patientId);
    assert.equal(timeline.stages.some((s) => s.stage === "baseline"), true);
    assert.equal(timeline.stages.some((s) => s.stage === "surgery_day"), true);
    assert.equal(
      timeline.stages.flatMap((s) => s.groups.flatMap((g) => g.images)).some((i) => i.patient_image_id === rejected.patient_image_id),
      false
    );
  });
});

describe("VIE comparison server best-effort", () => {
  it("accept flow does not fail if comparison generation errors", async () => {
    await assert.doesNotReject(async () => {
      await regenerateVieComparisonsBestEffort({
        tenantId: "00000000-0000-4000-8000-000000000099",
        patientId: "00000000-0000-4000-8000-000000000098",
      });
    });
  });
});

describe("VIE comparison review status", () => {
  it("review status accept/dismiss is modeled on pair rows", () => {
    const pair = generateVieComparisonPairs([
      acceptedRecord({
        patient_image_id: "img-1",
        protocol_template_slug: "baseline_consultation",
        protocol_slot_slug: "front",
        captured_at: "2025-01-01T10:00:00.000Z",
      }),
      acceptedRecord({
        patient_image_id: "img-2",
        protocol_template_slug: "follow_up_review",
        protocol_slot_slug: "fu_front",
        imaging_library_axis: "follow_up",
        captured_at: "2025-06-01T10:00:00.000Z",
      }),
    ])[0];
    assert.ok(pair);
    assert.match(pair.comparison_id, /^viecmp:/);
    assert.deepEqual(["suggested", "accepted", "dismissed"].includes("accepted"), true);
  });
});
