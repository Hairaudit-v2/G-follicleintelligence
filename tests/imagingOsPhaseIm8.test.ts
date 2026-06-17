import { describe, it } from "node:test";
import assert from "node:assert";
import {
  IMAGING_COMPARISON_DOMAINS,
  IMAGING_COMPARISON_REQUIREMENTS,
  IMAGING_COMPARISON_EVALUATOR_VERSION,
  buildComparisonImageFromOutcomeEvidence,
  buildComparisonImageFromProgressionImage,
  determineMeasurementTargets,
  evaluateHairAuditVisualComparison,
  evaluateLongitudinalProgressionReadiness,
  evaluateOutcomeMeasurementReadiness,
  evaluateSurgicalImageReadiness,
  evaluateVisualComparisonReadiness,
  isImagingOsComparisonDomain,
  recommendComparisonDomain,
  runImagingOsStubPipeline,
} from "../src/lib/imaging-os";
import type {
  CanonicalHairImageCategory,
  ImagingOsComparisonImage,
  ImagingOsOutcomeEvidence,
  ImagingOsProgressionImage,
  ImagingOsSurgicalImage,
  ImagingOsSurgicalImageEventType,
  ImagingOsTimepoint,
} from "../src/lib/imaging-os";

const GROWTH_CATEGORIES: CanonicalHairImageCategory[] = ["front", "top", "crown"];

function usableComparisonImage(
  timepoint: ImagingOsTimepoint,
  category: CanonicalHairImageCategory,
  extras: Partial<ImagingOsComparisonImage> = {}
): ImagingOsComparisonImage {
  return {
    image_id: `${timepoint}-${category}`,
    canonical_category: category,
    timepoint,
    quality_status: "excellent",
    is_clinically_usable: true,
    ...extras,
  };
}

function unusableComparisonImage(
  timepoint: ImagingOsTimepoint,
  category: CanonicalHairImageCategory
): ImagingOsComparisonImage {
  return {
    image_id: `${timepoint}-${category}-bad`,
    canonical_category: category,
    timepoint,
    quality_status: "poor",
    is_clinically_usable: false,
  };
}

function fullGrowthChangeComparisonSet(
  followupTimepoint: ImagingOsTimepoint = "month_12"
): ImagingOsComparisonImage[] {
  const images: ImagingOsComparisonImage[] = [];
  for (const category of GROWTH_CATEGORIES) {
    images.push(usableComparisonImage("baseline", category));
    images.push(usableComparisonImage(followupTimepoint, category));
  }
  return images;
}

describe("ImagingOS IM-8 — comparison registry", () => {
  it("contains all domains except unknown with requirements", () => {
    const comparisonDomains = IMAGING_COMPARISON_DOMAINS.filter((d) => d !== "unknown");
    assert.strictEqual(comparisonDomains.length, 9);
    for (const domain of comparisonDomains) {
      assert.ok(isImagingOsComparisonDomain(domain));
      const req = IMAGING_COMPARISON_REQUIREMENTS[domain];
      assert.ok(req.description.length > 0);
      assert.ok(req.required_categories.length > 0);
      assert.ok(req.allowed_followup_timepoints.length > 0);
      assert.strictEqual(req.minimum_images_per_comparison, 2);
    }
  });

  it("growth_change registry matches IM-8 spec", () => {
    const req = IMAGING_COMPARISON_REQUIREMENTS.growth_change;
    assert.strictEqual(req.required_baseline_timepoint, "baseline");
    assert.deepStrictEqual(req.allowed_followup_timepoints, ["month_3", "month_6", "month_12"]);
    assert.deepStrictEqual(req.required_categories, ["front", "top", "crown"]);
    assert.strictEqual(req.requires_same_category_match, true);
    assert.strictEqual(req.requires_quality_threshold, true);
  });

  it("donor_recovery_change requires donor images from pre_op baseline", () => {
    const req = IMAGING_COMPARISON_REQUIREMENTS.donor_recovery_change;
    assert.strictEqual(req.required_baseline_timepoint, "pre_op");
    assert.deepStrictEqual(req.required_categories, ["donor"]);
    assert.ok(req.allowed_followup_timepoints.includes("month_12"));
  });
});

