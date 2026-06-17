import { describe, it } from "node:test";
import assert from "node:assert";
import {
  IMAGING_OUTCOME_MEASUREMENT_DOMAINS,
  IMAGING_OUTCOME_MEASUREMENT_REQUIREMENTS,
  IMAGING_OUTCOME_MEASUREMENT_EVALUATOR_VERSION,
  buildOutcomeEvidenceFromProgressionImage,
  buildOutcomeEvidenceFromSurgicalImage,
  evaluateHairAuditOutcomeMeasurement,
  evaluateLongitudinalProgressionReadiness,
  evaluateOutcomeMeasurementReadiness,
  evaluateSurgicalImageReadiness,
  isImagingOsOutcomeMeasurementDomain,
  recommendNextCaptureRequirements,
  recommendOutcomeMeasurementDomain,
  runImagingOsStubPipeline,
} from "../src/lib/imaging-os";
import type {
  CanonicalHairImageCategory,
  ImagingOsOutcomeEvidence,
  ImagingOsProgressionImage,
  ImagingOsSurgicalImage,
  ImagingOsSurgicalImageEventType,
  ImagingOsTimepoint,
} from "../src/lib/imaging-os";

const GROWTH_CATEGORIES: CanonicalHairImageCategory[] = ["front", "top", "crown"];
const GROWTH_TIMEPOINTS: ImagingOsTimepoint[] = ["baseline", "month_6", "month_12"];

const SURGICAL_OUTCOME_CATEGORIES: CanonicalHairImageCategory[] = [
  "front",
  "top",
  "crown",
  "donor",
  "recipient",
];

const SURGICAL_OUTCOME_TIMEPOINTS: ImagingOsTimepoint[] = [
  "pre_op",
  "immediate_post_op",
  "month_12",
];

function usableEvidence(
  timepoint: ImagingOsTimepoint,
  category: CanonicalHairImageCategory,
  extras: Partial<ImagingOsOutcomeEvidence> = {}
): ImagingOsOutcomeEvidence {
  return {
    image_id: `${timepoint}-${category}`,
    canonical_category: category,
    timepoint,
    quality_status: "excellent",
    is_clinically_usable: true,
    ...extras,
  };
}

function unusableEvidence(
  timepoint: ImagingOsTimepoint,
  category: CanonicalHairImageCategory
): ImagingOsOutcomeEvidence {
  return {
    image_id: `${timepoint}-${category}-bad`,
    canonical_category: category,
    timepoint,
    quality_status: "poor",
    is_clinically_usable: false,
  };
}

function notEvaluatedEvidence(
  timepoint: ImagingOsTimepoint,
  category: CanonicalHairImageCategory
): ImagingOsOutcomeEvidence {
  return {
    canonical_category: category,
    timepoint,
    quality_status: undefined,
  };
}

function fullGrowthAssessmentSet(): ImagingOsOutcomeEvidence[] {
  const images: ImagingOsOutcomeEvidence[] = [];
  for (const timepoint of GROWTH_TIMEPOINTS) {
    for (const category of GROWTH_CATEGORIES) {
      images.push(usableEvidence(timepoint, category));
      images.push(usableEvidence(timepoint, category, { image_id: `${timepoint}-${category}-2` }));
    }
  }
  return images;
}

function fullSurgicalOutcomeAuditSet(): ImagingOsOutcomeEvidence[] {
  const images: ImagingOsOutcomeEvidence[] = [];
  for (const timepoint of SURGICAL_OUTCOME_TIMEPOINTS) {
    for (const category of SURGICAL_OUTCOME_CATEGORIES) {
      for (let i = 0; i < 3; i += 1) {
        images.push(
          usableEvidence(timepoint, category, {
            image_id: `${timepoint}-${category}-${i}`,
          })
        );
      }
    }
  }
  images.push(
    usableEvidence("pre_op", "graft_tray", {
      image_id: "graft-tray",
      surgical_event: "graft_tray",
    })
  );
  images.push(
    usableEvidence("immediate_post_op", "recipient", {
      image_id: "implantation-complete",
      surgical_event: "implantation_complete",
    })
  );
  return images;
}

