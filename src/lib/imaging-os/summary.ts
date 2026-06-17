/**
 * ImagingOS — case-level imaging intelligence summary engine (Phase IM-10).
 * Aggregates IM-3 through IM-9 outputs into unified HairAudit and Digital Twin scores.
 * Pure contracts; no I/O, AI, or image processing.
 */

import type { ImagingOsComparisonReadinessResult } from "./comparison";
import type { ImagingOsVisualMeasurementResult } from "./measurement";
import type { ImagingOsOutcomeMeasurementResult } from "./outcomes";
import type { ImagingOsProtocolEvaluationResult } from "./protocol";
import type { ImagingOsProgressionEvaluationResult } from "./progression";
import type {
  ImagingOsImageQualityEvaluationResult,
  ImagingOsImageQualityStatus,
} from "./quality";
import type { ImagingOsSurgicalReadinessResult } from "./surgical";

// ---------------------------------------------------------------------------
// Status and component models
// ---------------------------------------------------------------------------

export type ImagingOsOverallStatus =
  | "excellent"
  | "ready"
  | "partial"
  | "insufficient_data"
  | "blocked"
  | "invalid";

export type ImagingOsSummaryComponent =
  | "category"
  | "intake"
  | "protocol"
  | "quality"
  | "progression"
  | "surgical"
  | "outcome"
  | "comparison"
  | "measurement"
  | "score";

export type ImagingOsComponentScore = {
  component: ImagingOsSummaryComponent;
  score: number;
  status: string;
  warnings: string[];
  blockers: string[];
};

export type ImagingOsSummaryInput = {
  protocol_result?: ImagingOsProtocolEvaluationResult;
  quality_results?: ImagingOsImageQualityEvaluationResult[];
  progression_result?: ImagingOsProgressionEvaluationResult;
  surgical_result?: ImagingOsSurgicalReadinessResult;
  outcome_result?: ImagingOsOutcomeMeasurementResult;
  comparison_result?: ImagingOsComparisonReadinessResult;
  measurement_results?: ImagingOsVisualMeasurementResult[];
};

export const IMAGING_SUMMARY_EVALUATOR_VERSION = "imaging-summary-contract-v1" as const;

export type ImagingOsOverallScoreResult = {
  overall_score: number;
  component_scores: ImagingOsComponentScore[];
  overall_status: ImagingOsOverallStatus;
  strongest_components: ImagingOsComponentScore[];
  weakest_components: ImagingOsComponentScore[];
  warnings: string[];
  blockers: string[];
  evaluator_version: typeof IMAGING_SUMMARY_EVALUATOR_VERSION;
};

export type HairAuditReadinessScoreResult = {
  hairaudit_score: number;
  audit_ready: boolean;
  audit_status: ImagingOsOverallStatus;
  missing_requirements: string[];
  recommended_next_actions: string[];
};

export type DigitalTwinClinicalConfidence = "high" | "medium" | "low";

export type DigitalTwinImagingSummaryResult = {
  twin_imaging_score: number;
  clinical_confidence: DigitalTwinClinicalConfidence;
  imaging_completeness: number;
  measurable_domains: string[];
  pending_measurements: string[];
  missing_evidence: string[];
  next_required_capture: string | null;
  ready_for_ai_analysis: boolean;
  ready_for_global_benchmarking: boolean;
};

export type ImagingOsRecommendedActionPriority = "high" | "medium" | "low";

export type ImagingOsRecommendedAction = {
  priority: ImagingOsRecommendedActionPriority;
  component: ImagingOsSummaryComponent;
  action: string;
  reason: string;
};

export type ImagingOsFullCaseEvaluationResult = {
  component_scores: ImagingOsComponentScore[];
  overall: ImagingOsOverallScoreResult;
  hairaudit: HairAuditReadinessScoreResult;
  digital_twin: DigitalTwinImagingSummaryResult;
  recommended_actions: ImagingOsRecommendedAction[];
  evaluator_version: typeof IMAGING_SUMMARY_EVALUATOR_VERSION;
};

