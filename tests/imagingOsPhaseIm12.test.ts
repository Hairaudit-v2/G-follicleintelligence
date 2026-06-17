import { describe, it } from "node:test";
import assert from "node:assert";
import {
  ALLOWED_IM12_TASKS,
  buildAiVisionExecutionPrompt,
  buildAiVisionRequestContract,
  buildHairAuditAiVisionReadiness,
  canExecuteAiVisionTask,
  createAiProvider,
  DEFAULT_IMAGING_AI_FLAGS,
  evaluateAiVisionReadiness,
  evaluateHairAuditCaseImageProtocol,
  evaluateHairAuditOutcomeMeasurement,
  evaluateHairAuditVisualComparison,
  evaluateOutcomeMeasurementReadiness,
  evaluateVisualComparisonReadiness,
  executeImagingAiVisionTask,
  IMAGING_AI_OUTPUT_CONTRACT_VERSION,
  ImagingOsStubAiProvider,
  recommendAiVisionTasksForSummary,
  recommendSafeAiTasks,
  runHairAuditAiTask,
  runImagingOsStubPipeline,
  validateAiVisionModelOutputContract,
} from "../src/lib/imaging-os";
import type {
  CanonicalHairImageCategory,
  ImagingOsAiFeatureFlags,
  ImagingOsAiProvider,
  ImagingOsAiVisionEvidence,
  ImagingOsAiVisionRequestContract,
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

function lowRiskRequest(
  taskType: "image_category_classification" | "image_quality_assessment" | "protocol_gap_detection",
  overrides: Partial<{ request_id: string; timestamp: string }> = {}
): ImagingOsAiVisionRequestContract {
  return buildAiVisionRequestContract({
    task_type: taskType,
    evidence: [{ evidence_id: "ev-1", image_id: "img-1", canonical_category: "front" }],
    timestamp: overrides.timestamp ?? "2026-06-17T00:00:00.000Z",
    ...(overrides.request_id ? { request_id: overrides.request_id } : {}),
  });
}

function enabledFlags(overrides: Partial<ImagingOsAiFeatureFlags> = {}): ImagingOsAiFeatureFlags {
  return {
    ...DEFAULT_IMAGING_AI_FLAGS,
    ai_enabled: true,
    dry_run_mode: false,
    provider: "stub",
    ...overrides,
  };
}

describe("ImagingOS IM-12 — default flags safe", () => {
  it("DEFAULT_IMAGING_AI_FLAGS has safe defaults", () => {
    assert.strictEqual(DEFAULT_IMAGING_AI_FLAGS.ai_enabled, false);
    assert.strictEqual(DEFAULT_IMAGING_AI_FLAGS.allow_low_risk_tasks, true);
    assert.strictEqual(DEFAULT_IMAGING_AI_FLAGS.allow_medium_risk_tasks, false);
    assert.strictEqual(DEFAULT_IMAGING_AI_FLAGS.allow_high_risk_tasks, false);
    assert.strictEqual(DEFAULT_IMAGING_AI_FLAGS.allow_clinical_review_tasks, false);
    assert.strictEqual(DEFAULT_IMAGING_AI_FLAGS.dry_run_mode, true);
    assert.strictEqual(DEFAULT_IMAGING_AI_FLAGS.provider, "stub");
  });

  it("ALLOWED_IM12_TASKS contains only three low-risk tasks", () => {
    assert.deepStrictEqual(ALLOWED_IM12_TASKS, [
      "image_category_classification",
      "image_quality_assessment",
      "protocol_gap_detection",
    ]);
  });
});

describe("ImagingOS IM-12 — canExecuteAiVisionTask", () => {
  it("ai disabled blocks execution", () => {
    const result = canExecuteAiVisionTask({
      task_type: "image_category_classification",
      flags: DEFAULT_IMAGING_AI_FLAGS,
    });
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason?.includes("ai_enabled"));
  });

  it("low risk allowed when flag enabled", () => {
    const result = canExecuteAiVisionTask({
      task_type: "image_category_classification",
      flags: enabledFlags(),
    });
    assert.strictEqual(result.allowed, true);
  });

  it("medium risk blocked by default flags", () => {
    const result = canExecuteAiVisionTask({
      task_type: "hair_loss_stage_estimation",
      flags: enabledFlags(),
    });
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason?.includes("Medium-risk"));
  });

  it("high risk blocked by default flags", () => {
    const result = canExecuteAiVisionTask({
      task_type: "density_measurement",
      flags: enabledFlags(),
    });
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason?.includes("High-risk"));
  });

  it("clinical review blocked by default flags", () => {
    const result = canExecuteAiVisionTask({
      task_type: "surgical_outcome_review",
      flags: enabledFlags(),
    });
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason?.includes("Clinical review"));
  });
});

