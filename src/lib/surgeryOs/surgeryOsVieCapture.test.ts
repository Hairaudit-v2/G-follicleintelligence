import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSlotImageIds, mergeProgressForSlotCapture, slotIsSatisfied } from "@/src/lib/imagingOs/imagingOsProtocol";
import { assertVieProtocolCapturePolicy } from "@/src/lib/vie/vieCapturePolicy.server";
import {
  buildSurgeryOsVieCaptureSummary,
  buildVieSurgeryImageMetadata,
  deriveSurgeryOsVieWarnings,
  slotAccepted,
  slotPending,
} from "@/src/lib/surgeryOs/surgeryOsVieCaptureCore";

const surgeryId = "00000000-0000-4000-8000-000000000101";
const patientId = "00000000-0000-4000-8000-000000000102";
const caseId = "00000000-0000-4000-8000-000000000103";
const bookingId = "00000000-0000-4000-8000-000000000104";
const procedureDayId = "00000000-0000-4000-8000-000000000105";

describe("SurgeryOS VIE capture policy", () => {
  it("blocks generic surgery_os upload without protocol session and slot", () => {
    assert.throws(
      () =>
        assertVieProtocolCapturePolicy({
          captureSource: "surgery_os",
          protocolSessionId: null,
          protocolTemplateSlug: null,
          protocolSlotSlug: null,
        }),
      /active capture protocol/i
    );
  });

  it("allows surgery_os capture with active session and slot", () => {
    assert.doesNotThrow(() =>
      assertVieProtocolCapturePolicy({
        captureSource: "surgery_os",
        protocolSessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        protocolTemplateSlug: "surgery_day",
        protocolSlotSlug: "graft_tray_overview",
      })
    );
  });
});

describe("SurgeryOS VIE capture completeness", () => {
  it("pending captures do not count as complete", () => {
    const progress = {
      __meta__: {
        vie_pending: {
          graft_tray_overview: {
            patient_image_id: "img-pending",
            intelligence_id: "intel-1",
            captured_at: new Date().toISOString(),
            quality_score: 90,
            quality_band: "excellent",
            clinically_usable: true,
          },
        },
      },
    };

    assert.equal(slotAccepted("graft_tray_overview", progress), false);
    assert.equal(slotPending("graft_tray_overview", progress), true);

    const summary = buildSurgeryOsVieCaptureSummary({
      surgeryId,
      patientId,
      patientLabel: "Test Patient",
      caseId,
      bookingId,
      procedureDayId,
      sessionId: null,
      progress,
    });

    assert.equal(summary.graftTrayStatus, "pending_review");
    assert.ok(summary.surgicalDocumentationPercent < 100);
  });

  it("accepted captures update surgical documentation completeness", () => {
    const progress = {
      graft_tray_overview: ["img-1"],
      graft_tray_close: ["img-2"],
      donor_final_extraction: ["img-3"],
      immediate_post_op_front: ["img-4"],
      immediate_post_op_close: ["img-5"],
      __meta__: {
        vie_slot_quality: {
          graft_tray_overview: {
            patient_image_id: "img-1",
            intelligence_id: "intel-1",
            quality_score: 88,
            quality_band: "excellent",
            clinically_usable: true,
            accepted_at: new Date().toISOString(),
          },
        },
      },
    };

    const summary = buildSurgeryOsVieCaptureSummary({
      surgeryId,
      patientId,
      patientLabel: "Test Patient",
      caseId,
      bookingId,
      procedureDayId,
      sessionId: "00000000-0000-4000-8000-000000000106",
      progress,
    });

    assert.equal(summary.graftTrayStatus, "complete");
    assert.ok(summary.surgicalDocumentationPercent > 0);
    assert.ok(summary.donorDocumentationPercent > 0);
  });

  it("retake replace keeps a single surgery slot image id", () => {
    const progress = { graft_tray_overview: ["old-id"] };
    const prev = mergeProgressForSlotCapture.extractPreviousSlotImageIds(progress, "graft_tray_overview");
    assert.deepEqual(prev, ["old-id"]);
    const next = mergeProgressForSlotCapture.apply(progress, "graft_tray_overview", "new-id");
    assert.deepEqual(getSlotImageIds(next, "graft_tray_overview"), ["new-id"]);
    assert.equal(slotIsSatisfied({ slug: "graft_tray_overview", label: "Graft tray", required: true }, next), true);
  });

  it("graft tray slots are surfaced in SurgeryOS status", () => {
    const progress = {
      graft_tray_overview: ["img-1"],
      __meta__: {},
    };

    const summary = buildSurgeryOsVieCaptureSummary({
      surgeryId,
      patientId,
      patientLabel: "Test Patient",
      caseId,
      bookingId,
      procedureDayId,
      sessionId: null,
      progress,
    });

    assert.equal(summary.graftTrayStatus, "partial");
    const warnings = deriveSurgeryOsVieWarnings(progress);
    assert.ok(warnings.some((w) => w.kind === "missing_graft_tray_close"));
  });

  it("builds surgery-context metadata for captured images", () => {
    const meta = buildVieSurgeryImageMetadata({
      caseId,
      bookingId,
      procedureDayId,
      slotSlug: "graft_tray_overview",
    }) as { vie_surgery_context: Record<string, unknown> };

    assert.equal(meta.vie_surgery_context.case_id, caseId);
    assert.equal(meta.vie_surgery_context.booking_id, bookingId);
    assert.equal(meta.vie_surgery_context.procedure_day_id, procedureDayId);
    assert.equal(meta.vie_surgery_context.protocol_slug, "surgery_day");
    assert.equal(meta.vie_surgery_context.slot_slug, "graft_tray_overview");
    assert.equal(meta.vie_surgery_context.capture_surface, "surgery_os");
    assert.equal(meta.vie_surgery_context.surgery_phase, "graft_handling");
  });

  it("surfaces pending low-quality capture warnings", () => {
    const progress = {
      __meta__: {
        vie_pending: {
          donor_final_extraction: {
            patient_image_id: "img-low",
            intelligence_id: "intel-low",
            captured_at: new Date().toISOString(),
            quality_score: 40,
            quality_band: "retake_recommended",
            clinically_usable: false,
          },
        },
      },
    };

    const warnings = deriveSurgeryOsVieWarnings(progress);
    assert.ok(warnings.some((w) => w.kind === "pending_low_quality"));
    assert.equal(
      warnings.some((w) => w.kind === "missing_donor_final_extraction"),
      false
    );
  });

  it("warns when required surgery slots are missing", () => {
    const warnings = deriveSurgeryOsVieWarnings({});
    assert.ok(warnings.some((w) => w.kind === "missing_donor_final_extraction"));
    assert.ok(warnings.some((w) => w.kind === "missing_graft_tray_overview"));
    assert.ok(warnings.some((w) => w.kind === "missing_immediate_post_op"));
  });
});

describe("SurgeryOS VIE session context", () => {
  it("capture action passes booking and case context via metadata builder", () => {
    const meta = buildVieSurgeryImageMetadata({
      caseId,
      bookingId,
      procedureDayId,
      slotSlug: "donor_final_extraction",
    }) as { vie_surgery_context: Record<string, unknown> };

    assert.equal(meta.vie_surgery_context.case_id, caseId);
    assert.equal(meta.vie_surgery_context.booking_id, bookingId);
    assert.equal(meta.vie_surgery_context.surgery_phase, "extraction");
  });
});
