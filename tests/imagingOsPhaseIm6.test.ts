import { describe, it } from "node:test";
import assert from "node:assert";
import {
  IMAGING_SURGICAL_READINESS_DOMAINS,
  IMAGING_SURGICAL_READINESS_REQUIREMENTS,
  IMAGING_SURGICAL_READINESS_EVALUATOR_VERSION,
  buildSurgicalImageFromIntake,
  evaluateHairAuditSurgicalOutcomeReadiness,
  evaluateImageQualityFromMetadata,
  evaluateImageQualityStub,
  evaluateSurgicalImageReadiness,
  isImagingOsSurgicalReadinessDomain,
  normalizeImageIngestionRequest,
  normalizeSurgicalImageEventType,
  recommendSurgicalReadinessDomain,
  runImagingOsIngestionPipeline,
} from "../src/lib/imaging-os";
import type {
  CanonicalHairImageCategory,
  ImagingOsSurgicalImage,
  ImagingOsSurgicalImageEventType,
} from "../src/lib/imaging-os";

const SURGERY_PLANNING_CATEGORIES: CanonicalHairImageCategory[] = [
  "front",
  "top",
  "crown",
  "donor",
  "recipient",
];

const SURGERY_PLANNING_EVENTS: ImagingOsSurgicalImageEventType[] = [
  "pre_op",
  "recipient_design",
  "donor_mapping",
];

const OUTCOME_AUDIT_EVENTS: ImagingOsSurgicalImageEventType[] = [
  "pre_op",
  "immediate_post_op",
  "month_12_outcome",
];

const OUTCOME_AUDIT_CATEGORIES: CanonicalHairImageCategory[] = [
  "front",
  "top",
  "crown",
  "donor",
  "recipient",
];

function usableSurgicalImage(
  event: ImagingOsSurgicalImageEventType,
  category: CanonicalHairImageCategory,
  imageId?: string
): ImagingOsSurgicalImage {
  return {
    ...(imageId ? { image_id: imageId } : {}),
    canonical_category: category,
    surgical_event: event,
    quality_status: "excellent",
    is_clinically_usable: true,
  };
}

function unusableSurgicalImage(
  event: ImagingOsSurgicalImageEventType,
  category: CanonicalHairImageCategory,
  imageId?: string
): ImagingOsSurgicalImage {
  return {
    ...(imageId ? { image_id: imageId } : {}),
    canonical_category: category,
    surgical_event: event,
    quality_status: "poor",
    is_clinically_usable: false,
  };
}

function notEvaluatedSurgicalImage(
  event: ImagingOsSurgicalImageEventType,
  category: CanonicalHairImageCategory
): ImagingOsSurgicalImage {
  return {
    canonical_category: category,
    surgical_event: event,
    quality_status: "not_evaluated",
  };
}

function fullSurgeryPlanningSet(): ImagingOsSurgicalImage[] {
  return SURGERY_PLANNING_EVENTS.flatMap((event) =>
    SURGERY_PLANNING_CATEGORIES.map((category) =>
      usableSurgicalImage(event, category, `${event}-${category}`)
    )
  );
}

function fullOutcomeAuditSet(): ImagingOsSurgicalImage[] {
  return OUTCOME_AUDIT_EVENTS.flatMap((event) =>
    OUTCOME_AUDIT_CATEGORIES.map((category) =>
      usableSurgicalImage(event, category, `${event}-${category}`)
    )
  );
}

