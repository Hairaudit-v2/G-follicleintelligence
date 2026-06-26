import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOutcomeCompletenessInput,
  buildVieOutcomeSummary,
  isOutcomeEligiblePair,
  mapComparisonPairToOutcomeInput,
  pairContributesToOutcomeEvidence,
} from "./vieOutcomeIntelligenceCore";
import type { VieOutcomeComparisonInput } from "./vieOutcomeTypes";
import { regenerateVieOutcomeSummaryBestEffort } from "./vieOutcomeIntelligence.server";

const patientId = "00000000-0000-4000-8000-000000000001";

function pair(overrides: Partial<VieOutcomeComparisonInput> & Pick<VieOutcomeComparisonInput, "pair_id">): VieOutcomeComparisonInput {
  return {
    comparison_category: "baseline_vs_follow_up",
    anatomical_region: "hairline",
    slot_family: "front",
    before_timepoint: "baseline",
    after_timepoint: "follow_up_6m",
    quality_match_score: 85,
    confidence_band: "high",
    review_status: "suggested",
    warnings: [],
    recommended_use: ["clinical_review", "patient_progress"],
    alignment_score: 80,
    alignment_status: "acceptable",
    is_standardized_evidence: true,
    ...overrides,
  };
}

const emptyCompleteness = buildOutcomeCompletenessInput({
  consultation_percent: 0,
  donor_documentation_percent: 0,
  surgical_documentation_percent: 0,
  follow_up_progression_coverage: 0,
});

