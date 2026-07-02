import type {
  AdaptiveClinicianSuggestion,
  AdaptiveDerivedSummary,
  AdaptiveRescoreComparison,
} from "../types/adaptive";
import {
  getEndocrineReviewDomainsFromTriage,
  type EndocrineReviewDomain,
} from "./endocrineReviewDomains";

export type BloodworkEligibilityConfidenceBand = "low" | "moderate" | "high";

export type BloodworkEligibilityDomain =
  | "iron_studies"
  | "thyroid_panel"
  | "vitamin_d"
  | "b12_folate"
  | "female_endocrine_review"
  | "androgen_adrenal_review"
  | "thyroid_iron_nutrition_review"
  | "stress_trigger_overlap_review"
  | "pituitary_prolactin_followup"
  | "hormonal_context_review"
  | "metabolic_context_review";

export type EndocrineDomainSummary = {
  primaryDomain: BloodworkEligibilityDomain | null;
  secondaryDomains: BloodworkEligibilityDomain[];
  escalationDomains: BloodworkEligibilityDomain[];
  supportedBy: Partial<Record<BloodworkEligibilityDomain, string[]>>;
};

export type AdaptiveBloodworkEligibilitySupport = {
  eligible: boolean;
  confidence_band: BloodworkEligibilityConfidenceBand;
  reasons: string[];
  suggested_bloodwork_domains: BloodworkEligibilityDomain[];
  caution_notes: string[];
  endocrine_domain_summary: EndocrineDomainSummary | null;
};

