import { describe, it } from "node:test";
import assert from "node:assert";
import {
  IMAGING_AI_AUDIT_CONTRACT_VERSION,
  IMAGING_AI_OUTPUT_CONTRACT_VERSION,
  IMAGING_AI_VISION_TASK_REQUIREMENTS,
  IMAGING_AI_VISION_TASK_TYPES,
  buildAiVisionAuditLogContract,
  buildAiVisionEvidenceFromComparisonImage,
  buildAiVisionEvidenceFromIntake,
  buildAiVisionEvidenceFromOutcomeEvidence,
  buildAiVisionRequestContract,
  buildHairAuditAiVisionReadiness,
  createVisualMeasurementStub,
  evaluateAiVisionReadiness,
  evaluateHairAuditCaseImageProtocol,
  evaluateHairAuditOutcomeMeasurement,
  evaluateHairAuditVisualComparison,
  evaluateOutcomeMeasurementReadiness,
  evaluateVisualComparisonReadiness,
  isImagingOsAiVisionTaskType,
  normalizeImageIngestionRequest,
  recommendAiVisionTasksForSummary,
  runImagingOsStubPipeline,
  validateAiVisionModelOutputContract,
} from "../src/lib/imaging-os";
import type {
  CanonicalHairImageCategory,
  ImagingOsAiVisionEvidence,
  ImagingOsComparisonImage,
  ImagingOsOutcomeEvidence,
  ImagingOsTimepoint,
} from "../src/lib/imaging-os";

const GROWTH_CATEGORIES: CanonicalHairImageCategory[] = ["front", "top", "crown"];

function usableEvidence(
  timepoint: ImagingOsTimepoint,
  category: CanonicalHairImageCategory,
  extras: Partial<ImagingOsAiVisionEvidence> = {}
): ImagingOsAiVisionEvidence {
  return {
    evidence_id: `evidence-${timepoint}-${category}`,
    image_id: `${timepoint}-${category}`,
    canonical_category: category,
    timepoint,
    quality_status: "excellent",
    is_clinically_usable: true,
    ...extras,
  };
}

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

function fullGrowthAssessmentEvidence(): ImagingOsOutcomeEvidence[] {
  const evidence: ImagingOsOutcomeEvidence[] = [];
  const timepoints: ImagingOsTimepoint[] = ["baseline", "month_6", "month_12"];
  for (const timepoint of timepoints) {
    for (const category of GROWTH_CATEGORIES) {
      evidence.push(outcomeEvidence(timepoint, category));
      evidence.push({
        ...outcomeEvidence(timepoint, category),
        image_id: `${timepoint}-${category}-2`,
      });
    }
  }
  return evidence;
}

