/**
 * ImagingOS — canonical hair image category contract (Phase IM-1).
 */

export const CANONICAL_HAIR_IMAGE_CATEGORIES = [
  "front",
  "top",
  "crown",
  "left",
  "right",
  "donor",
  "recipient",
  "hairline",
  "temporal",
  "vertex",
  "graft_tray",
  "immediate_post_op",
  "follow_up",
  "microscopic",
  "other",
] as const;

export type CanonicalHairImageCategory = (typeof CANONICAL_HAIR_IMAGE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CanonicalHairImageCategory, string> = {
  front: "Front",
  top: "Top / vertex overhead",
  crown: "Crown",
  left: "Left profile / side",
  right: "Right profile / side",
  donor: "Donor area",
  recipient: "Recipient area",
  hairline: "Hairline close-up",
  temporal: "Temporal region",
  vertex: "Vertex",
  graft_tray: "Graft tray",
  immediate_post_op: "Immediate post-operative",
  follow_up: "Follow-up progress",
  microscopic: "Microscopic / trichoscopy",
  other: "Other / unclassified",
};

/** Confidence band thresholds for classification and protocol matching. */
export const CONFIDENCE_BANDS = {
  high: { min: 0.85, label: "high" },
  medium: { min: 0.65, label: "medium" },
  low: { min: 0.4, label: "low" },
  insufficient: { min: 0, label: "insufficient" },
} as const;

export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[keyof typeof CONFIDENCE_BANDS]["label"];

export function confidenceBandForScore(confidence: number): ConfidenceBand {
  const c = Math.max(0, Math.min(1, confidence));
  if (c >= CONFIDENCE_BANDS.high.min) return CONFIDENCE_BANDS.high.label;
  if (c >= CONFIDENCE_BANDS.medium.min) return CONFIDENCE_BANDS.medium.label;
  if (c >= CONFIDENCE_BANDS.low.min) return CONFIDENCE_BANDS.low.label;
  return CONFIDENCE_BANDS.insufficient.label;
}

export type ExternalCategoryMappingResult = {
  canonical: CanonicalHairImageCategory;
  /** Whether the external label matched a known alias vs fell back to other. */
  matched: boolean;
  source: "exact" | "alias" | "legacy_upload_type" | "fallback";
};

const EXACT_CANONICAL = new Set<string>(CANONICAL_HAIR_IMAGE_CATEGORIES);

/** HairAudit / HLI / legacy alias table → ImagingOS canonical category. */
const EXTERNAL_CATEGORY_ALIASES: Record<string, CanonicalHairImageCategory> = {
  // HairAudit canonical photo categories
  patient_current_front: "front",
  patient_current_top: "top",
  patient_current_crown: "crown",
  patient_current_left: "left",
  patient_current_right: "right",
  patient_current_donor: "donor",
  patient_current_recipient: "recipient",
  patient_current_hairline: "hairline",
  preop_front: "front",
  preop_top: "top",
  preop_crown: "crown",
  preop_left: "left",
  preop_right: "right",
  preop_donor: "donor",
  preop_donor_rear: "donor",
  preop_recipient: "recipient",
  preop_hairline: "hairline",
  intraop_graft_tray: "graft_tray",
  postop_immediate: "immediate_post_op",
  follow_up_progress: "follow_up",
  follow_up: "follow_up",
  trichoscopy: "microscopic",
  microscopic_view: "microscopic",
  // HLI FI_AI_IMAGE_CATEGORIES overlap
  left_profile: "left",
  right_profile: "right",
  unknown: "other",
  // FI patient image manual categories (partial overlap)
  scalp: "top",
  consult: "front",
  post_op: "immediate_post_op",
  progress: "follow_up",
  before: "front",
  after: "follow_up",
  hairline: "hairline",
  donor: "donor",
  trichoscopy_legacy: "microscopic",
};

const LEGACY_UPLOAD_TYPE_ALIASES: Record<string, CanonicalHairImageCategory> = {
  "patient_photo:front": "front",
  "patient_photo:top": "top",
  "patient_photo:crown": "crown",
  "patient_photo:left": "left",
  "patient_photo:right": "right",
  "patient_photo:donor": "donor",
  "patient_photo:recipient": "recipient",
  "patient_photo:hairline": "hairline",
  "patient_photo:temporal": "temporal",
  "patient_photo:vertex": "vertex",
  "patient_photo:graft_tray": "graft_tray",
  "patient_photo:immediate_post_op": "immediate_post_op",
  "patient_photo:follow_up": "follow_up",
  "patient_photo:microscopic": "microscopic",
};

function normalizeExternalKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Map an external product category label to the ImagingOS canonical category.
 * Does not perform AI inference — deterministic alias lookup only.
 */
export function mapExternalCategoryToCanonical(
  externalCategory: string,
  legacyUploadType?: string | null
): ExternalCategoryMappingResult {
  const key = normalizeExternalKey(externalCategory);
  if (EXACT_CANONICAL.has(key)) {
    return { canonical: key as CanonicalHairImageCategory, matched: true, source: "exact" };
  }

  const alias = EXTERNAL_CATEGORY_ALIASES[key];
  if (alias) {
    return { canonical: alias, matched: true, source: "alias" };
  }

  if (legacyUploadType) {
    const legacyKey = normalizeExternalKey(legacyUploadType);
    const legacyAlias = LEGACY_UPLOAD_TYPE_ALIASES[legacyKey];
    if (legacyAlias) {
      return { canonical: legacyAlias, matched: true, source: "legacy_upload_type" };
    }
  }

  return { canonical: "other", matched: false, source: "fallback" };
}

export function isCanonicalHairImageCategory(value: string): value is CanonicalHairImageCategory {
  return EXACT_CANONICAL.has(normalizeExternalKey(value));
}
