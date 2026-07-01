import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clinicalAnalysisResultToMetadataRecord, buildClinicalImageAnalysisFromHli } from "@/src/lib/imaging-os/clinicalImageAnalysisCore";
import {
  buildPatientTwinImagingDeepLinks,
  mapPatientTwinImagingIntelligence,
} from "./patientTwinImagingIntelligenceCore";

describe("patientTwinImagingIntelligenceCore", () => {
  it("maps clinical AI, quality, and staff review into conservative summary", () => {
    const clinical = clinicalAnalysisResultToMetadataRecord(
      buildClinicalImageAnalysisFromHli({
        hliCategory: "donor",
        categoryConfidence: 0.85,
        notes: "donor",
      })
    );
    const summary = mapPatientTwinImagingIntelligence({
      metadata: {
        imaging_clinical_ai: clinical,
        imaging_quality: {
          quality_score: 80,
          quality_status: "pass",
          blur_status: "clear",
          exposure_status: "normal",
          duplicate_status: "unique",
          evaluated_at: "2026-07-01T00:00:00.000Z",
          evaluator_version: "imagingos_quality_v1",
        },
        imaging_staff_review: {
          status: "retake_required",
          reviewed_by: "u1",
          reviewed_at: "2026-07-01T00:00:00.000Z",
          review_version: "imagingos_staff_review_v1",
        },
        capture_source: "vie_guided",
      },
      aiImageCategory: "donor",
      aiImageCategoryConfidence: 0.85,
      aiImageReviewStatus: "pending",
    });
    assert.equal(summary.view_type, "donor");
    assert.equal(summary.capture_source, "vie_guided");
    assert.equal(summary.retake_required, true);
    assert.ok(summary.limitations.some((l) => /not a predictive/i.test(l)));
  });

  it("builds deep links with review queue when review required", () => {
    const links = buildPatientTwinImagingDeepLinks({
      tenantId: "11111111-1111-1111-1111-111111111111",
      patientId: "22222222-2222-2222-2222-222222222222",
      metadata: { protocol_session_id: "33333333-3333-3333-3333-333333333333" },
      imageId: "44444444-4444-4444-4444-444444444444",
      reviewRequired: true,
    });
    assert.ok(links.review_queue_href?.includes("/imaging/review"));
    assert.ok(links.links.some((l) => l.label === "Protocol session"));
  });
});