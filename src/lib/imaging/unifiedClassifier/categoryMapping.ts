/**
 * Maps HLI / ImagingOS categories to PhotoCategoryV1 (intelligence-core contract).
 */

import type { PhotoCategoryV1 } from "@follicle/intelligence-core/contracts";
import { PHOTO_CATEGORIES_V1 } from "@follicle/intelligence-core/contracts";
import { mapExternalCategoryToCanonical } from "@/src/lib/imaging-os/categories";
import type { FiAiImageCategory } from "@/src/lib/hair-intelligence/imageClassification/types";

const PHOTO_CATEGORY_SET = new Set<string>(PHOTO_CATEGORIES_V1);

export function isPhotoCategoryV1(value: string): value is PhotoCategoryV1 {
  return PHOTO_CATEGORY_SET.has(value);
}

const HLI_TO_PHOTO_CATEGORY_V1: Record<FiAiImageCategory, PhotoCategoryV1 | undefined> = {
  front: "front",
  left_profile: "left_temple",
  right_profile: "right_temple",
  top: "wet_hair_top",
  crown: "crown",
  donor: "donor",
  graft_tray: "graft_tray",
  immediate_post_op: "immediate_post_op",
  follow_up: "follow_up",
  microscopic: "microscopic",
  unknown: undefined,
};

const IMAGING_OS_TO_PHOTO_CATEGORY_V1: Record<string, PhotoCategoryV1 | undefined> = {
  front: "front",
  top: "wet_hair_top",
  crown: "crown",
  left: "left_temple",
  right: "right_temple",
  donor: "donor",
  recipient: "recipient",
  hairline: "hairline_closeup",
  temporal: "left_temple",
  vertex: "crown",
  graft_tray: "graft_tray",
  immediate_post_op: "immediate_post_op",
  follow_up: "follow_up",
  microscopic: "microscopic",
  other: undefined,
};

export type CategoryMappingOutcome = {
  category: PhotoCategoryV1 | undefined;
  aliasUsed: boolean;
  mappingSource: "hli" | "imaging_os" | "direct_v1" | "fallback";
};

/** Map HLI classifier category to PhotoCategoryV1. */
export function mapHliCategoryToPhotoCategoryV1(
  category: FiAiImageCategory
): CategoryMappingOutcome {
  const mapped = HLI_TO_PHOTO_CATEGORY_V1[category];
  return {
    category: mapped,
    aliasUsed: category !== "unknown" && mapped !== undefined,
    mappingSource: "hli",
  };
}

/** Map external / legacy label to PhotoCategoryV1 via ImagingOS canonical bridge. */
export function mapExternalLabelToPhotoCategoryV1(
  externalCategory: string,
  legacyUploadType?: string | null
): CategoryMappingOutcome {
  const direct = externalCategory.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (isPhotoCategoryV1(direct)) {
    return { category: direct, aliasUsed: false, mappingSource: "direct_v1" };
  }

  const imagingOs = mapExternalCategoryToCanonical(externalCategory, legacyUploadType);
  const mapped = IMAGING_OS_TO_PHOTO_CATEGORY_V1[imagingOs.canonical];
  const aliasUsed = imagingOs.source === "alias" || imagingOs.source === "legacy_upload_type";

  return {
    category: mapped,
    aliasUsed,
    mappingSource: aliasUsed ? "imaging_os" : "fallback",
  };
}
