/**
 * ImagingOS — HairAudit visual measurement adapter (Phase IM-9).
 * Maps HairAudit image records to comparison readiness and builds measurement stubs.
 */

import {
  evaluateHairAuditVisualComparison,
  type HairAuditComparisonImageInput,
} from "./hairAuditComparisonAdapter";
import {
  buildMeasurementStubsFromComparisonResult,
  type ImagingOsVisualMeasurementResult,
} from "../measurement";
import type { ImagingOsComparisonReadinessResult } from "../comparison";

export type HairAuditMeasurementInput =
  | HairAuditComparisonImageInput[]
  | ImagingOsComparisonReadinessResult;

function isComparisonReadinessResult(
  input: HairAuditMeasurementInput
): input is ImagingOsComparisonReadinessResult {
  return (
    typeof input === "object" &&
    input != null &&
    !Array.isArray(input) &&
    "comparison_status" in input &&
    "evaluator_version" in input
  );
}

/** Build HairAudit measurement stubs from records or an existing comparison result (pure). */
export function buildHairAuditMeasurementStubs(
  input: HairAuditMeasurementInput
): ImagingOsVisualMeasurementResult[] {
  const comparisonResult = isComparisonReadinessResult(input)
    ? input
    : evaluateHairAuditVisualComparison(input);

  return buildMeasurementStubsFromComparisonResult(comparisonResult);
}
