import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapSurgeryCaseIntelligenceFacts,
  SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
  type SurgeryCaseFactsInput,
} from "./surgeryCaseFactsCore";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const CASE = "22222222-2222-4222-8222-222222222222";
const SURGERY = "44444444-4444-4444-8444-444444444444";
const BOOKING = "55555555-5555-4555-8555-555555555555";
const LINK = "66666666-6666-4666-8666-666666666666";
const IMAGE = "77777777-7777-4777-8777-777777777777";
const ESTIMATE = "88888888-8888-4888-8888-888888888888";
const REVIEWED_AT = "2026-07-04T12:05:00.000Z";

function baseInput(overrides: Partial<SurgeryCaseFactsInput> = {}): SurgeryCaseFactsInput {
  return {
    tenantId: TENANT,
    patientId: PATIENT,
    caseId: CASE,
    surgeryId: SURGERY,
    bookingId: BOOKING,
    procedureDate: "2026-07-04",
    surgeonFiUserId: "staff-surgeon",
    teamFiUserIds: ["staff-1", "staff-2"],
    surgeryStatus: "in_progress",
    procedurePhase: "extraction",
    liveStatus: "active",
    graftSessionId: "99999999-9999-4999-8999-999999999999",
    targetGrafts: 3000,
    extractedGrafts: 1200,
    implantedGrafts: 0,
    discardedGrafts: 0,
    remainingGrafts: 1200,
    reconciliationStatus: "pending",
    graftSessionPhase: "extraction",
    reconciledAt: null,
    confirmedTrayGrafts: 120,
    trayImageLinks: [],
    graftTrayIntelligence: null,
    ...overrides,
  };
}

function reviewedAiLink() {
  return {
    linkId: LINK,
    imageId: IMAGE,
    intelligenceSummary: {
      estimateId: ESTIMATE,
      graftTrayLinkId: LINK,
      hasFinalCount: true,
      finalAcceptedCount: 120,
      originalAiEstimate: 120,
      manualCount: 118,
      mismatchBand: "within_tolerance",
      confidenceBand: "high",
      imageQuality: "suitable",
      reviewerId: "staff-1",
      reviewerLabel: "Reviewer One",
      reviewedAt: REVIEWED_AT,
      finalCountSource: "ai" as const,
      supersededStaleJob: false,
      reviewStatus: "accepted_ai",
    },
  };
}

