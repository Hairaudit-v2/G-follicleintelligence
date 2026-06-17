/**
 * ImagingOS — visual measurement contracts (Phase IM-9).
 * Pure measurement result contracts; no I/O, AI, or pixel analysis.
 */

import type { ImagingOsComparisonCandidate, ImagingOsComparisonDomain } from "./comparison";
import type { ImagingOsComparisonMeasurementTarget } from "./comparison";
import type { ImagingOsComparisonReadinessResult } from "./comparison";

// ---------------------------------------------------------------------------
// Measurement domain model
// ---------------------------------------------------------------------------

export const IMAGING_MEASUREMENT_DOMAINS = [
  "density",
  "coverage",
  "caliber",
  "donor_density",
  "scar_visibility",
  "recipient_survival",
  "graft_survival",
  "hairline_position",
  "temporal_angle",
  "frontal_density",
  "scalp_visibility",
  "miniaturization",
  "graft_count_validation",
  "unknown",
] as const;

export type ImagingOsMeasurementDomain = (typeof IMAGING_MEASUREMENT_DOMAINS)[number];

export const IMAGING_MEASUREMENT_UNITS = [
  "percent",
  "hairs_per_cm2",
  "grafts_per_cm2",
  "hairs",
  "grafts",
  "millimeters",
  "degrees",
  "score_0_100",
  "ratio",
  "categorical",
  "unknown",
] as const;

export type ImagingOsMeasurementUnit = (typeof IMAGING_MEASUREMENT_UNITS)[number];

export const IMAGING_MEASUREMENT_METHODS = [
  "ai_vision",
  "pixel_analysis",
  "manual_clinician",
  "manual_auditor",
  "imported_external",
  "estimated",
  "contract_stub",
] as const;

export type ImagingOsMeasurementMethod = (typeof IMAGING_MEASUREMENT_METHODS)[number];

export type ImagingMeasurementRequirements = {
  allowed_units: ImagingOsMeasurementUnit[];
  preferred_unit: ImagingOsMeasurementUnit;
  compatible_comparison_domains: ImagingOsComparisonDomain[];
  minimum_confidence: number;
  requires_comparison_pair: boolean;
  requires_human_review_below_confidence: number;
  description: string;
};

const IMAGING_MEASUREMENT_REQUIREMENTS_MAP: Record<
  Exclude<ImagingOsMeasurementDomain, "unknown">,
  ImagingMeasurementRequirements
