import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildConsultationOsImageIngestionRequest,
  buildFollowUpOutcomeImageIngestionRequest,
  buildHairauditImageIngestionRequest,
  buildIiohrImageIngestionRequest,
  buildPatientPortalImageIngestionRequest,
  buildSurgeryOsImageIngestionRequest,
  IMAGING_OS_INGESTION_PIPELINE_VERSION,
} from "@/src/lib/imaging-os";
import { buildPatientImageIngestionRequest } from "./buildPatientImageIngestionRequest";
import { buildUnifiedIngestMetadataPatch, runUnifiedPatientImageIngest } from "./runUnifiedPatientImageIngest";
import { buildImagingSessionTaxonomy } from "./sessionTaxonomy";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const CASE = "22222222-2222-4222-8222-222222222222";
const IMAGE = "55555555-5555-4555-8555-555555555555";
const CONSULTATION = "66666666-6666-4666-8666-666666666666";
const STORAGE_PATH = `tenants/${TENANT}/patients/${PATIENT}/images/${IMAGE}/front.jpg`;

describe("imaging-core unified ingest routing", () => {
  it("routes surgery_os to surgery adapter", () => {
    const request = buildPatientImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      case_id: CASE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "surgery_os",
      protocol_template_slug: "surgery_day",
      protocol_slot_slug: "graft_tray_overview",
    });
    assert.equal(request.source_system, "surgery_os");
    assert.equal(request.upload_surface, "surgery_workflow");
    assert.equal(request.external_category, "graft_tray_overview");
  });

  it("routes follow_up_outcome to follow-up adapter", () => {
    const request = buildPatientImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "follow_up_outcome",
      protocol_template_slug: "follow_up_review",
      protocol_slot_slug: "fu_front",
      follow_up_interval: "6_month",
    });
    assert.equal(request.upload_surface, "fi_guided_protocol");
    assert.equal(request.metadata?.capture_source, "follow_up_outcome");
  });

  it("routes vie_capture_wizard + follow_up_review template to follow-up adapter", () => {
    const request = buildPatientImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "vie_capture_wizard",
      protocol_template_slug: "follow_up_review",
      protocol_slot_slug: "fu_top",
    });
    assert.equal(request.upload_surface, "fi_guided_protocol");
    assert.equal(request.metadata?.protocol_template_slug, "follow_up_review");
  });

  it("routes consultation_id to consultation adapter", () => {
    const request = buildPatientImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      consultation_id: CONSULTATION,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "consultation_os",
    });
    assert.equal(request.source_system, "consultation_os");
    assert.equal(request.upload_surface, "consultation_form");
  });

  it("routes patient_portal to patient upload adapter", () => {
    const request = buildPatientImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "patient_portal",
    });
    assert.equal(request.source_system, "patient_upload");
    assert.equal(request.upload_surface, "patient_portal");
  });

  it("routes hairaudit upload_source to hairaudit adapter", () => {
    const request = buildPatientImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      case_id: CASE,
      storage_bucket: "case-files",
      storage_path: `cases/${CASE}/front.jpg`,
      upload_source: "hairaudit",
      hairaudit_image_type: "frontal",
    });
    assert.equal(request.source_system, "hairaudit");
    assert.equal(request.upload_surface, "audit_upload");
    assert.equal(request.external_category, "frontal");
  });

  it("routes hair_longevity upload_source to hli adapter", () => {
    const request = buildPatientImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "case-files",
      storage_path: `cases/${CASE}/scalp.jpg`,
      upload_source: "hair_longevity",
      hli_document_kind: "supporting_docs",
    });
    assert.equal(request.source_system, "hli");
    assert.equal(request.upload_surface, "internal_api");
  });

  it("routes iiohr_academy to iiohr adapter", () => {
    const request = buildPatientImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      case_id: CASE,
      storage_bucket: "case-files",
      storage_path: `academy/${CASE}/donor.jpg`,
      capture_source: "iiohr_academy",
      external_category: "donor_rear",
    });
    assert.equal(request.source_system, "iiohr");
    assert.equal(request.upload_surface, "iiohr_portal");
  });
});