describe("mapSurgeryCaseIntelligenceFacts", () => {
  it("reviewed AI count produces case facts", () => {
    const facts = mapSurgeryCaseIntelligenceFacts(
      baseInput({
        trayImageLinks: [reviewedAiLink()],
        graftTrayIntelligence: {
          reviewedTrayCount: 1,
          pendingReviewCount: 0,
          supersededStaleCount: 0,
          totalFinalAcceptedGrafts: 120,
          hasSupersededStaleEstimate: false,
        },
      })
    );

    assert.ok(facts);
    assert.equal(facts.facts_version, SURGERY_CASE_INTELLIGENCE_FACTS_VERSION);
    assert.equal(facts.tenant_id, TENANT);
    assert.equal(facts.patient_id, PATIENT);
    assert.equal(facts.case_id, CASE);
    assert.equal(facts.surgery_id, SURGERY);
    assert.equal(facts.booking_id, BOOKING);
    assert.equal(facts.procedure_date, "2026-07-04");
    assert.equal(facts.final_reviewed_graft_count, 120);
    assert.equal(facts.graft_tray_ai_estimate, 120);
    assert.equal(facts.graft_tray_manual_count, 118);
    assert.equal(facts.graft_count_source, "ai");
    assert.equal(facts.has_final_graft_count, true);
    assert.equal(facts.graft_tray_review_pending, false);
    assert.equal(facts.reviewer_label, "Reviewer One");
    assert.equal(facts.extracted_grafts, 1200);
    assert.deepEqual(facts.graft_tray_image_ids, [IMAGE]);
    assert.equal(facts.graft_tray_outcome_facts.length, 1);
  });

  it("manual/override count produces case facts", () => {
    const facts = mapSurgeryCaseIntelligenceFacts(
      baseInput({
        trayImageLinks: [
          {
            linkId: LINK,
            imageId: IMAGE,
            intelligenceSummary: {
              estimateId: ESTIMATE,
              graftTrayLinkId: LINK,
              hasFinalCount: true,
              finalAcceptedCount: 119,
              originalAiEstimate: 120,
              manualCount: 118,
              mismatchBand: "minor_mismatch",
              confidenceBand: "medium",
              imageQuality: "marginal",
              reviewerId: "staff-1",
              reviewerLabel: null,
              reviewedAt: REVIEWED_AT,
              finalCountSource: "override",
              supersededStaleJob: false,
              reviewStatus: "corrected",
            },
          },
        ],
        graftTrayIntelligence: {
          reviewedTrayCount: 1,
          pendingReviewCount: 0,
          supersededStaleCount: 0,
          totalFinalAcceptedGrafts: 119,
          hasSupersededStaleEstimate: false,
        },
      })
    );

    assert.ok(facts);
    assert.equal(facts.final_reviewed_graft_count, 119);
    assert.equal(facts.graft_count_source, "override");
    assert.equal(facts.mismatch_band, "minor_mismatch");
  });

  it("pending review produces no final graft count", () => {
    const facts = mapSurgeryCaseIntelligenceFacts(
      baseInput({
        trayImageLinks: [
          {
            linkId: LINK,
            imageId: IMAGE,
            intelligenceSummary: {
              estimateId: ESTIMATE,
              graftTrayLinkId: LINK,
              hasFinalCount: false,
              finalAcceptedCount: null,
              originalAiEstimate: 120,
              manualCount: 118,
              mismatchBand: "within_tolerance",
              confidenceBand: "high",
              imageQuality: "suitable",
              reviewerId: null,
              reviewerLabel: null,
              reviewedAt: null,
              finalCountSource: null,
              supersededStaleJob: false,
              reviewStatus: "pending_review",
            },
          },
        ],
        graftTrayIntelligence: {
          reviewedTrayCount: 0,
          pendingReviewCount: 1,
          supersededStaleCount: 0,
          totalFinalAcceptedGrafts: null,
          hasSupersededStaleEstimate: false,
        },
      })
    );

    assert.ok(facts);
    assert.equal(facts.has_final_graft_count, false);
    assert.equal(facts.final_reviewed_graft_count, null);
    assert.equal(facts.graft_count_source, null);
    assert.equal(facts.graft_tray_review_pending, true);
    assert.equal(facts.graft_tray_outcome_facts.length, 0);
  });

  it("superseded estimate excluded from final count", () => {
    const facts = mapSurgeryCaseIntelligenceFacts(
      baseInput({
        trayImageLinks: [
          {
            linkId: LINK,
            imageId: IMAGE,
            intelligenceSummary: {
              estimateId: ESTIMATE,
              graftTrayLinkId: LINK,
              hasFinalCount: false,
              finalAcceptedCount: null,
              originalAiEstimate: null,
              manualCount: 118,
              mismatchBand: "within_tolerance",
              confidenceBand: "high",
              imageQuality: "suitable",
              reviewerId: null,
              reviewerLabel: null,
              reviewedAt: null,
              finalCountSource: null,
              supersededStaleJob: true,
              reviewStatus: "accepted_ai",
            },
          },
        ],
        graftTrayIntelligence: {
          reviewedTrayCount: 0,
          pendingReviewCount: 0,
          supersededStaleCount: 1,
          totalFinalAcceptedGrafts: null,
          hasSupersededStaleEstimate: true,
        },
      })
    );

    assert.ok(facts);
    assert.equal(facts.has_final_graft_count, false);
    assert.equal(facts.superseded_stale_estimate, true);
    assert.equal(facts.graft_tray_links[0]?.ai_estimate, null);
    assert.equal(facts.graft_tray_outcome_facts.length, 0);
  });

  it("facts_version present and stable", () => {
    const facts = mapSurgeryCaseIntelligenceFacts(
      baseInput({
        trayImageLinks: [reviewedAiLink()],
        graftTrayIntelligence: {
          reviewedTrayCount: 1,
          pendingReviewCount: 0,
          supersededStaleCount: 0,
          totalFinalAcceptedGrafts: 120,
          hasSupersededStaleEstimate: false,
        },
      })
    );
    assert.ok(facts);
    assert.equal(facts.facts_version, "surgery_case_intelligence_facts_v1");
  });

  it("missing optional surgery/team data handled safely", () => {
    const facts = mapSurgeryCaseIntelligenceFacts(
      baseInput({
        patientId: null,
        caseId: null,
        bookingId: null,
        procedureDate: null,
        surgeonFiUserId: null,
        teamFiUserIds: undefined,
        surgeryStatus: null,
        procedurePhase: null,
        liveStatus: null,
        graftSessionId: null,
        trayImageLinks: [reviewedAiLink()],
        graftTrayIntelligence: {
          reviewedTrayCount: 1,
          pendingReviewCount: 0,
          supersededStaleCount: 0,
          totalFinalAcceptedGrafts: 120,
          hasSupersededStaleEstimate: false,
        },
      })
    );

    assert.ok(facts);
    assert.equal(facts.patient_id, null);
    assert.equal(facts.case_id, null);
    assert.equal(facts.booking_id, null);
    assert.equal(facts.procedure_date, null);
    assert.equal(facts.surgeon_fi_user_id, null);
    assert.deepEqual(facts.team_fi_user_ids, []);
    assert.equal(facts.graft_session_id, null);
  });

  it("returns null when no graft tray or session context exists", () => {
    const facts = mapSurgeryCaseIntelligenceFacts(
      baseInput({
        graftSessionId: null,
        trayImageLinks: [],
        graftTrayIntelligence: null,
        surgeryStatus: "scheduled",
        reconciliationStatus: "pending",
      })
    );
    assert.equal(facts, null);
  });
});