> = {
  density: {
    allowed_units: ["hairs_per_cm2", "grafts_per_cm2", "score_0_100"],
    preferred_unit: "hairs_per_cm2",
    compatible_comparison_domains: ["growth_change", "density_change"],
    minimum_confidence: 0.75,
    requires_comparison_pair: true,
    requires_human_review_below_confidence: 0.85,
    description:
      "Scalp hair density measurement from baseline and follow-up comparison pairs",
  },
  coverage: {
    allowed_units: ["percent", "score_0_100"],
    preferred_unit: "percent",
    compatible_comparison_domains: ["growth_change", "recipient_growth_change"],
    minimum_confidence: 0.7,
    requires_comparison_pair: true,
    requires_human_review_below_confidence: 0.85,
    description: "Visible scalp coverage percentage across comparison intervals",
  },
  caliber: {
    allowed_units: ["score_0_100", "ratio"],
    preferred_unit: "score_0_100",
    compatible_comparison_domains: ["growth_change", "longitudinal_medical_response"],
    minimum_confidence: 0.75,
    requires_comparison_pair: true,
    requires_human_review_below_confidence: 0.85,
    description: "Hair shaft caliber assessment from longitudinal visual evidence",
  },
  donor_density: {
    allowed_units: ["hairs_per_cm2", "grafts_per_cm2", "score_0_100"],
    preferred_unit: "hairs_per_cm2",
    compatible_comparison_domains: ["donor_recovery_change"],
    minimum_confidence: 0.75,
    requires_comparison_pair: true,
    requires_human_review_below_confidence: 0.85,
    description: "Donor-area density measurement for recovery tracking",
  },
  scar_visibility: {
    allowed_units: ["score_0_100", "categorical"],
    preferred_unit: "score_0_100",
    compatible_comparison_domains: ["donor_recovery_change"],
    minimum_confidence: 0.7,
    requires_comparison_pair: true,
    requires_human_review_below_confidence: 0.85,
    description: "Donor scar visibility scoring across surgical recovery milestones",
  },
  recipient_survival: {
    allowed_units: ["percent", "ratio", "score_0_100"],
    preferred_unit: "percent",
    compatible_comparison_domains: ["recipient_growth_change", "graft_survival_change"],
    minimum_confidence: 0.75,
    requires_comparison_pair: true,
    requires_human_review_below_confidence: 0.85,
    description: "Recipient-area graft survival rate from post-op through outcome follow-up",
  },
  graft_survival: {
    allowed_units: ["percent", "ratio", "score_0_100"],
    preferred_unit: "percent",
    compatible_comparison_domains: ["graft_survival_change"],
    minimum_confidence: 0.75,
    requires_comparison_pair: true,
    requires_human_review_below_confidence: 0.85,
    description: "Graft survival measurement from immediate post-op to outcome documentation",
  },
  hairline_position: {
    allowed_units: ["millimeters", "score_0_100"],
    preferred_unit: "millimeters",
    compatible_comparison_domains: ["hairline_design_change"],
    minimum_confidence: 0.7,
    requires_comparison_pair: true,
    requires_human_review_below_confidence: 0.85,
    description: "Hairline position offset measurement for design review comparisons",
  },
  temporal_angle: {
    allowed_units: ["degrees", "score_0_100"],
    preferred_unit: "degrees",
    compatible_comparison_domains: ["hairline_design_change"],
    minimum_confidence: 0.7,
    requires_comparison_pair: true,
    requires_human_review_below_confidence: 0.85,
    description: "Temporal hairline angle measurement for design review comparisons",
  },
  frontal_density: {
    allowed_units: ["hairs_per_cm2", "grafts_per_cm2", "score_0_100"],
    preferred_unit: "hairs_per_cm2",
    compatible_comparison_domains: ["hairline_design_change", "growth_change"],
    minimum_confidence: 0.75,
    requires_comparison_pair: true,
    requires_human_review_below_confidence: 0.85,
    description: "Frontal-zone density measurement for hairline and growth comparisons",
  },
  scalp_visibility: {
    allowed_units: ["percent", "score_0_100"],
    preferred_unit: "percent",
    compatible_comparison_domains: ["scalp_visibility_change", "growth_change"],
    minimum_confidence: 0.7,
    requires_comparison_pair: true,
    requires_human_review_below_confidence: 0.85,
    description: "Scalp skin visibility measurement from overhead comparison views",
  },
  miniaturization: {
    allowed_units: ["score_0_100", "ratio", "percent"],
    preferred_unit: "score_0_100",
    compatible_comparison_domains: ["density_change", "longitudinal_medical_response"],
    minimum_confidence: 0.75,
    requires_comparison_pair: true,
    requires_human_review_below_confidence: 0.85,
    description: "Hair miniaturization scoring from microscopic and density comparisons",
  },
  graft_count_validation: {
    allowed_units: ["grafts", "hairs", "ratio"],
    preferred_unit: "grafts",
    compatible_comparison_domains: ["graft_survival_change"],
    minimum_confidence: 0.8,
    requires_comparison_pair: false,
    requires_human_review_below_confidence: 0.9,
    description: "Graft count validation against documented surgical and outcome evidence",
  },
};

/** Read-only visual measurement requirement registry (Phase IM-9). */
export const IMAGING_MEASUREMENT_REQUIREMENTS: Readonly<
  Record<Exclude<ImagingOsMeasurementDomain, "unknown">, ImagingMeasurementRequirements>
> = IMAGING_MEASUREMENT_REQUIREMENTS_MAP;

export function isImagingOsMeasurementDomain(
  value: string
): value is ImagingOsMeasurementDomain {
  return (IMAGING_MEASUREMENT_DOMAINS as readonly string[]).includes(value);
}