describe("ImagingOS IM-7 — outcome measurement registry", () => {
  it("contains all domains except unknown with requirements", () => {
    const measurableDomains = IMAGING_OUTCOME_MEASUREMENT_DOMAINS.filter((d) => d !== "unknown");
    assert.strictEqual(measurableDomains.length, 9);
    for (const domain of measurableDomains) {
      assert.ok(isImagingOsOutcomeMeasurementDomain(domain));
      const req = IMAGING_OUTCOME_MEASUREMENT_REQUIREMENTS[domain];
      assert.ok(req.description.length > 0);
      assert.ok(req.required_timepoints.length > 0);
      assert.ok(req.required_categories.length > 0);
      assert.ok(req.minimum_usable_images_per_timepoint > 0);
    }
  });

  it("growth_assessment registry matches IM-7 spec", () => {
    const req = IMAGING_OUTCOME_MEASUREMENT_REQUIREMENTS.growth_assessment;
    assert.deepStrictEqual(req.required_timepoints, ["baseline", "month_6", "month_12"]);
    assert.deepStrictEqual(req.required_categories, ["front", "top", "crown"]);
    assert.strictEqual(req.minimum_usable_images_per_timepoint, 2);
    assert.strictEqual(req.requires_baseline, true);
    assert.strictEqual(req.requires_quality_threshold, true);
  });

  it("surgical_outcome_audit requires graft_tray and implantation_complete events", () => {
    const req = IMAGING_OUTCOME_MEASUREMENT_REQUIREMENTS.surgical_outcome_audit;
    assert.deepStrictEqual(req.required_surgical_events, ["graft_tray", "implantation_complete"]);
    assert.strictEqual(req.minimum_usable_images_per_timepoint, 3);
  });
});

describe("ImagingOS IM-7 — evaluateOutcomeMeasurementReadiness", () => {
  it("returns measurable for complete growth assessment dataset", () => {
    const result = evaluateOutcomeMeasurementReadiness({
      domain: "growth_assessment",
      evidence: fullGrowthAssessmentSet(),
    });

    assert.strictEqual(result.measurement_status, "measurable");
    assert.strictEqual(result.readiness_score, 100);
    assert.strictEqual(result.missing_timepoints.length, 0);
    assert.strictEqual(result.evaluator_version, IMAGING_OUTCOME_MEASUREMENT_EVALUATOR_VERSION);
    assert.strictEqual(result.recommended_next_capture, "Outcome dataset complete.");
  });

  it("returns partially_measurable when month_12 is missing", () => {
    const evidence = fullGrowthAssessmentSet().filter((item) => item.timepoint !== "month_12");
    const result = evaluateOutcomeMeasurementReadiness({
      domain: "growth_assessment",
      evidence,
    });

    assert.strictEqual(result.measurement_status, "partially_measurable");
    assert.ok(result.missing_timepoints.includes("month_12"));
    assert.ok(result.readiness_score >= 50);
    assert.ok(result.readiness_score < 100);
  });

  it("fails requires_baseline when baseline is missing", () => {
    const evidence = fullGrowthAssessmentSet().filter((item) => item.timepoint !== "baseline");
    const result = evaluateOutcomeMeasurementReadiness({
      domain: "growth_assessment",
      evidence,
    });

    assert.notStrictEqual(result.measurement_status, "measurable");
    assert.ok(result.missing_timepoints.includes("baseline"));
    assert.ok(result.readiness_score < 90);
  });

  it("donor_recovery requires donor images at each timepoint", () => {
    const timepoints: ImagingOsTimepoint[] = [
      "pre_op",
      "immediate_post_op",
      "day_14",
      "month_6",
    ];
    const complete = timepoints.map((timepoint) => usableEvidence(timepoint, "donor"));
    const completeResult = evaluateOutcomeMeasurementReadiness({
      domain: "donor_recovery",
      evidence: complete,
    });
    assert.strictEqual(completeResult.measurement_status, "measurable");

    const missingDonor = complete.filter((item) => item.timepoint !== "month_6");
    const missingResult = evaluateOutcomeMeasurementReadiness({
      domain: "donor_recovery",
      evidence: missingDonor,
    });
    assert.ok(missingResult.missing_timepoints.includes("month_6"));
    assert.notStrictEqual(missingResult.measurement_status, "measurable");
  });

  it("surgical_outcome_audit requires graft_tray and implantation_complete events", () => {
    const withoutEvents = fullSurgicalOutcomeAuditSet().filter(
      (item) =>
        item.surgical_event !== "graft_tray" && item.surgical_event !== "implantation_complete"
    );
    const result = evaluateOutcomeMeasurementReadiness({
      domain: "surgical_outcome_audit",
      evidence: withoutEvents,
    });

    assert.ok(result.missing_surgical_events.includes("graft_tray"));
    assert.ok(result.missing_surgical_events.includes("implantation_complete"));
    assert.notStrictEqual(result.measurement_status, "measurable");
  });

  it("excludes unusable and not_evaluated evidence from scoring", () => {
    const usable = fullGrowthAssessmentSet();
    const withUnusable = [
      ...usable,
      unusableEvidence("month_12", "crown"),
      notEvaluatedEvidence("month_12", "front"),
    ];
    const result = evaluateOutcomeMeasurementReadiness({
      domain: "growth_assessment",
      evidence: withUnusable,
    });

    assert.ok(result.unusable_evidence_count >= 1);
    assert.strictEqual(result.measurement_status, "measurable");
  });

  it("returns invalid for unknown domain", () => {
    const result = evaluateOutcomeMeasurementReadiness({
      domain: "unknown",
      evidence: fullGrowthAssessmentSet(),
    });

    assert.strictEqual(result.measurement_status, "invalid");
    assert.strictEqual(result.readiness_score, 0);
  });
});