describe("runUnifiedPatientImageIngest", () => {
  it("produces imaging_os_ingest and imaging_session metadata blocks", () => {
    const result = runUnifiedPatientImageIngest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "surgery_os",
      protocol_template_slug: "surgery_day",
      protocol_slot_slug: "graft_tray_overview",
    });
    assert.equal(result.imaging_os_ingest.pipeline_version, IMAGING_OS_INGESTION_PIPELINE_VERSION);
    assert.equal(result.imaging_os_ingest.source_system, "surgery_os");
    assert.ok(result.imaging_os_ingest.canonical_photo_category);
    assert.equal(result.imaging_session.session_type, "surgery_day");
    assert.equal(result.imaging_session.view, "graft_tray_overview");
    assert.equal(result.imaging_session.protocol_version, "surgery_day");
  });

  it("buildUnifiedIngestMetadataPatch includes canonical_view", () => {
    const patch = buildUnifiedIngestMetadataPatch({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "imaging_os_wizard",
      protocol_template_slug: "baseline_consultation",
      protocol_slot_slug: "bc_front",
      external_category: "front",
    });
    assert.ok(patch.imaging_os_ingest);
    assert.ok(patch.imaging_session);
    assert.equal(patch.canonical_view, "front");
  });
});

describe("imaging-core session taxonomy", () => {
  it("classifies follow-up sessions", () => {
    const taxonomy = buildImagingSessionTaxonomy({
      capture_source: "follow_up_outcome",
      protocol_template_slug: "follow_up_review",
      protocol_slot_slug: "fu_front",
      follow_up_interval: "12_month",
    });
    assert.equal(taxonomy.session_type, "follow_up");
    assert.equal(taxonomy.interval, "12_month");
  });

  it("classifies hairaudit dual-write sessions", () => {
    const taxonomy = buildImagingSessionTaxonomy({
      upload_source: "hairaudit",
      protocol_slot_slug: "frontal",
    });
    assert.equal(taxonomy.session_type, "audit");
  });
});

describe("imaging-os Phase 1 adapters", () => {
  it("buildConsultationOsImageIngestionRequest sets consultation_form surface", () => {
    const request = buildConsultationOsImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      consultation_id: CONSULTATION,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
    });
    assert.equal(request.source_system, "consultation_os");
    assert.equal(request.consultation_id, CONSULTATION);
  });

  it("buildSurgeryOsImageIngestionRequest maps slot slug to external category", () => {
    const request = buildSurgeryOsImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      protocol_slot_slug: "immediate_post_op_front",
    });
    assert.equal(request.external_category, "immediate_post_op_front");
  });

  it("buildFollowUpOutcomeImageIngestionRequest defaults follow_up_review template", () => {
    const request = buildFollowUpOutcomeImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
    });
    assert.equal(request.metadata?.protocol_template_slug, "follow_up_review");
  });

  it("buildPatientPortalImageIngestionRequest marks patient actor", () => {
    const request = buildPatientPortalImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
    });
    assert.equal(request.uploaded_by_actor_type, "patient");
  });

  it("buildIiohrImageIngestionRequest uses iiohr_portal surface", () => {
    const request = buildIiohrImageIngestionRequest({
      case_id: CASE,
      external_image_id: IMAGE,
      storage_bucket: "case-files",
      storage_path: `academy/${CASE}/donor.jpg`,
      external_category: "donor_rear",
    });
    assert.equal(request.source_system, "iiohr");
    assert.equal(request.upload_surface, "iiohr_portal");
  });

  it("buildHairauditImageIngestionRequest preserves legacy upload type in metadata", () => {
    const request = buildHairauditImageIngestionRequest({
      case_id: CASE,
      external_image_id: IMAGE,
      storage_bucket: "case-files",
      storage_path: `cases/${CASE}/front.jpg`,
      external_category: "frontal",
      legacy_upload_type: "scalp_preop_front",
    });
    assert.equal(request.metadata?.legacy_upload_type, "scalp_preop_front");
  });
});