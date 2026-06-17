/**
 * ImagingOS — category-specific metadata quality expectations (Phase IM-4).
 * Pure helpers; no I/O or pixel analysis.
 */

import type { CanonicalHairImageCategory } from "./categories";

export type ImageQualityCategoryExpectations = {
  /** Minimum width for pass-level dimension checks (default baseline: 800). */
  min_width?: number;
  /** Minimum height for pass-level dimension checks (default baseline: 800). */
  min_height?: number;
  /** Preferred minimum for excellent-level dimension checks (default baseline: 1200). */
  preferred_min_width?: number;
  preferred_min_height?: number;
  /** Stronger minimum file size for detail-heavy categories. */
  min_size_bytes?: number;
  prefer_high_detail?: boolean;
  scalp_visibility_important?: boolean;
};

const BASELINE_MIN_DIMENSION = 800;
const BASELINE_PREFERRED_DIMENSION = 1200;

/**
 * Metadata-level expectations per canonical category.
 * Used to tighten thresholds for detail-critical clinical views.
 */
export function getImageQualityExpectationsForCategory(
  category: CanonicalHairImageCategory | undefined
): ImageQualityCategoryExpectations {
  switch (category) {
    case "microscopic":
      return {
        min_width: 1000,
        min_height: 1000,
        preferred_min_width: 1600,
        preferred_min_height: 1600,
        min_size_bytes: 250 * 1024,
        prefer_high_detail: true,
      };
    case "graft_tray":
      return {
        min_width: 1000,
        min_height: 1000,
        preferred_min_width: 1400,
        preferred_min_height: 1400,
        min_size_bytes: 150 * 1024,
        prefer_high_detail: true,
      };
    case "donor":
      return {
        scalp_visibility_important: true,
      };
    case "front":
    case "top":
    case "crown":
      return {};
    default:
      return {};
  }
}

export const QUALITY_BASELINE_MIN_DIMENSION = BASELINE_MIN_DIMENSION;
export const QUALITY_BASELINE_PREFERRED_DIMENSION = BASELINE_PREFERRED_DIMENSION;
