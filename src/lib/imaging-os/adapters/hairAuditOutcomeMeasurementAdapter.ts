/**
 * ImagingOS — HairAudit outcome measurement adapter (Phase IM-7).
 * Maps HairAudit category/timepoint labels to outcome evidence and evaluates surgical_outcome_audit.
 */

import { mapExternalCategoryToCanonical } from "../categories";
import {
  evaluateOutcomeMeasurementReadiness,
  type ImagingOsOutcomeEvidence,
  type ImagingOsOutcomeMeasurementResult,
} from "../outcomes";
import type { ImagingOsImageQualityStatus } from "../quality";
import { normalizeImagingOsTimepoint, type ImagingOsTimepoint } from "../progression";
import { normalizeSurgicalImageEventType, type ImagingOsSurgicalImageEventType } from "../surgical";

export type HairAuditOutcomeMeasurementImageInput = {
  category: string;
  timepoint?: string;
  quality_status?: string;
  is_clinically_usable?: boolean;
  surgical_event?: string;
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

function mapHairAuditSurgicalEvent(
  surgicalEvent?: string,
  timepoint?: string
): ImagingOsSurgicalImageEventType | undefined {
  if (surgicalEvent != null && surgicalEvent.trim().length > 0) {
    const normalized = normalizeSurgicalImageEventType(surgicalEvent);
    return normalized === "unknown" ? undefined : normalized;
  }

  const timepointKey = timepoint
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (timepointKey === "baseline" || timepointKey === "pre_op" || timepointKey === "preop") {
    return "pre_op";
  }
  if (
    timepointKey === "immediate_post_op" ||
    timepointKey === "postop" ||
    timepointKey === "post_op"
  ) {
    return "immediate_post_op";
  }
  if (
    timepointKey === "month_12" ||
    timepointKey === "12_month" ||
    timepointKey === "m12" ||
    timepointKey === "follow_up"
  ) {
    return "month_12_outcome";
  }

  return undefined;
}

function buildOutcomeEvidenceFromHairAuditInput(
  item: HairAuditOutcomeMeasurementImageInput,
  index: number
): ImagingOsOutcomeEvidence {
  const categoryMapping = mapExternalCategoryToCanonical(item.category);
  const timepoint = mapHairAuditTimepoint(item.timepoint);
  const qualityStatus = resolveQualityStatus(item.quality_status);
  const surgicalEvent = mapHairAuditSurgicalEvent(item.surgical_event, item.timepoint);

  return {
    image_id: `hairaudit-outcome-measurement-${index}`,
    canonical_category: categoryMapping.canonical,
    timepoint,
    ...(surgicalEvent ? { surgical_event: surgicalEvent } : {}),
    ...(qualityStatus ? { quality_status: qualityStatus } : {}),
    ...(item.is_clinically_usable != null
      ? { is_clinically_usable: item.is_clinically_usable }
      : {}),
  };
}

/** Evaluate HairAudit outcome images against surgical_outcome_audit measurement (pure). */
export function evaluateHairAuditOutcomeMeasurement(
  input: HairAuditOutcomeMeasurementImageInput[]
): ImagingOsOutcomeMeasurementResult {
  const evidence = input.map((item, index) => buildOutcomeEvidenceFromHairAuditInput(item, index));

  return evaluateOutcomeMeasurementReadiness({
    domain: "surgical_outcome_audit",
    evidence,
  });
}
