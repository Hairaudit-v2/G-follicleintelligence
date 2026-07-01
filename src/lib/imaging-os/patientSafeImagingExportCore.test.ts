import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPatientSafeImagingExportCard,
  patientSafeExportCardIsRedacted,
  redactMetadataForPatientExport,
} from "./patientSafeImagingExportCore";

describe("patientSafeImagingExportCore", () => {
  it("builds redacted export card with allowed wording only", () => {
    const card = buildPatientSafeImagingExportCard({
      imageId: "img-1",
      takenAt: "2026-07-01T12:00:00.000Z",
      viewLabel: "Front view",
      sessionType: "Baseline consultation",
      progressLabel: "Visit 1",
      metadata: {
        imaging_quality: { quality_status: "pass" },
      },
    });
    assert.equal(card.status_message, "Image quality suitable for review");
    assert.ok(patientSafeExportCardIsRedacted(card));
  });

  it("retake status uses patient-safe message", () => {
    const card = buildPatientSafeImagingExportCard({
      imageId: "img-2",
      metadata: {
        imaging_staff_review: {
          status: "retake_required",
          reviewed_at: "2026-01-01T00:00:00.000Z",
          reviewed_by: "user-1",
          review_version: "imagingos_staff_review_v1",
        },
      },
    });
    assert.equal(card.status, "retake_requested");
    assert.equal(card.status_message, "Retake requested");
    assert.ok(patientSafeExportCardIsRedacted(card));
  });

  it("rejects cards containing forbidden clinical wording", () => {
    const card = buildPatientSafeImagingExportCard({
      imageId: "img-3",
      viewLabel: "Norwood III pattern",
      metadata: {},
    });
    assert.equal(patientSafeExportCardIsRedacted(card), false);
  });

  it("redactMetadataForPatientExport strips staff and AI keys", () => {
    const redacted = redactMetadataForPatientExport({
      capture_source: "guided_capture",
      imaging_clinical_ai: { provider: "hli_openai" },
      imaging_job_summaries: { outcome_score: { confidence: 0.9 } },
      imaging_staff_review: { status: "reviewed" },
      imaging_review_assignment: { assigned_to: "user-1" },
      ai_image_category_confidence: 0.8,
      ai_image_category: "donor",
    });
    assert.equal(redacted.capture_source, "guided_capture");
    assert.equal(redacted.imaging_clinical_ai, undefined);
    assert.equal(redacted.imaging_job_summaries, undefined);
    assert.equal(redacted.imaging_staff_review, undefined);
    assert.equal(redacted.imaging_review_assignment, undefined);
    assert.equal(redacted.ai_image_category, undefined);
    assert.equal(redacted.ai_image_category_confidence, undefined);
  });
});