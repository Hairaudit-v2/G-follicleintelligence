import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PatientImageRow } from "@/src/lib/patientImages/patientImageTypes";
import { selectPatientPortalReleasedImages } from "./patientSafeImagingExportLoad.server";

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
    patient_portal_release_status: "held",
    portal_released_at: null,
    portal_released_by_fi_user_id: null,
    imaging_library_axis: "consultation",
    clinic_id: null,
    captured_by_staff_id: null,
    device_type: null,
    anatomical_region: "hairline",
    visit_type: null,
    follow_up_interval: null,
    imaging_protocol_template_slug: "baseline_consultation",
    imaging_protocol_slot_slug: "global_front",
    storage_bucket: "patient-images",
    storage_path: "tenant/tenant-1/i.jpg",
    original_filename: null,
    content_type: "image/jpeg",
    file_size_bytes: 1000,
    caption: null,
    taken_at: "2026-07-01T12:00:00.000Z",
    metadata: {},
    uploaded_by_user_id: null,
    archived_at: null,
    archived_by_user_id: null,
    archive_reason: null,
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
    ai_image_category: null,
    ai_image_category_confidence: null,
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

describe("selectPatientPortalReleasedImages", () => {
  it("excludes held images from portal export", () => {
    const filtered = selectPatientPortalReleasedImages([
      baseImage({ id: "held-1", patient_portal_release_status: "held" }),
      baseImage({ id: "released-1", patient_portal_release_status: "released" }),
    ]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.id, "released-1");
  });
});