describe("ImagingOS IM-12 — executeImagingAiVisionTask", () => {
  it("task not in ALLOWED_IM12_TASKS is blocked", async () => {
    const request = buildAiVisionRequestContract({
      task_type: "density_measurement",
      evidence: [usableEvidence("baseline", "top"), usableEvidence("month_12", "top")],
      comparison_result: evaluateVisualComparisonReadiness({
        domain: "density_change",
        images: fullGrowthComparisonSet("month_12"),
      }),
      timestamp: "fixed",
    });

    const result = await executeImagingAiVisionTask({
      request,
      flags: enabledFlags({ allow_high_risk_tasks: true }),
    });

    assert.strictEqual(result.execution_status, "blocked");
    assert.ok(result.blockers.some((b) => b.includes("IM-12 safety phase")));
  });

  it("ai disabled blocks execution", async () => {
    const result = await executeImagingAiVisionTask({
      request: lowRiskRequest("image_category_classification"),
      flags: DEFAULT_IMAGING_AI_FLAGS,
    });

    assert.strictEqual(result.execution_status, "blocked");
    assert.ok(result.blockers.some((b) => b.includes("ai_enabled")));
  });

  it("dry run returns dry_run status without output", async () => {
    const result = await executeImagingAiVisionTask({
      request: lowRiskRequest("image_category_classification"),
      flags: enabledFlags({ dry_run_mode: true }),
    });

    assert.strictEqual(result.execution_status, "dry_run");
    assert.strictEqual(result.output, undefined);
    assert.ok(result.audit_log.audit_id.startsWith("ai-audit-"));
    assert.strictEqual(result.audit_log.task_type, "image_category_classification");
  });

  it("stub provider returns valid category classification", async () => {
    const result = await executeImagingAiVisionTask({
      request: lowRiskRequest("image_category_classification"),
      flags: enabledFlags(),
    });

    assert.strictEqual(result.execution_status, "executed");
    assert.ok(result.output);
    assert.strictEqual(result.output!.task_type, "image_category_classification");
    assert.strictEqual(result.output!.classifications?.[0]?.category, "front");
    assert.strictEqual(result.output!.classifications?.[0]?.confidence, 0.93);
    assert.strictEqual(result.output!.model_name, "imaging-os-stub");
  });

  it("output validation passes for stub provider", async () => {
    const request = lowRiskRequest("image_quality_assessment");
    const result = await executeImagingAiVisionTask({
      request,
      flags: enabledFlags(),
    });

    assert.strictEqual(result.execution_status, "executed");
    const validation = validateAiVisionModelOutputContract(result.output!, request);
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(result.output!.findings?.[0]?.finding_type, "quality_assessment");
  });

  it("invalid provider output returns validation_failed", async () => {
    const request = lowRiskRequest("image_category_classification", {
      request_id: "req-valid-id",
    });

    const invalidProvider: ImagingOsAiProvider = {
      async executeTask() {
        return {
          request_id: "wrong-request-id",
          task_type: "image_category_classification",
          output_status: "completed",
          classifications: [{ category: "front", confidence: 0.9 }],
          requires_human_review: false,
          warnings: [],
          blockers: [],
          generated_at: "2026-06-17T00:00:00.000Z",
          output_contract_version: IMAGING_AI_OUTPUT_CONTRACT_VERSION,
        };
      },
    };

    const result = await executeImagingAiVisionTask({
      request,
      flags: enabledFlags(),
      provider: invalidProvider,
    });

    assert.strictEqual(result.execution_status, "validation_failed");
    assert.ok(result.output);
    assert.ok(result.blockers.some((b) => b.includes("request_id")));
  });

  it("protocol gap detection stub returns valid findings", async () => {
    const result = await executeImagingAiVisionTask({
      request: lowRiskRequest("protocol_gap_detection"),
      flags: enabledFlags(),
    });

    assert.strictEqual(result.execution_status, "executed");
    assert.strictEqual(result.output!.findings?.[0]?.finding_type, "protocol_gap");
    assert.strictEqual(result.output!.findings?.[0]?.description, "Potential missing donor image.");
  });
});