describe("ImagingOS IM-6 — surgical event normalization", () => {
  it("normalizes canonical surgical event values", () => {
    assert.strictEqual(normalizeSurgicalImageEventType("pre_op"), "pre_op");
    assert.strictEqual(normalizeSurgicalImageEventType("graft_tray"), "graft_tray");
    assert.strictEqual(normalizeSurgicalImageEventType("month_12_outcome"), "month_12_outcome");
  });

  it("normalizes pre-op aliases", () => {
    assert.strictEqual(normalizeSurgicalImageEventType("before"), "pre_op");
    assert.strictEqual(normalizeSurgicalImageEventType("baseline"), "pre_op");
    assert.strictEqual(normalizeSurgicalImageEventType("preop"), "pre_op");
    assert.strictEqual(normalizeSurgicalImageEventType("pre-op"), "pre_op");
  });

  it("normalizes recipient and donor planning aliases", () => {
    assert.strictEqual(normalizeSurgicalImageEventType("hairline_design"), "recipient_design");
    assert.strictEqual(normalizeSurgicalImageEventType("recipient_plan"), "recipient_design");
    assert.strictEqual(normalizeSurgicalImageEventType("donor_zone"), "donor_mapping");
    assert.strictEqual(normalizeSurgicalImageEventType("donor_marking"), "donor_mapping");
  });

  it("normalizes intraoperative aliases", () => {
    assert.strictEqual(normalizeSurgicalImageEventType("grafts"), "graft_tray");
    assert.strictEqual(normalizeSurgicalImageEventType("extraction"), "extraction_documentation");
    assert.strictEqual(normalizeSurgicalImageEventType("implantation"), "implantation_documentation");
    assert.strictEqual(normalizeSurgicalImageEventType("placement_complete"), "implantation_complete");
  });

  it("normalizes follow-up and outcome aliases", () => {
    assert.strictEqual(normalizeSurgicalImageEventType("postop"), "immediate_post_op");
    assert.strictEqual(normalizeSurgicalImageEventType("14_day"), "day_14_review");
    assert.strictEqual(normalizeSurgicalImageEventType("m6"), "month_6_review");
    assert.strictEqual(normalizeSurgicalImageEventType("m12"), "month_12_outcome");
    assert.strictEqual(normalizeSurgicalImageEventType("one_year"), "month_12_outcome");
    assert.strictEqual(normalizeSurgicalImageEventType("revision"), "revision_review");
  });

  it("returns unknown for missing or unrecognized values", () => {
    assert.strictEqual(normalizeSurgicalImageEventType(null), "unknown");
    assert.strictEqual(normalizeSurgicalImageEventType(undefined), "unknown");
    assert.strictEqual(normalizeSurgicalImageEventType(""), "unknown");
    assert.strictEqual(normalizeSurgicalImageEventType("missing"), "unknown");
    assert.strictEqual(normalizeSurgicalImageEventType("random_label"), "unknown");
  });
});

describe("ImagingOS IM-6 — surgical readiness registry", () => {
  it("contains all readiness domains with requirements", () => {
    assert.strictEqual(IMAGING_SURGICAL_READINESS_DOMAINS.length, 6);
    for (const domain of IMAGING_SURGICAL_READINESS_DOMAINS) {
      assert.ok(isImagingOsSurgicalReadinessDomain(domain));
      const req = IMAGING_SURGICAL_READINESS_REQUIREMENTS[domain];
      assert.ok(req.description.length > 0);
      assert.ok(req.required_events.length > 0);
      assert.ok(req.required_categories.length > 0);
      assert.ok(req.minimum_usable_images_per_event > 0);
    }
  });

  it("defines outcome_audit requirements", () => {
    const req = IMAGING_SURGICAL_READINESS_REQUIREMENTS.outcome_audit;
    assert.deepStrictEqual(req.required_events, [
      "pre_op",
      "immediate_post_op",
      "month_12_outcome",
    ]);
    assert.deepStrictEqual(req.required_categories, [
      "front",
      "top",
      "crown",
      "donor",
      "recipient",
    ]);
    assert.strictEqual(req.minimum_usable_images_per_event, 3);
  });
});

