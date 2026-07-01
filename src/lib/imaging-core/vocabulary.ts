/**
 * Imaging Core — shared vocabulary hierarchy (Phase 0 consolidation).
 *
 * Hierarchy: classifier (FI_AI_*) → canonical (CANONICAL_*) → UI bucket (PatientImageCategory)
 * → legacy aliases (FiUploadType, HairAudit labels, HLI document kinds).
 */

import { FI_AI_IMAGE_CATEGORIES, type FiAiImageCategory } from "@/src/lib/hair-intelligence/imageClassification/types";
import {
  CANONICAL_HAIR_IMAGE_CATEGORIES,
  mapExternalCategoryToCanonical,
  type CanonicalHairImageCategory,
  type ExternalCategoryMappingResult,
} from "@/src/lib/imaging-os/categories";
import type { FiUploadType } from "@/lib/fi/uploadTypes";
import type { PatientImageCategory } from "@/src/lib/patientImages/patientImageTypes";

export {
  CANONICAL_HAIR_IMAGE_CATEGORIES,
  FI_AI_IMAGE_CATEGORIES,
  mapExternalCategoryToCanonical,
};
export type { CanonicalHairImageCategory, ExternalCategoryMappingResult, FiAiImageCategory };

/** UI-facing patient image library buckets stored on fi_patient_images.image_category. */
export const PATIENT_IMAGE_LIBRARY_BUCKETS = [
  "consult",
  "scalp",
  "donor",
  "hairline",
  "trichoscopy",
  "post_op",
  "progress",
  "before",
  "after",
  "other",
] as const satisfies readonly PatientImageCategory[];

/**
 * Map ImagingOS canonical category → fi_patient_images.image_category bucket.
 */
export function mapCanonicalToPatientImageCategory(canonical: string): PatientImageCategory {
  const c = canonical.trim().toLowerCase();
  if (c === "donor" || c === "recipient") return "donor";
  if (c === "immediate_post_op" || c === "graft_tray") return "post_op";
  if (c === "follow_up" || c === "after") return "progress";
  if (c === "microscopic" || c === "trichoscopy") return "trichoscopy";
  if (c === "hairline" || c === "front" || c === "left" || c === "right") return "scalp";
  if (c === "top" || c === "crown" || c === "vertex") return "scalp";
  if (c === "before" || c === "preop") return "before";
  return "other";
}

/** Resolve external label + optional legacy FiUploadType to a patient library bucket. */
export function mapExternalToPatientImageCategory(
  externalCategory: string,
  legacyUploadType?: FiUploadType | string | null
): PatientImageCategory {
  const mapping = mapExternalCategoryToCanonical(externalCategory, legacyUploadType);
  return mapCanonicalToPatientImageCategory(mapping.canonical);
}