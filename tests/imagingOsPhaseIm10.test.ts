import { describe, it } from "node:test";
import assert from "node:assert";
import {
  IMAGING_SUMMARY_EVALUATOR_VERSION,
  buildDigitalTwinImagingSummary,
  buildHairAuditImagingSummary,
  buildHairAuditReadinessScore,
  calculateImagingComponentScores,
  calculateOverallImagingScore,
  evaluateHairAuditCaseImageProtocol,
  evaluateHairAuditOutcomeMeasurement,
  evaluateHairAuditVisualComparison,
  evaluateImageQualityFromMetadata,
  evaluateLongitudinalProgressionReadiness,
  evaluateOutcomeMeasurementReadiness,
  evaluateSurgicalImageReadiness,
  evaluateVisualComparisonReadiness,
  recommendNextImagingActions,
  runFullImagingOsCaseEvaluation,
  runImagingOsStubPipeline,
  scoreFromComparisonStatus,
  scoreFromOutcomeStatus,
  scoreFromProtocolStatus,
  scoreFromQualityStatus,
  scoreMeasurementResults,
  createVisualMeasurementStub,
  buildHairAuditMeasurementStubs,
} from "../src/lib/imaging-os";
import type {
  CanonicalHairImageCategory,
  ImagingOsComparisonImage,
  ImagingOsImageQualityEvaluationResult,
  ImagingOsOutcomeEvidence,
  ImagingOsProgressionImage,
  ImagingOsSurgicalImage,
  ImagingOsTimepoint,
  ImagingOsVisualMeasurementResult,
} from "../src/lib/imaging-os";

const GROWTH_CATEGORIES: CanonicalHairImageCategory[] = ["front", "top", "crown"];
const HAIRAUDIT_BASELINE = ["front", "left", "right", "top", "crown", "donor"];

function usableComparisonImage(
  timepoint: ImagingOsTimepoint,
  category: CanonicalHairImageCategory
): ImagingOsComparisonImage {
  return {
    image_id: `${timepoint}-${category}`,
    canonical_category: category,
    timepoint,
    quality_status: "excellent",
    is_clinically_usable: true,
  };
}

function fullGrowthComparisonSet(followup: ImagingOsTimepoint = "month_12"): ImagingOsComparisonImage[] {
  const images: ImagingOsComparisonImage[] = [];
  for (const category of GROWTH_CATEGORIES) {
    images.push(usableComparisonImage("baseline", category));
    images.push(usableComparisonImage(followup, category));
  }
  return images;
}

function excellentQuality(category: CanonicalHairImageCategory): ImagingOsImageQualityEvaluationResult {
  return evaluateImageQualityFromMetadata({
    width: 1600,
    height: 1200,
    size_bytes: 512 * 1024,
    content_type: "image/jpeg",
    canonical_category: category,
  });
}

function progressionImage(
  timepoint: ImagingOsTimepoint,
  category: CanonicalHairImageCategory
): ImagingOsProgressionImage {
  return {
    image_id: `${timepoint}-${category}`,
    canonical_category: category,
    timepoint,
    quality_status: "excellent",
    is_clinically_usable: true,
  };
}

function surgicalImage(event: ImagingOsSurgicalImage["surgical_event"]): ImagingOsSurgicalImage {
  return {
    image_id: `surgical-${event}`,
    canonical_category: event === "donor_mapping" ? "donor" : "front",
    surgical_event: event,
    quality_status: "excellent",
    is_clinically_usable: true,
  };
}

function outcomeEvidence(
  timepoint: ImagingOsTimepoint,
  category: CanonicalHairImageCategory
): ImagingOsOutcomeEvidence {
  return {
    image_id: `${timepoint}-${category}`,
    canonical_category: category,
    timepoint,
    quality_status: "excellent",
    is_clinically_usable: true,
  };
}

function measurementWithConfidence(
  confidence: number,
  requiresHumanReview = false
): ImagingOsVisualMeasurementResult {
  return {
    ...createVisualMeasurementStub({
      domain: "density",
      confidence,
      comparison_domain: "growth_change",
    }),
    requires_human_review: requiresHumanReview,
  };
}

