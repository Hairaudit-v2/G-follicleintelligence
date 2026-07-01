import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PatientImageRow } from "@/src/lib/patientImages/patientImageTypes";
import {
  mapPatientImageToSafeExportCard,
  mapPatientImagesToSafeExportCards,
  patientSafeExportCardsAreRedacted,
} from "./patientSafeImagingExportMapperCore";

function baseImage(overrides: Partial<PatientImageRow> = {}): PatientImageRow {
  return {
    id: "img-1",
    tenant_id: "tenant-1",
    patient_id: "patient-1",
    person_id: null,
    case_id: null,
    booking_id: null,
    lead_id: null,
    consultation_id: null,
    form_instance_id: null,
    image_category: "consult",
    image_status: "active",
    imaging_library_axis: "consultation",
    clinic_id: null,
    captured_by_staff_id: null,
    device_type: null,
    anatomical_region: "hairline",
    visit_type: "guided:baseline_consultation",
    follow_up_interval: null,
    imaging_protocol_template_slug: "baseline_consultation",
    imaging_protocol_slot_slug: "global_front",
    storage_bucket: "patient-images",
    storage_path: "t/p/i.jpg",
    original_filename: null,
    content_type: "image/jpeg",
    file_size_bytes: 1000,
    caption: null,
    taken_at: "2026-07-01T12:00:00.000Z",
    metadata: {
      imaging_quality: { quality_status: "pass" },
      imaging_clinical_ai: { provider: "hli_openai", confidence: 0.9 },
      imaging_job_summaries: { norwood_grade: { observations: ["Norwood III"] } },
    },
    uploaded_by_user_id: null,
    archived_at: null,
    archived_by_user_id: null,
    archive_reason: null,
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
    ai_image_category: "front",
    ai_image_category_confidence: 0.9,
    ai_hair_state: null,
    ai_shave_state: null,
    ai_surgery_stage: null,
    ai_image_ai_notes: null,
    ai_image_review_status: "pending",
    ai_image_reviewed_by_staff_id: null,
    ai_image_reviewed_at: null,
    ai_image_classified_at: null,
    ai_image_classifier_version: null,
    ...overrides,
  };
}

describe("patientSafeImagingExportMapperCore", () => {
  it("maps image to redacted export card without clinical fields", () => {
    const card = mapPatientImageToSafeExportCard(baseImage());
    assert.equal(card.status_message, "Image quality suitable for review");
    assert.ok(patientSafeExportCardsAreRedacted([card]));
    assert.equal(card.view_label, "global front");
  });

  it("excludes images with forbidden view labels from batch export", () => {
    const cards = mapPatientImagesToSafeExportCards([
      baseImage({
        imaging_protocol_slot_slug: null,
        anatomical_region: "norwood_pattern" as never,
      }),
    ]);
    assert.equal(cards.length, 0);
  });

  it("batch export cards are all redacted", () => {
    const cards = mapPatientImagesToSafeExportCards([baseImage(), baseImage({ id: "img-2" })]);
    assert.equal(cards.length, 2);
    assert.ok(patientSafeExportCardsAreRedacted(cards));
  });
});