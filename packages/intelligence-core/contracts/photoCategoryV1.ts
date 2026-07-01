export const PHOTO_CATEGORY_V1_VERSION = 1 as const;

/**
 * Ecosystem-wide canonical photo categories for cross-product imaging intelligence.
 *
 * Superset of ImagingOS `CANONICAL_HAIR_IMAGE_CATEGORIES` with explicit
 * wet-hair and magnified views used by HairAudit and HLI intake flows.
 * Product-local keys (e.g. `preop_front`, `patient_current_top`) map to these
 * via alias tables in each consumer — not duplicated here.
 */
export const PHOTO_CATEGORIES_V1 = [
  "front",
  "left_temple",
  "right_temple",
  "crown",
  "donor",
  "recipient",
  "graft_tray",
  "immediate_post_op",
  "follow_up",
  "microscopic",
  "wet_hair_front",
  "wet_hair_top",
  "hairline_closeup",
  "scalp_magnified",
] as const;

export type PhotoCategoryV1 = (typeof PHOTO_CATEGORIES_V1)[number];

/** Human-readable labels for UI and report surfaces (English baseline). */
export const PHOTO_CATEGORY_V1_LABELS: Record<PhotoCategoryV1, string> = {
  front: "Front",
  left_temple: "Left temple",
  right_temple: "Right temple",
  crown: "Crown",
  donor: "Donor area",
  recipient: "Recipient area",
  graft_tray: "Graft tray",
  immediate_post_op: "Immediate post-operative",
  follow_up: "Follow-up progress",
  microscopic: "Microscopic / trichoscopy",
  wet_hair_front: "Wet hair — front",
  wet_hair_top: "Wet hair — top",
  hairline_closeup: "Hairline close-up",
  scalp_magnified: "Scalp magnified",
};
