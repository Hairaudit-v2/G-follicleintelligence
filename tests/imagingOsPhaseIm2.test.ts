import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  normalizeImageIngestionRequest,
  runImagingOsIngestionPipeline,
  buildFiOsPatientImageIngestionRequest,
  buildHliImageIngestionRequest,
  IMAGING_OS_INGESTION_PIPELINE_VERSION,
} from "../src/lib/imaging-os";
import {
  buildStubClassificationResponse,
  buildHairAuditIngestionRequest,
  classifyHairAuditImageRequest,
  STUB_CLASSIFIER_VERSION,
} from "../src/lib/hairaudit/fiOsHairAuditImageClassifyService";
import type { HairAuditImageClassifyRequest } from "../src/lib/hairaudit/fiOsHairAuditImageClassifyService";

const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SAMPLE_UPLOAD = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
const SAMPLE_PATIENT = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

function hairAuditRequest(
  overrides: Partial<HairAuditImageClassifyRequest> = {}
): HairAuditImageClassifyRequest {
  return {
    source_system: "hairaudit",
    idempotency_key: `hairaudit:image-intelligence:${SAMPLE_CASE}:${SAMPLE_UPLOAD}:v1`,
    source_case_id: SAMPLE_CASE,
    source_upload_id: SAMPLE_UPLOAD,
    canonical_photo_category: "patient_current_front",
    legacy_upload_type: "patient_photo:front",
    storage_bucket: "case-files",
    storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
    image_content_type: "image/jpeg",
    image_size_bytes: 1024,
    ...overrides,
  };
}

const RESPONSE_FIELD_KEYS = [
  "category",
  "canonical_photo_category",
  "confidence",
  "quality_status",
  "protocol_status",
  "classifier_version",
  "notes",
] as const;

describe("ImagingOS IM-2 — normalizeImageIngestionRequest", () => {
  it("maps HairAudit external category to canonical category", () => {
    const intake = normalizeImageIngestionRequest({
      source_system: "hairaudit",
      upload_surface: "audit_upload",
      external_category: "patient_current_front",
      storage_path: "cases/front.jpg",
    });
    assert.strictEqual(intake.canonical_photo_category, "front");
    assert.strictEqual(intake.is_processable, true);
    assert.strictEqual(intake.metadata_version, "imaging-intake.v2");
  });

  it("canonical_category_hint overrides external category", () => {
    const intake = normalizeImageIngestionRequest({
      source_system: "fi_os",
      upload_surface: "case_gallery",
      external_category: "patient_current_front",
      canonical_category_hint: "donor",
      storage_path: "patients/donor.jpg",
    });
    assert.strictEqual(intake.canonical_photo_category, "donor");

    const pipeline = runImagingOsIngestionPipeline({
      source_system: "fi_os",
      upload_surface: "case_gallery",
      external_category: "patient_current_front",
      canonical_category_hint: "donor",
      storage_path: "patients/donor.jpg",
    });
    assert.strictEqual(pipeline.classification.canonical_photo_category, "donor");
  });

  it("missing storage reference returns is_processable false", () => {
    const intake = normalizeImageIngestionRequest({
      source_system: "hli",
      upload_surface: "patient_portal",
      external_category: "left_profile",
    });
    assert.strictEqual(intake.is_processable, false);
    assert.ok(intake.warnings.some((w) => /not processable/i.test(w)));
  });

  it("public_url only image is processable", () => {
    const intake = normalizeImageIngestionRequest({
      source_system: "hli",
      upload_surface: "internal_api",
      public_url: "https://cdn.example.com/image.jpg",
      external_category: "right_profile",
    });
    assert.strictEqual(intake.is_processable, true);
    assert.strictEqual(intake.canonical_photo_category, "right");
  });

  it("does not throw for sparse minimal input", () => {
    assert.doesNotThrow(() =>
      normalizeImageIngestionRequest({
        source_system: "unknown",
        upload_surface: "unknown",
      })
    );
    const intake = normalizeImageIngestionRequest({
      source_system: "unknown",
      upload_surface: "unknown",
    });
    assert.strictEqual(intake.canonical_photo_category, "other");
    assert.strictEqual(intake.is_processable, false);
    assert.ok(intake.intake_id.startsWith("intake-"));
  });
});

