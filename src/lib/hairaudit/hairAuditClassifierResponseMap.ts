/**
 * Maps HLI / FI OS classifier output to HairAudit image-classify API contract.
 */

import { confidenceBandForScore } from "@/src/lib/imaging-os/categories";
import { mapExternalCategoryToCanonical } from "@/src/lib/imaging-os/categories";
import type { FiAiImageCategory } from "@/src/lib/hair-intelligence/imageClassification/types";
import type { ClinicalHairImageClassifierResult } from "./classifyClinicalHairImageFromModelUrl";

const HLI_TO_CANONICAL: Record<FiAiImageCategory, string> = {
  front: "front",
  left_profile: "left",
  right_profile: "right",
  top: "top",
  crown: "crown",
  donor: "donor",
  graft_tray: "graft_tray",
  immediate_post_op: "immediate_post_op",
  follow_up: "follow_up",
  microscopic: "microscopic",
  unknown: "other",
};

const HLI_TO_HAIRAUDIT_CATEGORY: Record<FiAiImageCategory, string> = {
  front: "patient_current_front",
  left_profile: "patient_current_left",
  right_profile: "patient_current_right",
  top: "patient_current_top",
  crown: "patient_current_crown",
  donor: "patient_current_donor",
  graft_tray: "intraop_graft_tray",
  immediate_post_op: "postop_immediate",
  follow_up: "follow_up_progress",
  microscopic: "trichoscopy",
  unknown: "patient_current_front",
};

export function mapHliCategoryToCanonicalPhotoCategory(category: FiAiImageCategory): string {
  return HLI_TO_CANONICAL[category] ?? "other";
}

export function mapHliCategoryToHairAuditExternalCategory(category: FiAiImageCategory): string {
  return HLI_TO_HAIRAUDIT_CATEGORY[category] ?? "patient_current_front";
}

export function buildDegradedHairAuditClassification(input: {
  canonical_photo_category: string;
  legacy_upload_type?: string;
  classifier_version: string;
  reason: string;
}): ClinicalHairImageClassifierResult {
  const mapping = mapExternalCategoryToCanonical(
    input.canonical_photo_category,
    input.legacy_upload_type
  );
  const confidence = 0.45;
  const band = confidenceBandForScore(confidence);

  return {
    category: input.canonical_photo_category,
    canonical_photo_category: mapping.canonical,
    confidence,
    quality_status: "not_evaluated",
    protocol_status: "not_evaluated",
    classifier_version: input.classifier_version,
    notes: `Degraded classification (${band} confidence): ${input.reason}`,
  };
}

export function buildHairAuditClassificationFromHli(input: {
  hliCategory: FiAiImageCategory;
  categoryConfidence: number;
  classifierVersion: string;
  notes: string;
  fallbackExternalCategory: string;
}): ClinicalHairImageClassifierResult {
  const confidence = Math.max(0, Math.min(1, input.categoryConfidence));
  const band = confidenceBandForScore(confidence);
  const useUnknown = input.hliCategory === "unknown" || confidence < 0.4;

  const canonical = useUnknown
    ? mapExternalCategoryToCanonical(input.fallbackExternalCategory).canonical
    : mapHliCategoryToCanonicalPhotoCategory(input.hliCategory);

  const externalCategory = useUnknown
    ? input.fallbackExternalCategory
    : mapHliCategoryToHairAuditExternalCategory(input.hliCategory);

  const safeNotes =
    confidence < 0.65
      ? `Low confidence (${band}); staff review recommended. ${input.notes}`.trim()
      : input.notes.trim();

  return {
    category: externalCategory,
    canonical_photo_category: canonical,
    confidence,
    quality_status: confidence >= 0.65 ? "acceptable" : "review_recommended",
    protocol_status: "not_evaluated",
    classifier_version: input.classifierVersion,
    notes: safeNotes.slice(0, 2000),
  };
}