describe("ImagingOS IM-6 — evaluateSurgicalImageReadiness", () => {
  it("returns ready for complete surgery_planning image set", () => {
    const result = evaluateSurgicalImageReadiness({
      domain: "surgery_planning",
      images: fullSurgeryPlanningSet(),
    });
    assert.strictEqual(result.readiness_status, "ready");
    assert.strictEqual(result.completeness_score, 100);
    assert.deepStrictEqual(result.missing_events, []);
    assert.strictEqual(result.evaluator_version, IMAGING_SURGICAL_READINESS_EVALUATOR_VERSION);
  });

  it("returns partial or not_ready when donor_mapping is missing", () => {
    const withoutDonorMapping = fullSurgeryPlanningSet().filter(
      (image) => image.surgical_event !== "donor_mapping"
    );
    const result = evaluateSurgicalImageReadiness({
      domain: "surgery_planning",
      images: withoutDonorMapping,
    });
    assert.ok(["partial", "not_ready"].includes(result.readiness_status));
    assert.deepStrictEqual(result.missing_events, ["donor_mapping"]);
    assert.notStrictEqual(result.readiness_status, "ready");
  });

  it("does not count unusable images toward readiness", () => {
    const images = fullOutcomeAuditSet().map((image) =>
      image.surgical_event === "month_12_outcome"
        ? unusableSurgicalImage(image.surgical_event, image.canonical_category, image.image_id)
        : image
    );
    const result = evaluateSurgicalImageReadiness({
      domain: "outcome_audit",
      images,
    });
    assert.notStrictEqual(result.readiness_status, "ready");
    assert.deepStrictEqual(result.missing_events, ["month_12_outcome"]);
    assert.ok(result.quality_blockers.length > 0);
  });

  it("does not count not_evaluated images as usable", () => {
    const images = [
      ...OUTCOME_AUDIT_CATEGORIES.map((category) =>
        notEvaluatedSurgicalImage("pre_op", category)
      ),
      ...OUTCOME_AUDIT_CATEGORIES.map((category) =>
        usableSurgicalImage("immediate_post_op", category)
      ),
      ...OUTCOME_AUDIT_CATEGORIES.map((category) =>
        usableSurgicalImage("month_12_outcome", category)
      ),
    ];
    const result = evaluateSurgicalImageReadiness({
      domain: "outcome_audit",
      images,
    });
    assert.notStrictEqual(result.readiness_status, "ready");
    assert.deepStrictEqual(result.missing_events, ["pre_op"]);
  });

  it("requires pre_op, immediate_post_op, and month_12_outcome for outcome_audit", () => {
    const preOpOnly = OUTCOME_AUDIT_CATEGORIES.map((category) =>
      usableSurgicalImage("pre_op", category)
    );
    const result = evaluateSurgicalImageReadiness({
      domain: "outcome_audit",
      images: preOpOnly,
    });
    assert.notStrictEqual(result.readiness_status, "ready");
    assert.deepStrictEqual(result.missing_events, ["immediate_post_op", "month_12_outcome"]);
  });

  it("requires donor category across events for donor_recovery", () => {
    const images = [
      usableSurgicalImage("pre_op", "front"),
      usableSurgicalImage("immediate_post_op", "front"),
      usableSurgicalImage("day_14_review", "front"),
      usableSurgicalImage("month_6_review", "front"),
      usableSurgicalImage("month_12_outcome", "front"),
    ];
    const result = evaluateSurgicalImageReadiness({
      domain: "donor_recovery",
      images,
    });
    assert.notStrictEqual(result.readiness_status, "ready");
    assert.ok(Object.keys(result.missing_categories_by_event).length > 0);
    for (const event of result.required_events) {
      assert.deepStrictEqual(result.missing_categories_by_event[event], ["donor"]);
    }
  });

  it("returns invalid for unknown domain", () => {
    const result = evaluateSurgicalImageReadiness({
      domain: "unknown_domain" as "outcome_audit",
      images: [],
    });
    assert.strictEqual(result.readiness_status, "invalid");
    assert.strictEqual(result.completeness_score, 0);
  });
});