describe("ImagingOS IM-8 — evaluateVisualComparisonReadiness", () => {
  it("returns ready for growth_change with baseline + month_12 images", () => {
    const result = evaluateVisualComparisonReadiness({
      domain: "growth_change",
      images: fullGrowthChangeComparisonSet("month_12"),
    });

    assert.strictEqual(result.comparison_status, "ready");
    assert.strictEqual(result.readiness_score, 100);
    assert.strictEqual(result.valid_comparison_pairs.length, 3);
    assert.strictEqual(result.invalid_comparison_pairs.length, 0);
    assert.strictEqual(result.evaluator_version, IMAGING_COMPARISON_EVALUATOR_VERSION);
    assert.ok(result.detected_followup_timepoints.includes("month_12"));
  });

  it("returns insufficient_data when baseline is missing", () => {
    const images = fullGrowthChangeComparisonSet("month_12").filter(
      (image) => image.timepoint !== "baseline"
    );
    const result = evaluateVisualComparisonReadiness({
      domain: "growth_change",
      images,
    });

    assert.strictEqual(result.comparison_status, "insufficient_data");
    assert.strictEqual(result.readiness_score, 0);
    assert.strictEqual(result.valid_comparison_pairs.length, 0);
    assert.deepStrictEqual(result.missing_required_categories, GROWTH_CATEGORIES);
  });

  it("returns partial when follow-up is missing for some categories", () => {
    const images = fullGrowthChangeComparisonSet("month_12").filter(
      (image) => !(image.timepoint === "month_12" && image.canonical_category === "crown")
    );
    const result = evaluateVisualComparisonReadiness({
      domain: "growth_change",
      images,
    });

    assert.strictEqual(result.comparison_status, "partial");
    assert.strictEqual(result.valid_comparison_pairs.length, 2);
    assert.ok(result.readiness_score >= 50);
    assert.ok(result.readiness_score < 100);
    assert.ok(result.missing_required_categories.includes("crown"));
  });

  it("excludes unusable images from comparison pairs", () => {
    const images = [
      ...fullGrowthChangeComparisonSet("month_12"),
      unusableComparisonImage("month_12", "front"),
    ];
    const result = evaluateVisualComparisonReadiness({
      domain: "growth_change",
      images,
    });

    assert.strictEqual(result.comparison_status, "ready");
    assert.ok(result.quality_blockers.length >= 1);
  });

  it("invalidates pair on category mismatch", () => {
    const images: ImagingOsComparisonImage[] = [
      usableComparisonImage("baseline", "front"),
      usableComparisonImage("month_12", "top"),
      usableComparisonImage("baseline", "top"),
      usableComparisonImage("month_12", "top"),
      usableComparisonImage("baseline", "crown"),
      usableComparisonImage("month_12", "crown"),
    ];

    const result = evaluateVisualComparisonReadiness({
      domain: "growth_change",
      images,
    });

    assert.notStrictEqual(result.comparison_status, "ready");
    assert.ok(result.invalid_comparison_pairs.length >= 1 || result.valid_comparison_pairs.length < 3);
    const frontPair = [...result.valid_comparison_pairs, ...result.invalid_comparison_pairs].find(
      (pair) => pair.baseline_image.canonical_category === "front"
    );
    assert.ok(frontPair);
    assert.strictEqual(frontPair.category_match, false);
    assert.strictEqual(frontPair.comparison_ready, false);
  });

  it("donor_recovery_change requires donor images", () => {
    const complete = [
      usableComparisonImage("pre_op", "donor"),
      usableComparisonImage("month_12", "donor"),
    ];
    const completeResult = evaluateVisualComparisonReadiness({
      domain: "donor_recovery_change",
      images: complete,
    });
    assert.strictEqual(completeResult.comparison_status, "ready");

    const missingDonor = [
      usableComparisonImage("pre_op", "front"),
      usableComparisonImage("month_12", "front"),
    ];
    const missingResult = evaluateVisualComparisonReadiness({
      domain: "donor_recovery_change",
      images: missingDonor,
    });
    assert.notStrictEqual(missingResult.comparison_status, "ready");
    assert.ok(missingResult.missing_required_categories.includes("donor"));
  });

  it("returns invalid for unknown domain", () => {
    const result = evaluateVisualComparisonReadiness({
      domain: "unknown",
      images: fullGrowthChangeComparisonSet("month_12"),
    });

    assert.strictEqual(result.comparison_status, "invalid");
    assert.strictEqual(result.readiness_score, 0);
  });
});