describe("ImagingOS IM-2 — adapters", () => {
  it("FI OS patient adapter builds valid ingestion request", () => {
    const request = buildFiOsPatientImageIngestionRequest({
      patient_id: SAMPLE_PATIENT,
      case_id: SAMPLE_CASE,
      storage_bucket: "patient-images",
      storage_path: `tenants/t1/patients/${SAMPLE_PATIENT}/scalp.jpg`,
      content_type: "image/jpeg",
      size_bytes: 2048,
      external_category: "scalp",
    });
    assert.strictEqual(request.source_system, "fi_os");
    assert.strictEqual(request.upload_surface, "case_gallery");
    assert.strictEqual(request.patient_id, SAMPLE_PATIENT);
    assert.strictEqual(request.storage_bucket, "patient-images");

    const intake = normalizeImageIngestionRequest(request);
    assert.strictEqual(intake.is_processable, true);
    assert.strictEqual(intake.canonical_photo_category, "top");
  });

  it("HLI adapter builds valid ingestion request", () => {
    const request = buildHliImageIngestionRequest({
      patient_id: SAMPLE_PATIENT,
      external_image_id: "hli-img-42",
      external_category: "left_profile",
      public_url: "https://storage.example/hli/left.jpg",
      upload_surface: "internal_api",
    });
    assert.strictEqual(request.source_system, "hli");
    assert.strictEqual(request.upload_surface, "internal_api");
    assert.strictEqual(request.external_image_id, "hli-img-42");

    const intake = normalizeImageIngestionRequest(request);
    assert.strictEqual(intake.is_processable, true);
    assert.strictEqual(intake.canonical_photo_category, "left");
  });
});

describe("ImagingOS IM-2 — runImagingOsIngestionPipeline", () => {
  it("returns pipeline_version imaging-os-ingestion-v1", () => {
    const result = runImagingOsIngestionPipeline({
      source_system: "fi_os",
      upload_surface: "clinic_console",
      storage_path: "uploads/test.jpg",
      external_category: "donor",
    });
    assert.strictEqual(result.pipeline_version, IMAGING_OS_INGESTION_PIPELINE_VERSION);
    assert.strictEqual(result.pipeline_version, "imaging-os-ingestion-v1");
    assert.strictEqual(result.status, "dry_run");
    assert.strictEqual(result.quality.quality_status, "not_evaluated");
    assert.strictEqual(result.classification.classification_status, "dry_run");
  });

  it("non-processable image returns status not_processable", () => {
    const result = runImagingOsIngestionPipeline({
      source_system: "consultation_os",
      upload_surface: "consultation_form",
      external_category: "consult",
    });
    assert.strictEqual(result.status, "not_processable");
    assert.strictEqual(result.intake.is_processable, false);
    assert.strictEqual(result.quality.quality_status, "not_evaluated");
    assert.strictEqual(result.classification.classification_status, "dry_run");
  });
});

describe("ImagingOS IM-2 — HairAudit compatibility", () => {
  it("buildHairAuditIngestionRequest maps HairAudit fields", () => {
    const request = buildHairAuditIngestionRequest(hairAuditRequest());
    assert.strictEqual(request.source_system, "hairaudit");
    assert.strictEqual(request.upload_surface, "audit_upload");
    assert.strictEqual(request.case_id, SAMPLE_CASE);
    assert.strictEqual(request.external_image_id, SAMPLE_UPLOAD);
    assert.strictEqual(request.external_category, "patient_current_front");
  });

  it("buildStubClassificationResponse returns the same 7-field response shape", () => {
    const stub = buildStubClassificationResponse(hairAuditRequest());
    const keys = Object.keys(stub).sort();
    assert.deepStrictEqual(keys, [...RESPONSE_FIELD_KEYS].sort());
    assert.strictEqual(stub.classifier_version, STUB_CLASSIFIER_VERSION);
    assert.strictEqual(stub.category, "patient_current_front");
    assert.strictEqual(stub.canonical_photo_category, "front");
    assert.strictEqual(stub.quality_status, "not_evaluated");
    assert.strictEqual(stub.protocol_status, "not_evaluated");
    assert.strictEqual(stub.notes, "Stub classification only");
    assert.ok(stub.confidence >= 0.5 && stub.confidence <= 0.7);
  });

  const ENV_KEYS = ["HAIRAUDIT_IMAGE_CLASSIFIER_MODE"] as const;
  let savedMode: string | undefined;

  beforeEach(() => {
    savedMode = process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE;
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE = "stub";
  });

  afterEach(() => {
    if (savedMode === undefined) delete process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE;
    else process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE = savedMode;
  });

  it("classifyHairAuditImageRequest stub mode still works via ingestion pipeline", async () => {
    const outcome = await classifyHairAuditImageRequest(hairAuditRequest());
    assert.strictEqual(outcome.ok, true);
    if (!outcome.ok) return;
    const keys = Object.keys(outcome.result).sort();
    assert.deepStrictEqual(keys, [...RESPONSE_FIELD_KEYS].sort());
    assert.strictEqual(outcome.result.canonical_photo_category, "front");
  });
});