describe("ImagingOS IM-7 — recommendNextCaptureRequirements", () => {
  it("recommends month_12 crown capture when missing", () => {
    const evidence = fullGrowthAssessmentSet().filter(
      (item) => !(item.timepoint === "month_12" && item.canonical_category === "crown")
    );
    const result = evaluateOutcomeMeasurementReadiness({
      domain: "growth_assessment",
      evidence,
    });
    const recommendation = recommendNextCaptureRequirements(result);

    assert.strictEqual(recommendation.priority_level, "high");
    assert.match(recommendation.next_recommended_capture, /month_12 crown/i);
  });

  it("returns complete message when measurable", () => {
    const result = evaluateOutcomeMeasurementReadiness({
      domain: "growth_assessment",
      evidence: fullGrowthAssessmentSet(),
    });
    const recommendation = recommendNextCaptureRequirements(result);

    assert.strictEqual(recommendation.next_recommended_capture, "Outcome dataset complete.");
    assert.strictEqual(recommendation.priority_level, undefined);
  });
});

describe("ImagingOS IM-7 — recommendOutcomeMeasurementDomain", () => {
  it("maps progression and surgical workflow inputs to outcome domains", () => {
    assert.strictEqual(
      recommendOutcomeMeasurementDomain({ progression_assessment: "surgery_growth_tracking" }),
      "growth_assessment"
    );
    assert.strictEqual(
      recommendOutcomeMeasurementDomain({ progression_assessment: "donor_recovery_tracking" }),
      "donor_recovery"
    );
    assert.strictEqual(
      recommendOutcomeMeasurementDomain({ surgical_domain: "recipient_growth" }),
      "recipient_survival"
    );
    assert.strictEqual(
      recommendOutcomeMeasurementDomain({ surgical_domain: "outcome_audit" }),
      "surgical_outcome_audit"
    );
    assert.strictEqual(
      recommendOutcomeMeasurementDomain({ progression_assessment: "hairaudit_outcome_12month" }),
      "growth_assessment"
    );
    assert.strictEqual(
      recommendOutcomeMeasurementDomain({ progression_assessment: "hli_longitudinal_review" }),
      "longitudinal_medical_response"
    );
    assert.strictEqual(
      recommendOutcomeMeasurementDomain({ surgical_domain: "revision_review" }),
      "revision_outcome_review"
    );
  });
});