describe("ImagingOS IM-8 — determineMeasurementTargets", () => {
  it("returns correct targets for growth_change", () => {
    assert.deepStrictEqual(determineMeasurementTargets("growth_change"), [
      "density",
      "coverage",
      "caliber",
    ]);
  });

  it("returns correct targets for donor_recovery_change", () => {
    assert.deepStrictEqual(determineMeasurementTargets("donor_recovery_change"), [
      "donor_density",
      "extraction_healing",
      "scar_visibility",
    ]);
  });

  it("returns correct targets for hairline_design_change", () => {
    assert.deepStrictEqual(determineMeasurementTargets("hairline_design_change"), [
      "hairline_position",
      "temporal_angle",
      "frontal_density",
    ]);
  });

  it("returns correct targets for recipient_growth_change", () => {
    assert.deepStrictEqual(determineMeasurementTargets("recipient_growth_change"), [
      "recipient_survival",
      "density",
      "coverage",
    ]);
  });
});

describe("ImagingOS IM-8 — recommendComparisonDomain", () => {
  it("maps outcome measurement domains to comparison domains", () => {
    assert.strictEqual(
      recommendComparisonDomain({ outcome_domain: "growth_assessment" }),
      "growth_change"
    );
    assert.strictEqual(
      recommendComparisonDomain({ outcome_domain: "density_change" }),
      "density_change"
    );
    assert.strictEqual(
      recommendComparisonDomain({ outcome_domain: "donor_recovery" }),
      "donor_recovery_change"
    );
    assert.strictEqual(
      recommendComparisonDomain({ outcome_domain: "recipient_survival" }),
      "recipient_growth_change"
    );
    assert.strictEqual(
      recommendComparisonDomain({ outcome_domain: "hairline_design_review" }),
      "hairline_design_change"
    );
    assert.strictEqual(
      recommendComparisonDomain({ outcome_domain: "surgical_outcome_audit" }),
      "graft_survival_change"
    );
    assert.strictEqual(
      recommendComparisonDomain({ outcome_domain: "longitudinal_medical_response" }),
      "longitudinal_medical_response"
    );
    assert.strictEqual(
      recommendComparisonDomain({ outcome_domain: "revision_outcome_review" }),
      "revision_comparison"
    );
  });

  it("maps progression and surgical workflow inputs", () => {
    assert.strictEqual(
      recommendComparisonDomain({ progression_assessment: "hairaudit_outcome_12month" }),
      "growth_change"
    );
    assert.strictEqual(
      recommendComparisonDomain({ surgical_domain: "recipient_growth" }),
      "recipient_growth_change"
    );
    assert.strictEqual(
      recommendComparisonDomain({ surgical_domain: "revision_review" }),
      "revision_comparison"
    );
  });
});

describe("ImagingOS IM-8 — bridge helpers", () => {
  it("buildComparisonImageFromOutcomeEvidence maps outcome fields", () => {
    const evidence: ImagingOsOutcomeEvidence = {
      image_id: "outcome-1",
      patient_id: "patient-1",
      canonical_category: "front",
      timepoint: "baseline",
      quality_status: "acceptable",
      is_clinically_usable: true,
    };
    const image = buildComparisonImageFromOutcomeEvidence(evidence);

    assert.strictEqual(image.image_id, "outcome-1");
    assert.strictEqual(image.patient_id, "patient-1");
    assert.strictEqual(image.canonical_category, "front");
    assert.strictEqual(image.timepoint, "baseline");
    assert.strictEqual(image.quality_status, "acceptable");
  });

  it("buildComparisonImageFromProgressionImage maps progression fields", () => {
    const progressionImage: ImagingOsProgressionImage = {
      image_id: "prog-1",
      canonical_category: "crown",
      timepoint: "month_12",
      captured_at: "2025-06-01T00:00:00.000Z",
      quality_status: "excellent",
      is_clinically_usable: true,
    };
    const image = buildComparisonImageFromProgressionImage(progressionImage);

    assert.strictEqual(image.image_id, "prog-1");
    assert.strictEqual(image.canonical_category, "crown");
    assert.strictEqual(image.timepoint, "month_12");
    assert.strictEqual(image.captured_at, "2025-06-01T00:00:00.000Z");
  });
});

