/**
 * ImagingOS — HairAudit case summary adapter (Phase IM-10).
 * Builds HairAudit score contract from comparison, measurement, and outcome results.
 */

import type { ImagingOsComparisonReadinessResult } from "../comparison";
import type { ImagingOsVisualMeasurementResult } from "../measurement";
import type { ImagingOsOutcomeMeasurementResult } from "../outcomes";
import {
  buildHairAuditReadinessScore,
  runFullImagingOsCaseEvaluation,
  type HairAuditReadinessScoreResult,
  type ImagingOsFullCaseEvaluationResult,
  type ImagingOsSummaryInput,
} from "../summary";

export type HairAuditSummaryAdapterInput = {
  comparison_result?: ImagingOsComparisonReadinessResult;
  measurement_results?: ImagingOsVisualMeasurementResult[];
  outcome_result?: ImagingOsOutcomeMeasurementResult;
  protocol_result?: ImagingOsSummaryInput["protocol_result"];
  quality_results?: ImagingOsSummaryInput["quality_results"];
};

export type HairAuditImagingSummaryContract = HairAuditReadinessScoreResult &
  Pick<
    ImagingOsFullCaseEvaluationResult,
    "component_scores" | "recommended_actions" | "evaluator_version"
  > & {
    comparison_status?: ImagingOsComparisonReadinessResult["comparison_status"];
    outcome_status?: ImagingOsOutcomeMeasurementResult["measurement_status"];
    measurement_count: number;
  };

function toSummaryInput(input: HairAuditSummaryAdapterInput): ImagingOsSummaryInput {
  return {
    comparison_result: input.comparison_result,
    measurement_results: input.measurement_results,
    outcome_result: input.outcome_result,
    protocol_result: input.protocol_result,
    quality_results: input.quality_results,
  };
}

/** Build HairAudit imaging summary contract from IM-7..IM-9 outputs (pure). */
export function buildHairAuditImagingSummary(
  input: HairAuditSummaryAdapterInput
): HairAuditImagingSummaryContract {
  const summaryInput = toSummaryInput(input);
  const evaluation = runFullImagingOsCaseEvaluation(summaryInput);
  const hairaudit = buildHairAuditReadinessScore(summaryInput);

  return {
    ...hairaudit,
    component_scores: evaluation.component_scores,
    recommended_actions: evaluation.recommended_actions,
    evaluator_version: evaluation.evaluator_version,
    comparison_status: input.comparison_result?.comparison_status,
    outcome_status: input.outcome_result?.measurement_status,
    measurement_count: input.measurement_results?.length ?? 0,
  };
}
