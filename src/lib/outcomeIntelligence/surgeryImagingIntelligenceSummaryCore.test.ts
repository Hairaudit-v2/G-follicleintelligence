import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSurgeryImagingIntelligenceSummary,
  classifySurgeryImagingGroup,
  formatSurgeryImagingAuditReadinessLabel,
  formatSurgeryImagingCompletenessLabel,
} from "./surgeryImagingIntelligenceSummaryCore";
import {
  mapSurgeryCaseIntelligenceFacts,
  type SurgeryCaseFactsInput,
} from "./surgeryCaseFactsCore";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const CASE = "22222222-2222-4222-8222-222222222222";
const SURGERY = "44444444-4444-4444-8444-444444444444";
const LEGACY_HAIRAUDIT = "66666666-6666-4666-8666-666666666666";
const REFERENCE_DATE = "2026-07-05T12:00:00.000Z";

function image(
  id: string,
  overrides: Partial<Parameters<typeof classifySurgeryImagingGroup>[0]> = {}
) {
  return {
    imageId: id,
    ...overrides,
  };
}

function completeImagingSet() {
  return [
    image("baseline-front", {
      surgicalEvent: "pre_op",
      canonicalCategory: "front",
      qualityStatus: "acceptable",
    }),
    image("baseline-top", {
      surgicalEvent: "pre_op",
      canonicalCategory: "top",
      qualityStatus: "acceptable",
    }),
    image("baseline-crown", {
      surgicalEvent: "pre_op",
      canonicalCategory: "crown",
      qualityStatus: "acceptable",
    }),
    image("donor-1", {
      surgicalEvent: "donor_mapping",
      canonicalCategory: "donor",
      qualityStatus: "acceptable",
    }),
    image("recipient-front", {
      surgicalEvent: "recipient_design",
      canonicalCategory: "front",
      qualityStatus: "acceptable",
    }),
    image("recipient-top", {
      surgicalEvent: "recipient_design",
      canonicalCategory: "top",
      qualityStatus: "acceptable",
    }),
    image("recipient-zone", {
      surgicalEvent: "recipient_design",
      canonicalCategory: "recipient",
      qualityStatus: "acceptable",
    }),
    image("graft-tray-1", {
      surgicalEvent: "graft_tray",
      canonicalCategory: "graft_tray",
      qualityStatus: "acceptable",
    }),
    image("immediate-front", {
      surgicalEvent: "immediate_post_op",
      canonicalCategory: "front",
      qualityStatus: "acceptable",
    }),
    image("immediate-top", {
      surgicalEvent: "immediate_post_op",
      canonicalCategory: "top",
      qualityStatus: "acceptable",
    }),
    image("followup-front", {
      surgicalEvent: "month_12_outcome",
      canonicalCategory: "front",
      qualityStatus: "acceptable",
    }),
    image("followup-top", {
      surgicalEvent: "month_12_outcome",
      canonicalCategory: "top",
      qualityStatus: "acceptable",
    }),
    image("followup-crown", {
      surgicalEvent: "month_12_outcome",
      canonicalCategory: "crown",
      qualityStatus: "acceptable",
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
    procedureDate: "2026-07-04",
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
        imageId: "77777777-7777-4777-8777-777777777777",
        intelligenceSummary: {
          estimateId: "88888888-8888-4888-8888-888888888888",
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

describe("surgeryImagingIntelligenceSummaryCore", () => {
  it("preserves legacy HairAudit link in audit readiness", () => {
    const summary = buildSurgeryImagingIntelligenceSummary({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseId: CASE,
      patientId: PATIENT,
      procedureDate: "2026-07-04",
      images: completeImagingSet(),
      hasReviewedGraftCount: true,
      hairAuditLink: {
        tenantId: TENANT,
        surgeryId: SURGERY,
        caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT },
      },
      referenceDate: REFERENCE_DATE,
    });

    assert.equal(summary.hairaudit_case_id, LEGACY_HAIRAUDIT);
    assert.equal(summary.hairaudit_link_origin, "legacy");
    assert.equal(summary.audit_readiness.hairaudit_link_resolved, true);
    assert.equal(summary.audit_readiness.overall_audit_ready, true);
  });

  it("flags missing imaging sets and required views", () => {
    const summary = buildSurgeryImagingIntelligenceSummary({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseId: CASE,
      patientId: PATIENT,
      procedureDate: "2026-07-04",
      images: [
        image("baseline-front", {
          surgicalEvent: "pre_op",
          canonicalCategory: "front",
          qualityStatus: "acceptable",
        }),
      ],
      hasReviewedGraftCount: false,
      hairAuditLink: {
        tenantId: TENANT,
        surgeryId: SURGERY,
        caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT },
      },
      referenceDate: REFERENCE_DATE,
    });

    const baseline = summary.groups.find((g) => g.group === "baseline_pre_op");
    const donor = summary.groups.find((g) => g.group === "donor");
    assert.ok(baseline);
    assert.equal(baseline.complete, false);
    assert.ok(baseline.missing_required_views.includes("top"));
    assert.ok(donor);
    assert.equal(donor.complete, false);
    assert.ok(summary.missing_required_views.length > 0);
    assert.equal(summary.audit_readiness.donor_set_complete, false);
    assert.equal(summary.audit_readiness.overall_audit_ready, false);
    assert.ok(summary.audit_readiness.missing_requirements.includes("donor_set"));
  });

  it("tracks poor-quality images separately from usable counts", () => {
    const summary = buildSurgeryImagingIntelligenceSummary({
      tenantId: TENANT,
      surgeryId: SURGERY,
      images: [
        image("donor-poor", {
          surgicalEvent: "donor_mapping",
          canonicalCategory: "donor",
          qualityStatus: "poor",
        }),
        image("donor-good", {
          surgicalEvent: "donor_mapping",
          canonicalCategory: "donor",
          qualityStatus: "acceptable",
        }),
      ],
      hasReviewedGraftCount: false,
      referenceDate: REFERENCE_DATE,
    });

    assert.deepEqual(summary.poor_quality_image_ids, ["donor-poor"]);
    const donor = summary.groups.find((g) => g.group === "donor");
    assert.equal(donor?.poor_quality_count, 1);
    assert.equal(donor?.usable_image_count, 1);
  });

  it("marks before/after ready when baseline, immediate post-op, and follow-up are satisfied", () => {
    const recentProcedureSummary = buildSurgeryImagingIntelligenceSummary({
      tenantId: TENANT,
      surgeryId: SURGERY,
      procedureDate: "2026-06-01",
      images: [
        image("baseline-front", {
          surgicalEvent: "pre_op",
          canonicalCategory: "front",
          qualityStatus: "acceptable",
        }),
        image("immediate-front", {
          surgicalEvent: "immediate_post_op",
          canonicalCategory: "front",
          qualityStatus: "acceptable",
        }),
      ],
      hasReviewedGraftCount: true,
      hairAuditLink: {
        tenantId: TENANT,
        surgeryId: SURGERY,
        caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT },
      },
      referenceDate: REFERENCE_DATE,
      followUpDueAfterMonths: 10,
    });

    assert.equal(recentProcedureSummary.audit_readiness.follow_up_captured_or_due, false);
    assert.equal(recentProcedureSummary.audit_readiness.before_after_ready, false);

    const dueFollowUpSummary = buildSurgeryImagingIntelligenceSummary({
      tenantId: TENANT,
      surgeryId: SURGERY,
      procedureDate: "2025-08-01",
      images: [
        image("baseline-front", {
          surgicalEvent: "pre_op",
          canonicalCategory: "front",
          qualityStatus: "acceptable",
        }),
        image("immediate-front", {
          surgicalEvent: "immediate_post_op",
          canonicalCategory: "front",
          qualityStatus: "acceptable",
        }),
      ],
      hasReviewedGraftCount: true,
      hairAuditLink: {
        tenantId: TENANT,
        surgeryId: SURGERY,
        caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT },
      },
      referenceDate: REFERENCE_DATE,
      followUpDueAfterMonths: 10,
    });

    assert.equal(dueFollowUpSummary.audit_readiness.follow_up_captured_or_due, true);
    assert.equal(dueFollowUpSummary.audit_readiness.before_after_ready, true);
    assert.equal(
      formatSurgeryImagingAuditReadinessLabel(dueFollowUpSummary.audit_readiness),
      "Before/after ready"
    );
  });

  it("includes imaging_intelligence_summary in published surgery case facts", () => {
    const facts = mapSurgeryCaseIntelligenceFacts(
      baseFactsInput({
        imagingImages: completeImagingSet(),
        hairAuditLink: {
          tenantId: TENANT,
          surgeryId: SURGERY,
          caseId: CASE,
          caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT },
        },
      })
    );

    assert.ok(facts);
    assert.ok(facts.imaging_intelligence_summary);
    assert.equal(facts.imaging_intelligence_summary.completeness_score, 100);
    assert.equal(facts.imaging_intelligence_summary.hairaudit_case_id, LEGACY_HAIRAUDIT);
    assert.equal(facts.imaging_intelligence_summary.audit_readiness.overall_audit_ready, true);
    assert.equal(formatSurgeryImagingCompletenessLabel(100), "Complete");
  });
});
