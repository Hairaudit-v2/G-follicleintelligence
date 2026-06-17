import { describe, it } from "node:test";
import assert from "node:assert";
import {
  IMAGING_PROGRESSION_ASSESSMENT_TYPES,
  IMAGING_PROGRESSION_REQUIREMENTS,
  IMAGING_PROGRESSION_EVALUATOR_VERSION,
  buildProgressionImageFromIntake,
  evaluateImageQualityFromMetadata,
  evaluateImageQualityStub,
  evaluateLongitudinalProgressionReadiness,
  isImagingOsProgressionAssessmentType,
  normalizeImagingOsTimepoint,
  normalizeImageIngestionRequest,
  recommendProgressionAssessmentForWorkflow,
  runImagingOsCaseProgressionEvaluation,
  runImagingOsIngestionPipeline,
} from "../src/lib/imaging-os";
import type { CanonicalHairImageCategory, ImagingOsProgressionImage, ImagingOsTimepoint } from "../src/lib/imaging-os";

function usableImage(
  timepoint: ImagingOsTimepoint,
  category: CanonicalHairImageCategory,
  imageId?: string
): ImagingOsProgressionImage {
  return {
    ...(imageId ? { image_id: imageId } : {}),
    canonical_category: category,
    timepoint,
    quality_status: "excellent",
    is_clinically_usable: true,
  };
}

function unusableImage(
  timepoint: ImagingOsTimepoint,
  category: CanonicalHairImageCategory,
  imageId?: string
): ImagingOsProgressionImage {
  return {
    ...(imageId ? { image_id: imageId } : {}),
    canonical_category: category,
    timepoint,
    quality_status: "poor",
    is_clinically_usable: false,
  };
}

function notEvaluatedImage(
  timepoint: ImagingOsTimepoint,
  category: CanonicalHairImageCategory
): ImagingOsProgressionImage {
  return {
    canonical_category: category,
    timepoint,
    quality_status: "not_evaluated",
  };
}

function fullHairAuditOutcome12MonthSet(): ImagingOsProgressionImage[] {
  const baselineCategories: CanonicalHairImageCategory[] = ["front", "top", "crown", "donor"];
  const month12Categories: CanonicalHairImageCategory[] = ["front", "top", "crown", "donor"];
  return [
    ...baselineCategories.map((category) => usableImage("baseline", category, `baseline-${category}`)),
    ...month12Categories.map((category) => usableImage("month_12", category, `m12-${category}`)),
  ];
}

describe("ImagingOS IM-5 — timepoint normalization", () => {
  it("normalizes canonical timepoint values", () => {
    assert.strictEqual(normalizeImagingOsTimepoint("baseline"), "baseline");
    assert.strictEqual(normalizeImagingOsTimepoint("month_12"), "month_12");
  });

  it("normalizes baseline aliases", () => {
    assert.strictEqual(normalizeImagingOsTimepoint("before"), "baseline");
    assert.strictEqual(normalizeImagingOsTimepoint("initial"), "baseline");
    assert.strictEqual(normalizeImagingOsTimepoint("intake"), "baseline");
  });

  it("normalizes pre-op aliases", () => {
    assert.strictEqual(normalizeImagingOsTimepoint("preop"), "pre_op");
    assert.strictEqual(normalizeImagingOsTimepoint("pre-op"), "pre_op");
    assert.strictEqual(normalizeImagingOsTimepoint("surgery_planning"), "pre_op");
  });

  it("normalizes post-op and day-14 aliases", () => {
    assert.strictEqual(normalizeImagingOsTimepoint("postop"), "immediate_post_op");
    assert.strictEqual(normalizeImagingOsTimepoint("immediate_postop"), "immediate_post_op");
    assert.strictEqual(normalizeImagingOsTimepoint("14_day"), "day_14");
    assert.strictEqual(normalizeImagingOsTimepoint("two_week"), "day_14");
  });

  it("normalizes month aliases", () => {
    assert.strictEqual(normalizeImagingOsTimepoint("3-month"), "month_3");
    assert.strictEqual(normalizeImagingOsTimepoint("m6"), "month_6");
    assert.strictEqual(normalizeImagingOsTimepoint("m12"), "month_12");
    assert.strictEqual(normalizeImagingOsTimepoint("one_year"), "month_12");
    assert.strictEqual(normalizeImagingOsTimepoint("m24"), "month_24");
    assert.strictEqual(normalizeImagingOsTimepoint("annual"), "annual_review");
  });

  it("returns unknown for missing or unrecognized values", () => {
    assert.strictEqual(normalizeImagingOsTimepoint(null), "unknown");
    assert.strictEqual(normalizeImagingOsTimepoint(undefined), "unknown");
    assert.strictEqual(normalizeImagingOsTimepoint(""), "unknown");
    assert.strictEqual(normalizeImagingOsTimepoint("random_label"), "unknown");
  });
});