describe("ImagingOS IM-11 — AI task registry integrity", () => {
  it("contains all task types except unknown with requirements", () => {
    const taskTypes = IMAGING_AI_VISION_TASK_TYPES.filter((task) => task !== "unknown");
    assert.strictEqual(taskTypes.length, 12);
    for (const taskType of taskTypes) {
      assert.ok(isImagingOsAiVisionTaskType(taskType));
      const requirements = IMAGING_AI_VISION_TASK_REQUIREMENTS[taskType];
      assert.ok(requirements.description.length > 0);
      assert.ok(requirements.required_quality_statuses.length > 0);
    }
  });

  it("maps risk levels per IM-11 spec", () => {
    assert.strictEqual(
      IMAGING_AI_VISION_TASK_REQUIREMENTS.image_category_classification.risk_level,
      "low"
    );
    assert.strictEqual(
      IMAGING_AI_VISION_TASK_REQUIREMENTS.image_quality_assessment.risk_level,
      "low"
    );
    assert.strictEqual(
      IMAGING_AI_VISION_TASK_REQUIREMENTS.protocol_gap_detection.risk_level,
      "low"
    );
    assert.strictEqual(
      IMAGING_AI_VISION_TASK_REQUIREMENTS.hair_loss_stage_estimation.risk_level,
      "medium"
    );
    assert.strictEqual(
      IMAGING_AI_VISION_TASK_REQUIREMENTS.donor_area_assessment.risk_level,
      "medium"
    );
    assert.strictEqual(
      IMAGING_AI_VISION_TASK_REQUIREMENTS.recipient_area_assessment.risk_level,
      "medium"
    );
    assert.strictEqual(IMAGING_AI_VISION_TASK_REQUIREMENTS.growth_comparison.risk_level, "high");
    assert.strictEqual(IMAGING_AI_VISION_TASK_REQUIREMENTS.density_measurement.risk_level, "high");
    assert.strictEqual(
      IMAGING_AI_VISION_TASK_REQUIREMENTS.graft_survival_estimation.risk_level,
      "high"
    );
    assert.strictEqual(
      IMAGING_AI_VISION_TASK_REQUIREMENTS.hairline_design_review.risk_level,
      "high"
    );
    assert.strictEqual(
      IMAGING_AI_VISION_TASK_REQUIREMENTS.surgical_outcome_review.risk_level,
      "clinical_review_required"
    );
    assert.strictEqual(
      IMAGING_AI_VISION_TASK_REQUIREMENTS.digital_twin_summary.risk_level,
      "clinical_review_required"
    );
  });

  it("density measurement registry matches IM-11 spec", () => {
    const req = IMAGING_AI_VISION_TASK_REQUIREMENTS.density_measurement;
    assert.strictEqual(req.risk_level, "high");
    assert.deepStrictEqual(req.required_quality_statuses, ["excellent", "acceptable"]);
    assert.strictEqual(req.requires_clinically_usable_images, true);
    assert.strictEqual(req.requires_comparison_ready, true);
    assert.deepStrictEqual(req.allowed_measurement_domains, ["density", "frontal_density"]);
    assert.deepStrictEqual(req.allowed_comparison_domains, [
      "density_change",
      "growth_change",
    ]);
    assert.strictEqual(req.requires_human_review, true);
  });
});

