/**
 * ImagingOS — HairAudit surgical outcome adapter (Phase IM-6).
 * Maps HairAudit category/timepoint labels to surgical events and evaluates outcome_audit readiness.
 */

import { mapExternalCategoryToCanonical } from "../categories";
import {
  evaluateSurgicalImageReadiness,
  normalizeSurgicalImageEventType,
  type ImagingOsSurgicalImage,
  type ImagingOsSurgicalImageEventType,
  type ImagingOsSurgicalReadinessResult,
} from "../surgical";
import type { ImagingOsImageQualityStatus } from "../quality";

export type HairAuditSurgicalOutcomeImageInput = {
  category: string;
  timepoint?: string;
  quality_status?: string;
  is_clinically_usable?: boolean;
};

const HAIRAUDIT_TIMEPOINT_TO_SURGICAL_EVENT: Record<string, ImagingOsSurgicalImageEventType> = {
  baseline: "pre_op",
  pre_op: "pre_op",
  preop: "pre_op",
  "pre-op": "pre_op",
  immediate_post_op: "immediate_post_op",
  postop: "immediate_post_op",
  "post-op": "immediate_post_op",
  "12_month": "month_12_outcome",
  month_12: "month_12_outcome",
  m12: "month_12_outcome",
  follow_up: "month_12_outcome",
};

function normalizeTimepointKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function mapHairAuditTimepointToSurgicalEvent(timepoint?: string): ImagingOsSurgicalImageEventType {
  if (timepoint == null || timepoint.trim().length === 0) {
    return "unknown";
  }
  const key = normalizeTimepointKey(timepoint);
  const mapped = HAIRAUDIT_TIMEPOINT_TO_SURGICAL_EVENT[key];
  if (mapped) {
    return mapped;
  }
  return normalizeSurgicalImageEventType(timepoint);
}

function resolveQualityStatus(
  qualityStatus?: string
): ImagingOsImageQualityStatus | "not_evaluated" {
  if (qualityStatus == null || qualityStatus.trim().length === 0) {
    return "not_evaluated";
  }
  const normalized = qualityStatus.trim().toLowerCase();
  if (
    normalized === "excellent" ||
    normalized === "acceptable" ||
    normalized === "borderline" ||
    normalized === "poor" ||
    normalized === "invalid" ||
    normalized === "not_evaluated"
  ) {
    return normalized;
  }
  return "not_evaluated";
}

function buildSurgicalImageFromHairAuditInput(
  item: HairAuditSurgicalOutcomeImageInput,
  index: number
): ImagingOsSurgicalImage {
  const categoryMapping = mapExternalCategoryToCanonical(item.category);
  const surgicalEvent = mapHairAuditTimepointToSurgicalEvent(item.timepoint);
  const qualityStatus = resolveQualityStatus(item.quality_status);

  return {
    image_id: `hairaudit-outcome-${index}`,
    canonical_category: categoryMapping.canonical,
    surgical_event: surgicalEvent,
    quality_status: qualityStatus,
    ...(item.is_clinically_usable != null
      ? { is_clinically_usable: item.is_clinically_usable }
      : {}),
  };
}

/** Evaluate HairAudit surgical outcome images against outcome_audit readiness (pure). */
export function evaluateHairAuditSurgicalOutcomeReadiness(
  input: HairAuditSurgicalOutcomeImageInput[]
): ImagingOsSurgicalReadinessResult {
  const images = input.map((item, index) => buildSurgicalImageFromHairAuditInput(item, index));

  return evaluateSurgicalImageReadiness({
    domain: "outcome_audit",
    images,
  });
}