describe("ImagingOS IM-5 — progression registry", () => {
  it("contains all assessment types with requirements", () => {
    assert.strictEqual(IMAGING_PROGRESSION_ASSESSMENT_TYPES.length, 6);
    for (const assessmentType of IMAGING_PROGRESSION_ASSESSMENT_TYPES) {
      assert.ok(isImagingOsProgressionAssessmentType(assessmentType));
      const req = IMAGING_PROGRESSION_REQUIREMENTS[assessmentType];
      assert.ok(req.description.length > 0);
      assert.ok(req.required_timepoints.length > 0);
      assert.ok(req.required_categories.length > 0);
      assert.ok(req.minimum_usable_images_per_timepoint > 0);
    }
  });

  it("defines hairaudit_outcome_12month requirements", () => {
    const req = IMAGING_PROGRESSION_REQUIREMENTS.hairaudit_outcome_12month;
    assert.deepStrictEqual(req.required_timepoints, ["baseline", "month_12"]);
    assert.deepStrictEqual(req.required_categories, ["front", "top", "crown", "donor"]);
    assert.strictEqual(req.minimum_usable_images_per_timepoint, 3);
  });
});

describe("ImagingOS IM-5 — evaluateLongitudinalProgressionReadiness", () => {
  it("returns ready for complete hairaudit_outcome_12month set", () => {
    const result = evaluateLongitudinalProgressionReadiness({
      assessment_type: "hairaudit_outcome_12month",
      images: fullHairAuditOutcome12MonthSet(),
    });
    assert.strictEqual(result.readiness_status, "ready");
    assert.strictEqual(result.progression_direction, "insufficient_data");
    assert.strictEqual(result.completeness_score, 100);
    assert.deepStrictEqual(result.missing_timepoints, []);
    assert.strictEqual(result.evaluator_version, IMAGING_PROGRESSION_EVALUATOR_VERSION);
  });

  it("returns partial or not_ready when month_12 is missing", () => {
    const baselineOnly = fullHairAuditOutcome12MonthSet().filter(
      (image) => image.timepoint === "baseline"
    );
    const result = evaluateLongitudinalProgressionReadiness({
      assessment_type: "hairaudit_outcome_12month",
      images: baselineOnly,
    });
    assert.ok(["partial", "not_ready"].includes(result.readiness_status));
    assert.deepStrictEqual(result.missing_timepoints, ["month_12"]);
    assert.notStrictEqual(result.readiness_status, "ready");
  });

  it("does not count unusable images toward readiness", () => {
    const images = fullHairAuditOutcome12MonthSet().map((image) =>
      image.timepoint === "month_12"
        ? unusableImage(image.timepoint, image.canonical_category, image.image_id)
        : image
    );
    const result = evaluateLongitudinalProgressionReadiness({
      assessment_type: "hairaudit_outcome_12month",
      images,
    });
    assert.notStrictEqual(result.readiness_status, "ready");
    assert.deepStrictEqual(result.missing_timepoints, ["month_12"]);
    assert.ok(result.quality_blockers.length > 0);
  });

  it("does not count not_evaluated images as usable", () => {
    const images = [
      ...["front", "top", "crown", "donor"].map((category) =>
        notEvaluatedImage("baseline", category as CanonicalHairImageCategory)
      ),
      ...["front", "top", "crown", "donor"].map((category) =>
        usableImage("month_12", category as CanonicalHairImageCategory)
      ),
    ];
    const result = evaluateLongitudinalProgressionReadiness({
      assessment_type: "hairaudit_outcome_12month",
      images,
    });
    assert.notStrictEqual(result.readiness_status, "ready");
    assert.deepStrictEqual(result.missing_timepoints, ["baseline"]);
  });

  it("requires donor category across timepoints for donor_recovery_tracking", () => {
    const images = [
      usableImage("pre_op", "front"),
      usableImage("immediate_post_op", "front"),
      usableImage("day_14", "front"),
      usableImage("month_6", "front"),
      usableImage("month_12", "front"),
    ];
    const result = evaluateLongitudinalProgressionReadiness({
      assessment_type: "donor_recovery_tracking",
      images,
    });
    assert.notStrictEqual(result.readiness_status, "ready");
    assert.ok(Object.keys(result.missing_categories_by_timepoint).length > 0);
    for (const timepoint of result.required_timepoints) {
      assert.deepStrictEqual(result.missing_categories_by_timepoint[timepoint], ["donor"]);
    }
  });

  it("returns invalid for unknown assessment type", () => {
    const result = evaluateLongitudinalProgressionReadiness({
      assessment_type: "unknown_assessment" as "hairaudit_outcome_12month",
      images: [],
    });
    assert.strictEqual(result.readiness_status, "invalid");
    assert.strictEqual(result.progression_direction, "not_evaluated");
    assert.strictEqual(result.completeness_score, 0);
  });
});

