import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildConsultationOsImageIngestionRequest } from "@/src/lib/imaging-os/adapters/consultationOsImageAdapter";
import { buildPatientImageIngestionRequest } from "./buildPatientImageIngestionRequest";
import { resolvePatientImageUploadCaptureSource } from "./resolvePatientImageUploadCaptureSource";
import { buildUnifiedIngestMetadataPatch } from "./runUnifiedPatientImageIngest";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const IMAGE = "55555555-5555-4555-8555-555555555555";
const CONSULTATION = "66666666-6666-4666-8666-666666666666";
const FORM_INSTANCE = "77777777-7777-4777-8777-777777777777";
const STORAGE_PATH = `tenants/${TENANT}/patients/${PATIENT}/images/${IMAGE}/scalp.jpg`;

describe("consultation image upload capture source", () => {
  it("preserves explicit consultation_os capture_source", () => {
    assert.equal(
      resolvePatientImageUploadCaptureSource({
        captureSource: "consultation_os",
        consultationId: CONSULTATION,
      }),
      "consultation_os"
    );
  });

  it("defaults capture_source to consultation_os when consultation_id is present", () => {
    assert.equal(
      resolvePatientImageUploadCaptureSource({
        captureSource: null,
        consultationId: CONSULTATION,
      }),
      "consultation_os"
    );
  });

  it("leaves capture_source null when consultation_id is absent", () => {
    assert.equal(
      resolvePatientImageUploadCaptureSource({
        captureSource: null,
        consultationId: null,
      }),
      null
    );
  });
});

describe("consultation image unified ingest routing", () => {
  it("routes consultation_os uploads to consultationOsImageAdapter", () => {
    const request = buildPatientImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      consultation_id: CONSULTATION,
      form_instance_id: FORM_INSTANCE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "consultation_os",
      image_category: "scalp",
    });
    assert.equal(request.source_system, "consultation_os");
    assert.equal(request.upload_surface, "consultation_form");
    assert.equal(request.consultation_id, CONSULTATION);
    assert.equal(request.metadata?.capture_source, "consultation_os");
    assert.equal(request.metadata?.form_instance_id, FORM_INSTANCE);
  });

  it("routes consultation_id-only context to consultation adapter", () => {
    const request = buildPatientImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      consultation_id: CONSULTATION,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      image_category: "scalp",
    });
    assert.equal(request.source_system, "consultation_os");
    assert.equal(request.metadata?.capture_source, "consultation_os");
  });

  it("persists form_instance_id into unified ingest metadata", () => {
    const patch = buildUnifiedIngestMetadataPatch({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      consultation_id: CONSULTATION,
      form_instance_id: FORM_INSTANCE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "consultation_os",
      image_category: "scalp",
      metadata: { form_field_id: "clinical_photos" },
    });
    const ingest = patch.imaging_os_ingest as { source_system?: string };
    assert.equal(ingest.source_system, "consultation_os");
    const request = buildConsultationOsImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      consultation_id: CONSULTATION,
      form_instance_id: FORM_INSTANCE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      external_category: "scalp",
      metadata: { form_field_id: "clinical_photos" },
    });
    assert.equal(request.metadata?.form_instance_id, FORM_INSTANCE);
    assert.equal(request.metadata?.form_field_id, "clinical_photos");
  });

  it("keeps non-consultation surgery uploads on surgery adapter", () => {
    const request = buildPatientImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "surgery_os",
      protocol_template_slug: "surgery_day",
      protocol_slot_slug: "graft_tray_overview",
    });
    assert.equal(request.source_system, "surgery_os");
    assert.notEqual(request.source_system, "consultation_os");
  });
});