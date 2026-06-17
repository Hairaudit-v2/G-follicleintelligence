import { describe, it } from "node:test";
import assert from "node:assert";
import {
  IMAGING_MEASUREMENT_DOMAINS,
  IMAGING_MEASUREMENT_REQUIREMENTS,
  IMAGING_MEASUREMENT_EVALUATOR_VERSION,
  buildHairAuditMeasurementStubs,
  buildMeasurementStubsFromComparisonResult,
  createVisualMeasurementStub,
  evaluateHairAuditVisualComparison,
  evaluateLongitudinalProgressionReadiness,
  evaluateOutcomeMeasurementReadiness,
  evaluateSurgicalImageReadiness,
  evaluateVisualComparisonReadiness,
  isImagingOsMeasurementDomain,
  recommendMeasurementDomainsForComparisonDomain,
  runImagingOsStubPipeline,
  validateVisualMeasurementResult,
} from "../src/lib/imaging-os";
import type {
  CanonicalHairImageCategory,
  ImagingOsComparisonImage,
  ImagingOsComparisonReadinessResult,
  ImagingOsOutcomeEvidence,
  ImagingOsProgressionImage,
  ImagingOsSurgicalImage,
  ImagingOsSurgicalImageEventType,
  ImagingOsTimepoint,
  ImagingOsVisualMeasurementResult,
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

function readyGrowthComparisonResult(): ImagingOsComparisonReadinessResult {
  return evaluateVisualComparisonReadiness({
    domain: "growth_change",
    images: fullGrowthChangeComparisonSet("month_12"),
  });
}

describe("ImagingOS IM-9 — measurement registry", () => {
  it("contains all domains except unknown with requirements", () => {
    const measurementDomains = IMAGING_MEASUREMENT_DOMAINS.filter((d) => d !== "unknown");
    assert.strictEqual(measurementDomains.length, 13);
    for (const domain of measurementDomains) {
      assert.ok(isImagingOsMeasurementDomain(domain));
      const req = IMAGING_MEASUREMENT_REQUIREMENTS[domain];
      assert.ok(req.description.length > 0);
      assert.ok(req.allowed_units.length > 0);
      assert.ok(req.allowed_units.includes(req.preferred_unit));
      assert.ok(req.compatible_comparison_domains.length > 0);
      assert.ok(req.minimum_confidence >= 0 && req.minimum_confidence <= 1);
      assert.ok(
        req.requires_human_review_below_confidence >= 0 &&
          req.requires_human_review_below_confidence <= 1
      );
    }
  });

  it("density registry matches IM-9 spec", () => {
    const req = IMAGING_MEASUREMENT_REQUIREMENTS.density;
    assert.deepStrictEqual(req.allowed_units, [
      "hairs_per_cm2",
      "grafts_per_cm2",
      "score_0_100",
    ]);
    assert.strictEqual(req.preferred_unit, "hairs_per_cm2");
    assert.deepStrictEqual(req.compatible_comparison_domains, [
      "growth_change",
      "density_change",
    ]);
    assert.strictEqual(req.minimum_confidence, 0.75);
    assert.strictEqual(req.requires_comparison_pair, true);
    assert.strictEqual(req.requires_human_review_below_confidence, 0.85);
  });

  it("graft_count_validation does not require comparison pair", () => {
    const req = IMAGING_MEASUREMENT_REQUIREMENTS.graft_count_validation;
    assert.strictEqual(req.requires_comparison_pair, false);
    assert.strictEqual(req.preferred_unit, "grafts");
  });
});

describe("ImagingOS IM-9 — createVisualMeasurementStub", () => {
  it("applies contract_stub defaults", () => {
    const stub = createVisualMeasurementStub({ domain: "density" });

    assert.strictEqual(stub.method, "contract_stub");
    assert.strictEqual(stub.value, null);
    assert.strictEqual(stub.confidence, 0);
    assert.strictEqual(stub.domain, "density");
    assert.strictEqual(stub.evaluator_version, IMAGING_MEASUREMENT_EVALUATOR_VERSION);
    assert.ok(stub.measurement_id.startsWith("vm-density-contract-stub"));
    assert.strictEqual(stub.requires_human_review, true);
  });

  it("applies preferred unit when unit not supplied", () => {
    const density = createVisualMeasurementStub({ domain: "density" });
    assert.strictEqual(density.unit, "hairs_per_cm2");

    const coverage = createVisualMeasurementStub({ domain: "coverage" });
    assert.strictEqual(coverage.unit, "percent");

    const temporal = createVisualMeasurementStub({ domain: "temporal_angle" });
    assert.strictEqual(temporal.unit, "degrees");
  });

  it("includes evidence pair ids when comparison candidate supplied", () => {
    const comparison = readyGrowthComparisonResult();
    const candidate = comparison.valid_comparison_pairs[0];

    const stub = createVisualMeasurementStub({
      domain: "density",
      comparison_domain: "growth_change",
      comparison_candidate: candidate,
    });

    assert.strictEqual(stub.baseline_image_id, candidate.baseline_image.image_id);
    assert.strictEqual(stub.followup_image_id, candidate.followup_image.image_id);
    assert.ok(stub.evidence_pair_id);
    assert.ok(stub.measurement_id.includes("baseline-front"));
  });
});

describe("ImagingOS IM-9 — validateVisualMeasurementResult", () => {
  it("invalidates unknown domain", () => {
    const result: ImagingOsVisualMeasurementResult = {
      measurement_id: "vm-unknown",
      domain: "unknown",
      value: null,
      unit: "unknown",
      confidence: 0,
      method: "contract_stub",
      requires_human_review: false,
      validation_status: "valid",
      warnings: [],
      blockers: [],
      evaluator_version: IMAGING_MEASUREMENT_EVALUATOR_VERSION,
    };

    const validation = validateVisualMeasurementResult(result);
    assert.strictEqual(validation.validation_status, "invalid");
    assert.ok(validation.blockers.some((b) => b.includes("Unknown")));
  });

  it("invalidates disallowed unit for domain", () => {
    const stub = createVisualMeasurementStub({
      domain: "density",
      unit: "degrees",
      confidence: 0.9,
    });

    assert.strictEqual(stub.validation_status, "invalid");
    assert.ok(stub.blockers.some((b) => b.includes("not allowed")));
  });

  it("low confidence triggers warning and human review", () => {
    const stub = createVisualMeasurementStub({
      domain: "density",
      confidence: 0.5,
      comparison_domain: "growth_change",
    });

    assert.strictEqual(stub.validation_status, "warning");
    assert.strictEqual(stub.requires_human_review, true);
    assert.ok(stub.warnings.some((w) => w.includes("below minimum threshold")));
  });

  it("invalidates confidence outside 0–1", () => {
    const stub = createVisualMeasurementStub({
      domain: "coverage",
      confidence: 1.5,
    });

    assert.strictEqual(stub.validation_status, "invalid");
    assert.ok(stub.blockers.some((b) => b.includes("Confidence must be between 0 and 1")));
  });

  it("allows null value for contract_stub", () => {
    const stub = createVisualMeasurementStub({
      domain: "density",
      value: null,
      method: "contract_stub",
    });

    assert.strictEqual(stub.value, null);
    assert.notStrictEqual(stub.validation_status, "invalid");
    assert.ok(!stub.blockers.some((b) => b.includes("Null measurement value")));
  });

  it("invalidates null value for manual_clinician", () => {
    const stub = createVisualMeasurementStub({
      domain: "density",
      value: null,
      method: "manual_clinician",
      confidence: 0.9,
    });

    assert.strictEqual(stub.validation_status, "invalid");
    assert.ok(stub.blockers.some((b) => b.includes("Null measurement value")));
  });
});

describe("ImagingOS IM-9 — buildMeasurementStubsFromComparisonResult", () => {
  it("creates stubs for ready comparison result", () => {
    const comparison = readyGrowthComparisonResult();
    assert.strictEqual(comparison.comparison_status, "ready");

    const stubs = buildMeasurementStubsFromComparisonResult(comparison);

    assert.strictEqual(stubs.length, 3);
    assert.deepStrictEqual(
      stubs.map((stub) => stub.domain).sort(),
      ["caliber", "coverage", "density"]
    );
    for (const stub of stubs) {
      assert.strictEqual(stub.method, "contract_stub");
      assert.strictEqual(stub.comparison_domain, "growth_change");
      assert.ok(stub.baseline_image_id);
      assert.ok(stub.followup_image_id);
    }
  });

  it("creates stubs for partial comparison result", () => {
    const images = fullGrowthChangeComparisonSet("month_12").filter(
      (image) => !(image.timepoint === "month_12" && image.canonical_category === "crown")
    );
    const comparison = evaluateVisualComparisonReadiness({
      domain: "growth_change",
      images,
    });

    assert.strictEqual(comparison.comparison_status, "partial");
    const stubs = buildMeasurementStubsFromComparisonResult(comparison);
    assert.strictEqual(stubs.length, 3);
  });

  it("returns no stubs for insufficient comparison result", () => {
    const images = fullGrowthChangeComparisonSet("month_12").filter(
      (image) => image.timepoint !== "baseline"
    );
    const comparison = evaluateVisualComparisonReadiness({
      domain: "growth_change",
      images,
    });

    assert.strictEqual(comparison.comparison_status, "insufficient_data");
    const stubs = buildMeasurementStubsFromComparisonResult(comparison);
    assert.strictEqual(stubs.length, 0);
  });
});

describe("ImagingOS IM-9 — recommendMeasurementDomainsForComparisonDomain", () => {
  it("maps growth_change to density, coverage, caliber, frontal_density", () => {
    assert.deepStrictEqual(recommendMeasurementDomainsForComparisonDomain("growth_change"), [
      "density",
      "coverage",
      "caliber",
      "frontal_density",
    ]);
  });

  it("maps density_change to density, caliber, miniaturization", () => {
    assert.deepStrictEqual(recommendMeasurementDomainsForComparisonDomain("density_change"), [
      "density",
      "caliber",
      "miniaturization",
    ]);
  });

  it("maps donor_recovery_change", () => {
    assert.deepStrictEqual(
      recommendMeasurementDomainsForComparisonDomain("donor_recovery_change"),
      ["donor_density", "scar_visibility", "scalp_visibility"]
    );
  });

  it("maps recipient_growth_change", () => {
    assert.deepStrictEqual(
      recommendMeasurementDomainsForComparisonDomain("recipient_growth_change"),
      ["recipient_survival", "density", "coverage"]
    );
  });

  it("maps hairline_design_change", () => {
    assert.deepStrictEqual(
      recommendMeasurementDomainsForComparisonDomain("hairline_design_change"),
      ["hairline_position", "temporal_angle", "frontal_density"]
    );
  });

  it("maps graft_survival_change", () => {
    assert.deepStrictEqual(
      recommendMeasurementDomainsForComparisonDomain("graft_survival_change"),
      ["graft_survival", "recipient_survival", "graft_count_validation"]
    );
  });

  it("maps longitudinal_medical_response", () => {
    assert.deepStrictEqual(
      recommendMeasurementDomainsForComparisonDomain("longitudinal_medical_response"),
      ["density", "caliber", "miniaturization", "coverage"]
    );
  });

  it("maps revision_comparison", () => {
    assert.deepStrictEqual(recommendMeasurementDomainsForComparisonDomain("revision_comparison"), [
      "density",
      "coverage",
      "scar_visibility",
      "hairline_position",
    ]);
  });

  it("returns empty array for unknown comparison domain", () => {
    assert.deepStrictEqual(recommendMeasurementDomainsForComparisonDomain("unknown"), []);
  });
});

describe("ImagingOS IM-9 — HairAudit measurement adapter", () => {
  it("builds measurement stubs from HairAudit records", () => {
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

    const stubs = buildHairAuditMeasurementStubs(input);
    assert.strictEqual(stubs.length, 3);
    assert.ok(stubs.every((stub) => stub.comparison_domain === "growth_change"));
  });

  it("builds measurement stubs from existing comparison result", () => {
    const comparison = readyGrowthComparisonResult();
    const stubs = buildHairAuditMeasurementStubs(comparison);

    assert.strictEqual(stubs.length, 3);
    assert.ok(stubs.every((stub) => stub.method === "contract_stub"));
  });

  it("uses evaluateHairAuditVisualComparison internally for records", () => {
    const comparison = evaluateHairAuditVisualComparison([
      {
        category: "front",
        timepoint: "baseline",
        quality_status: "excellent",
        is_clinically_usable: true,
      },
      {
        category: "front",
        timepoint: "month_12",
        quality_status: "excellent",
        is_clinically_usable: true,
      },
    ]);

    const fromRecords = buildHairAuditMeasurementStubs([
      {
        category: "front",
        timepoint: "baseline",
        quality_status: "excellent",
        is_clinically_usable: true,
      },
      {
        category: "front",
        timepoint: "month_12",
        quality_status: "excellent",
        is_clinically_usable: true,
      },
    ]);
    const fromComparison = buildHairAuditMeasurementStubs(comparison);

    assert.strictEqual(fromRecords.length, fromComparison.length);
    assert.deepStrictEqual(
      fromRecords.map((stub) => stub.domain),
      fromComparison.map((stub) => stub.domain)
    );
  });
});

describe("ImagingOS IM-9 — IM-1 through IM-8 compatibility", () => {
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

  it("IM-8 comparison evaluation still works", () => {
    const result = evaluateVisualComparisonReadiness({
      domain: "growth_change",
      images: fullGrowthChangeComparisonSet("month_12"),
    });
    assert.strictEqual(result.comparison_status, "ready");
  });
});
