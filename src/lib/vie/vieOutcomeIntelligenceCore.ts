import type { VieProtocolSlug } from "./vieProtocolTypes";
import {
  VIE_OUTCOME_ENGINE_VERSION,
  type VieOutcomeComparisonInput,
  type VieOutcomeCompletenessInput,
  type VieOutcomeConfidenceBand,
  type VieOutcomeDomain,
  type VieOutcomeDomainSummary,
  type VieOutcomeNextAction,
  type VieOutcomeNextRecommendedCapture,
  type VieOutcomePairContribution,
  type VieOutcomeStatus,
  type VieOutcomeSummary,
} from "./vieOutcomeTypes";

const DOMAIN_LABELS: Record<VieOutcomeDomain, string> = {
  recipient_growth: "Recipient growth monitoring",
  donor_recovery: "Donor recovery evidence",
  hairline_maturation: "Hairline maturation signal",
  crown_progress: "Crown progress signal",
  surgical_healing: "Surgical healing documentation",
  documentation_readiness: "Documentation readiness",
  audit_evidence_quality: "Audit evidence quality",
};

const DOMAIN_WEIGHTS: Record<VieOutcomeDomain, number> = {
  recipient_growth: 1.2,
  donor_recovery: 1.0,
  hairline_maturation: 1.0,
  crown_progress: 0.9,
  surgical_healing: 1.1,
  documentation_readiness: 0.8,
  audit_evidence_quality: 1.0,
};

const RECIPIENT_SLOT_FAMILIES = new Set(["recipient", "front", "top"]);
const HAIRLINE_SLOT_FAMILIES = new Set(["front"]);
const CROWN_SLOT_FAMILIES = new Set(["crown", "top"]);
const DONOR_CATEGORIES = new Set(["donor_before_vs_after_extraction"]);
const RECIPIENT_CATEGORIES = new Set([
  "baseline_vs_follow_up",
  "recipient_before_vs_after_implantation",
  "treatment_progression",
]);
const HAIRLINE_CATEGORIES = new Set(["baseline_vs_follow_up", "treatment_progression"]);
const CROWN_CATEGORIES = new Set(["baseline_vs_follow_up", "treatment_progression"]);
const SURGICAL_CATEGORIES = new Set([
  "pre_op_vs_post_op",
  "recipient_before_vs_after_implantation",
]);
const AUDIT_CATEGORIES = new Set([
  "donor_before_vs_after_extraction",
  "graft_tray_documentation",
  "pre_op_vs_post_op",
  "baseline_vs_follow_up",
]);

/** Pairs eligible for outcome evidence — accepted review or high-confidence with no warnings. */
export function isOutcomeEligiblePair(pair: VieOutcomeComparisonInput): boolean {
  if (pair.review_status === "dismissed") return false;
  if (pair.review_status === "accepted") return true;
  return pair.confidence_band === "high" && pair.warnings.length === 0;
}

export function pairContributesToOutcomeEvidence(
  pair: VieOutcomeComparisonInput
): VieOutcomePairContribution {
  if (!isOutcomeEligiblePair(pair)) {
    return {
      contributes: false,
      domains: [],
      reason:
        pair.review_status === "dismissed"
          ? "Pair dismissed — excluded from outcome evidence"
          : "Pair not yet accepted or high-confidence — pending review",
    };
  }

  const domains = domainsForPair(pair);
  if (domains.length === 0) {
    return {
      contributes: false,
      domains: [],
      reason: "Pair category does not map to an outcome domain",
    };
  }

  return {
    contributes: true,
    domains,
    reason: `Contributes to ${domains.map((d) => DOMAIN_LABELS[d]).join(", ")}`,
  };
}

