import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultPatientVisualSummaryApproval } from "./patientVisualSummaryApprovalCore";
import { buildPatientVisualSummaryReport } from "./patientVisualSummaryReportCore";
import {
  isReportVisibleInPatientPortal,
  redactForbiddenPortalFields,
  sanitizeReportForPatientPortal,
} from "./patientVisualSummaryPortalCore";

describe("patientVisualSummaryPortalCore", () => {
  it("shows approved report in portal", () => {
    const report = buildPatientVisualSummaryReport({
      reportType: "surgery_post_op_summary",
      patientName: "Alex Patient",
      images: [],
      caseMetadata: {
        patient_visual_summary_reports: {
          surgery_post_op_summary: {
            status: "approved",
            approved_by: "staff-1",
            approved_at: "2026-07-01T00:00:00.000Z",
            report_type: "surgery_post_op_summary",
            version: "patient_visual_summary_v1",
          },
        },
      },
    });
    assert.equal(isReportVisibleInPatientPortal(report), true);
  });

  it("hides draft report from portal", () => {
    const report = buildPatientVisualSummaryReport({
      reportType: "surgery_post_op_summary",
      patientName: "Alex Patient",
      images: [],
    });
    assert.equal(isReportVisibleInPatientPortal(report), false);
  });

  it("redacts forbidden fields and staff notes", () => {
    const report = buildPatientVisualSummaryReport({
      reportType: "surgery_post_op_summary",
      patientName: "Alex Patient",
      images: [],
      staffRecord: {
        recipient_zones: [{ zone_id: "zone_1", graft_count: 100, notes: "Internal blend note" }],
      },
      caseMetadata: {
        patient_visual_summary_reports: {
          surgery_post_op_summary: {
            status: "approved",
            approved_by: "staff-1",
            approved_at: "2026-07-01T00:00:00.000Z",
            report_type: "surgery_post_op_summary",
            version: "patient_visual_summary_v1",
            surgery_id: "surg-1",
          },
        },
      },
    });
    const sanitized = sanitizeReportForPatientPortal(report);
    assert.equal(sanitized.graftDistributionZones[0].notes, undefined);
    assert.equal(sanitized.approval.approved_by, null);
    assert.equal(sanitized.approval.surgery_id, null);

    const redacted = redactForbiddenPortalFields(sanitized);
    const zones = redacted.graftDistributionZones as Array<Record<string, unknown>>;
    assert.equal(zones[0].notes, undefined);
    const approval = redacted.approval as Record<string, unknown>;
    assert.equal(approval.approved_by, undefined);
    assert.equal(approval.surgery_id, undefined);
  });

  it("handles missing images safely", () => {
    const report = buildPatientVisualSummaryReport({
      reportType: "surgery_post_op_summary",
      patientName: "No Photos",
      images: [],
      caseMetadata: {
        patient_visual_summary_reports: {
          surgery_post_op_summary: {
            status: "approved",
            approved_by: "staff-1",
            approved_at: "2026-07-01T00:00:00.000Z",
            report_type: "surgery_post_op_summary",
            version: "patient_visual_summary_v1",
          },
        },
      },
    });
    assert.equal(isReportVisibleInPatientPortal(report), true);
    for (const photo of report.photoPanel) {
      assert.equal(photo.preview_signed_url, null);
    }
  });

  it("default approval is not patient visible", () => {
    const draft = defaultPatientVisualSummaryApproval("surgery_post_op_summary");
    assert.equal(draft.status, "draft");
  });
});