describe("ImagingOS IM-6 — recommendSurgicalReadinessDomain", () => {
  it("maps graft_tray event to intraoperative_documentation", () => {
    assert.strictEqual(
      recommendSurgicalReadinessDomain({ surgical_event: "graft_tray" }),
      "intraoperative_documentation"
    );
  });

  it("maps extraction_documentation and implantation_complete to intraoperative_documentation", () => {
    assert.strictEqual(
      recommendSurgicalReadinessDomain({ surgical_event: "extraction_documentation" }),
      "intraoperative_documentation"
    );
    assert.strictEqual(
      recommendSurgicalReadinessDomain({ surgical_event: "implantation_complete" }),
      "intraoperative_documentation"
    );
  });

  it("maps surgery_planning protocol to surgery_planning domain", () => {
    assert.strictEqual(
      recommendSurgicalReadinessDomain({ protocol: "surgery_planning" }),
      "surgery_planning"
    );
  });

  it("maps donor_analysis protocol to donor_recovery", () => {
    assert.strictEqual(
      recommendSurgicalReadinessDomain({ protocol: "donor_analysis" }),
      "donor_recovery"
    );
  });

  it("maps progression assessments to surgical domains", () => {
    assert.strictEqual(
      recommendSurgicalReadinessDomain({ assessment_type: "donor_recovery_tracking" }),
      "donor_recovery"
    );
    assert.strictEqual(
      recommendSurgicalReadinessDomain({ assessment_type: "surgery_growth_tracking" }),
      "recipient_growth"
    );
    assert.strictEqual(
      recommendSurgicalReadinessDomain({ assessment_type: "hairaudit_outcome_12month" }),
      "outcome_audit"
    );
  });

  it("maps revision_review event to revision_review domain", () => {
    assert.strictEqual(
      recommendSurgicalReadinessDomain({ surgical_event: "revision_review" }),
      "revision_review"
    );
  });

  it("returns undefined for unrecognized workflow", () => {
    assert.strictEqual(recommendSurgicalReadinessDomain({}), undefined);
  });
});

describe("ImagingOS IM-6 — buildSurgicalImageFromIntake", () => {
  it("maps metadata.surgical_event to surgical event", () => {
    const intake = normalizeImageIngestionRequest({
      source_system: "surgery_os",
      upload_surface: "surgery_workflow",
      storage_path: "uploads/graft.jpg",
      external_category: "graft_tray",
      surgery_id: "surg-001",
      patient_id: "pat-001",
      metadata: { surgical_event: "graft_tray" },
    });
    const image = buildSurgicalImageFromIntake({ intake });
    assert.strictEqual(image.surgical_event, "graft_tray");
    assert.strictEqual(image.canonical_category, "graft_tray");
    assert.strictEqual(image.surgical_case_id, "surg-001");
    assert.strictEqual(image.patient_id, "pat-001");
  });

  it("maps metadata.event_type and workflow_stage aliases", () => {
    const fromEventType = normalizeImageIngestionRequest({
      source_system: "surgery_os",
      upload_surface: "surgery_workflow",
      storage_path: "uploads/donor.jpg",
      external_category: "donor",
      metadata: { event_type: "donor_zone" },
    });
    assert.strictEqual(
      buildSurgicalImageFromIntake({ intake: fromEventType }).surgical_event,
      "donor_mapping"
    );

    const fromWorkflowStage = normalizeImageIngestionRequest({
      source_system: "surgery_os",
      upload_surface: "surgery_workflow",
      storage_path: "uploads/recipient.jpg",
      external_category: "recipient",
      metadata: { workflow_stage: "recipient_plan" },
    });
    assert.strictEqual(
      buildSurgicalImageFromIntake({ intake: fromWorkflowStage }).surgical_event,
      "recipient_design"
    );
  });

  it("maps metadata.timepoint using normalizeImagingOsTimepoint", () => {
    const intake = normalizeImageIngestionRequest({
      source_system: "surgery_os",
      upload_surface: "surgery_workflow",
      storage_path: "uploads/front.jpg",
      external_category: "front",
      metadata: { surgical_event: "pre_op", timepoint: "m12" },
    });
    const image = buildSurgicalImageFromIntake({ intake });
    assert.strictEqual(image.timepoint, "month_12");
  });

  it("falls back to case_id when surgery_id is absent", () => {
    const intake = normalizeImageIngestionRequest({
      source_system: "surgery_os",
      upload_surface: "surgery_workflow",
      storage_path: "uploads/front.jpg",
      external_category: "front",
      case_id: "case-001",
      metadata: { surgical_event: "pre_op" },
    });
    const image = buildSurgicalImageFromIntake({ intake });
    assert.strictEqual(image.surgical_case_id, "case-001");
  });

  it("carries metadata quality usability when provided", () => {
    const intake = normalizeImageIngestionRequest({
      source_system: "surgery_os",
      upload_surface: "surgery_workflow",
      storage_path: "uploads/front.jpg",
      external_category: "front",
      content_type: "image/jpeg",
      width: 1600,
      height: 1200,
      size_bytes: 512 * 1024,
      metadata: { surgical_event: "pre_op" },
    });
    const quality = evaluateImageQualityFromMetadata({
      width: 1600,
      height: 1200,
      size_bytes: 512 * 1024,
      content_type: "image/jpeg",
      canonical_category: "front",
    });
    const image = buildSurgicalImageFromIntake({ intake, quality });
    assert.strictEqual(image.is_clinically_usable, quality.is_clinically_usable);
    assert.strictEqual(image.quality_status, quality.quality_status);
  });

  it("marks stub quality as not usable", () => {
    const intake = normalizeImageIngestionRequest({
      source_system: "surgery_os",
      upload_surface: "surgery_workflow",
      storage_path: "uploads/front.jpg",
      external_category: "front",
      metadata: { surgical_event: "pre_op" },
    });
    const stub = evaluateImageQualityStub();
    const image = buildSurgicalImageFromIntake({ intake, quality: stub });
    assert.strictEqual(image.quality_status, "not_evaluated");
    assert.strictEqual(image.is_clinically_usable, false);
  });
});

