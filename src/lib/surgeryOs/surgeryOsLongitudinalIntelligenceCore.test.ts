import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSurgeryOsLongitudinalSurfacing } from "./surgeryOsLongitudinalIntelligenceCore";
import type { SurgeryOsVieCaptureSummary } from "./surgeryOsVieCapture.types";

const baseCapture: SurgeryOsVieCaptureSummary = {
  surgeryId: "surgery-1",
  patientId: "patient-1",
  patientLabel: "Test",
  caseId: "case-1",
  bookingId: null,
  procedureDayId: null,
  sessionId: "session-1",
  protocolSlug: "surgery_day",
  surgicalDocumentationPercent: 40,
  donorDocumentationPercent: 30,
  graftTrayStatus: "pending_review",
  immediatePostOpStatus: "missing",
  phases: [
    {
      phase: "extraction",
      label: "Extraction",
      requiredTotal: 2,
      acceptedCount: 1,
      pendingReviewCount: 1,
      latestQualityScore: 70,
      nextRecommendedSlot: "donor_final_extraction",
      nextRecommendedSlotLabel: "Donor final",
    },
    {
      phase: "graft_handling",
      label: "Graft handling",
      requiredTotal: 2,
      acceptedCount: 0,
      pendingReviewCount: 0,
      latestQualityScore: null,
      nextRecommendedSlot: "graft_tray_overview",
      nextRecommendedSlotLabel: "Graft tray",
    },
  ],
  warnings: [],
  nextRecommendedSlot: "graft_tray_overview",
  nextRecommendedSlotLabel: "Graft tray",
  comparisonStatus: {
    donor_extraction_pair: "partial",
    graft_tray_pair: "missing",
    immediate_post_op_pair: "missing",
  },
  outcomeReadiness: null,
};

describe("surgeryOsLongitudinalIntelligenceCore", () => {
  it("builds longitudinal surfacing with review and twin links", () => {
    const surfacing = buildSurgeryOsLongitudinalSurfacing({
      tenantId: "tenant-1",
      capture: baseCapture,
    });
    assert.ok(surfacing.review_queue_href.includes("/imaging/review"));
    assert.ok(surfacing.patient_twin_href.includes("/twin"));
    assert.ok(surfacing.imaging_gallery_href.includes("/patients/patient-1"));
    assert.equal(surfacing.pending_review_count, 1);
    assert.ok(surfacing.slots.length >= 2);
    assert.ok(surfacing.deep_links.length > 0);
  });

  it("flags staff review when pending review phases exist", () => {
    const surfacing = buildSurgeryOsLongitudinalSurfacing({
      tenantId: "tenant-1",
      capture: baseCapture,
    });
    assert.equal(surfacing.staff_review_required, true);
  });
});