export function isImagingOsMeasurementUnit(value: string): value is ImagingOsMeasurementUnit {
  return (IMAGING_MEASUREMENT_UNITS as readonly string[]).includes(value);
}

export function isImagingOsMeasurementMethod(
  value: string
): value is ImagingOsMeasurementMethod {
  return (IMAGING_MEASUREMENT_METHODS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Measurement result contract
// ---------------------------------------------------------------------------

export const IMAGING_MEASUREMENT_EVALUATOR_VERSION = "imaging-measurement-contract-v1" as const;

export type ImagingOsVisualMeasurementValidationStatus = "valid" | "warning" | "invalid";

export type ImagingOsVisualMeasurementResult = {
  measurement_id: string;
  domain: ImagingOsMeasurementDomain;
  value: number | string | null;
  unit: ImagingOsMeasurementUnit;
  confidence: number;
  method: ImagingOsMeasurementMethod;
  evidence_pair_id?: string;
  baseline_image_id?: string;
  followup_image_id?: string;
  comparison_domain?: ImagingOsComparisonDomain;
  requires_human_review: boolean;
  validation_status: ImagingOsVisualMeasurementValidationStatus;
  warnings: string[];
  blockers: string[];
  metadata?: Record<string, unknown>;
  measured_at?: string;
  evaluator_version: typeof IMAGING_MEASUREMENT_EVALUATOR_VERSION;
};

export type VisualMeasurementValidationResult = {
  validation_status: ImagingOsVisualMeasurementValidationStatus;
  warnings: string[];
  blockers: string[];
  requires_human_review: boolean;
};

export type CreateVisualMeasurementStubInput = {
  domain: ImagingOsMeasurementDomain;
  comparison_candidate?: ImagingOsComparisonCandidate;
  comparison_domain?: ImagingOsComparisonDomain;
  method?: ImagingOsMeasurementMethod;
  value?: number | string | null;
  unit?: ImagingOsMeasurementUnit;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

const NUMERIC_MEASUREMENT_UNITS: ReadonlySet<ImagingOsMeasurementUnit> = new Set([
  "percent",
  "hairs_per_cm2",
  "grafts_per_cm2",
  "hairs",
  "grafts",
  "millimeters",
  "degrees",
  "score_0_100",
  "ratio",
]);

const COMPARISON_TARGET_TO_MEASUREMENT_DOMAIN: Partial<
  Record<ImagingOsComparisonMeasurementTarget, ImagingOsMeasurementDomain>
> = {
  density: "density",
  coverage: "coverage",
  caliber: "caliber",
  donor_density: "donor_density",
  scar_visibility: "scar_visibility",
  recipient_survival: "recipient_survival",
  graft_survival: "graft_survival",
  hairline_position: "hairline_position",
  temporal_angle: "temporal_angle",
  frontal_density: "frontal_density",
  scalp_visibility: "scalp_visibility",
};

const MEASUREMENT_DOMAINS_BY_COMPARISON_DOMAIN: Record<
  Exclude<ImagingOsComparisonDomain, "unknown">,
  ImagingOsMeasurementDomain[]
> = {
  growth_change: ["density", "coverage", "caliber", "frontal_density"],
  density_change: ["density", "caliber", "miniaturization"],
  donor_recovery_change: ["donor_density", "scar_visibility", "scalp_visibility"],
  recipient_growth_change: ["recipient_survival", "density", "coverage"],
  hairline_design_change: ["hairline_position", "temporal_angle", "frontal_density"],
  scalp_visibility_change: ["scalp_visibility", "coverage"],
  graft_survival_change: ["graft_survival", "recipient_survival", "graft_count_validation"],
  longitudinal_medical_response: ["density", "caliber", "miniaturization", "coverage"],
  revision_comparison: ["density", "coverage", "scar_visibility", "hairline_position"],
};

function slugifyMeasurementIdPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildEvidencePairId(candidate?: ImagingOsComparisonCandidate): string | undefined {
  if (!candidate) {
    return undefined;
  }
  const baselineId = candidate.baseline_image.image_id ?? candidate.baseline_image.canonical_category;
  const followupId = candidate.followup_image.image_id ?? candidate.followup_image.canonical_category;
  return `${slugifyMeasurementIdPart(baselineId)}__${slugifyMeasurementIdPart(followupId)}`;
}

/** Generate a deterministic measurement identifier from domain, images, and method. */
export function generateVisualMeasurementId(input: {
  domain: ImagingOsMeasurementDomain;
  method: ImagingOsMeasurementMethod;
  comparison_domain?: ImagingOsComparisonDomain;
  comparison_candidate?: ImagingOsComparisonCandidate;
}): string {
  const baselineId =
    input.comparison_candidate?.baseline_image.image_id ??
    input.comparison_candidate?.baseline_image.canonical_category ??
    "none";
  const followupId =
    input.comparison_candidate?.followup_image.image_id ??
    input.comparison_candidate?.followup_image.canonical_category ??
    "none";
  const comparisonDomain = input.comparison_domain ?? "none";

  return [
    "vm",
    slugifyMeasurementIdPart(input.domain),
    slugifyMeasurementIdPart(input.method),
    slugifyMeasurementIdPart(comparisonDomain),
    slugifyMeasurementIdPart(String(baselineId)),
    slugifyMeasurementIdPart(String(followupId)),
  ].join("-");
}

function resolveMeasurementRequirements(
  domain: ImagingOsMeasurementDomain
): ImagingMeasurementRequirements | undefined {
  if (domain === "unknown") {
    return undefined;
  }
  return IMAGING_MEASUREMENT_REQUIREMENTS_MAP[domain];
}

function isNullValueAllowed(method: ImagingOsMeasurementMethod): boolean {
  return method === "contract_stub" || method === "estimated";
}

/** Validate a visual measurement result against domain registry rules (pure). */
export function validateVisualMeasurementResult(
  result: ImagingOsVisualMeasurementResult
): VisualMeasurementValidationResult {
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (result.domain === "unknown") {
    blockers.push("Unknown or unsupported visual measurement domain.");
    return {
      validation_status: "invalid",
      warnings,
      blockers,
      requires_human_review: true,
    };
  }

  const requirements = resolveMeasurementRequirements(result.domain);
  if (!requirements) {
    blockers.push(`No measurement requirements registered for domain: ${result.domain}.`);
    return {
      validation_status: "invalid",
      warnings,
      blockers,
      requires_human_review: true,
    };
  }

  if (result.confidence < 0 || result.confidence > 1) {
    blockers.push("Confidence must be between 0 and 1 inclusive.");
  }

  if (!requirements.allowed_units.includes(result.unit)) {
    blockers.push(
      `Unit "${result.unit}" is not allowed for measurement domain "${result.domain}".`
    );
  }

  if (
    result.comparison_domain &&
    result.comparison_domain !== "unknown" &&
    !requirements.compatible_comparison_domains.includes(result.comparison_domain)
  ) {
    warnings.push(
      `Comparison domain "${result.comparison_domain}" is not listed as compatible with "${result.domain}".`
    );
  }

  if (result.confidence < requirements.minimum_confidence) {
    warnings.push(
      `Confidence ${result.confidence} is below minimum threshold ${requirements.minimum_confidence} for ${result.domain}.`
    );
  }

  const requiresHumanReview =
    result.confidence < requirements.requires_human_review_below_confidence;

  if (requirements.requires_comparison_pair) {
    const hasComparisonPair =
      (result.baseline_image_id != null && result.followup_image_id != null) ||
      result.evidence_pair_id != null;

    if (!hasComparisonPair) {
      if (result.method === "contract_stub") {
        warnings.push(
          `Measurement domain "${result.domain}" requires a comparison pair; baseline and follow-up image references are missing.`
        );
      } else {
        blockers.push(
          `Measurement domain "${result.domain}" requires a comparison pair; baseline and follow-up image references are missing.`
        );
      }
    }
  }

  if (result.value == null) {
    if (!isNullValueAllowed(result.method)) {
      blockers.push(
        `Null measurement value is not allowed for method "${result.method}"; only contract_stub and estimated permit null values.`
      );
    }
  } else if (
    result.unit !== "categorical" &&
    NUMERIC_MEASUREMENT_UNITS.has(result.unit) &&
    typeof result.value !== "number"
  ) {
    warnings.push(
      `Numeric unit "${result.unit}" expects a number value; received ${typeof result.value}.`
    );
  }

  let validationStatus: ImagingOsVisualMeasurementValidationStatus = "valid";
  if (blockers.length > 0) {
    validationStatus = "invalid";
  } else if (warnings.length > 0) {
    validationStatus = "warning";
  }

  return {
    validation_status: validationStatus,
    warnings,
    blockers,
    requires_human_review: requiresHumanReview,
  };
}

/** Create a contract stub visual measurement result with registry defaults (pure). */
export function createVisualMeasurementStub(
  input: CreateVisualMeasurementStubInput
): ImagingOsVisualMeasurementResult {
  const method = input.method ?? "contract_stub";
  const confidence = input.confidence ?? 0;
  const value = input.value !== undefined ? input.value : null;
  const requirements = resolveMeasurementRequirements(input.domain);
  const unit =
    input.unit ??
    requirements?.preferred_unit ??
    ("unknown" satisfies ImagingOsMeasurementUnit);

  const evidencePairId = buildEvidencePairId(input.comparison_candidate);
  const baselineImageId = input.comparison_candidate?.baseline_image.image_id;
  const followupImageId = input.comparison_candidate?.followup_image.image_id;

  const draft: ImagingOsVisualMeasurementResult = {
    measurement_id: generateVisualMeasurementId({
      domain: input.domain,
      method,
      comparison_domain: input.comparison_domain,
      comparison_candidate: input.comparison_candidate,
    }),
    domain: input.domain,
    value,
    unit,
    confidence,
    method,
    ...(evidencePairId ? { evidence_pair_id: evidencePairId } : {}),
    ...(baselineImageId ? { baseline_image_id: baselineImageId } : {}),
    ...(followupImageId ? { followup_image_id: followupImageId } : {}),
    ...(input.comparison_domain ? { comparison_domain: input.comparison_domain } : {}),
    requires_human_review: false,
    validation_status: "valid",
    warnings: [],
    blockers: [],
    ...(input.metadata ? { metadata: input.metadata } : {}),
    evaluator_version: IMAGING_MEASUREMENT_EVALUATOR_VERSION,
  };

  const validation = validateVisualMeasurementResult(draft);

  return {
    ...draft,
    validation_status: validation.validation_status,
    warnings: validation.warnings,
    blockers: validation.blockers,
    requires_human_review: validation.requires_human_review,
  };
}

function mapComparisonTargetToMeasurementDomain(
  target: ImagingOsComparisonMeasurementTarget
): ImagingOsMeasurementDomain | undefined {
  return COMPARISON_TARGET_TO_MEASUREMENT_DOMAIN[target];
}

/** Build measurement stubs from IM-8 comparison readiness output (pure). */
export function buildMeasurementStubsFromComparisonResult(
  input: ImagingOsComparisonReadinessResult
): ImagingOsVisualMeasurementResult[] {
  if (
    input.comparison_status !== "ready" &&
    input.comparison_status !== "partial"
  ) {
    return [];
  }

  const comparisonCandidate = input.valid_comparison_pairs[0];

  return input.measurement_targets_available.flatMap((target) => {
    const domain = mapComparisonTargetToMeasurementDomain(target);
    if (!domain) {
      return [];
    }

    return [
      createVisualMeasurementStub({
        domain,
        comparison_domain: input.domain,
        ...(comparisonCandidate ? { comparison_candidate: comparisonCandidate } : {}),
        metadata: {
          comparison_status: input.comparison_status,
          measurement_target: target,
        },
      }),
    ];
  });
}

/** Recommend measurement domains for a visual comparison domain (pure). */
export function recommendMeasurementDomainsForComparisonDomain(
  domain: ImagingOsComparisonDomain
): ImagingOsMeasurementDomain[] {
  if (domain === "unknown") {
    return [];
  }
  return [...MEASUREMENT_DOMAINS_BY_COMPARISON_DOMAIN[domain]];
}
