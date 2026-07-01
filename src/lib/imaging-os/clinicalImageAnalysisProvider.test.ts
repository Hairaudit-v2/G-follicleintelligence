import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildClinicalImageAnalysisFromHli,
  buildStubClinicalImageAnalysis,
  mergeClinicalAnalysisWithAssessments,
  buildDonorAssessmentSummary,
} from "./clinicalImageAnalysisCore";

describe("clinicalImageAnalysisProvider paths", () => {
  it("stub path is deterministic and staff-safe", () => {
    const a = buildStubClinicalImageAnalysis({ externalCategory: "donor", idempotencyKey: "x" });
    const b = buildStubClinicalImageAnalysis({ externalCategory: "donor", idempotencyKey: "x" });
    assert.deepEqual(a.confidence, b.confidence);
    assert.equal(a.provider, "stub");
  });

  it("degraded live path maps to needs_review when confidence low", () => {
    const base = buildClinicalImageAnalysisFromHli({
      hliCategory: "unknown",
      categoryConfidence: 0.2,
      notes: "uncertain",
    });
    assert.equal(base.status, "failed");
    assert.equal(base.reviewRequired, true);
  });

  it("merges donor assessment into clinical result", () => {
    const base = buildStubClinicalImageAnalysis({ externalCategory: "donor", idempotencyKey: "d1" });
    const merged = mergeClinicalAnalysisWithAssessments(base, {
      donor: buildDonorAssessmentSummary({
        confidence: 0.5,
        observations: ["Moderate donor quality observed."],
        reviewRequired: true,
      }),
      donorFindings: { donor_quality_rating: "moderate" },
    });
    assert.ok(merged.donor_assessment?.review_required);
    assert.ok(merged.reasons.includes("donor_assessment_needs_review"));
    assert.equal(merged.status, "needs_review");
  });
});