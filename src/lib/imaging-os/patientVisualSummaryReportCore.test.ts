import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PatientImageRow } from "@/src/lib/patientImages/patientImageTypes";
import {
  buildGraftTypeSummary,
  buildPatientVisualSummaryReport,
  buildRecipientZones,
  buildDensityZones,
  HEALING_TIMELINE_MILESTONES,
  patientSafeReportTextIsAllowed,
  patientVisualSummaryReportIsPatientSafe,
} from "./patientVisualSummaryReportCore";
import { PATIENT_VISUAL_SUMMARY_NOT_RECORDED } from "./patientVisualSummaryReportTypes";
import {
  defaultPatientVisualSummaryApproval,
  mergePatientVisualSummaryApprovalMetadata,
  patientVisualSummaryPatientAccessAllowed,
  readPatientVisualSummaryApproval,
} from "./patientVisualSummaryApprovalCore";

function baseImage(overrides: Partial<PatientImageRow> = {}): PatientImageRow {
  return {
    id: "img-1",
    tenant_id: "t-1",
    patient_id: "p-1",
    person_id: null,
    case_id: "case-1",
    booking_id: null,
    lead_id: null,
    consultation_id: null,
    form_instance_id: null,
    image_category: "post_op",
    image_status: "active",
    patient_portal_release_status: "held",
    portal_released_at: null,
    portal_released_by_fi_user_id: null,
    imaging_library_axis: "surgery",
    clinic_id: null,
    captured_by_staff_id: null,
    device_type: null,
    anatomical_region: null,
    visit_type: null,
    follow_up_interval: null,
    imaging_protocol_template_slug: null,
    imaging_protocol_slot_slug: null,
    storage_bucket: "case-files",
    storage_path: "path/img.jpg",
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

describe("patientVisualSummaryReportCore", () => {
  it("does not invent missing graft data", () => {
    const summary = buildGraftTypeSummary({ composition: null });
    assert.equal(summary.singles, PATIENT_VISUAL_SUMMARY_NOT_RECORDED);
    assert.equal(summary.doubles, PATIENT_VISUAL_SUMMARY_NOT_RECORDED);
    assert.equal(summary.triples, PATIENT_VISUAL_SUMMARY_NOT_RECORDED);
    assert.equal(summary.fourPlusHair, PATIENT_VISUAL_SUMMARY_NOT_RECORDED);
  });

  it("uses SurgeryOS composition when provided", () => {
    const summary = buildGraftTypeSummary({
      composition: { singles: 100, doubles: 200, triples: 50, multiples: 10 },
    });
    assert.equal(summary.singles, 100);
    assert.equal(summary.fourPlusHair, 10);
  });

  it("does not invent per-zone graft counts", () => {
    const zones = buildRecipientZones({ staffRecord: null });
    assert.equal(zones.length, 4);
    for (const z of zones) {
      assert.equal(z.graftCount, undefined);
    }
  });

  it("shows staff-recorded zone graft counts only", () => {
    const zones = buildRecipientZones({
      staffRecord: {
        recipient_zones: [{ zone_id: "zone_1", graft_count: 420 }],
      },
    });
    const z1 = zones.find((z) => z.zoneId === "zone_1");
    assert.equal(z1?.graftCount, 420);
    const z2 = zones.find((z) => z.zoneId === "zone_2");
    assert.equal(z2?.graftCount, undefined);
  });

  it("shows density zones only when staff-recorded", () => {
    assert.deepEqual(buildDensityZones(null), []);
    const zones = buildDensityZones({
      density_zones: [
        { label: "Hairline", qualitative_label: "Higher density zone", grafts_per_cm2: 45 },
      ],
    });
    assert.equal(zones.length, 1);
    assert.equal(zones[0].graftsPerCm2, 45);
  });

  it("builds surgery post-op report without forbidden fields", () => {
    const report = buildPatientVisualSummaryReport({
      reportType: "surgery_post_op_summary",
      patientName: "Alex Patient",
      clinicName: "Test Clinic",
      images: [{ image: baseImage(), previewSignedUrl: "https://signed.example/img" }],
      graftComposition: { singles: 10, doubles: 20, triples: 5, multiples: 2 },
      generatedAt: "2026-07-01T00:00:00.000Z",
    });
    assert.equal(report.reportType, "surgery_post_op_summary");
    assert.equal(report.auditSummary, null);
    assert.ok(patientVisualSummaryReportIsPatientSafe(report));
    assert.equal(report.patientAccessAllowed, false);
  });

  it("builds HairAudit report with audit summary", () => {
    const report = buildPatientVisualSummaryReport({
      reportType: "hairaudit_visual_summary",
      patientName: "Sam Audit",
      images: [
        {
          image: baseImage({
            metadata: {
              upload_source: "hairaudit",
              canonical_view: "front",
              imaging_quality: { quality_status: "pass" },
            },
          }),
        },
      ],
      generatedAt: "2026-07-01T00:00:00.000Z",
    });
    assert.ok(report.auditSummary);
    assert.ok(report.auditSummary!.uploadedViews.includes("front"));
    assert.ok(patientVisualSummaryReportIsPatientSafe(report));
  });

  it("rejects forbidden clinical wording in report text check", () => {
    assert.equal(patientSafeReportTextIsAllowed("Norwood III pattern"), false);
    assert.equal(patientSafeReportTextIsAllowed("confidence 0.92"), false);
    assert.equal(patientSafeReportTextIsAllowed("guaranteed excellent result"), false);
    assert.equal(patientSafeReportTextIsAllowed("soft natural hairline"), true);
  });

  it("handles missing images gracefully", () => {
    const report = buildPatientVisualSummaryReport({
      reportType: "surgery_post_op_summary",
      patientName: "No Photos",
      images: [],
    });
    for (const photo of report.photoPanel) {
      assert.equal(photo.image_id, null);
      assert.equal(photo.status_message, PATIENT_VISUAL_SUMMARY_NOT_RECORDED);
    }
  });

  it("timeline wording is generic and non-guaranteed", () => {
    assert.ok(HEALING_TIMELINE_MILESTONES.every((m) => !/guarantee/i.test(m.label)));
    const report = buildPatientVisualSummaryReport({
      reportType: "surgery_post_op_summary",
      patientName: "Timeline",
      images: [],
    });
    assert.equal(report.timelineVariationNote, "Timelines vary between patients.");
    assert.ok(!report.healingTimeline.some((m) => /guarantee/i.test(m.label)));
  });

  it("requires staff approval for patient access", () => {
    const draft = defaultPatientVisualSummaryApproval("surgery_post_op_summary");
    assert.equal(patientVisualSummaryPatientAccessAllowed(draft), false);

    const meta = mergePatientVisualSummaryApprovalMetadata(
      {},
      {
        ...draft,
        status: "approved",
        approved_by: "user-1",
        approved_at: "2026-07-01T00:00:00.000Z",
      }
    );
    const approved = readPatientVisualSummaryApproval(meta, "surgery_post_op_summary");
    assert.equal(approved?.status, "approved");
    assert.equal(patientVisualSummaryPatientAccessAllowed(approved), true);
  });
});