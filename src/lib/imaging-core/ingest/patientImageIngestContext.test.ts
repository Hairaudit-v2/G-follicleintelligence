import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { IMAGING_OS_INGESTION_PIPELINE_VERSION } from "@/src/lib/imaging-os/pipeline";
import { buildPatientImageIngestionRequest } from "./buildPatientImageIngestionRequest";
import {
  parsePatientImageIngestionContext,
  validateHairauditIngestContext,
  validateParsedPatientImageIngestContext,
  validateSurgeryOsIngestContext,
} from "./parsePatientImageIngestionContext";
import { runUnifiedPatientImageIngest } from "./runUnifiedPatientImageIngest";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const CASE = "22222222-2222-4222-8222-222222222222";
const IMAGE = "55555555-5555-4555-8555-555555555555";
const BOOKING = "44444444-4444-4444-8444-444444444444";
const STORAGE_PATH = `tenants/${TENANT}/patients/${PATIENT}/images/${IMAGE}/front.jpg`;

describe("parsePatientImageIngestionContext", () => {
  it("parses flat surgery_os input into SurgeryOsIngestContext", () => {
    const ctx = parsePatientImageIngestionContext({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      case_id: CASE,
      booking_id: BOOKING,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "surgery_os",
      protocol_template_slug: "surgery_day",
      protocol_slot_slug: "graft_tray_overview",
    });
    assert.equal(ctx.kind, "surgery_os");
    assert.equal(ctx.capture_source, "surgery_os");
    assert.equal(ctx.booking_id, BOOKING);
    assert.equal(ctx.protocol_template_slug, "surgery_day");
    assert.equal(validateSurgeryOsIngestContext(ctx).valid, true);
  });

  it("normalizes imaging_os_wizard and guided_capture into ImagingOsWizardIngestContext", () => {
    const wizard = parsePatientImageIngestionContext({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "imaging_os_wizard",
      protocol_template_slug: "hair_loss_consultation",
      protocol_slot_slug: "bc_front",
    });
    assert.equal(wizard.kind, "imaging_os_wizard");
    assert.equal(wizard.capture_source, "imaging_os_wizard");

    const guided = parsePatientImageIngestionContext({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "guided_capture",
      protocol_template_slug: "baseline_consultation",
      protocol_slot_slug: "bc_front",
    });
    assert.equal(guided.kind, "imaging_os_wizard");
    assert.equal(guided.capture_source, "imaging_os_wizard");
  });

  it("normalizes vie_guided into VieCaptureWizardIngestContext", () => {
    const ctx = parsePatientImageIngestionContext({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "vie_guided",
      protocol_template_slug: "hair_loss_consultation",
      protocol_slot_slug: "bc_left",
    });
    assert.equal(ctx.kind, "vie_capture_wizard");
    assert.equal(ctx.capture_source, "vie_capture_wizard");
  });

  it("preserves hairaudit external case/source metadata", () => {
    const ctx = parsePatientImageIngestionContext({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      case_id: CASE,
      fi_upload_id: "upload-abc",
      fi_event_id: "event-xyz",
      storage_bucket: "case-files",
      storage_path: `cases/${CASE}/front.jpg`,
      upload_source: "hairaudit",
      capture_source: "hairaudit",
      hairaudit_image_type: "frontal",
      legacy_upload_type: "scalp_preop_front",
      metadata: { audit_lane: "preop" },
    });
    assert.equal(ctx.kind, "hairaudit");
    assert.equal(ctx.case_id, CASE);
    assert.equal(ctx.fi_upload_id, "upload-abc");
    assert.equal(ctx.fi_event_id, "event-xyz");
    assert.equal(ctx.hairaudit_image_type, "frontal");
    assert.equal(ctx.legacy_upload_type, "scalp_preop_front");
    assert.deepEqual(ctx.metadata, { audit_lane: "preop" });
    assert.equal(validateHairauditIngestContext(ctx).valid, true);
  });

  it("routes wizard follow_up_review template to legacy_follow_up", () => {
    const ctx = parsePatientImageIngestionContext({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "imaging_os_wizard",
      protocol_template_slug: "follow_up_review",
      protocol_slot_slug: "fu_front",
    });
    assert.equal(ctx.kind, "legacy_follow_up");
    assert.equal(ctx.capture_source, "imaging_os_wizard");
  });

  it("falls back unknown/legacy values safely", () => {
    const unknown = parsePatientImageIngestionContext({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "not_a_real_source",
    });
    assert.equal(unknown.kind, "unknown");
    assert.equal(unknown.capture_source, "unknown");

    const legacyFollowUp = parsePatientImageIngestionContext({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "legacy_follow_up",
      protocol_template_slug: "follow_up_review",
    });
    assert.equal(legacyFollowUp.kind, "legacy_follow_up");
    assert.equal(legacyFollowUp.capture_source, "legacy_follow_up");
  });

  it("validateParsedPatientImageIngestContext delegates by kind", () => {
    const surgery = parsePatientImageIngestionContext({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "surgery_os",
    });
    assert.equal(validateParsedPatientImageIngestContext(surgery).valid, false);

    const hairaudit = parsePatientImageIngestionContext({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      case_id: CASE,
      storage_bucket: "case-files",
      storage_path: `cases/${CASE}/front.jpg`,
      upload_source: "hairaudit",
    });
    assert.equal(validateParsedPatientImageIngestContext(hairaudit).valid, true);
  });
});

describe("discriminated ingest preserves unified output", () => {
  const surgeryFlat = {
    tenant_id: TENANT,
    patient_id: PATIENT,
    image_id: IMAGE,
    case_id: CASE,
    storage_bucket: "patient-images",
    storage_path: STORAGE_PATH,
    capture_source: "surgery_os",
    protocol_template_slug: "surgery_day",
    protocol_slot_slug: "graft_tray_overview",
  } as const;

  it("buildPatientImageIngestionRequest matches for flat and parsed surgery_os", () => {
    const parsed = parsePatientImageIngestionContext(surgeryFlat);
    const fromFlat = buildPatientImageIngestionRequest(surgeryFlat);
    const fromParsed = buildPatientImageIngestionRequest(parsed);
    assert.deepEqual(fromParsed, fromFlat);
  });

  it("runUnifiedPatientImageIngest output unchanged for representative surgery_os input", () => {
    const parsed = parsePatientImageIngestionContext(surgeryFlat);
    const fromFlat = runUnifiedPatientImageIngest(surgeryFlat);
    const fromParsed = runUnifiedPatientImageIngest(parsed);
    assert.deepEqual(fromParsed, fromFlat);
    assert.equal(
      fromFlat.imaging_os_ingest.pipeline_version,
      IMAGING_OS_INGESTION_PIPELINE_VERSION
    );
    assert.equal(fromFlat.imaging_os_ingest.source_system, "surgery_os");
    assert.equal(fromFlat.imaging_session.session_type, "surgery_day");
    assert.equal(fromFlat.imaging_session.view, "graft_tray_overview");
  });

  it("runUnifiedPatientImageIngest unchanged for imaging_os_wizard baseline", () => {
    const flat = {
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "imaging_os_wizard",
      protocol_template_slug: "baseline_consultation",
      protocol_slot_slug: "bc_front",
      external_category: "front",
    };
    const parsed = parsePatientImageIngestionContext(flat);
    assert.deepEqual(runUnifiedPatientImageIngest(parsed), runUnifiedPatientImageIngest(flat));
    const result = runUnifiedPatientImageIngest(flat);
    assert.equal(result.canonical_view, result.imaging_os_ingest.canonical_photo_category);
  });
});
