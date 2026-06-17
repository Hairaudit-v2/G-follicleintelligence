/**
 * ImagingOS — HairAudit case-level protocol adapter (Phase IM-3).
 * Maps HairAudit category labels to canonical categories and evaluates baseline protocol.
 */

import { mapExternalCategoryToCanonical } from "../categories";
import {
  evaluateImageProtocolCompleteness,
  type ImagingOsProtocolEvaluationResult,
} from "../protocol";

/** Evaluate HairAudit case images against the hairaudit_baseline protocol (pure). */
export function evaluateHairAuditCaseImageProtocol(
  hairAuditCategoryLabels: string[]
): ImagingOsProtocolEvaluationResult {
  const categories = hairAuditCategoryLabels.map(
    (label) => mapExternalCategoryToCanonical(label).canonical
  );

  return evaluateImageProtocolCompleteness({
    protocol: "hairaudit_baseline",
    categories,
  });
}
