import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveHairAuditLinkForSurgery } from "./hairAuditLinkCore";
import {
  buildLongitudinalOutcomeComparison,
  formatLongitudinalComparisonReadinessLabel,
} from "./longitudinalOutcomeComparisonCore";
import {
  mapSurgeryCaseIntelligenceFacts,
  type SurgeryCaseFactsInput,
} from "./surgeryCaseFactsCore";
import { validateSurgeryCaseIntelligenceFactsForPublish } from "./surgeryCaseFactsPublisherCore";
import { surgeryCaseIntelligenceFactsSchema } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const CASE = "22222222-2222-4222-8222-222222222222";
const SURGERY = "44444444-4444-4444-8444-444444444444";
const LEGACY_HAIRAUDIT = "66666666-6666-4666-8666-666666666666";
const REPORT = "77777777-7777-4777-8777-777777777777";
const REFERENCE_DATE = "2026-07-05T12:00:00.000Z";

const IMG_BASELINE_FRONT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01";
const IMG_BASELINE_TOP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02";
const IMG_DONOR_BASELINE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03";
const IMG_RECIPIENT_BASELINE_FRONT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04";
const IMG_RECIPIENT_BASELINE_TOP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05";
const IMG_IMMEDIATE_FRONT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06";
const IMG_IMMEDIATE_TOP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07";
const IMG_FOLLOWUP_FRONT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08";
const IMG_FOLLOWUP_TOP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09";
const IMG_FOLLOWUP_DONOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10";

function image(
  id: string,
  overrides: Record<string, string | boolean | null | undefined> = {}
) {
  return {
    imageId: id,
    canonicalCategory: overrides.canonicalCategory as string | undefined,
    surgicalEvent: overrides.surgicalEvent as string | undefined,
    procedureStage: overrides.procedureStage as string | undefined,
    imageCategory: overrides.imageCategory as string | undefined,
    anatomicalRegion: overrides.anatomicalRegion as string | undefined,
    visitType: overrides.visitType as string | undefined,
    followUpInterval: overrides.followUpInterval as string | undefined,
    qualityStatus: overrides.qualityStatus as string | undefined,
    isClinicallyUsable: overrides.isClinicallyUsable as boolean | null | undefined,
    capturedAt: overrides.capturedAt as string | undefined,
  };
}

function completeLongitudinalSet(window: "month_12" | "month_6" = "month_12") {
  const interval = window === "month_12" ? "month_12" : "month_6";
  return [
    image(IMG_BASELINE_FRONT, {
      surgicalEvent: "pre_op",
      canonicalCategory: "front",
      qualityStatus: "acceptable",
    }),
    image(IMG_BASELINE_TOP, {
      surgicalEvent: "pre_op",
      canonicalCategory: "top",
      qualityStatus: "acceptable",
    }),
    image(IMG_DONOR_BASELINE, {
      surgicalEvent: "donor_mapping",
      canonicalCategory: "donor",
      qualityStatus: "acceptable",
    }),
    image(IMG_RECIPIENT_BASELINE_FRONT, {
      surgicalEvent: "recipient_design",
      canonicalCategory: "front",
      qualityStatus: "acceptable",
    }),
    image(IMG_RECIPIENT_BASELINE_TOP, {
      surgicalEvent: "recipient_design",
      canonicalCategory: "top",
      qualityStatus: "acceptable",
    }),
    image(IMG_IMMEDIATE_FRONT, {
      surgicalEvent: "immediate_post_op",
      canonicalCategory: "front",
      qualityStatus: "acceptable",
    }),
    image(IMG_IMMEDIATE_TOP, {
      surgicalEvent: "immediate_post_op",
      canonicalCategory: "top",
      qualityStatus: "acceptable",
    }),
    image(IMG_FOLLOWUP_FRONT, {
      surgicalEvent: "month_12_outcome",
      canonicalCategory: "front",
      followUpInterval: interval,
      qualityStatus: "acceptable",
      capturedAt: "2026-07-01T10:00:00.000Z",
    }),
    image(IMG_FOLLOWUP_TOP, {
      surgicalEvent: "month_12_outcome",
      canonicalCategory: "top",
      followUpInterval: interval,
      qualityStatus: "acceptable",
      capturedAt: "2026-07-01T10:00:00.000Z",
    }),
    image(IMG_FOLLOWUP_DONOR, {
      surgicalEvent: "month_12_outcome",
      canonicalCategory: "donor",
      followUpInterval: interval,
      qualityStatus: "acceptable",
      capturedAt: "2026-07-01T10:00:00.000Z",
    }),
  ];
}

