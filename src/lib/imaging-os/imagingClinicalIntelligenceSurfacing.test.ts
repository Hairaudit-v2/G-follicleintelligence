import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildClinicalImageAnalysisFromHli, clinicalAnalysisResultToMetadataRecord } from "./clinicalImageAnalysisCore";
import { buildImagingClinicalIntelligenceView } from "./imagingClinicalIntelligenceSurfacing";
import { buildStaffReviewRecord, mergeImagingStaffReviewMetadata } from "./imagingStaffReviewCore";

describe("imagingClinicalIntelligenceSurfacing", () => {
  it("surfaces donor and recipient assessments", () => {
    const clinical = clinicalAnalysisResultToMetadataRecord(
      buildClinicalImageAnalysisFromHli({
        hliCategory: "donor",
        categoryConfidence: 0.9,
        notes: "ok",
      })
    );
    clinical.donor_assessment = {
      status: "complete",
      confidence: 0.88,
      observations: ["Donor quality rating: good"],
      review_required: false,
    };
    const view = buildImagingClinicalIntelligenceView({
      tenantId: "tenant-1",
      imageId: "img-1",
      metadata: { imaging_clinical_ai: clinical },
      aiImageCategoryConfidence: 0.9,
    });
    assert.ok(view.donorAssessment);
    assert.equal(view.reviewRequired, false);
    assert.match(view.reviewQueueHref, /imaging\/review/);
  });

  it("flags review required for quality and missing region", () => {
    const clinical = clinicalAnalysisResultToMetadataRecord(
      buildClinicalImageAnalysisFromHli({
        hliCategory: "donor",
        categoryConfidence: 0.4,
        notes: "low",
        extraReasons: ["missing_scalp_region"],
      })
    );
    const view = buildImagingClinicalIntelligenceView({
      tenantId: "tenant-1",
      imageId: "img-1",
      metadata: {
        imaging_clinical_ai: clinical,
        imaging_quality: {
          quality_score: 40,
          quality_status: "fail",
          blur_status: "blurred",
          exposure_status: "normal",
          duplicate_status: "unique",
          evaluated_at: new Date().toISOString(),
          evaluator_version: "imagingos_quality_v1",
        },
      },
      aiImageCategoryConfidence: 0.4,
    });
    assert.equal(view.reviewRequired, true);
    assert.equal(view.missingScalpRegion, true);
  });

  it("clears review required after staff reviewed", () => {
    const metadata = mergeImagingStaffReviewMetadata(
      {
        imaging_clinical_ai: clinicalAnalysisResultToMetadataRecord(
          buildClinicalImageAnalysisFromHli({
            hliCategory: "donor",
            categoryConfidence: 0.4,
            notes: "low",
          })
        ),
      },
      buildStaffReviewRecord({ status: "reviewed", reviewedByUserId: "u1" })
    );
    const view = buildImagingClinicalIntelligenceView({
      tenantId: "tenant-1",
      imageId: "img-1",
      metadata,
      aiImageCategoryConfidence: 0.4,
    });
    assert.equal(view.reviewRequired, false);
    assert.equal(view.staffReviewStatus, "reviewed");
  });
});