describe("VIE outcome intelligence core", () => {
  it("insufficient evidence produces insufficient_evidence status", () => {
    const summary = buildVieOutcomeSummary({
      patientId,
      pairs: [],
      completeness: emptyCompleteness,
      alignmentConsistencyScore: 0,
    });

    assert.equal(summary.overall_outcome_readiness_score, 0);
    assert.equal(summary.confidence_band, "low");
    assert.equal(summary.audit_ready, false);
    for (const d of summary.domains) {
      if (d.domain === "documentation_readiness") continue;
      if (d.domain === "donor_recovery" || d.domain === "surgical_healing") continue;
      assert.equal(d.status, "insufficient_evidence", d.domain);
    }
  });

  it("high-quality aligned baseline/follow-up pairs improve readiness", () => {
    const summary = buildVieOutcomeSummary({
      patientId,
      pairs: [
        pair({ pair_id: "p1", confidence_band: "high" }),
        pair({
          pair_id: "p2",
          anatomical_region: "crown",
          slot_family: "crown",
          comparison_category: "baseline_vs_follow_up",
        }),
      ],
      completeness: buildOutcomeCompletenessInput({
        consultation_percent: 80,
        donor_documentation_percent: 50,
        surgical_documentation_percent: 50,
        follow_up_progression_coverage: 75,
      }),
      alignmentConsistencyScore: 75,
    });

    assert.ok(summary.overall_outcome_readiness_score >= 50);
    const recipient = summary.domains.find((d) => d.domain === "recipient_growth");
    assert.ok(recipient);
    assert.ok(recipient!.evidence_count >= 1);
    assert.notEqual(recipient!.status, "insufficient_evidence");
  });

  it("low alignment reduces confidence", () => {
    const highAlign = buildVieOutcomeSummary({
      patientId,
      pairs: [pair({ pair_id: "p1", alignment_score: 85, alignment_status: "excellent" })],
      completeness: buildOutcomeCompletenessInput({
        consultation_percent: 70,
        donor_documentation_percent: 60,
        surgical_documentation_percent: 60,
        follow_up_progression_coverage: 50,
      }),
      alignmentConsistencyScore: 85,
    });

    const lowAlign = buildVieOutcomeSummary({
      patientId,
      pairs: [
        pair({
          pair_id: "p1",
          alignment_score: 35,
          alignment_status: "poor",
          confidence_band: "medium",
        }),
      ],
      completeness: buildOutcomeCompletenessInput({
        consultation_percent: 70,
        donor_documentation_percent: 60,
        surgical_documentation_percent: 60,
        follow_up_progression_coverage: 50,
      }),
      alignmentConsistencyScore: 35,
    });

    assert.ok(highAlign.confidence_band !== "low" || highAlign.overall_outcome_readiness_score > lowAlign.overall_outcome_readiness_score);
    assert.equal(lowAlign.confidence_band, "low");
  });

  it("pending/rejected captures excluded via pair eligibility", () => {
    const dismissed = pair({ pair_id: "d1", review_status: "dismissed" });
    const lowConf = pair({ pair_id: "l1", confidence_band: "low", warnings: ["quality issue"] });

    assert.equal(isOutcomeEligiblePair(dismissed), false);
    assert.equal(isOutcomeEligiblePair(lowConf), false);

    const contribution = pairContributesToOutcomeEvidence(dismissed);
    assert.equal(contribution.contributes, false);
  });

  it("clinician-accepted comparison increases readiness", () => {
    const suggested = buildVieOutcomeSummary({
      patientId,
      pairs: [pair({ pair_id: "s1", review_status: "suggested" })],
      completeness: buildOutcomeCompletenessInput({
        consultation_percent: 80,
        donor_documentation_percent: 70,
        surgical_documentation_percent: 70,
        follow_up_progression_coverage: 80,
      }),
      alignmentConsistencyScore: 70,
    });

    const accepted = buildVieOutcomeSummary({
      patientId,
      pairs: [pair({ pair_id: "a1", review_status: "accepted" })],
      completeness: buildOutcomeCompletenessInput({
        consultation_percent: 80,
        donor_documentation_percent: 70,
        surgical_documentation_percent: 70,
        follow_up_progression_coverage: 80,
      }),
      alignmentConsistencyScore: 70,
    });

    const suggestedRecipient = suggested.domains.find((d) => d.domain === "recipient_growth")!;
    const acceptedRecipient = accepted.domains.find((d) => d.domain === "recipient_growth")!;
    assert.ok(acceptedRecipient.score >= suggestedRecipient.score);
  });

  it("donor documentation contributes to donor_recovery domain", () => {
    const summary = buildVieOutcomeSummary({
      patientId,
      pairs: [
        pair({
          pair_id: "donor1",
          comparison_category: "donor_before_vs_after_extraction",
          slot_family: "donor",
          anatomical_region: "donor",
          recommended_use: ["audit_evidence"],
        }),
      ],
      completeness: buildOutcomeCompletenessInput({
        consultation_percent: 50,
        donor_documentation_percent: 90,
        surgical_documentation_percent: 40,
        follow_up_progression_coverage: 30,
      }),
      alignmentConsistencyScore: 60,
    });

    const donor = summary.domains.find((d) => d.domain === "donor_recovery")!;
    assert.ok(donor.score >= 40);
    assert.ok(donor.evidence_count >= 1);
    assert.notEqual(donor.status, "insufficient_evidence");
  });

  it("surgery day documentation contributes to surgical_healing domain", () => {
    const summary = buildVieOutcomeSummary({
      patientId,
      pairs: [
        pair({
          pair_id: "surg1",
          comparison_category: "pre_op_vs_post_op",
          slot_family: "front",
          anatomical_region: "hairline",
        }),
      ],
      completeness: buildOutcomeCompletenessInput({
        consultation_percent: 50,
        donor_documentation_percent: 50,
        surgical_documentation_percent: 85,
        follow_up_progression_coverage: 20,
      }),
      alignmentConsistencyScore: 65,
    });

    const surgical = summary.domains.find((d) => d.domain === "surgical_healing")!;
    assert.ok(surgical.score >= 40);
    assert.notEqual(surgical.status, "insufficient_evidence");
  });

  it("audit_ready only true when required evidence thresholds are met", () => {
    const weak = buildVieOutcomeSummary({
      patientId,
      pairs: [pair({ pair_id: "w1" })],
      completeness: buildOutcomeCompletenessInput({
        consultation_percent: 40,
        donor_documentation_percent: 40,
        surgical_documentation_percent: 40,
        follow_up_progression_coverage: 20,
      }),
      alignmentConsistencyScore: 40,
    });
    assert.equal(weak.audit_ready, false);

    const strong = buildVieOutcomeSummary({
      patientId,
      pairs: [
        pair({
          pair_id: "a1",
          review_status: "accepted",
          comparison_category: "donor_before_vs_after_extraction",
          slot_family: "donor",
          anatomical_region: "donor",
          recommended_use: ["audit_evidence"],
        }),
        pair({
          pair_id: "a2",
          review_status: "accepted",
          comparison_category: "graft_tray_documentation",
          slot_family: "graft_tray",
          anatomical_region: "graft_tray",
          recommended_use: ["audit_evidence"],
        }),
        pair({
          pair_id: "a3",
          review_status: "accepted",
          comparison_category: "pre_op_vs_post_op",
          recommended_use: ["audit_evidence"],
        }),
      ],
      completeness: buildOutcomeCompletenessInput({
        consultation_percent: 90,
        donor_documentation_percent: 90,
        surgical_documentation_percent: 90,
        follow_up_progression_coverage: 80,
      }),
      alignmentConsistencyScore: 85,
    });

    assert.equal(strong.audit_ready, true);
    const auditDomain = strong.domains.find((d) => d.domain === "audit_evidence_quality")!;
    assert.equal(auditDomain.status, "audit_ready");
  });

  it("pair contribution mapping for ImagingOS compare tab", () => {
    const row = mapComparisonPairToOutcomeInput({
      id: "uuid-pair",
      comparison_category: "baseline_vs_follow_up",
      anatomical_region: "hairline",
      slot_family: "front",
      before_timepoint: "baseline",
      after_timepoint: "follow_up_6m",
      quality_match_score: 88,
      confidence_band: "high",
      review_status: "accepted",
      warnings: [],
      recommended_use: ["patient_progress"],
      alignment: {
        alignment_score: 82,
        alignment_status: "acceptable",
        confidence_band: "high",
        is_standardized_evidence: true,
      },
    });

    const contrib = pairContributesToOutcomeEvidence(row);
    assert.equal(contrib.contributes, true);
    assert.ok(contrib.domains.includes("recipient_growth"));
  });

  it("best-effort regeneration does not break accept/comparison flows", async () => {
    await assert.doesNotReject(async () => {
      await regenerateVieOutcomeSummaryBestEffort({
        tenantId: "00000000-0000-4000-8000-000000000099",
        patientId: "00000000-0000-4000-8000-000000000088",
      });
    });
  });
});

describe("Patient Twin outcome summary mapping", () => {
  it("summary includes all seven outcome domains", () => {
    const summary = buildVieOutcomeSummary({
      patientId,
      pairs: [pair({ pair_id: "p1", review_status: "accepted" })],
      completeness: buildOutcomeCompletenessInput({
        consultation_percent: 60,
        donor_documentation_percent: 60,
        surgical_documentation_percent: 60,
        follow_up_progression_coverage: 50,
      }),
      alignmentConsistencyScore: 60,
    });

    assert.equal(summary.domains.length, 7);
    assert.ok(summary.next_actions.length >= 0);
    assert.equal(summary.engine_version, "vie-outcome.v1");
    assert.ok(typeof summary.clinical_review_recommended === "boolean");
  });
});
