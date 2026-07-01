import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildClinicalImageAnalysisFromHli,
  buildStubClinicalImageAnalysis,
  buildUnavailableClinicalImageAnalysis,
  clinicalAnalysisResultToMetadataRecord,
  mergeImagingClinicalAiMetadata,
  shouldRunDonorAssessment,
  shouldRunRecipientAssessment,
  collectImagingReviewReasons,
  CLINICAL_REVIEW_CONFIDENCE_THRESHOLD,
} from "./clinicalImageAnalysisCore";

describe("clinicalImageAnalysisCore", () => {
  it("stub provider returns contract-valid shape", () => {
    const result = buildStubClinicalImageAnalysis({
      externalCategory: "donor",
      idempotencyKey: "img-1",
    });
    assert.equal(result.provider, "stub");
    assert.equal(result.analysisVersion, "imagingos_clinical_v1");
    assert.ok(result.confidence >= 0.5 && result.confidence <= 0.7);
    assert.equal(result.viewType, "donor");
  });

  it("live HLI mapping flags low confidence for review", () => {
    const result = buildClinicalImageAnalysisFromHli({
      hliCategory: "donor",
      categoryConfidence: 0.55,
      notes: "test",
    });
    assert.equal(result.provider, "hli_openai");
    assert.equal(result.status, "needs_review");
    assert.ok(result.reviewRequired);
    assert.ok(result.reasons.includes("low_classification_confidence"));
  });

  it("unavailable provider fails safely with review flag", () => {
    const result = buildUnavailableClinicalImageAnalysis({ reason: "signed_url_unavailable" });
    assert.equal(result.provider, "unavailable");
    assert.equal(result.status, "failed");
    assert.equal(result.reviewRequired, true);
  });

  it("shouldRunDonorAssessment triggers for donor views and slots", () => {
    assert.equal(shouldRunDonorAssessment({ viewType: "donor" }), true);
    assert.equal(shouldRunDonorAssessment({ protocolSlotSlug: "donor_close" }), true);
    assert.equal(shouldRunDonorAssessment({ viewType: "front" }), false);
  });

  it("shouldRunRecipientAssessment triggers for recipient views and slots", () => {
    assert.equal(shouldRunRecipientAssessment({ viewType: "recipient" }), true);
    assert.equal(shouldRunRecipientAssessment({ protocolSlotSlug: "recipient_midscalp" }), true);
    assert.equal(shouldRunRecipientAssessment({ viewType: "donor" }), false);
  });

  it("metadata merge preserves unrelated keys", () => {
    const record = clinicalAnalysisResultToMetadataRecord(
      buildStubClinicalImageAnalysis({ externalCategory: "donor" })
    );
    const merged = mergeImagingClinicalAiMetadata(
      { imaging_quality: { quality_score: 80 }, hairaudit: { case: "x" } },
      record
    );
    assert.deepEqual(merged.imaging_quality, { quality_score: 80 });
    assert.deepEqual(merged.hairaudit, { case: "x" });
    assert.ok(merged.imaging_clinical_ai);
  });

  it("collectImagingReviewReasons aggregates flags", () => {
    const reasons = collectImagingReviewReasons({
      classificationConfidence: CLINICAL_REVIEW_CONFIDENCE_THRESHOLD - 0.1,
      qualityStatus: "review",
      duplicateStatus: "possible_duplicate",
      scalpRegionReviewRequired: true,
      clinicalAi: {
        provider: "unavailable",
        status: "failed",
        confidence: 0,
        review_required: true,
        reasons: ["failed_live_analysis"],
        clinical_findings: {},
        analysis_version: "imagingos_clinical_v1",
        analysed_at: new Date().toISOString(),
      },
    });
    assert.ok(reasons.includes("low_classification_confidence"));
    assert.ok(reasons.includes("poor_quality_metadata"));
    assert.ok(reasons.includes("possible_duplicate"));
    assert.ok(reasons.includes("missing_scalp_region"));
    assert.ok(reasons.includes("failed_live_analysis"));
  });
});