describe("ImagingOS IM-5 — recommendProgressionAssessmentForWorkflow", () => {
  it("maps HLI to hli_longitudinal_review", () => {
    assert.strictEqual(
      recommendProgressionAssessmentForWorkflow({ source_system: "hli", upload_surface: "hli_intake" }),
      "hli_longitudinal_review"
    );
  });

  it("maps HairAudit 12-month follow-up to hairaudit_outcome_12month", () => {
    assert.strictEqual(
      recommendProgressionAssessmentForWorkflow({
        source_system: "hairaudit",
        upload_surface: "audit_upload",
        protocol: "surgery_followup_12month",
      }),
      "hairaudit_outcome_12month"
    );
  });

  it("maps surgery_os to surgery_growth_tracking", () => {
    assert.strictEqual(
      recommendProgressionAssessmentForWorkflow({
        source_system: "surgery_os",
        upload_surface: "surgery_workflow",
      }),
      "surgery_growth_tracking"
    );
  });

  it("maps donor_analysis protocol to donor_recovery_tracking", () => {
    assert.strictEqual(
      recommendProgressionAssessmentForWorkflow({ protocol: "donor_analysis" }),
      "donor_recovery_tracking"
    );
  });

  it("maps consultation_os to hair_loss_monitoring", () => {
    assert.strictEqual(
      recommendProgressionAssessmentForWorkflow({
        source_system: "consultation_os",
        upload_surface: "consultation_form",
      }),
      "hair_loss_monitoring"
    );
  });

  it("returns undefined for unrecognized workflow", () => {
    assert.strictEqual(
      recommendProgressionAssessmentForWorkflow({ source_system: "manual_upload" }),
      undefined
    );
  });
});

describe("ImagingOS IM-5 — buildProgressionImageFromIntake", () => {
  it("maps metadata.timepoint to progression timepoint", () => {
    const intake = normalizeImageIngestionRequest({
      source_system: "fi_os",
      upload_surface: "clinic_console",
      storage_path: "uploads/front.jpg",
      external_category: "front",
      metadata: { timepoint: "m12" },
    });
    const image = buildProgressionImageFromIntake({ intake });
    assert.strictEqual(image.timepoint, "month_12");
    assert.strictEqual(image.canonical_category, "front");
  });

  it("maps followup_month metadata to timepoint", () => {
    const intake = normalizeImageIngestionRequest({
      source_system: "fi_os",
      upload_surface: "clinic_console",
      storage_path: "uploads/top.jpg",
      external_category: "top",
      metadata: { followup_month: 6 },
    });
    const image = buildProgressionImageFromIntake({ intake });
    assert.strictEqual(image.timepoint, "month_6");
  });

  it("carries metadata quality usability when provided", () => {
    const intake = normalizeImageIngestionRequest({
      source_system: "fi_os",
      upload_surface: "clinic_console",
      storage_path: "uploads/front.jpg",
      external_category: "front",
      content_type: "image/jpeg",
      width: 1600,
      height: 1200,
      size_bytes: 512 * 1024,
      metadata: { timepoint: "baseline" },
    });
    const quality = evaluateImageQualityFromMetadata({
      width: 1600,
      height: 1200,
      size_bytes: 512 * 1024,
      content_type: "image/jpeg",
      canonical_category: "front",
    });
    const image = buildProgressionImageFromIntake({ intake, quality });
    assert.strictEqual(image.is_clinically_usable, quality.is_clinically_usable);
    assert.strictEqual(image.quality_status, quality.quality_status);
  });

  it("marks stub quality as not usable", () => {
    const intake = normalizeImageIngestionRequest({
      source_system: "fi_os",
      upload_surface: "clinic_console",
      storage_path: "uploads/front.jpg",
      external_category: "front",
    });
    const stub = evaluateImageQualityStub();
    const image = buildProgressionImageFromIntake({ intake, quality: stub });
    assert.strictEqual(image.quality_status, "not_evaluated");
    assert.strictEqual(image.is_clinically_usable, false);
  });
});

describe("ImagingOS IM-5 — case evaluation helper", () => {
  it("runImagingOsCaseProgressionEvaluation delegates to readiness evaluator", () => {
    const images = fullHairAuditOutcome12MonthSet();
    const direct = evaluateLongitudinalProgressionReadiness({
      assessment_type: "hairaudit_outcome_12month",
      images,
    });
    const viaCase = runImagingOsCaseProgressionEvaluation({
      assessment_type: "hairaudit_outcome_12month",
      images,
    });
    assert.deepStrictEqual(viaCase, direct);
  });
});

describe("ImagingOS IM-5 — IM-1 to IM-4 compatibility", () => {
  it("single-image pipeline does not attach progression results", () => {
    const result = runImagingOsIngestionPipeline({
      source_system: "fi_os",
      upload_surface: "clinic_console",
      storage_path: "uploads/front.jpg",
      external_category: "front",
      content_type: "image/jpeg",
      width: 1600,
      height: 1200,
      size_bytes: 512 * 1024,
    });
    assert.strictEqual("progression" in result, false);
    assert.strictEqual(result.status, "dry_run");
  });

  it("preserves IM-3 protocol completeness when protocol context is provided", () => {
    const result = runImagingOsIngestionPipeline(
      {
        source_system: "hairaudit",
        upload_surface: "audit_upload",
        storage_path: "cases/front.jpg",
        external_category: "patient_current_front",
      },
      {
        protocol: "hairaudit_baseline",
        case_categories: ["front", "left", "right", "top", "crown", "donor"],
      }
    );
    assert.ok(result.protocol_completeness);
    assert.strictEqual(result.protocol_completeness!.status, "complete");
  });
});