function baseFactsInput(overrides: Partial<SurgeryCaseFactsInput> = {}): SurgeryCaseFactsInput {
  return {
    tenantId: TENANT,
    patientId: PATIENT,
    caseId: CASE,
    surgeryId: SURGERY,
    bookingId: null,
    procedureDate: "2025-07-01",
    surgeonFiUserId: null,
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
    trayImageLinks: [
      {
        linkId: "66666666-6666-4666-8666-666666666666",
        imageId: "88888888-8888-4888-8888-888888888888",
        intelligenceSummary: {
          estimateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          graftTrayLinkId: "66666666-6666-4666-8666-666666666666",
          hasFinalCount: true,
          finalAcceptedCount: 120,
          originalAiEstimate: 120,
          manualCount: 118,
          mismatchBand: "within_tolerance",
          confidenceBand: "high",
          imageQuality: "suitable",
          reviewerId: "staff-1",
          reviewerLabel: "Reviewer One",
          reviewedAt: "2026-07-04T12:05:00.000Z",
          finalCountSource: "ai",
          supersededStaleJob: false,
          reviewStatus: "accepted_ai",
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
    ...overrides,
  };
}

describe("longitudinalOutcomeComparisonCore", () => {
  it("complete baseline + follow-up is comparison-ready", () => {
    const comparison = buildLongitudinalOutcomeComparison({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseId: CASE,
      patientId: PATIENT,
      procedureDate: "2025-07-01",
      images: completeLongitudinalSet(),
      hairAuditLink: {
        tenantId: TENANT,
        surgeryId: SURGERY,
        caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT, report_id: REPORT },
      },
      referenceDate: REFERENCE_DATE,
    });

    assert.equal(comparison.comparison_readiness.ready_for_comparison, true);
    assert.equal(comparison.comparison_readiness.outcome_measured, true);
    assert.equal(formatLongitudinalComparisonReadinessLabel(comparison.comparison_readiness), "Outcome measured");
    assert.equal(comparison.before_after_ready, true);
    assert.equal(comparison.active_follow_up_window, "month_12");
  });

  it("missing donor follow-up blocks donor recovery readiness", () => {
    const comparison = buildLongitudinalOutcomeComparison({
      tenantId: TENANT,
      surgeryId: SURGERY,
      procedureDate: "2025-07-01",
      images: completeLongitudinalSet().filter((entry) => entry.imageId !== IMG_FOLLOWUP_DONOR),
      referenceDate: REFERENCE_DATE,
    });

    assert.equal(comparison.donor_recovery_evidence_status, "blocked_missing_evidence");
    assert.ok(comparison.missing_outcome_evidence.includes("donor_follow_up"));
  });

  it("poor-quality follow-up blocks outcome measurement", () => {
    const comparison = buildLongitudinalOutcomeComparison({
      tenantId: TENANT,
      surgeryId: SURGERY,
      procedureDate: "2025-07-01",
      images: completeLongitudinalSet().map((entry) =>
        entry.imageId === IMG_FOLLOWUP_TOP
          ? { ...entry, qualityStatus: "poor", isClinicallyUsable: false }
          : entry
      ),
      referenceDate: REFERENCE_DATE,
    });

    assert.equal(comparison.comparison_readiness.outcome_measured, false);
    assert.equal(comparison.comparison_readiness.ready_for_comparison, false);
    assert.ok(
      comparison.missing_outcome_evidence.includes("follow_up_comparison_views") ||
        comparison.missing_outcome_evidence.includes("follow_up_poor_quality")
    );
  });

  it("12-month follow-up marks outcome report ready when HairAudit link resolves", () => {
    const comparison = buildLongitudinalOutcomeComparison({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseId: CASE,
      procedureDate: "2025-07-01",
      images: completeLongitudinalSet("month_12"),
      hairAuditLink: {
        tenantId: TENANT,
        surgeryId: SURGERY,
        caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT, report_id: REPORT },
      },
      referenceDate: REFERENCE_DATE,
    });

    assert.equal(comparison.hairaudit_report_ready, true);
    assert.equal(comparison.hairaudit_case_id, LEGACY_HAIRAUDIT);
    assert.equal(comparison.hairaudit_report_id, REPORT);
  });

  it("legacy HairAudit report links still resolve", () => {
    const resolution = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT, report_id: REPORT },
    });
    assert.equal(resolution.hairaudit_case_id, LEGACY_HAIRAUDIT);
    assert.equal(resolution.fi_report_id, REPORT);
    assert.equal(resolution.hrefs.audit_report_href, `/fi-admin/${TENANT}/audit/${REPORT}`);
  });

  it("includes longitudinal_outcome_summary in published surgery case facts", () => {
    const facts = mapSurgeryCaseIntelligenceFacts(
      baseFactsInput({
        imagingImages: completeLongitudinalSet(),
        hairAuditLink: {
          tenantId: TENANT,
          surgeryId: SURGERY,
          caseId: CASE,
          caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT, report_id: REPORT },
        },
      })
    );

    assert.ok(facts);
    assert.ok(facts.longitudinal_outcome_summary);
    assert.equal(facts.before_after_ready, true);
    assert.equal(facts.donor_recovery_ready, true);
    assert.equal(facts.recipient_growth_ready, true);
    assert.equal(facts.follow_up_window_status.length, 5);
    validateSurgeryCaseIntelligenceFactsForPublish(facts);
  });

  it("older facts without longitudinal_outcome_summary still parse", () => {
    const legacyPayload = {
      facts_version: "surgery_case_intelligence_facts_v1",
      tenant_id: TENANT,
      patient_id: PATIENT,
      case_id: CASE,
      surgery_id: SURGERY,
      booking_id: null,
      procedure_date: "2026-07-04",
      final_reviewed_graft_count: 120,
      graft_tray_ai_estimate: 120,
      graft_tray_manual_count: 118,
      graft_count_source: "ai",
      mismatch_band: "within_tolerance",
      confidence_band: "high",
      image_quality: "suitable",
      reviewer_id: null,
      reviewer_label: null,
      reviewed_at: null,
      has_final_graft_count: true,
      graft_tray_review_pending: false,
      superseded_stale_estimate: false,
      graft_session_id: null,
      target_grafts: 3000,
      extracted_grafts: 1200,
      implanted_grafts: 0,
      discarded_grafts: 0,
      remaining_grafts: 1200,
      reconciliation_status: "pending",
      graft_session_phase: "extraction",
      reconciled_at: null,
      confirmed_tray_grafts: 120,
      surgery_status: "completed",
      procedure_phase: "complete",
      live_status: "idle",
      surgeon_fi_user_id: null,
      team_fi_user_ids: [],
      graft_tray_image_ids: [],
      graft_tray_link_ids: [],
      graft_tray_links: [],
      graft_tray_outcome_facts: [],
      confidence_level: "high",
      imaging_intelligence_summary: null,
    };

    const parsed = surgeryCaseIntelligenceFactsSchema.parse(legacyPayload);
    assert.equal(parsed.longitudinal_outcome_summary, null);
    assert.equal(parsed.before_after_ready, false);
    assert.deepEqual(parsed.follow_up_window_status, []);
    assert.deepEqual(parsed.missing_outcome_evidence, []);
  });
});