export type AdaptiveBloodworkEligibilityInput = {
  adaptive_triage_output: AdaptiveDerivedSummary | null | undefined;
  adaptive_rescore_comparison?: AdaptiveRescoreComparison | null;
  clinician_suggestions?: AdaptiveClinicianSuggestion[] | null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function uniq<T extends string>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function includesAny(source: string[], match: string[]): boolean {
  return match.some((item) => source.includes(item));
}

function mapEndocrineDomain(domain: EndocrineReviewDomain): BloodworkEligibilityDomain {
  switch (domain) {
    case "female_endocrine_review":
      return "female_endocrine_review";
    case "androgen_adrenal_review":
      return "androgen_adrenal_review";
    case "thyroid_iron_nutrition_review":
      return "thyroid_iron_nutrition_review";
    case "stress_trigger_overlap_review":
      return "stress_trigger_overlap_review";
    case "pituitary_prolactin_followup":
      return "pituitary_prolactin_followup";
  }
}

const ENDOCRINE_DOMAIN_PRIORITY: BloodworkEligibilityDomain[] = [
  "pituitary_prolactin_followup",
  "female_endocrine_review",
  "androgen_adrenal_review",
  "thyroid_iron_nutrition_review",
  "stress_trigger_overlap_review",
];

function pushSupportSignal(
  target: Partial<Record<BloodworkEligibilityDomain, string[]>>,
  domain: BloodworkEligibilityDomain,
  signal: string
) {
  if (!signal) return;
  const existing = target[domain] ?? [];
  if (!existing.includes(signal)) {
    target[domain] = [...existing, signal];
  }
}

function buildEndocrineDomainSummary(
  triage: AdaptiveDerivedSummary,
  domains: BloodworkEligibilityDomain[],
  reasons: string[]
): EndocrineDomainSummary | null {
  const endocrineDomains = ENDOCRINE_DOMAIN_PRIORITY.filter((domain) =>
    domains.includes(domain)
  );
  if (endocrineDomains.length === 0) return null;

  const pathway =
    typeof triage.primary_pathway === "string" ? triage.primary_pathway : "";
  const drivers = asStringArray(triage.possible_drivers);
  const flags = asStringArray(triage.clinician_attention_flags);
  const considerations = asStringArray(triage.bloodwork_considerations);
  const supportedBy: Partial<Record<BloodworkEligibilityDomain, string[]>> = {};

  if (endocrineDomains.includes("female_endocrine_review")) {
    if (pathway === "female_hormonal_pattern") {
      pushSupportSignal(
        supportedBy,
        "female_endocrine_review",
        "female hormonal-pattern pathway"
      );
    }
    if (drivers.includes("female_endocrine_context")) {
      pushSupportSignal(
        supportedBy,
        "female_endocrine_review",
        "female endocrine context"
      );
    }
    if (drivers.includes("cycle_irregularity")) {
      pushSupportSignal(
        supportedBy,
        "female_endocrine_review",
        "cycle irregularity signal"
      );
    }
    if (drivers.includes("hirsutism_supporting_signal")) {
      pushSupportSignal(
        supportedBy,
        "female_endocrine_review",
        "supporting hirsutism severity signal"
      );
    }
  }

  if (endocrineDomains.includes("androgen_adrenal_review")) {
    if (drivers.includes("hyperandrogen_features")) {
      pushSupportSignal(
        supportedBy,
        "androgen_adrenal_review",
        "hyperandrogen feature signal"
      );
    }
    if (drivers.includes("hirsutism_supporting_signal")) {
      pushSupportSignal(
        supportedBy,
        "androgen_adrenal_review",
        "supporting hirsutism severity signal"
      );
    }
    if (flags.includes("possible_pcos_signal")) {
      pushSupportSignal(
        supportedBy,
        "androgen_adrenal_review",
        "PCOS-style attention flag"
      );
    }
    if (
      considerations.includes("androgen_hormone_review_if_clinically_appropriate")
    ) {
      pushSupportSignal(
        supportedBy,
        "androgen_adrenal_review",
        "androgen hormone review consideration"
      );
    }
  }

  if (endocrineDomains.includes("thyroid_iron_nutrition_review")) {
    if (pathway === "thyroid_metabolic_pattern") {
      pushSupportSignal(
        supportedBy,
        "thyroid_iron_nutrition_review",
        "thyroid/metabolic pathway"
      );
    }
    if (pathway === "nutritional_deficiency_pattern") {
      pushSupportSignal(
        supportedBy,
        "thyroid_iron_nutrition_review",
        "nutritional-deficiency pathway"
      );
    }
    if (flags.includes("heavy_period_related_iron_risk")) {
      pushSupportSignal(
        supportedBy,
        "thyroid_iron_nutrition_review",
        "heavy-period iron-risk flag"
      );
    }
    if (drivers.includes("nutritional_risk")) {
      pushSupportSignal(
        supportedBy,
        "thyroid_iron_nutrition_review",
        "nutritional risk cluster"
      );
    }
  }

  if (endocrineDomains.includes("stress_trigger_overlap_review")) {
    if (pathway === "postpartum_pattern") {
      pushSupportSignal(
        supportedBy,
        "stress_trigger_overlap_review",
        "postpartum overlap pathway"
      );
    }
    if (
      pathway === "telogen_effluvium_acute" ||
      pathway === "telogen_effluvium_chronic"
    ) {
      pushSupportSignal(
        supportedBy,
        "stress_trigger_overlap_review",
        "telogen-effluvium overlap pathway"
      );
    }
    if (drivers.includes("recent_trigger_burden")) {
      pushSupportSignal(
        supportedBy,
        "stress_trigger_overlap_review",
        "recent trigger burden"
      );
    }
    if (drivers.includes("stress_trigger_delay_overlap")) {
      pushSupportSignal(
        supportedBy,
        "stress_trigger_overlap_review",
        "delayed-shedding overlap"
      );
    }
  }

  if (endocrineDomains.includes("pituitary_prolactin_followup")) {
    if (drivers.includes("pituitary_followup_prompt")) {
      pushSupportSignal(
        supportedBy,
        "pituitary_prolactin_followup",
        "pituitary follow-up prompt"
      );
    }
    if (reasons.some((reason) => reason.toLowerCase().includes("pituitary/prolactin"))) {
      pushSupportSignal(
        supportedBy,
        "pituitary_prolactin_followup",
        "specific endocrine follow-up signal"
      );
    }
  }

  const escalationDomains = endocrineDomains.filter(
    (domain) => domain === "pituitary_prolactin_followup"
  );
  const primaryDomain =
    escalationDomains[0] ??
    endocrineDomains.find((domain) => domain !== "pituitary_prolactin_followup") ??
    null;
  const secondaryDomains = endocrineDomains.filter((domain) => domain !== primaryDomain);

  return {
    primaryDomain,
    secondaryDomains,
    escalationDomains,
    supportedBy,
  };
}

export function deriveAdaptiveBloodworkEligibilitySupport(
  input: AdaptiveBloodworkEligibilityInput
): AdaptiveBloodworkEligibilitySupport {
  const triage = input.adaptive_triage_output;
  if (!triage) {
    return {
      eligible: false,
      confidence_band: "low",
      reasons: [],
      suggested_bloodwork_domains: [],
      caution_notes: [
        "No adaptive triage payload available for bloodwork consideration support.",
      ],
      endocrine_domain_summary: null,
    };
  }

  const primaryPathway = typeof triage.primary_pathway === "string" ? triage.primary_pathway : "";
  const secondaryPathways = asStringArray(triage.secondary_pathways);
  const flags = asStringArray(triage.clinician_attention_flags);
  const drivers = asStringArray(triage.possible_drivers);
  const triageDomains = asStringArray(triage.bloodwork_considerations);
  const redFlags = asStringArray(triage.red_flags);
  const deltaChanged = input.adaptive_rescore_comparison?.changed === true;
  const suggestions = input.clinician_suggestions ?? [];

  const reasons: string[] = [];
  const domains: BloodworkEligibilityDomain[] = [];
  const cautionNotes: string[] = [];

  const hasPathway = (pathway: string) =>
    primaryPathway === pathway || secondaryPathways.includes(pathway);

  if (hasPathway("nutritional_deficiency_pattern")) {
    reasons.push("Nutritional-deficiency pathway signal present.");
    domains.push("iron_studies", "vitamin_d", "b12_folate");
  }

  if (
    hasPathway("telogen_effluvium_acute") ||
    hasPathway("telogen_effluvium_chronic")
  ) {
    reasons.push("Telogen-effluvium pathway signal with systemic trigger context.");
    domains.push("iron_studies", "thyroid_panel");
  }

  if (flags.includes("heavy_period_related_iron_risk")) {
    reasons.push("Heavy-period / iron-risk attention flag present.");
    domains.push("iron_studies");
  }

  if (hasPathway("thyroid_metabolic_pattern")) {
    reasons.push("Thyroid/metabolic pathway signal present.");
    domains.push("thyroid_panel", "metabolic_context_review");
  }

  if (
    hasPathway("postpartum_pattern") &&
    includesAny(drivers, ["recent_trigger_burden", "possible_postpartum_context"])
  ) {
    reasons.push("Postpartum signal with diffuse/shedding context.");
    domains.push("iron_studies", "thyroid_panel", "vitamin_d");
  }

  if (hasPathway("female_hormonal_pattern")) {
    reasons.push("Female endocrine-pattern signal where endocrine review may be useful.");
    domains.push("female_endocrine_review");
  }

  if (includesAny(triageDomains, ["iron_studies"])) domains.push("iron_studies");
  if (includesAny(triageDomains, ["thyroid_panel"])) domains.push("thyroid_panel");
  if (includesAny(triageDomains, ["vitamin_d"])) domains.push("vitamin_d");
  if (includesAny(triageDomains, ["b12_folate"])) domains.push("b12_folate");
  if (
    includesAny(triageDomains, [
      "androgen_hormone_review_if_clinically_appropriate",
    ])
  ) {
    domains.push("androgen_adrenal_review");
  }
  if (
    includesAny(triageDomains, ["metabolic_review_if_clinically_appropriate"])
  ) {
    domains.push("metabolic_context_review");
  }

  const endocrineDomains = getEndocrineReviewDomainsFromTriage(triage).map(
    mapEndocrineDomain
  );
  domains.push(...endocrineDomains);

  if (endocrineDomains.includes("female_endocrine_review")) {
    reasons.push("Female endocrine history signals suggest a broader endocrine review domain.");
  }
  if (endocrineDomains.includes("androgen_adrenal_review")) {
    reasons.push(
      "Androgen-sensitive or PCOS-style signals suggest androgen/adrenal-androgen review."
    );
  }
  if (endocrineDomains.includes("thyroid_iron_nutrition_review")) {
    reasons.push(
      "Thyroid, iron, or nutritional overlap signals suggest broader systemic review."
    );
  }
  if (endocrineDomains.includes("stress_trigger_overlap_review")) {
    reasons.push(
      "Delayed-shedding or postpartum/trigger overlap signals suggest trigger-context review."
    );
  }
  if (endocrineDomains.includes("pituitary_prolactin_followup")) {
    reasons.push(
      "Specific endocrine follow-up prompts suggest direct pituitary/prolactin-oriented review."
    );
    cautionNotes.push(
      "Escalation-style endocrine follow-up signal present; prioritise direct clinician review over routine low-priority batching."
    );
  }

  if (deltaChanged) {
    cautionNotes.push(
      "Adaptive interpretation changed under current engine; use bloodwork support in full clinical context."
    );
  }
  if (redFlags.length > 0) {
    cautionNotes.push(
      "Red-flag signals are present; prioritise direct clinical review over isolated rule interpretation."
    );
  }
  if (
    suggestions.some(
      (s) =>
        s.id === "mixed_pattern_caution" ||
        s.id === "prioritise_direct_scalp_review"
    )
  ) {
    cautionNotes.push(
      "Pattern-overlap caution present; avoid single-cause assumptions."
    );
  }

  const uniqueReasons = uniq(reasons);
  const uniqueDomains = uniq(domains);
  const eligible = uniqueReasons.length > 0 || uniqueDomains.length > 0;
  const endocrine_domain_summary = buildEndocrineDomainSummary(
    triage,
    uniqueDomains,
    uniqueReasons
  );

  const confidence_band: BloodworkEligibilityConfidenceBand = !eligible
    ? "low"
    : uniqueReasons.length >= 3 || uniqueDomains.length >= 3
    ? "high"
    : "moderate";

  return {
    eligible,
    confidence_band,
    reasons: uniqueReasons,
    suggested_bloodwork_domains: uniqueDomains,
    caution_notes: uniq(cautionNotes),
    endocrine_domain_summary,
  };
}

