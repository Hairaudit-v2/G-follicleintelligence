import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPatientPortalImageIngestionRequest } from "@/src/lib/imaging-os/adapters/patientPortalImageAdapter";
import { buildPatientImageIngestionRequest } from "./buildPatientImageIngestionRequest";
import {
  buildPatientPortalImageUploadFields,
  normalizePatientPortalImageSlotSlug,
} from "@/src/lib/patientPortal/patientPortalImageUploadCore";
import { buildUnifiedIngestMetadataPatch } from "./runUnifiedPatientImageIngest";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const IMAGE = "55555555-5555-4555-8555-555555555555";
const STORAGE_PATH = `tenants/${TENANT}/patients/${PATIENT}/images/${IMAGE}/fu_front.jpg`;

describe("patient portal image upload fields", () => {
  it("defaults follow_up_review + fu_front with patient_portal capture_source", () => {
    const fields = buildPatientPortalImageUploadFields();
    assert.equal(fields.capture_source, "patient_portal");
    assert.equal(fields.imaging_protocol_template_slug, "follow_up_review");
    assert.equal(fields.imaging_protocol_slot_slug, "fu_front");
    assert.equal(fields.imaging_library_axis, "follow_up");
    assert.equal(fields.image_category, "progress");
  });

  it("normalizes invalid slot slugs to fu_front", () => {
    assert.equal(normalizePatientPortalImageSlotSlug("fu_top"), "fu_top");
    assert.equal(normalizePatientPortalImageSlotSlug("invalid"), "fu_front");
  });
});

describe("patient portal unified ingest routing", () => {
  it("routes patient_portal uploads to patientPortalImageAdapter", () => {
    const request = buildPatientImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "patient_portal",
      protocol_template_slug: "follow_up_review",
      protocol_slot_slug: "fu_front",
      image_category: "progress",
    });
    assert.equal(request.source_system, "patient_upload");
    assert.equal(request.upload_surface, "patient_portal");
    assert.equal(request.uploaded_by_actor_type, "patient");
    assert.equal(request.metadata?.capture_source, "patient_portal");
  });

  it("buildPatientPortalImageIngestionRequest sets follow_up_review defaults", () => {
    const request = buildPatientPortalImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      protocol_slot_slug: "fu_top",
    });
    assert.equal(request.metadata?.protocol_template_slug, "follow_up_review");
    assert.equal(request.metadata?.protocol_slot_slug, "fu_top");
  });

  it("produces unified ingest metadata for patient_portal capture", () => {
    const patch = buildUnifiedIngestMetadataPatch({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "patient_portal",
      protocol_template_slug: "follow_up_review",
      protocol_slot_slug: "fu_front",
      image_category: "progress",
    });
    const ingest = patch.imaging_os_ingest as { source_system?: string; upload_surface?: string };
    assert.equal(ingest.source_system, "patient_upload");
    assert.equal(ingest.upload_surface, "patient_portal");
    const session = patch.imaging_session as { session_type?: string; capture_source?: string };
    assert.equal(session.session_type, "follow_up");
    assert.equal(session.capture_source, "patient_portal");
  });

  it("keeps consultation_os uploads on consultation adapter", () => {
    const request = buildPatientImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      consultation_id: "66666666-6666-4666-8666-666666666666",
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "consultation_os",
    });
    assert.equal(request.source_system, "consultation_os");
    assert.notEqual(request.source_system, "patient_upload");
  });
});