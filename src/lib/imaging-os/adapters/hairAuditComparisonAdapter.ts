/**
 * ImagingOS — HairAudit visual comparison adapter (Phase IM-8).
 * Maps HairAudit category/timepoint labels to comparison images and evaluates growth_change readiness.
 */

import { mapExternalCategoryToCanonical } from "../categories";
import {
  evaluateVisualComparisonReadiness,
  type ImagingOsComparisonImage,
  type ImagingOsComparisonReadinessResult,
} from "../comparison";
import type { ImagingOsImageQualityStatus } from "../quality";
import { normalizeImagingOsTimepoint, type ImagingOsTimepoint } from "../progression";

export type HairAuditComparisonImageInput = {
  category: string;
  timepoint?: string;
  quality_status?: string;
  is_clinically_usable?: boolean;
};

function resolveQualityStatus(qualityStatus?: string): ImagingOsImageQualityStatus | undefined {
  if (qualityStatus == null || qualityStatus.trim().length === 0) {
    return undefined;
  }
  const normalized = qualityStatus.trim().toLowerCase();
  if (
    normalized === "excellent" ||
    normalized === "acceptable" ||
    normalized === "borderline" ||
    normalized === "poor" ||
    normalized === "invalid"
  ) {
    return normalized;
  }
  return undefined;
}

function mapHairAuditTimepoint(timepoint?: string): ImagingOsTimepoint {
  if (timepoint == null || timepoint.trim().length === 0) {
    return "unknown";
  }
  return normalizeImagingOsTimepoint(timepoint);
}

function buildComparisonImageFromHairAuditInput(
  item: HairAuditComparisonImageInput,
  index: number
): ImagingOsComparisonImage {
  const categoryMapping = mapExternalCategoryToCanonical(item.category);
  const timepoint = mapHairAuditTimepoint(item.timepoint);
  const qualityStatus = resolveQualityStatus(item.quality_status);

  return {
    image_id: `hairaudit-comparison-${index}`,
    canonical_category: categoryMapping.canonical,
    timepoint,
    ...(qualityStatus ? { quality_status: qualityStatus } : {}),
    ...(item.is_clinically_usable != null
      ? { is_clinically_usable: item.is_clinically_usable }
      : {}),
  };
}

/** Evaluate HairAudit image records against growth_change visual comparison (pure). */
export function evaluateHairAuditVisualComparison(
  input: HairAuditComparisonImageInput[]
): ImagingOsComparisonReadinessResult {
  const images = input.map((item, index) => buildComparisonImageFromHairAuditInput(item, index));

  return evaluateVisualComparisonReadiness({
    domain: "growth_change",
    images,
  });
}
