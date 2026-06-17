/**
 * ImagingOS — HairAudit AI vision readiness adapter (Phase IM-11).
 * Builds AI vision request contracts from HairAudit case readiness outputs.
 */

import type { ImagingOsComparisonReadinessResult } from "../comparison";
import type { ImagingOsOutcomeMeasurementResult } from "../outcomes";
import {
  buildAiVisionRequestContract,
  type ImagingOsAiVisionEvidence,
  type ImagingOsAiVisionRequestContract,
  type ImagingOsAiVisionSummaryResultInput,
  type ImagingOsAiVisionTaskType,
} from "../aiVision";

export type HairAuditAiVisionReadinessInput = {
  evidence: ImagingOsAiVisionEvidence[];
  comparison_result?: ImagingOsComparisonReadinessResult;
  outcome_result?: ImagingOsOutcomeMeasurementResult;
  summary_result?: ImagingOsAiVisionSummaryResultInput;
  task_type?: ImagingOsAiVisionTaskType;
  request_id?: string;
  timestamp?: string;
};

/** Build HairAudit AI vision readiness request contract (pure, no API changes). */
export function buildHairAuditAiVisionReadiness(
  input: HairAuditAiVisionReadinessInput
): ImagingOsAiVisionRequestContract {
  return buildAiVisionRequestContract({
    task_type: input.task_type ?? "surgical_outcome_review",
    evidence: input.evidence,
    ...(input.comparison_result ? { comparison_result: input.comparison_result } : {}),
    ...(input.outcome_result ? { outcome_result: input.outcome_result } : {}),
    ...(input.summary_result ? { summary_result: input.summary_result } : {}),
    ...(input.request_id ? { request_id: input.request_id } : {}),
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
  });
}