function domainsForPair(pair: VieOutcomeComparisonInput): VieOutcomeDomain[] {
  const domains = new Set<VieOutcomeDomain>();

  if (
    RECIPIENT_CATEGORIES.has(pair.comparison_category) &&
    (RECIPIENT_SLOT_FAMILIES.has(pair.slot_family) || pair.anatomical_region.includes("recipient"))
  ) {
    domains.add("recipient_growth");
  }

  if (DONOR_CATEGORIES.has(pair.comparison_category) || pair.slot_family === "donor") {
    domains.add("donor_recovery");
  }

  if (
    HAIRLINE_CATEGORIES.has(pair.comparison_category) &&
    (HAIRLINE_SLOT_FAMILIES.has(pair.slot_family) ||
      pair.anatomical_region.includes("hairline") ||
      pair.anatomical_region.includes("front"))
  ) {
    domains.add("hairline_maturation");
  }

  if (
    CROWN_CATEGORIES.has(pair.comparison_category) &&
    (CROWN_SLOT_FAMILIES.has(pair.slot_family) || pair.anatomical_region.includes("crown"))
  ) {
    domains.add("crown_progress");
  }

  if (SURGICAL_CATEGORIES.has(pair.comparison_category)) {
    domains.add("surgical_healing");
  }

  if (
    AUDIT_CATEGORIES.has(pair.comparison_category) ||
    pair.recommended_use.includes("audit_evidence")
  ) {
    domains.add("audit_evidence_quality");
  }

  return [...domains];
}