function fullGrowthAssessmentSet(): ImagingOsOutcomeEvidence[] {
  const images: ImagingOsOutcomeEvidence[] = [];
  const timepoints: ImagingOsTimepoint[] = ["baseline", "month_6", "month_12"];
  for (const timepoint of timepoints) {
    for (const category of GROWTH_CATEGORIES) {
      images.push(outcomeEvidence(timepoint, category));
      images.push({
        ...outcomeEvidence(timepoint, category),
        image_id: `${timepoint}-${category}-2`,
      });
    }
  }
  return images;
}

function strongCaseInput() {
  const protocol = evaluateHairAuditCaseImageProtocol(HAIRAUDIT_BASELINE);
  const qualityResults = HAIRAUDIT_BASELINE.map((category) =>
    excellentQuality(category as CanonicalHairImageCategory)
  );
  const comparison = evaluateVisualComparisonReadiness({
    domain: "growth_change",
    images: fullGrowthComparisonSet("month_12"),
  });
  const outcome = evaluateOutcomeMeasurementReadiness({
    domain: "growth_assessment",
    evidence: fullGrowthAssessmentSet(),
  });
  const measurementResults = buildHairAuditMeasurementStubs(comparison).map((stub) => ({
    ...stub,
    confidence: 0.92,
    requires_human_review: false,
    validation_status: "valid" as const,
  }));

  return {
    protocol_result: protocol,
    quality_results: qualityResults,
    comparison_result: comparison,
    outcome_result: outcome,
    measurement_results: measurementResults,
  };
}

describe("ImagingOS IM-10 — component score normalization", () => {
  it("maps protocol statuses to contract scores", () => {
    assert.strictEqual(scoreFromProtocolStatus("complete"), 100);
    assert.strictEqual(scoreFromProtocolStatus("partial"), 70);
    assert.strictEqual(scoreFromProtocolStatus("incomplete"), 30);
    assert.strictEqual(scoreFromProtocolStatus("invalid"), 0);
  });

  it("maps quality statuses to contract scores", () => {
    assert.strictEqual(scoreFromQualityStatus("excellent"), 95);
    assert.strictEqual(scoreFromQualityStatus("acceptable"), 80);
    assert.strictEqual(scoreFromQualityStatus("borderline"), 50);
    assert.strictEqual(scoreFromQualityStatus("poor"), 20);
    assert.strictEqual(scoreFromQualityStatus("invalid"), 0);
  });

  it("maps outcome and comparison statuses to contract scores", () => {
    assert.strictEqual(scoreFromOutcomeStatus("measurable"), 100);
    assert.strictEqual(scoreFromComparisonStatus("ready"), 100);
    assert.strictEqual(scoreFromComparisonStatus("insufficient_data"), 30);
  });
});

describe("ImagingOS IM-10 — calculateImagingComponentScores", () => {
  it("averages quality scores across results", () => {
    const front = excellentQuality("front");
    const top = excellentQuality("top");
    const scores = calculateImagingComponentScores({
      quality_results: [front, top],
    });

    const quality = scores.find((entry) => entry.component === "quality");
    assert.ok(quality);
    assert.ok(quality.score >= 70);
    assert.strictEqual(quality.status, "excellent");
  });

  it("averages measurement confidence with human review penalty", () => {
    const noReview = measurementWithConfidence(0.92, false);
    const withReview = measurementWithConfidence(0.92, true);

    assert.strictEqual(scoreMeasurementResults([noReview]), 92);
    assert.strictEqual(scoreMeasurementResults([withReview]), 82);
    assert.strictEqual(scoreMeasurementResults([noReview, withReview]), 87);
  });

  it("handles partial input without forcing all modules", () => {
    const protocol = evaluateHairAuditCaseImageProtocol(["front", "left"]);
    const scores = calculateImagingComponentScores({ protocol_result: protocol });

    assert.strictEqual(scores.length, 1);
    assert.strictEqual(scores[0].component, "protocol");
    assert.strictEqual(scores[0].status, "incomplete");
    assert.strictEqual(scores[0].score, 30);
  });
});