describe("ImagingOS IM-11 — evaluateAiVisionReadiness", () => {
  it("category classification can be ready with not_evaluated quality", () => {
    const result = evaluateAiVisionReadiness({
      task_type: "image_category_classification",
      evidence: [
        {
          evidence_id: "ev-1",
          quality_status: "not_evaluated",
        },
      ],
    });

    assert.strictEqual(result.readiness_status, "ready");
    assert.strictEqual(result.blockers.length, 0);
    assert.strictEqual(result.requires_human_review, false);
  });

  it("density measurement blocked without comparison readiness", () => {
    const evidence = GROWTH_CATEGORIES.flatMap((category) => [
      usableEvidence("baseline", category),
      usableEvidence("month_12", category),
    ]);

    const result = evaluateAiVisionReadiness({
      task_type: "density_measurement",
      evidence,
    });

    assert.strictEqual(result.readiness_status, "blocked");
    assert.ok(result.blockers.some((blocker) => blocker.includes("Comparison")));
  });

  it("density measurement ready with usable evidence and comparison ready", () => {
    const comparison = evaluateVisualComparisonReadiness({
      domain: "density_change",
      images: fullGrowthComparisonSet("month_12"),
    });
    const evidence = comparison.valid_comparison_pairs.flatMap((pair) => [
      buildAiVisionEvidenceFromComparisonImage(pair.baseline_image),
      buildAiVisionEvidenceFromComparisonImage(pair.followup_image),
    ]);

    const result = evaluateAiVisionReadiness({
      task_type: "density_measurement",
      evidence,
      comparison_result: comparison,
    });

    assert.strictEqual(result.readiness_status, "partial");
    assert.strictEqual(result.blockers.length, 0);
    assert.ok(result.warnings.length > 0);
    assert.strictEqual(result.risk_level, "high");
  });

  it("surgical outcome review requires outcome and summary threshold", () => {
    const comparison = evaluateVisualComparisonReadiness({
      domain: "growth_change",
      images: fullGrowthComparisonSet("month_12"),
    });
    const outcome = evaluateOutcomeMeasurementReadiness({
      domain: "growth_assessment",
      evidence: fullGrowthAssessmentEvidence(),
    });
    const evidence = [usableEvidence("month_12", "front")];

    const blocked = evaluateAiVisionReadiness({
      task_type: "surgical_outcome_review",
      evidence,
      comparison_result: comparison,
      outcome_result: outcome,
      summary_result: { overall_score: 60, overall_status: "partial" },
    });
    assert.strictEqual(blocked.readiness_status, "blocked");
    assert.ok(blocked.blockers.some((blocker) => blocker.includes("summary score")));

    const ready = evaluateAiVisionReadiness({
      task_type: "surgical_outcome_review",
      evidence,
      comparison_result: comparison,
      outcome_result: outcome,
      summary_result: { overall_score: 85, overall_status: "ready" },
    });
    assert.strictEqual(ready.blockers.length, 0);
    assert.ok(ready.readiness_status === "ready" || ready.readiness_status === "partial");
    assert.strictEqual(ready.human_review_policy, "clinical_sign_off_required");
  });

  it("digital twin summary requires summary threshold", () => {
    const blocked = evaluateAiVisionReadiness({
      task_type: "digital_twin_summary",
      evidence: [{ evidence_id: "ev-1" }],
      summary_result: { overall_score: 70, overall_status: "partial" },
    });
    assert.strictEqual(blocked.readiness_status, "blocked");
    assert.ok(blocked.blockers.some((blocker) => blocker.includes("summary score")));

    const ready = evaluateAiVisionReadiness({
      task_type: "digital_twin_summary",
      evidence: [{ evidence_id: "ev-1" }],
      summary_result: { overall_score: 90, overall_status: "ready" },
    });
    assert.strictEqual(ready.blockers.length, 0);
    assert.strictEqual(ready.readiness_status, "partial");
  });

  it("invalid task returns invalid", () => {
    const result = evaluateAiVisionReadiness({
      task_type: "unknown",
      evidence: [{ evidence_id: "ev-1" }],
    });
    assert.strictEqual(result.readiness_status, "invalid");
    assert.ok(result.blockers.length > 0);
  });

  it("missing evidence returns blocked", () => {
    const result = evaluateAiVisionReadiness({
      task_type: "image_quality_assessment",
      evidence: [],
    });
    assert.strictEqual(result.readiness_status, "blocked");
    assert.ok(result.blockers.some((blocker) => blocker.includes("At least one evidence")));
  });
});

describe("ImagingOS IM-11 — evidence bridges", () => {
  it("buildAiVisionEvidenceFromIntake works", () => {
    const intake = normalizeImageIngestionRequest({
      source_system: "hairaudit",
      upload_surface: "audit_upload",
      external_category: "front",
      storage_path: "cases/abc/front.jpg",
      patient_id: "patient-1",
      metadata: { timepoint: "baseline" },
    });

    const evidence = buildAiVisionEvidenceFromIntake({ intake });
    assert.ok(evidence.evidence_id.startsWith("ai-evidence-"));
    assert.strictEqual(evidence.canonical_category, "front");
    assert.strictEqual(evidence.timepoint, "baseline");
    assert.strictEqual(evidence.quality_status, "not_evaluated");
    assert.strictEqual(evidence.storage_path, "cases/abc/front.jpg");
  });

  it("buildAiVisionEvidenceFromOutcomeEvidence works", () => {
    const evidence = buildAiVisionEvidenceFromOutcomeEvidence(
      outcomeEvidence("month_12", "front")
    );
    assert.ok(evidence.evidence_id.startsWith("ai-evidence-"));
    assert.strictEqual(evidence.image_id, "month_12-front");
    assert.strictEqual(evidence.canonical_category, "front");
    assert.strictEqual(evidence.timepoint, "month_12");
  });

  it("buildAiVisionEvidenceFromComparisonImage works", () => {
    const evidence = buildAiVisionEvidenceFromComparisonImage(
      usableComparisonImage("baseline", "top")
    );
    assert.ok(evidence.evidence_id.startsWith("ai-evidence-"));
    assert.strictEqual(evidence.canonical_category, "top");
    assert.strictEqual(evidence.is_clinically_usable, true);
  });
});