describe("ImagingOS IM-6 — HairAudit surgical outcome adapter", () => {
  function fullHairAuditOutcomeInput() {
    const categories = ["patient_current_front", "patient_current_top", "patient_current_crown", "patient_current_donor", "patient_current_recipient"];
    return [
      ...categories.map((category) => ({
        category,
        timepoint: "baseline",
        quality_status: "excellent",
        is_clinically_usable: true,
      })),
      ...categories.map((category) => ({
        category,
        timepoint: "postop",
        quality_status: "excellent",
        is_clinically_usable: true,
      })),
      ...categories.map((category) => ({
        category,
        timepoint: "12_month",
        quality_status: "excellent",
        is_clinically_usable: true,
      })),
    ];
  }

  it("maps HairAudit labels and timepoints to outcome_audit readiness", () => {
    const result = evaluateHairAuditSurgicalOutcomeReadiness(fullHairAuditOutcomeInput());
    assert.strictEqual(result.domain, "outcome_audit");
    assert.strictEqual(result.readiness_status, "ready");
    assert.deepStrictEqual(result.missing_events, []);
    assert.strictEqual(result.evaluator_version, IMAGING_SURGICAL_READINESS_EVALUATOR_VERSION);
  });

  it("maps follow_up timepoint to month_12_outcome", () => {
    const baseline = ["front", "top", "crown", "donor", "recipient"].map((category) => ({
      category,
      timepoint: "pre_op",
      quality_status: "excellent",
      is_clinically_usable: true,
    }));
    const postOp = ["front", "top", "crown", "donor", "recipient"].map((category) => ({
      category,
      timepoint: "immediate_post_op",
      quality_status: "excellent",
      is_clinically_usable: true,
    }));
    const followUp = ["front", "top", "crown", "donor", "recipient"].map((category) => ({
      category,
      timepoint: "follow_up",
      quality_status: "excellent",
      is_clinically_usable: true,
    }));
    const result = evaluateHairAuditSurgicalOutcomeReadiness([
      ...baseline,
      ...postOp,
      ...followUp,
    ]);
    assert.strictEqual(result.readiness_status, "ready");
  });

  it("returns not ready when month_12_outcome evidence is missing", () => {
    const withoutOutcome = fullHairAuditOutcomeInput().filter(
      (item) => item.timepoint !== "12_month"
    );
    const result = evaluateHairAuditSurgicalOutcomeReadiness(withoutOutcome);
    assert.notStrictEqual(result.readiness_status, "ready");
    assert.deepStrictEqual(result.missing_events, ["month_12_outcome"]);
  });
});

describe("ImagingOS IM-6 — IM-1 to IM-5 compatibility", () => {
  it("single-image pipeline does not attach surgical results", () => {
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
    assert.strictEqual("surgical" in result, false);
    assert.strictEqual("surgical_readiness" in result, false);
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