const CRITICAL_COMPONENTS: ReadonlySet<ImagingOsSummaryComponent> = new Set([
  "quality",
  "protocol",
  "comparison",
]);

const SUMMARY_INPUT_COMPONENTS: readonly ImagingOsSummaryComponent[] = [
  "protocol",
  "quality",
  "progression",
  "surgical",
  "outcome",
  "comparison",
  "measurement",
];

const HAIRAUDIT_WEIGHTS: Partial<Record<ImagingOsSummaryComponent, number>> = {
  protocol: 0.2,
  quality: 0.2,
  comparison: 0.2,
  outcome: 0.2,
  measurement: 0.2,
};

const HAIRAUDIT_READINESS_THRESHOLDS: Partial<Record<ImagingOsSummaryComponent, number>> = {
  protocol: 80,
  quality: 75,
  comparison: 70,
  outcome: 70,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function scoreFromProtocolStatus(status: ImagingOsProtocolEvaluationResult["status"]): number {
  switch (status) {
    case "complete":
      return 100;
    case "partial":
      return 70;
    case "incomplete":
      return 30;
    case "invalid":
      return 0;
    default:
      return 0;
  }
}

function scoreFromQualityStatus(status: ImagingOsImageQualityStatus): number {
  switch (status) {
    case "excellent":
      return 95;
    case "acceptable":
      return 80;
    case "borderline":
      return 50;
    case "poor":
      return 20;
    case "invalid":
      return 0;
    default:
      return 0;
  }
}

function scoreFromProgressionStatus(
  status: ImagingOsProgressionEvaluationResult["readiness_status"]
): number {
  switch (status) {
    case "ready":
      return 100;
    case "partial":
      return 70;
    case "not_ready":
      return 30;
    case "invalid":
      return 0;
    default:
      return 0;
  }
}

function scoreFromSurgicalStatus(
  status: ImagingOsSurgicalReadinessResult["readiness_status"]
): number {
  switch (status) {
    case "ready":
      return 100;
    case "partial":
      return 70;
    case "not_ready":
      return 30;
    case "invalid":
      return 0;
    default:
      return 0;
  }
}

function scoreFromOutcomeStatus(
  status: ImagingOsOutcomeMeasurementResult["measurement_status"]
): number {
  switch (status) {
    case "measurable":
      return 100;
    case "partially_measurable":
      return 70;
    case "insufficient_evidence":
      return 30;
    case "invalid":
      return 0;
    default:
      return 0;
  }
}

function scoreFromComparisonStatus(
  status: ImagingOsComparisonReadinessResult["comparison_status"]
): number {
  switch (status) {
    case "ready":
      return 100;
    case "partial":
      return 70;
    case "insufficient_data":
      return 30;
    case "invalid":
      return 0;
    default:
      return 0;
  }
}

function scoreMeasurementResults(results: ImagingOsVisualMeasurementResult[]): number {
  if (results.length === 0) return 0;

  const scores = results.map((result) => {
    let score = result.confidence * 100;
    if (result.requires_human_review) {
      score -= 10;
    }
    return clampScore(score);
  });

  return clampScore(average(scores));
}

function resolveOverallStatus(
  overallScore: number,
  componentScores: ImagingOsComponentScore[]
): ImagingOsOverallStatus {
  const hasInvalidCritical = componentScores.some(
    (entry) =>
      CRITICAL_COMPONENTS.has(entry.component) &&
      (entry.status === "invalid" || entry.score === 0)
  );

  if (hasInvalidCritical) {
    return "blocked";
  }

  if (overallScore >= 95) return "excellent";
  if (overallScore >= 80) return "ready";
  if (overallScore >= 60) return "partial";
  if (overallScore >= 40) return "insufficient_data";
  return "blocked";
}

function resolveAuditStatus(hairauditScore: number): ImagingOsOverallStatus {
  if (hairauditScore >= 95) return "excellent";
  if (hairauditScore >= 80) return "ready";
  if (hairauditScore >= 60) return "partial";
  if (hairauditScore >= 40) return "insufficient_data";
  return "blocked";
}

function resolveClinicalConfidence(overallScore: number): DigitalTwinClinicalConfidence {
  if (overallScore >= 85) return "high";
  if (overallScore >= 60) return "medium";
  return "low";
}

function getComponentScore(
  componentScores: ImagingOsComponentScore[],
  component: ImagingOsSummaryComponent
): number | undefined {
  return componentScores.find((entry) => entry.component === component)?.score;
}

function formatMissingCategories(categories: string[]): string {
  return categories.length > 0 ? categories.join(", ") : "required views";
}

function buildProtocolComponentScore(
  result: ImagingOsProtocolEvaluationResult
): ImagingOsComponentScore {
  const warnings =
    result.missing_required.length > 0
      ? [`Missing required categories: ${formatMissingCategories(result.missing_required)}`]
      : [];
  const blockers = result.status === "invalid" ? ["Protocol evaluation invalid."] : [];

  return {
    component: "protocol",
    score: scoreFromProtocolStatus(result.status),
    status: result.status,
    warnings: uniqueStrings(warnings),
    blockers,
  };
}

function buildQualityComponentScore(
  results: ImagingOsImageQualityEvaluationResult[]
): ImagingOsComponentScore {
  const avgScore = clampScore(average(results.map((result) => result.quality_score)));
  const dominantStatus = results.some((result) => result.quality_status === "invalid")
    ? "invalid"
    : results.some((result) => result.quality_status === "poor")
      ? "poor"
      : results.some((result) => result.quality_status === "borderline")
        ? "borderline"
        : results.some((result) => result.quality_status === "acceptable")
          ? "acceptable"
          : "excellent";

  return {
    component: "quality",
    score: avgScore,
    status: dominantStatus,
    warnings: uniqueStrings(results.flatMap((result) => result.warnings)),
    blockers: uniqueStrings(results.flatMap((result) => result.blockers)),
  };
}

function buildProgressionComponentScore(
  result: ImagingOsProgressionEvaluationResult
): ImagingOsComponentScore {
  return {
    component: "progression",
    score: scoreFromProgressionStatus(result.readiness_status),
    status: result.readiness_status,
    warnings: uniqueStrings(result.warnings),
    blockers: uniqueStrings(result.quality_blockers),
  };
}

function buildSurgicalComponentScore(
  result: ImagingOsSurgicalReadinessResult
): ImagingOsComponentScore {
  return {
    component: "surgical",
    score: scoreFromSurgicalStatus(result.readiness_status),
    status: result.readiness_status,
    warnings: uniqueStrings(result.warnings),
    blockers: uniqueStrings(result.quality_blockers),
  };
}

function buildOutcomeComponentScore(
  result: ImagingOsOutcomeMeasurementResult
): ImagingOsComponentScore {
  const warnings: string[] = [];
  if (result.missing_timepoints.length > 0) {
    warnings.push(`Missing timepoints: ${result.missing_timepoints.join(", ")}`);
  }
  if (result.recommended_next_capture.trim().length > 0) {
    warnings.push(result.recommended_next_capture);
  }

  return {
    component: "outcome",
    score: scoreFromOutcomeStatus(result.measurement_status),
    status: result.measurement_status,
    warnings: uniqueStrings(warnings),
    blockers: uniqueStrings(result.quality_blockers),
  };
}

function buildComparisonComponentScore(
  result: ImagingOsComparisonReadinessResult
): ImagingOsComponentScore {
  const warnings = [...result.warnings];
  if (result.missing_required_categories.length > 0) {
    warnings.push(
      `Missing comparison categories: ${formatMissingCategories(result.missing_required_categories)}`
    );
  }

  return {
    component: "comparison",
    score: scoreFromComparisonStatus(result.comparison_status),
    status: result.comparison_status,
    warnings: uniqueStrings(warnings),
    blockers: uniqueStrings(result.quality_blockers),
  };
}

function buildMeasurementComponentScore(
  results: ImagingOsVisualMeasurementResult[]
): ImagingOsComponentScore {
  const invalidCount = results.filter((result) => result.validation_status === "invalid").length;
  const status =
    invalidCount === results.length
      ? "invalid"
      : results.some((result) => result.requires_human_review)
        ? "review_required"
        : "ready";

  return {
    component: "measurement",
    score: scoreMeasurementResults(results),
    status,
    warnings: uniqueStrings(results.flatMap((result) => result.warnings)),
    blockers: uniqueStrings(results.flatMap((result) => result.blockers)),
  };
}

/** Map each available IM-3..IM-9 phase output to a normalized component score. */
export function calculateImagingComponentScores(
  input: ImagingOsSummaryInput
): ImagingOsComponentScore[] {
  const scores: ImagingOsComponentScore[] = [];

  if (input.protocol_result) {
    scores.push(buildProtocolComponentScore(input.protocol_result));
  }
  if (input.quality_results && input.quality_results.length > 0) {
    scores.push(buildQualityComponentScore(input.quality_results));
  }
  if (input.progression_result) {
    scores.push(buildProgressionComponentScore(input.progression_result));
  }
  if (input.surgical_result) {
    scores.push(buildSurgicalComponentScore(input.surgical_result));
  }
  if (input.outcome_result) {
    scores.push(buildOutcomeComponentScore(input.outcome_result));
  }
  if (input.comparison_result) {
    scores.push(buildComparisonComponentScore(input.comparison_result));
  }
  if (input.measurement_results && input.measurement_results.length > 0) {
    scores.push(buildMeasurementComponentScore(input.measurement_results));
  }

  return scores;
}

/** Aggregate component scores into an overall imaging summary. */
export function calculateOverallImagingScore(
  input: ImagingOsSummaryInput
): ImagingOsOverallScoreResult {
  const componentScores = calculateImagingComponentScores(input);
  const overallScore =
    componentScores.length > 0
      ? clampScore(average(componentScores.map((entry) => entry.score)))
      : 0;

  const sorted = [...componentScores].sort((a, b) => b.score - a.score);
  const strongestComponents = sorted.slice(0, 3);
  const weakestComponents = [...componentScores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  return {
    overall_score: overallScore,
    component_scores: componentScores,
    overall_status: resolveOverallStatus(overallScore, componentScores),
    strongest_components: strongestComponents,
    weakest_components: weakestComponents,
    warnings: uniqueStrings(componentScores.flatMap((entry) => entry.warnings)),
    blockers: uniqueStrings(componentScores.flatMap((entry) => entry.blockers)),
    evaluator_version: IMAGING_SUMMARY_EVALUATOR_VERSION,
  };
}

function buildMissingRequirementMessages(
  componentScores: ImagingOsComponentScore[]
): string[] {
  const requirements: string[] = [];

  for (const [component, threshold] of Object.entries(HAIRAUDIT_READINESS_THRESHOLDS)) {
    const entry = componentScores.find((score) => score.component === component);
    if (!entry) {
      requirements.push(`${component} evaluation not provided`);
      continue;
    }
    if (entry.score < (threshold ?? 0)) {
      requirements.push(`${component} score ${entry.score} below required ${threshold}`);
    }
  }

  return requirements;
}

/** Build HairAudit readiness score and audit gate evaluation. */
export function buildHairAuditReadinessScore(
  input: ImagingOsSummaryInput
): HairAuditReadinessScoreResult {
  const componentScores = calculateImagingComponentScores(input);

  let weightedSum = 0;
  for (const [component, weight] of Object.entries(HAIRAUDIT_WEIGHTS)) {
    const score = getComponentScore(componentScores, component as ImagingOsSummaryComponent) ?? 0;
    weightedSum += score * (weight ?? 0);
  }
  const hairauditScore = clampScore(weightedSum);

  const missingRequirements = buildMissingRequirementMessages(componentScores);
  const auditReady = missingRequirements.length === 0;

  const recommendedNextActions: string[] = [];
  const outcome = input.outcome_result;
  if (outcome?.recommended_next_capture.trim()) {
    recommendedNextActions.push(outcome.recommended_next_capture);
  }
  const comparison = input.comparison_result;
  if (comparison && comparison.missing_required_categories.length > 0) {
    const followup = comparison.detected_followup_timepoints[0] ?? "month_12";
    for (const category of comparison.missing_required_categories) {
      recommendedNextActions.push(`Capture ${followup.replace(/_/g, " ")} ${category} image`);
    }
  }
  const protocol = input.protocol_result;
  if (protocol && protocol.missing_required.length > 0) {
    recommendedNextActions.push(
      `Complete baseline set: ${formatMissingCategories(protocol.missing_required)}`
    );
  }

  return {
    hairaudit_score: hairauditScore,
    audit_ready: auditReady,
    audit_status: resolveAuditStatus(hairauditScore),
    missing_requirements: missingRequirements,
    recommended_next_actions: uniqueStrings(recommendedNextActions),
  };
}

/** Build Digital Twin imaging summary from aggregated case intelligence. */
export function buildDigitalTwinImagingSummary(
  input: ImagingOsSummaryInput
): DigitalTwinImagingSummaryResult {
  const overall = calculateOverallImagingScore(input);
  const hairaudit = buildHairAuditReadinessScore(input);

  const presentComponents = SUMMARY_INPUT_COMPONENTS.filter((component) => {
    switch (component) {
      case "protocol":
        return input.protocol_result != null;
      case "quality":
        return (input.quality_results?.length ?? 0) > 0;
      case "progression":
        return input.progression_result != null;
      case "surgical":
        return input.surgical_result != null;
      case "outcome":
        return input.outcome_result != null;
      case "comparison":
        return input.comparison_result != null;
      case "measurement":
        return (input.measurement_results?.length ?? 0) > 0;
      default:
        return false;
    }
  });

  const measurableDomains = uniqueStrings(
    (input.measurement_results ?? [])
      .filter((result) => result.validation_status !== "invalid")
      .map((result) => result.domain)
  );

  const pendingMeasurements = (input.measurement_results ?? [])
    .filter(
      (result) =>
        result.requires_human_review ||
        result.value == null ||
        result.validation_status !== "valid"
    )
    .map((result) => result.domain);

  const missingEvidence: string[] = [];
  if (input.outcome_result?.missing_timepoints.length) {
    missingEvidence.push(
      `Missing outcome timepoints: ${input.outcome_result.missing_timepoints.join(", ")}`
    );
  }
  if (input.comparison_result?.missing_required_categories.length) {
    missingEvidence.push(
      `Missing comparison categories: ${input.comparison_result.missing_required_categories.join(", ")}`
    );
  }
  if (input.protocol_result?.missing_required.length) {
    missingEvidence.push(
      `Missing protocol categories: ${input.protocol_result.missing_required.join(", ")}`
    );
  }

  return {
    twin_imaging_score: overall.overall_score,
    clinical_confidence: resolveClinicalConfidence(overall.overall_score),
    imaging_completeness: clampScore(
      (presentComponents.length / SUMMARY_INPUT_COMPONENTS.length) * 100
    ),
    measurable_domains: measurableDomains,
    pending_measurements: uniqueStrings(pendingMeasurements),
    missing_evidence: uniqueStrings(missingEvidence),
    next_required_capture: input.outcome_result?.recommended_next_capture?.trim() || null,
    ready_for_ai_analysis: overall.overall_score > 80,
    ready_for_global_benchmarking: hairaudit.hairaudit_score > 85,
  };
}

function inferActionForComponent(entry: ImagingOsComponentScore): ImagingOsRecommendedAction | null {
  const priority: ImagingOsRecommendedActionPriority =
    entry.score < 40 ? "high" : entry.score < 70 ? "medium" : "low";

  if (entry.blockers.length > 0) {
    return {
      priority: "high",
      component: entry.component,
      action: entry.blockers[0],
      reason: `${entry.component} blocked imaging readiness`,
    };
  }

  if (entry.component === "quality" && entry.score < 75) {
    const donorBlocker = entry.blockers.find((blocker) =>
      blocker.toLowerCase().includes("donor")
    );
    const scalpBlocker = entry.warnings.find((warning) =>
      warning.toLowerCase().includes("scalp")
    );
    return {
      priority,
      component: "quality",
      action: donorBlocker ? "Recapture donor image" : "Recapture low-quality clinical image",
      reason: scalpBlocker ?? entry.warnings[0] ?? "Image quality below HairAudit threshold",
    };
  }

  if (entry.component === "comparison" && entry.score <= 70) {
    return {
      priority,
      component: "comparison",
      action: entry.warnings[0] ?? "Capture missing follow-up comparison image",
      reason: "No valid follow-up comparison pair",
    };
  }

  if (entry.component === "protocol" && entry.score < 80) {
    return {
      priority,
      component: "protocol",
      action: entry.warnings[0] ?? "Complete required baseline photography set",
      reason: "Protocol completeness below audit threshold",
    };
  }

  if (entry.component === "outcome" && entry.score < 70) {
    return {
      priority,
      component: "outcome",
      action: entry.warnings[0] ?? "Capture outcome follow-up evidence",
      reason: "Outcome measurement evidence insufficient",
    };
  }

  if (entry.component === "measurement" && entry.score < 70) {
    return {
      priority,
      component: "measurement",
      action: "Review or rerun visual measurements",
      reason: entry.warnings[0] ?? "Measurement confidence below threshold",
    };
  }

  if (entry.component === "progression" && entry.score < 70) {
    return {
      priority,
      component: "progression",
      action: entry.warnings[0] ?? "Capture missing progression timepoints",
      reason: "Longitudinal progression evidence incomplete",
    };
  }

  if (entry.component === "surgical" && entry.score < 70) {
    return {
      priority,
      component: "surgical",
      action: entry.warnings[0] ?? "Capture missing surgical documentation images",
      reason: "Surgical imaging readiness incomplete",
    };
  }

  return null;
}

/** Recommend prioritized next imaging actions from weakest components. */
export function recommendNextImagingActions(
  input: ImagingOsSummaryInput
): ImagingOsRecommendedAction[] {
  const overall = calculateOverallImagingScore(input);
  const actions: ImagingOsRecommendedAction[] = [];

  for (const entry of overall.weakest_components) {
    const action = inferActionForComponent(entry);
    if (action) {
      actions.push(action);
    }
  }

  if (actions.length === 0) {
    for (const entry of overall.component_scores) {
      const action = inferActionForComponent(entry);
      if (action && action.priority !== "low") {
        actions.push(action);
      }
    }
  }

  const priorityOrder: Record<ImagingOsRecommendedActionPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/** Run full case-level ImagingOS evaluation (IM-10 orchestration). */
export function runFullImagingOsCaseEvaluation(
  input: ImagingOsSummaryInput
): ImagingOsFullCaseEvaluationResult {
  const componentScores = calculateImagingComponentScores(input);
  const overall = calculateOverallImagingScore(input);
  const hairaudit = buildHairAuditReadinessScore(input);
  const digitalTwin = buildDigitalTwinImagingSummary(input);
  const recommendedActions = recommendNextImagingActions(input);

  return {
    component_scores: componentScores,
    overall,
    hairaudit,
    digital_twin: digitalTwin,
    recommended_actions: recommendedActions,
    evaluator_version: IMAGING_SUMMARY_EVALUATOR_VERSION,
  };
}

export {
  scoreFromProtocolStatus,
  scoreFromQualityStatus,
  scoreFromProgressionStatus,
  scoreFromSurgicalStatus,
  scoreFromOutcomeStatus,
  scoreFromComparisonStatus,
  scoreMeasurementResults,
};