describe("ImagingOS IM-11 — request and audit contracts", () => {
  it("buildAiVisionRequestContract generates deterministic request_id", () => {
    const requestA = buildAiVisionRequestContract({
      task_type: "image_category_classification",
      evidence: [{ evidence_id: "ev-1", image_id: "img-1" }],
      timestamp: "2026-06-17T00:00:00.000Z",
    });
    const requestB = buildAiVisionRequestContract({
      task_type: "image_category_classification",
      evidence: [{ evidence_id: "ev-1", image_id: "img-1" }],
      timestamp: "2026-06-17T00:00:00.000Z",
    });

    assert.strictEqual(requestA.request_id, requestB.request_id);
    assert.ok(requestA.request_id.startsWith("ai-vision-"));
    assert.strictEqual(
      requestA.model_output_contract_version,
      IMAGING_AI_OUTPUT_CONTRACT_VERSION
    );
    assert.strictEqual(requestA.audit_contract_version, IMAGING_AI_AUDIT_CONTRACT_VERSION);
  });

  it("buildAiVisionAuditLogContract builds audit contract", () => {
    const request = buildAiVisionRequestContract({
      task_type: "density_measurement",
      evidence: [usableEvidence("baseline", "top")],
      timestamp: "fixed",
    });
    const audit = buildAiVisionAuditLogContract({
      request,
      created_at: "2026-06-17T00:00:00.000Z",
      model_name: "vision-stub",
      model_version: "0.0.0",
    });

    assert.ok(audit.audit_id.startsWith("ai-audit-"));
    assert.strictEqual(audit.request_id, request.request_id);
    assert.strictEqual(audit.task_type, "density_measurement");
    assert.strictEqual(audit.evidence_count, 1);
    assert.strictEqual(audit.audit_contract_version, IMAGING_AI_AUDIT_CONTRACT_VERSION);
  });
});

describe("ImagingOS IM-11 — output validation", () => {
  it("rejects unallowed measurement domains", () => {
    const request = buildAiVisionRequestContract({
      task_type: "density_measurement",
      evidence: [usableEvidence("baseline", "top"), usableEvidence("month_12", "top")],
      comparison_result: evaluateVisualComparisonReadiness({
        domain: "density_change",
        images: fullGrowthComparisonSet("month_12"),
      }),
      timestamp: "fixed",
    });

    const output = {
      request_id: request.request_id,
      task_type: "density_measurement" as const,
      output_status: "completed" as const,
      measurements: [
        createVisualMeasurementStub({
          domain: "graft_survival",
          confidence: 0.9,
        }),
      ],
      requires_human_review: true,
      warnings: [],
      blockers: [],
      generated_at: "2026-06-17T00:00:00.000Z",
      output_contract_version: IMAGING_AI_OUTPUT_CONTRACT_VERSION,
    };

    const validation = validateAiVisionModelOutputContract(output, request);
    assert.strictEqual(validation.valid, false);
    assert.ok(
      validation.blockers.some((blocker) => blocker.includes("graft_survival"))
    );
  });

  it("requires review for high-risk measurement output", () => {
    const request = buildAiVisionRequestContract({
      task_type: "density_measurement",
      evidence: [usableEvidence("baseline", "top"), usableEvidence("month_12", "top")],
      comparison_result: evaluateVisualComparisonReadiness({
        domain: "density_change",
        images: fullGrowthComparisonSet("month_12"),
      }),
      timestamp: "fixed",
    });

    const output = {
      request_id: request.request_id,
      task_type: "density_measurement" as const,
      output_status: "completed" as const,
      measurements: [
        createVisualMeasurementStub({
          domain: "density",
          confidence: 0.92,
        }),
      ],
      requires_human_review: false,
      warnings: [],
      blockers: [],
      generated_at: "2026-06-17T00:00:00.000Z",
      output_contract_version: IMAGING_AI_OUTPUT_CONTRACT_VERSION,
    };

    const validation = validateAiVisionModelOutputContract(output, request);
    assert.strictEqual(validation.requires_human_review, true);
    assert.ok(
      validation.warnings.some((warning) => warning.includes("High-risk task with measurements"))
    );
  });
});

