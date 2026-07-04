import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { surgeryCaseIntelligenceFactsSchema } from "./surgeryOsBoardPayloadSchema";
import { buildSurgeryOsCaseIntelligenceFacts } from "./surgeryOsCaseFactsCore";
import type { SurgeryOsGraftSummary } from "./surgeryOsBoardModel.types";

const TENANT = "11111111-1111-4111-8111-111111111111";
const SURGERY = "44444444-4444-4444-8444-444444444444";

function minimalGraftSummary(
  overrides: Partial<SurgeryOsGraftSummary> = {}
): SurgeryOsGraftSummary {
  return {
    surgeryId: SURGERY,
    patientLabel: "Patient",
    sessionId: "99999999-9999-4999-8999-999999999999",
    phase: "extraction",
    phaseLabel: "Extraction",
    targetGrafts: 3000,
    extractedGrafts: 500,
    implantedGrafts: 0,
    discardedGrafts: 0,
    remainingGrafts: 500,
    singles: 100,
    doubles: 200,
    triples: 100,
    multiples: 100,
    totalHairs: 1000,
    averageHairsPerGraft: 2,
    progressPercent: 17,
    reconciliationStatus: "pending",
    reconciliationStatusLabel: "Pending",
    pendingTrayCount: 0,
    confirmedTrayGrafts: 500,
    trayImageCount: 1,
    trayImageLinks: [
      {
        linkId: "66666666-6666-4666-8666-666666666666",
        imageId: "77777777-7777-4777-8777-777777777777",
        capturedAt: "2026-07-04T10:00:00.000Z",
        status: "linked",
        reviewRequired: false,
        imagingHref: null,
        aiEstimate: null,
        intelligenceSummary: {
          estimateId: "88888888-8888-4888-8888-888888888888",
          imageId: "77777777-7777-4777-8777-777777777777",
          graftTrayLinkId: "66666666-6666-4666-8666-666666666666",
          hasFinalCount: true,
          finalAcceptedCount: 120,
          originalAiEstimate: 120,
          manualCount: 118,
          varianceDelta: 2,
          mismatchBand: "within_tolerance",
          confidenceBand: "high",
          imageQuality: "suitable",
          reviewDecision: "accept_ai_estimate",
          reviewStatus: "accepted_ai",
          displayState: "accepted_ai",
          reviewerId: "staff-1",
          reviewerLabel: "Staff",
          reviewedAt: "2026-07-04T12:05:00.000Z",
          finalCountSource: "ai",
          isReadOnly: true,
          supersededStaleJob: false,
          sourceImageHref: null,
          reviewAuditTrail: [],
          warnings: [],
        },
      },
    ],
    graftTrayIntelligence: {
      reviewedTrayCount: 1,
      pendingReviewCount: 0,
      supersededStaleCount: 0,
      totalFinalAcceptedGrafts: 120,
      hasSupersededStaleEstimate: false,
    },
    caseIntelligenceFacts: null,
    reconciledAt: null,
    reconciledByLabel: null,
    sessionLocks: {
      extraction: {
        kind: "extraction",
        deviceId: null,
        heldAt: null,
        heldByFiUserId: null,
        heldByLabel: null,
        isHeldByDevice: false,
        isStale: true,
      },
      implantation: {
        kind: "implantation",
        deviceId: null,
        heldAt: null,
        heldByFiUserId: null,
        heldByLabel: null,
        isHeldByDevice: false,
        isStale: true,
      },
    },
    totals: {
      targetGrafts: 3000,
      extractedGrafts: 500,
      implantedGrafts: 0,
      discardedGrafts: 0,
      remainingGrafts: 500,
      totalHairs: 1000,
      averageHairsPerGraft: 2,
      composition: { singles: 100, doubles: 200, triples: 100, multiples: 100 },
    },
    hrefs: { patient: null, case: null, surgery: null },
    ...overrides,
  };
}

describe("buildSurgeryOsCaseIntelligenceFacts", () => {
  it("builds facts from SurgeryOS graft summary", () => {
    const facts = buildSurgeryOsCaseIntelligenceFacts({
      tenantId: TENANT,
      patientId: "33333333-3333-4333-8333-333333333333",
      caseId: "22222222-2222-4222-8222-222222222222",
      surgeryId: SURGERY,
      bookingId: null,
      procedureDate: "2026-07-04",
      surgeonFiUserId: "staff-surgeon",
      teamFiUserIds: ["staff-1"],
      graftSummary: minimalGraftSummary(),
    });

    assert.ok(facts);
    assert.equal(facts.surgery_id, SURGERY);
    assert.equal(facts.final_reviewed_graft_count, 120);
    assert.equal(facts.extracted_grafts, 500);
    surgeryCaseIntelligenceFactsSchema.parse(facts);
  });
});