function pairEvidenceScore(pair: VieOutcomeComparisonInput): number {
  let score = pair.quality_match_score;
  if (pair.review_status === "accepted") score += 10;
  if (pair.is_standardized_evidence) score += 8;
  if (pair.alignment_score != null) {
    score = score * 0.6 + pair.alignment_score * 0.4;
  }
  if (pair.alignment_status === "poor" || pair.alignment_status === "retake_recommended") {
    score -= 20;
  }
  if (pair.warnings.length > 0) score -= 8 * pair.warnings.length;
  if (pair.confidence_band === "low") score -= 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function pairHasConcern(pair: VieOutcomeComparisonInput): boolean {
  return (
    pair.alignment_status === "poor" ||
    pair.alignment_status === "retake_recommended" ||
    pair.confidence_band === "low" ||
    pair.warnings.length >= 2
  );
}

function deriveDomainStatus(
  score: number,
  evidenceCount: number,
  hasConcern: boolean,
  auditDomain = false
): VieOutcomeStatus {
  if (evidenceCount === 0) return "insufficient_evidence";
  if (hasConcern && score < 55) return "concern";
  if (auditDomain && score >= 80 && evidenceCount >= 2 && !hasConcern) return "audit_ready";
  if (score >= 75 && evidenceCount >= 2 && !hasConcern) return "favourable";
  if (score >= 50) return "monitoring";
  if (score >= 30 || evidenceCount >= 1) return "early_signal";
  return "insufficient_evidence";
}

function scoreFromPairs(pairs: VieOutcomeComparisonInput[]): {
  score: number;
  evidenceCount: number;
  hasConcern: boolean;
  bestPairId: string | null;
} {
  const eligible = pairs.filter(isOutcomeEligiblePair);
  if (eligible.length === 0) {
    return { score: 0, evidenceCount: 0, hasConcern: false, bestPairId: null };
  }

  const scores = eligible.map(pairEvidenceScore);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const hasConcern = eligible.some(pairHasConcern);
  const bestIdx = scores.indexOf(Math.max(...scores));

  return {
    score: Math.round(avg),
    evidenceCount: eligible.length,
    hasConcern,
    bestPairId: eligible[bestIdx]?.pair_id ?? null,
  };
}

function scoreDocumentationReadiness(completeness: VieOutcomeCompletenessInput): {
  score: number;
  evidenceCount: number;
  hasConcern: boolean;
} {
  const parts = [
    completeness.consultation_percent,
    completeness.donor_documentation_percent,
    completeness.surgical_documentation_percent,
    completeness.follow_up_progression_coverage,
  ];
  const score = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  const evidenceCount = parts.filter((p) => p >= 50).length;
  const hasConcern = parts.some((p) => p < 40);
  return { score, evidenceCount, hasConcern };
}

function scoreDonorRecovery(
  pairs: VieOutcomeComparisonInput[],
  donorDocPercent: number
): { score: number; evidenceCount: number; hasConcern: boolean; bestPairId: string | null } {
  const donorPairs = pairs.filter(
    (p) => DONOR_CATEGORIES.has(p.comparison_category) || p.slot_family === "donor"
  );
  const fromPairs = scoreFromPairs(donorPairs);
  const docBoost = Math.round(donorDocPercent * 0.35);
  const combinedScore =
    fromPairs.evidenceCount > 0 ? Math.round(fromPairs.score * 0.65 + docBoost * 0.35) : docBoost;
  const evidenceCount = fromPairs.evidenceCount + (donorDocPercent >= 50 ? 1 : 0);

  return {
    score: combinedScore,
    evidenceCount,
    hasConcern: fromPairs.hasConcern || donorDocPercent < 40,
    bestPairId: fromPairs.bestPairId,
  };
}

function scoreSurgicalHealing(
  pairs: VieOutcomeComparisonInput[],
  surgicalDocPercent: number
): { score: number; evidenceCount: number; hasConcern: boolean; bestPairId: string | null } {
  const surgicalPairs = pairs.filter((p) => SURGICAL_CATEGORIES.has(p.comparison_category));
  const fromPairs = scoreFromPairs(surgicalPairs);
  const docBoost = Math.round(surgicalDocPercent * 0.4);
  const combinedScore =
    fromPairs.evidenceCount > 0 ? Math.round(fromPairs.score * 0.6 + docBoost * 0.4) : docBoost;
  const evidenceCount = fromPairs.evidenceCount + (surgicalDocPercent >= 50 ? 1 : 0);

  return {
    score: combinedScore,
    evidenceCount,
    hasConcern: fromPairs.hasConcern || surgicalDocPercent < 40,
    bestPairId: fromPairs.bestPairId,
  };
}

function scoreAuditEvidence(
  pairs: VieOutcomeComparisonInput[],
  completeness: VieOutcomeCompletenessInput
): { score: number; evidenceCount: number; hasConcern: boolean; bestPairId: string | null } {
  const auditPairs = pairs.filter(
    (p) =>
      AUDIT_CATEGORIES.has(p.comparison_category) || p.recommended_use.includes("audit_evidence")
  );
  const acceptedAudit = auditPairs.filter((p) => p.review_status === "accepted");
  const fromPairs = scoreFromPairs(auditPairs);
  let score = fromPairs.score;
  if (acceptedAudit.length > 0) score = Math.min(100, score + acceptedAudit.length * 5);
  const docFactor = Math.round(
    (completeness.surgical_documentation_percent + completeness.donor_documentation_percent) / 2
  );
  score = Math.round(score * 0.7 + docFactor * 0.3);

  return {
    score,
    evidenceCount: fromPairs.evidenceCount + acceptedAudit.length,
    hasConcern: fromPairs.hasConcern,
    bestPairId: fromPairs.bestPairId,
  };
}

function inferNextCaptureForDomain(
  domain: VieOutcomeDomain,
  status: VieOutcomeStatus
): VieOutcomeNextRecommendedCapture {
  if (status === "audit_ready" || status === "favourable") {
    return { protocol_slug: null, slot_slug: null, label: null };
  }

  const map: Partial<Record<VieOutcomeDomain, VieOutcomeNextRecommendedCapture>> = {
    recipient_growth: {
      protocol_slug: "follow_up_review",
      slot_slug: "fu_front",
      label: "Follow-up — front (match baseline framing)",
    },
    donor_recovery: {
      protocol_slug: "surgery_day",
      slot_slug: "donor_final_extraction",
      label: "Donor — final extraction documentation",
    },
    hairline_maturation: {
      protocol_slug: "follow_up_review",
      slot_slug: "fu_front",
      label: "Follow-up — hairline maturation view",
    },
    crown_progress: {
      protocol_slug: "follow_up_review",
      slot_slug: "fu_crown",
      label: "Follow-up — crown view",
    },
    surgical_healing: {
      protocol_slug: "surgery_day",
      slot_slug: "immediate_post_op_front",
      label: "Immediate post-op — front healing documentation",
    },
    documentation_readiness: {
      protocol_slug: "baseline_consultation",
      slot_slug: "front",
      label: "Baseline consultation — complete required views",
    },
    audit_evidence_quality: {
      protocol_slug: "surgery_day",
      slot_slug: "graft_tray_overview",
      label: "Graft tray overview for audit evidence pack",
    },
  };

  return map[domain] ?? { protocol_slug: null, slot_slug: null, label: null };
}

function buildDomainSummary(
  domain: VieOutcomeDomain,
  input: {
    score: number;
    evidenceCount: number;
    hasConcern: boolean;
    bestPairId: string | null;
    warnings: string[];
  },
  auditDomain = false
): VieOutcomeDomainSummary {
  const status = deriveDomainStatus(
    input.score,
    input.evidenceCount,
    input.hasConcern,
    auditDomain
  );
  return {
    domain,
    score: input.score,
    status,
    evidence_count: input.evidenceCount,
    best_comparison_pair_id: input.bestPairId,
    warnings: input.warnings,
    next_recommended_capture: inferNextCaptureForDomain(domain, status),
  };
}

function deriveOverallConfidence(
  pairs: VieOutcomeComparisonInput[],
  alignmentConsistencyScore: number
): VieOutcomeConfidenceBand {
  const eligible = pairs.filter(isOutcomeEligiblePair);
  if (eligible.length === 0) return "low";

  const highConf = eligible.filter(
    (p) => p.confidence_band === "high" || p.review_status === "accepted"
  ).length;
  const poorAlignment = eligible.filter(
    (p) => p.alignment_status === "poor" || p.alignment_status === "retake_recommended"
  ).length;

  if (highConf >= 2 && poorAlignment === 0 && alignmentConsistencyScore >= 70) return "high";
  if (eligible.length >= 1 && alignmentConsistencyScore >= 50) return "medium";
  return "low";
}

function buildNextActions(domains: VieOutcomeDomainSummary[]): VieOutcomeNextAction[] {
  const actions: VieOutcomeNextAction[] = [];

  for (const d of domains) {
    if (d.status === "concern") {
      actions.push({
        kind: "alignment_recapture",
        label: `${DOMAIN_LABELS[d.domain]} — alignment or quality concern; recapture recommended`,
        priority: "high",
        domain: d.domain,
      });
    } else if (d.status === "insufficient_evidence" && d.next_recommended_capture.label) {
      actions.push({
        kind: "capture",
        label: d.next_recommended_capture.label,
        priority: "medium",
        domain: d.domain,
      });
    } else if (d.status === "early_signal" || d.status === "monitoring") {
      actions.push({
        kind: "clinical_review",
        label: `${DOMAIN_LABELS[d.domain]} — monitoring signal; clinician review suggested`,
        priority: "low",
        domain: d.domain,
      });
    }
  }

  const auditDomain = domains.find((d) => d.domain === "audit_evidence_quality");
  if (auditDomain?.status === "audit_ready") {
    actions.unshift({
      kind: "audit_prep",
      label: "Audit evidence quality threshold met — ready for evidence pack preparation",
      priority: "medium",
      domain: "audit_evidence_quality",
    });
  }

  const comparisonReviewNeeded = domains.some(
    (d) => d.evidence_count > 0 && d.status === "early_signal"
  );
  if (comparisonReviewNeeded) {
    actions.push({
      kind: "comparison_review",
      label: "Review and accept high-confidence comparison pairs to strengthen outcome evidence",
      priority: "medium",
      domain: null,
    });
  }

  const seen = new Set<string>();
  return actions.filter((a) => {
    const key = `${a.kind}:${a.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildVieOutcomeSummary(input: {
  patientId: string;
  caseId?: string | null;
  pairs: VieOutcomeComparisonInput[];
  completeness: VieOutcomeCompletenessInput;
  alignmentConsistencyScore?: number;
  generatedAt?: string;
}): VieOutcomeSummary {
  const pairs = input.pairs;
  const completeness = input.completeness;
  const alignmentConsistencyScore = input.alignmentConsistencyScore ?? 0;

  const recipientPairs = pairs.filter(
    (p) =>
      RECIPIENT_CATEGORIES.has(p.comparison_category) &&
      (RECIPIENT_SLOT_FAMILIES.has(p.slot_family) || p.anatomical_region.includes("recipient"))
  );
  const hairlinePairs = pairs.filter(
    (p) =>
      HAIRLINE_CATEGORIES.has(p.comparison_category) &&
      (HAIRLINE_SLOT_FAMILIES.has(p.slot_family) ||
        p.anatomical_region.includes("hairline") ||
        p.anatomical_region.includes("front"))
  );
  const crownPairs = pairs.filter(
    (p) =>
      CROWN_CATEGORIES.has(p.comparison_category) &&
      (CROWN_SLOT_FAMILIES.has(p.slot_family) || p.anatomical_region.includes("crown"))
  );

  const recipient = scoreFromPairs(recipientPairs);
  const hairline = scoreFromPairs(hairlinePairs);
  const crown = scoreFromPairs(crownPairs);
  const donor = scoreDonorRecovery(pairs, completeness.donor_documentation_percent);
  const surgical = scoreSurgicalHealing(pairs, completeness.surgical_documentation_percent);
  const documentation = scoreDocumentationReadiness(completeness);
  const audit = scoreAuditEvidence(pairs, completeness);

  const domainInputs: Array<{
    domain: VieOutcomeDomain;
    data: typeof recipient;
    audit?: boolean;
    extraWarnings?: string[];
  }> = [
    {
      domain: "recipient_growth",
      data: recipient,
      extraWarnings: recipient.hasConcern
        ? ["Alignment or quality concern in recipient progression pairs"]
        : [],
    },
    {
      domain: "donor_recovery",
      data: donor,
      extraWarnings:
        completeness.donor_documentation_percent < 50 ? ["Donor documentation incomplete"] : [],
    },
    { domain: "hairline_maturation", data: hairline },
    { domain: "crown_progress", data: crown },
    {
      domain: "surgical_healing",
      data: surgical,
      extraWarnings:
        completeness.surgical_documentation_percent < 50
          ? ["Surgical day documentation incomplete"]
          : [],
    },
    {
      domain: "documentation_readiness",
      data: { ...documentation, bestPairId: null },
      extraWarnings:
        documentation.score < 50 ? ["Protocol completeness below monitoring threshold"] : [],
    },
    { domain: "audit_evidence_quality", data: audit, audit: true },
  ];

  const domains = domainInputs.map(({ domain, data, audit: isAudit, extraWarnings }) =>
    buildDomainSummary(
      domain,
      {
        score: data.score,
        evidenceCount: data.evidenceCount,
        hasConcern: data.hasConcern,
        bestPairId: data.bestPairId,
        warnings: extraWarnings ?? [],
      },
      isAudit
    )
  );

  let weightedSum = 0;
  let weightTotal = 0;
  for (const d of domains) {
    const w = DOMAIN_WEIGHTS[d.domain];
    weightedSum += d.score * w;
    weightTotal += w;
  }
  const overall_outcome_readiness_score =
    weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;

  const confidence_band = deriveOverallConfidence(pairs, alignmentConsistencyScore);

  const auditDomain = domains.find((d) => d.domain === "audit_evidence_quality");
  const audit_ready =
    auditDomain?.status === "audit_ready" &&
    auditDomain.score >= 80 &&
    auditDomain.evidence_count >= 2 &&
    completeness.surgical_documentation_percent >= 70 &&
    completeness.donor_documentation_percent >= 70;

  const clinical_review_recommended = domains.some(
    (d) =>
      d.status === "early_signal" ||
      d.status === "monitoring" ||
      d.status === "concern" ||
      (d.evidence_count > 0 && d.status !== "audit_ready" && d.status !== "favourable")
  );

  const globalWarnings: string[] = [];
  if (confidence_band === "low") {
    globalWarnings.push("Low confidence band — sparse evidence or poor alignment consistency");
  }
  if (pairs.filter(isOutcomeEligiblePair).length === 0) {
    globalWarnings.push(
      "No accepted or high-confidence comparison pairs available for outcome evidence"
    );
  }

  const next_actions = buildNextActions(domains);

  return {
    engine_version: VIE_OUTCOME_ENGINE_VERSION,
    patient_id: input.patientId,
    case_id: input.caseId?.trim() || null,
    overall_outcome_readiness_score,
    confidence_band,
    domains,
    audit_ready,
    clinical_review_recommended,
    warnings: globalWarnings,
    next_actions,
    generated_at: input.generatedAt ?? new Date().toISOString(),
  };
}

export function outcomeStatusLabel(status: VieOutcomeStatus): string {
  return status.replace(/_/g, " ");
}

export function outcomeDomainLabel(domain: VieOutcomeDomain): string {
  return DOMAIN_LABELS[domain];
}

/** Map domain summaries for SurgeryOS surgical healing + donor recovery panels. */
export function pickSurgeryOutcomeDomains(domains: VieOutcomeDomainSummary[]): {
  surgical_healing: VieOutcomeDomainSummary | null;
  donor_recovery: VieOutcomeDomainSummary | null;
  documentation_readiness: VieOutcomeDomainSummary | null;
} {
  const byDomain = new Map(domains.map((d) => [d.domain, d]));
  return {
    surgical_healing: byDomain.get("surgical_healing") ?? null,
    donor_recovery: byDomain.get("donor_recovery") ?? null,
    documentation_readiness: byDomain.get("documentation_readiness") ?? null,
  };
}

export function mapComparisonPairToOutcomeInput(pair: {
  id: string;
  comparison_category: string;
  anatomical_region: string;
  slot_family: string;
  before_timepoint: string;
  after_timepoint: string;
  quality_match_score: number;
  confidence_band: string;
  review_status: string;
  warnings: string[];
  recommended_use: string[];
  alignment?: {
    alignment_score: number | null;
    alignment_status: string | null;
    is_standardized_evidence: boolean;
  } | null;
}): VieOutcomeComparisonInput {
  return {
    pair_id: pair.id,
    comparison_category: pair.comparison_category,
    anatomical_region: pair.anatomical_region,
    slot_family: pair.slot_family,
    before_timepoint: pair.before_timepoint,
    after_timepoint: pair.after_timepoint,
    quality_match_score: pair.quality_match_score,
    confidence_band: pair.confidence_band as VieOutcomeComparisonInput["confidence_band"],
    review_status: pair.review_status as VieOutcomeComparisonInput["review_status"],
    warnings: pair.warnings,
    recommended_use: pair.recommended_use,
    alignment_score: pair.alignment?.alignment_score ?? null,
    alignment_status: pair.alignment?.alignment_status ?? null,
    is_standardized_evidence: pair.alignment?.is_standardized_evidence ?? false,
  };
}

export function buildOutcomeCompletenessInput(input: {
  consultation_percent: number;
  donor_documentation_percent: number;
  surgical_documentation_percent: number;
  follow_up_progression_coverage: number;
}): VieOutcomeCompletenessInput {
  return {
    consultation_percent: input.consultation_percent,
    donor_documentation_percent: input.donor_documentation_percent,
    surgical_documentation_percent: input.surgical_documentation_percent,
    follow_up_progression_coverage: input.follow_up_progression_coverage,
  };
}

export type { VieProtocolSlug };