describe("ImagingOS IM-7 — evidence bridge helpers", () => {
  it("buildOutcomeEvidenceFromProgressionImage maps progression fields", () => {
    const progressionImage: ImagingOsProgressionImage = {
      image_id: "prog-1",
      canonical_category: "front",
      timepoint: "baseline",
      quality_status: "acceptable",
      is_clinically_usable: true,
    };
    const evidence = buildOutcomeEvidenceFromProgressionImage(progressionImage);

    assert.strictEqual(evidence.image_id, "prog-1");
    assert.strictEqual(evidence.canonical_category, "front");
    assert.strictEqual(evidence.timepoint, "baseline");
    assert.strictEqual(evidence.quality_status, "acceptable");
    assert.strictEqual(evidence.is_clinically_usable, true);
  });

  it("buildOutcomeEvidenceFromSurgicalImage maps surgical fields and timepoint", () => {
    const surgicalImage: ImagingOsSurgicalImage = {
      image_id: "surg-1",
      patient_id: "patient-1",
      surgical_case_id: "case-1",
      canonical_category: "donor",
      surgical_event: "month_6_review",
      quality_status: "excellent",
      is_clinically_usable: true,
    };
    const evidence = buildOutcomeEvidenceFromSurgicalImage(surgicalImage);

    assert.strictEqual(evidence.image_id, "surg-1");
    assert.strictEqual(evidence.patient_id, "patient-1");
    assert.strictEqual(evidence.surgical_case_id, "case-1");
    assert.strictEqual(evidence.surgical_event, "month_6_review");
    assert.strictEqual(evidence.timepoint, "month_6");
  });
});

describe("ImagingOS IM-7 — HairAudit outcome measurement adapter", () => {
  it("evaluates HairAudit records against surgical_outcome_audit", () => {
    const input = [
      ...SURGICAL_OUTCOME_CATEGORIES.flatMap((category) =>
        Array.from({ length: 3 }, () => ({
          category,
          timepoint: "pre_op",
          quality_status: "excellent",
          is_clinically_usable: true,
        }))
      ),
      ...SURGICAL_OUTCOME_CATEGORIES.flatMap((category) =>
        Array.from({ length: 3 }, () => ({
          category,
          timepoint: "immediate_post_op",
          quality_status: "excellent",
          is_clinically_usable: true,
        }))
      ),
      ...SURGICAL_OUTCOME_CATEGORIES.flatMap((category) =>
        Array.from({ length: 3 }, () => ({
          category,
          timepoint: "month_12",
          quality_status: "excellent",
          is_clinically_usable: true,
        }))
      ),
      {
        category: "graft_tray",
        timepoint: "pre_op",
        surgical_event: "graft_tray",
        quality_status: "excellent",
        is_clinically_usable: true,
      },
      {
        category: "recipient",
        timepoint: "immediate_post_op",
        surgical_event: "implantation_complete",
        quality_status: "excellent",
        is_clinically_usable: true,
      },
    ];

    const result = evaluateHairAuditOutcomeMeasurement(input);
    assert.strictEqual(result.domain, "surgical_outcome_audit");
    assert.strictEqual(result.measurement_status, "measurable");
  });

  it("maps HairAudit category and timepoint labels", () => {
    const result = evaluateHairAuditOutcomeMeasurement([
      {
        category: "donor_area",
        timepoint: "baseline",
        quality_status: "acceptable",
        is_clinically_usable: true,
      },
    ]);

    assert.strictEqual(result.domain, "surgical_outcome_audit");
    assert.ok(result.usable_evidence_count >= 1);
  });
});

describe("ImagingOS IM-7 — IM-1 through IM-6 compatibility", () => {
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
    const images: ImagingOsProgressionImage[] = GROWTH_TIMEPOINTS.flatMap((timepoint) =>
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
    const images: ImagingOsSurgicalImage[] = events.flatMap((event) =>
      SURGICAL_OUTCOME_CATEGORIES.map((category) => ({
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
});