describe("ImagingOS IM-11 — HairAudit adapter", () => {
  it("defaults to surgical_outcome_review", () => {
    const comparison = evaluateHairAuditVisualComparison(
      fullGrowthComparisonSet("month_12").map((image) => ({
        category: image.canonical_category,
        timepoint: image.timepoint,
        quality_status: "excellent" as const,
      }))
    );
    const outcome = evaluateHairAuditOutcomeMeasurement(
      fullGrowthAssessmentEvidence().map((item) => ({
        category: item.canonical_category,
        timepoint: item.timepoint,
        quality_status: "excellent" as const,
      }))
    );

    const request = buildHairAuditAiVisionReadiness({
      evidence: [usableEvidence("month_12", "front")],
      comparison_result: comparison,
      outcome_result: outcome,
      summary_result: { overall_score: 85, overall_status: "ready" },
      timestamp: "fixed",
    });

    assert.strictEqual(request.task_type, "surgical_outcome_review");
    assert.strictEqual(request.risk_level, "clinical_review_required");
    assert.ok(request.request_id.length > 0);
  });
});

describe("ImagingOS IM-11 — recommendAiVisionTasksForSummary", () => {
  it("recommends tasks based on summary and readiness outputs", () => {
    const comparison = evaluateVisualComparisonReadiness({
      domain: "growth_change",
      images: fullGrowthComparisonSet("month_12"),
    });
    const outcome = evaluateOutcomeMeasurementReadiness({
      domain: "growth_assessment",
      evidence: fullGrowthAssessmentEvidence(),
    });

    const strongTasks = recommendAiVisionTasksForSummary({
      summary_result: { overall_score: 85, overall_status: "ready" },
      comparison_result: comparison,
      outcome_result: outcome,
    });

    assert.ok(strongTasks.includes("image_category_classification"));
    assert.ok(strongTasks.includes("image_quality_assessment"));
    assert.ok(strongTasks.includes("growth_comparison"));
    assert.ok(strongTasks.includes("density_measurement"));
    assert.ok(strongTasks.includes("surgical_outcome_review"));

    const weakTasks = recommendAiVisionTasksForSummary({
      summary_result: { overall_score: 50, overall_status: "insufficient_data" },
    });
    assert.ok(weakTasks.includes("protocol_gap_detection"));
    assert.ok(!weakTasks.includes("growth_comparison"));
  });
});

describe("ImagingOS IM-11 — IM-1 through IM-10 compatibility", () => {
  it("preserves IM-1 stub pipeline", () => {
    const pipeline = runImagingOsStubPipeline({
      source_system: "hairaudit",
      source_case_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      source_upload_id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
      external_category: "front",
      content_type: "image/jpeg",
      file_size_bytes: 512 * 1024,
    });
    assert.strictEqual(pipeline.ok, true);
  });

  it("preserves IM-8 comparison and IM-7 outcome evaluators alongside IM-11", () => {
    const comparison = evaluateVisualComparisonReadiness({
      domain: "growth_change",
      images: fullGrowthComparisonSet("month_12"),
    });
    const outcome = evaluateOutcomeMeasurementReadiness({
      domain: "growth_assessment",
      evidence: fullGrowthAssessmentEvidence(),
    });
    const protocol = evaluateHairAuditCaseImageProtocol([
      "front",
      "left",
      "right",
      "top",
      "crown",
      "donor",
    ]);

    assert.ok(comparison.comparison_status === "ready" || comparison.comparison_status === "partial");
    assert.ok(
      outcome.measurement_status === "measurable" ||
        outcome.measurement_status === "partially_measurable"
    );
    assert.ok(protocol.completeness_score > 0);

    const aiRequest = buildAiVisionRequestContract({
      task_type: "growth_comparison",
      evidence: fullGrowthComparisonSet("month_12").map(buildAiVisionEvidenceFromComparisonImage),
      comparison_result: comparison,
      outcome_result: outcome,
      timestamp: "fixed",
    });
    assert.strictEqual(aiRequest.task_type, "growth_comparison");
    assert.strictEqual(aiRequest.blockers.length, 0);
  });
});