describe("ImagingOS IM-12 — buildAiVisionExecutionPrompt", () => {
  it("generates prompts for category classification", () => {
    const request = lowRiskRequest("image_category_classification");
    const prompt = buildAiVisionExecutionPrompt(request);

    assert.ok(prompt.system_prompt.includes("Classify"));
    assert.ok(prompt.user_prompt.includes("classification"));
    assert.ok(Array.isArray(prompt.structured_schema.classifications));
  });

  it("generates prompts for quality assessment", () => {
    const request = lowRiskRequest("image_quality_assessment");
    const prompt = buildAiVisionExecutionPrompt(request);

    assert.ok(prompt.system_prompt.includes("quality"));
    assert.ok(prompt.structured_schema.findings);
  });

  it("generates prompts for protocol gap detection", () => {
    const request = lowRiskRequest("protocol_gap_detection");
    const prompt = buildAiVisionExecutionPrompt(request);

    assert.ok(prompt.system_prompt.includes("protocol"));
    assert.ok(prompt.user_prompt.includes("protocol gaps"));
  });
});

describe("ImagingOS IM-12 — createAiProvider", () => {
  it("returns stub provider", () => {
    const provider = createAiProvider("stub");
    assert.ok(provider instanceof ImagingOsStubAiProvider);
  });

  it("throws for unimplemented providers", () => {
    assert.throws(() => createAiProvider("openai"), /not implemented in IM-12/);
    assert.throws(() => createAiProvider("anthropic"), /not implemented in IM-12/);
    assert.throws(() => createAiProvider("local"), /not implemented in IM-12/);
  });
});

describe("ImagingOS IM-12 — HairAudit adapter", () => {
  it("runHairAuditAiTask delegates to execution engine", async () => {
    const request = buildHairAuditAiVisionReadiness({
      task_type: "image_category_classification",
      evidence: [{ evidence_id: "ev-1", canonical_category: "top" }],
      timestamp: "fixed",
    });

    const result = await runHairAuditAiTask({
      request,
      flags: enabledFlags(),
    });

    assert.strictEqual(result.execution_status, "executed");
    assert.strictEqual(result.output?.classifications?.[0]?.category, "top");
  });
});

describe("ImagingOS IM-12 — recommendSafeAiTasks", () => {
  it("always recommends image_category_classification", () => {
    const tasks = recommendSafeAiTasks();
    assert.deepStrictEqual(tasks, ["image_category_classification"]);
  });

  it("adds quality assessment when score > 60", () => {
    const tasks = recommendSafeAiTasks({ summary_result: { overall_score: 65 } });
    assert.ok(tasks.includes("image_category_classification"));
    assert.ok(tasks.includes("image_quality_assessment"));
    assert.ok(!tasks.includes("protocol_gap_detection"));
  });

  it("adds protocol gap when score > 75", () => {
    const tasks = recommendSafeAiTasks({ summary_result: { overall_score: 80 } });
    assert.ok(tasks.includes("image_category_classification"));
    assert.ok(tasks.includes("image_quality_assessment"));
    assert.ok(tasks.includes("protocol_gap_detection"));
  });

  it("never recommends higher risk tasks", () => {
    const tasks = recommendSafeAiTasks({ summary_result: { overall_score: 100 } });
    assert.ok(!tasks.includes("growth_comparison" as never));
    assert.ok(!tasks.includes("density_measurement" as never));
    assert.ok(!tasks.includes("surgical_outcome_review" as never));
  });
});

describe("ImagingOS IM-12 — IM-1 through IM-11 compatibility", () => {
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

  it("preserves IM-11 readiness evaluation alongside IM-12 execution", async () => {
    const readiness = evaluateAiVisionReadiness({
      task_type: "image_category_classification",
      evidence: [{ evidence_id: "ev-1", quality_status: "not_evaluated" }],
    });
    assert.strictEqual(readiness.readiness_status, "ready");

    const request = buildAiVisionRequestContract({
      task_type: "image_category_classification",
      evidence: [{ evidence_id: "ev-1", quality_status: "not_evaluated" }],
      timestamp: "fixed",
    });

    const dryRun = await executeImagingAiVisionTask({
      request,
      flags: enabledFlags({ dry_run_mode: true }),
    });
    assert.strictEqual(dryRun.execution_status, "dry_run");
  });

  it("preserves IM-11 recommendAiVisionTasksForSummary separately from safe recommendations", () => {
    const comparison = evaluateVisualComparisonReadiness({
      domain: "growth_change",
      images: fullGrowthComparisonSet("month_12"),
    });
    const outcome = evaluateOutcomeMeasurementReadiness({
      domain: "growth_assessment",
      evidence: fullGrowthAssessmentEvidence(),
    });

    const broad = recommendAiVisionTasksForSummary({
      summary_result: { overall_score: 85, overall_status: "ready" },
      comparison_result: comparison,
      outcome_result: outcome,
    });
    assert.ok(broad.includes("growth_comparison"));

    const safe = recommendSafeAiTasks({ summary_result: { overall_score: 85 } });
    assert.ok(!safe.includes("growth_comparison" as never));
  });

  it("preserves IM-8 comparison and HairAudit adapters", () => {
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
  });
});