describe("ImagingOS IM-8 — HairAudit comparison adapter", () => {
  it("evaluates HairAudit records against growth_change", () => {
    const input = GROWTH_CATEGORIES.flatMap((category) => [
      {
        category,
        timepoint: "baseline",
        quality_status: "excellent",
        is_clinically_usable: true,
      },
      {
        category,
        timepoint: "month_12",
        quality_status: "excellent",
        is_clinically_usable: true,
      },
    ]);

    const result = evaluateHairAuditVisualComparison(input);
    assert.strictEqual(result.domain, "growth_change");
    assert.strictEqual(result.comparison_status, "ready");
    assert.strictEqual(result.readiness_score, 100);
  });

  it("maps HairAudit category and timepoint labels", () => {
    const result = evaluateHairAuditVisualComparison([
      {
        category: "patient_current_front",
        timepoint: "baseline",
        quality_status: "acceptable",
        is_clinically_usable: true,
      },
      {
        category: "patient_current_front",
        timepoint: "12_month",
        quality_status: "acceptable",
        is_clinically_usable: true,
      },
    ]);

    assert.strictEqual(result.domain, "growth_change");
    assert.strictEqual(result.comparison_status, "partial");
    assert.strictEqual(result.valid_comparison_pairs.length, 1);
    assert.strictEqual(result.valid_comparison_pairs[0].baseline_image.canonical_category, "front");
  });
});

describe("ImagingOS IM-8 — IM-1 through IM-7 compatibility", () => {
  it("IM-1 stub pipeline still runs", () => {
    const result = runImagingOsStubPipeline({
      source_system: "hairaudit",
      source_case_id: "11111111-1111-4111-8111-111111111111",
      source_upload_id: "22222222-2222-4222-8222-222222222222",
      external_category: "front",
    });
    assert.strictEqual(result.ok, true);
  });

  it("IM-5 progression evaluation still works", () => {
    const timepoints: ImagingOsTimepoint[] = ["baseline", "month_6", "month_12"];
    const images: ImagingOsProgressionImage[] = timepoints.flatMap((timepoint) =>
      GROWTH_CATEGORIES.flatMap((category) => [
        {
          image_id: `${timepoint}-${category}-1`,
          canonical_category: category,
          timepoint,
          quality_status: "excellent" as const,
          is_clinically_usable: true,
        },
        {
          image_id: `${timepoint}-${category}-2`,
          canonical_category: category,
          timepoint,
          quality_status: "excellent" as const,
          is_clinically_usable: true,
        },
      ])
    );
    const result = evaluateLongitudinalProgressionReadiness({
      assessment_type: "hair_loss_monitoring",
      images,
    });
    assert.strictEqual(result.readiness_status, "ready");
  });

  it("IM-6 surgical evaluation still works", () => {
    const events: ImagingOsSurgicalImageEventType[] = [
      "pre_op",
      "immediate_post_op",
      "month_12_outcome",
    ];
    const categories: CanonicalHairImageCategory[] = [
      "front",
      "top",
      "crown",
      "donor",
      "recipient",
    ];
    const images: ImagingOsSurgicalImage[] = events.flatMap((event) =>
      categories.map((category) => ({
        image_id: `${event}-${category}`,
        canonical_category: category,
        surgical_event: event,
        quality_status: "excellent" as const,
        is_clinically_usable: true,
      }))
    );
    const result = evaluateSurgicalImageReadiness({
      domain: "outcome_audit",
      images,
    });
    assert.ok(["ready", "partial"].includes(result.readiness_status));
  });

  it("IM-7 outcome measurement still works", () => {
    const evidence: ImagingOsOutcomeEvidence[] = ["baseline", "month_6", "month_12"].flatMap(
      (timepoint) =>
        GROWTH_CATEGORIES.flatMap((category) => [
          {
            image_id: `${timepoint}-${category}-1`,
            canonical_category: category,
            timepoint,
            quality_status: "excellent" as const,
            is_clinically_usable: true,
          },
          {
            image_id: `${timepoint}-${category}-2`,
            canonical_category: category,
            timepoint,
            quality_status: "excellent" as const,
            is_clinically_usable: true,
          },
        ])
    );
    const result = evaluateOutcomeMeasurementReadiness({
      domain: "growth_assessment",
      evidence,
    });
    assert.strictEqual(result.measurement_status, "measurable");
  });
});