describe("ImagingOS IM-10 — calculateOverallImagingScore", () => {
  it("computes overall score as average of available components", () => {
    const input = strongCaseInput();
    const overall = calculateOverallImagingScore(input);

    assert.ok(overall.overall_score >= 80);
    assert.strictEqual(overall.evaluator_version, IMAGING_SUMMARY_EVALUATOR_VERSION);
    assert.ok(overall.component_scores.length >= 5);
  });

  it("identifies strongest and weakest components", () => {
    const input = strongCaseInput();
    input.protocol_result = evaluateHairAuditCaseImageProtocol(["front"]);
    const overall = calculateOverallImagingScore(input);

    assert.strictEqual(overall.strongest_components.length, 3);
    assert.strictEqual(overall.weakest_components.length, 3);
    assert.ok(
      overall.weakest_components.some((entry) => entry.component === "protocol")
    );
    assert.ok(overall.strongest_components[0].score >= overall.weakest_components[0].score);
  });

  it("forces blocked status when critical component is invalid", () => {
    const invalidQuality = evaluateImageQualityFromMetadata({
      width: 1600,
      height: 1200,
      size_bytes: 512 * 1024,
      content_type: "image/tiff",
      canonical_category: "front",
    });

    const overall = calculateOverallImagingScore({
      protocol_result: evaluateHairAuditCaseImageProtocol(HAIRAUDIT_BASELINE),
      quality_results: [invalidQuality],
      comparison_result: evaluateVisualComparisonReadiness({
        domain: "growth_change",
        images: fullGrowthComparisonSet(),
      }),
    });

    assert.strictEqual(overall.overall_status, "blocked");
    assert.ok(overall.blockers.some((blocker) => blocker.length > 0));
  });
});

describe("ImagingOS IM-10 — buildHairAuditReadinessScore", () => {
  it("applies 20% weighting across HairAudit components", () => {
    const input = strongCaseInput();
    const hairaudit = buildHairAuditReadinessScore(input);

    assert.ok(hairaudit.hairaudit_score >= 80);
    assert.strictEqual(hairaudit.audit_ready, true);
    assert.strictEqual(hairaudit.missing_requirements.length, 0);
  });

  it("marks audit not ready when thresholds are not met", () => {
    const input = strongCaseInput();
    input.protocol_result = evaluateHairAuditCaseImageProtocol(["front", "left", "right"]);
    input.comparison_result = evaluateVisualComparisonReadiness({
      domain: "growth_change",
      images: [usableComparisonImage("baseline", "front")],
    });

    const hairaudit = buildHairAuditReadinessScore(input);

    assert.strictEqual(hairaudit.audit_ready, false);
    assert.ok(hairaudit.missing_requirements.length > 0);
    assert.ok(hairaudit.recommended_next_actions.length > 0);
  });
});

describe("ImagingOS IM-10 — buildDigitalTwinImagingSummary", () => {
  it("generates twin summary with AI and benchmarking readiness flags", () => {
    const input = strongCaseInput();
    const twin = buildDigitalTwinImagingSummary(input);

    assert.ok(twin.twin_imaging_score >= 80);
    assert.strictEqual(twin.clinical_confidence, "high");
    assert.strictEqual(twin.ready_for_ai_analysis, true);
    assert.ok(twin.measurable_domains.includes("density"));
    const hairaudit = buildHairAuditReadinessScore(input);
    assert.strictEqual(twin.ready_for_global_benchmarking, hairaudit.hairaudit_score > 85);
  });

  it("sets low clinical confidence for weak overall score", () => {
    const twin = buildDigitalTwinImagingSummary({
      protocol_result: evaluateHairAuditCaseImageProtocol(["front"]),
      quality_results: [
        evaluateImageQualityFromMetadata({
          width: 400,
          height: 300,
          size_bytes: 40 * 1024,
          content_type: "image/jpeg",
          canonical_category: "front",
        }),
      ],
    });

    assert.strictEqual(twin.clinical_confidence, "low");
    assert.strictEqual(twin.ready_for_ai_analysis, false);
  });
});

describe("ImagingOS IM-10 — recommendNextImagingActions", () => {
  it("returns prioritized actions for weakest components", () => {
    const input = strongCaseInput();
    input.comparison_result = evaluateVisualComparisonReadiness({
      domain: "growth_change",
      images: [
        usableComparisonImage("baseline", "front"),
        usableComparisonImage("baseline", "top"),
      ],
    });

    const actions = recommendNextImagingActions(input);

    assert.ok(actions.length > 0);
    assert.ok(actions.some((action) => action.component === "comparison"));
    assert.ok(["high", "medium", "low"].includes(actions[0].priority));
    assert.ok(actions[0].action.length > 0);
    assert.ok(actions[0].reason.length > 0);
  });
});

describe("ImagingOS IM-10 — runFullImagingOsCaseEvaluation", () => {
  it("orchestrates component, overall, HairAudit, and Digital Twin outputs", () => {
    const evaluation = runFullImagingOsCaseEvaluation(strongCaseInput());

    assert.strictEqual(evaluation.evaluator_version, IMAGING_SUMMARY_EVALUATOR_VERSION);
    assert.ok(evaluation.component_scores.length > 0);
    assert.ok(evaluation.overall.overall_score > 0);
    assert.ok(evaluation.hairaudit.hairaudit_score > 0);
    assert.ok(evaluation.digital_twin.twin_imaging_score > 0);
    assert.ok(Array.isArray(evaluation.recommended_actions));
  });
});

describe("ImagingOS IM-10 — HairAudit summary adapter", () => {
  it("builds HairAudit score contract from comparison, measurement, and outcome", () => {
    const comparison = evaluateHairAuditVisualComparison([
      { category: "front", timepoint: "baseline", quality_status: "excellent" },
      { category: "front", timepoint: "month_12", quality_status: "excellent" },
      { category: "top", timepoint: "baseline", quality_status: "excellent" },
      { category: "top", timepoint: "month_12", quality_status: "excellent" },
      { category: "crown", timepoint: "baseline", quality_status: "excellent" },
      { category: "crown", timepoint: "month_12", quality_status: "excellent" },
    ]);
    const measurements = buildHairAuditMeasurementStubs(comparison);
    const outcome = evaluateHairAuditOutcomeMeasurement([
      { category: "front", timepoint: "baseline", quality_status: "excellent" },
      { category: "front", timepoint: "month_12", quality_status: "excellent" },
    ]);

    const summary = buildHairAuditImagingSummary({
      comparison_result: comparison,
      measurement_results: measurements,
      outcome_result: outcome,
      protocol_result: evaluateHairAuditCaseImageProtocol(HAIRAUDIT_BASELINE),
      quality_results: [excellentQuality("front"), excellentQuality("top")],
    });

    assert.ok(summary.hairaudit_score > 0);
    assert.strictEqual(summary.evaluator_version, IMAGING_SUMMARY_EVALUATOR_VERSION);
    assert.strictEqual(summary.comparison_status, comparison.comparison_status);
    assert.strictEqual(summary.outcome_status, outcome.measurement_status);
    assert.strictEqual(summary.measurement_count, measurements.length);
    assert.ok(summary.component_scores.length > 0);
  });
});

describe("ImagingOS IM-10 — IM-1 through IM-9 compatibility", () => {
  it("preserves IM-1 stub pipeline alongside IM-10 summary", () => {
    const pipeline = runImagingOsStubPipeline({
      source_system: "hairaudit",
      source_case_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      source_upload_id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
      external_category: "front",
      content_type: "image/jpeg",
      file_size_bytes: 512 * 1024,
    });
    assert.strictEqual(pipeline.ok, true);
    if (pipeline.ok) {
      assert.ok(pipeline.snapshot.classification.canonical_photo_category);
    }
  });

  it("integrates IM-3 protocol, IM-5 progression, and IM-6 surgical outputs", () => {
    const progression = evaluateLongitudinalProgressionReadiness({
      assessment_type: "hair_loss_monitoring",
      images: [
        progressionImage("baseline", "front"),
        progressionImage("baseline", "top"),
        progressionImage("baseline", "crown"),
        progressionImage("month_6", "front"),
        progressionImage("month_6", "top"),
        progressionImage("month_6", "crown"),
        progressionImage("month_12", "front"),
        progressionImage("month_12", "top"),
        progressionImage("month_12", "crown"),
      ],
    });
    const surgical = evaluateSurgicalImageReadiness({
      domain: "outcome_audit",
      images: [
        surgicalImage("pre_op"),
        surgicalImage("immediate_post_op"),
        surgicalImage("month_12_outcome"),
      ],
    });

    const scores = calculateImagingComponentScores({
      protocol_result: evaluateHairAuditCaseImageProtocol(HAIRAUDIT_BASELINE),
      progression_result: progression,
      surgical_result: surgical,
    });

    assert.ok(scores.some((entry) => entry.component === "progression"));
    assert.ok(scores.some((entry) => entry.component === "surgical"));
  });
});
