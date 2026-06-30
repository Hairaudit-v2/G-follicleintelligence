/**
 * ConsultationOS Visual Assessment Engine — shared value shapes and vocabulary.
 * Values persist in `fi_consultation_form_instances.values` JSON only (no DB migration).
 */

export const CONSULTATION_VISUAL_ASSESSMENT_PUBLIC_BASE = "/consultation-os/visual-assessment";

/** Canonical scalp zone ids for visual multi-select (`selected_zones`). */
export const CONSULTATION_SCALP_ZONE_IDS = [
  "frontal",
  "crown",
  "temporal_left",
  "temporal_right",
  "mid_scalp",
  "occipital",
  "donor_safe_zone",
] as const;

export type ConsultationScalpZoneId = (typeof CONSULTATION_SCALP_ZONE_IDS)[number];

/** Repair wireframe annotation tags (per-zone, multi-tag). */
export const CONSULTATION_REPAIR_ANNOTATION_TAGS = [
  "failed_growth",
  "overharvested",
  "scarring",
  "poor_density",
  "redesign_required",
] as const;

export type ConsultationRepairAnnotationTag = (typeof CONSULTATION_REPAIR_ANNOTATION_TAGS)[number];

/** Stored under `repair_visual_annotations` — zone id → list of tags. */
export type ConsultationRepairVisualAnnotationsV1 = Partial<
  Record<ConsultationScalpZoneId, ConsultationRepairAnnotationTag[]>
>;

export function isConsultationScalpZoneId(v: string): v is ConsultationScalpZoneId {
  return (CONSULTATION_SCALP_ZONE_IDS as readonly string[]).includes(v);
}

export function isConsultationRepairAnnotationTag(v: string): v is ConsultationRepairAnnotationTag {
  return (CONSULTATION_REPAIR_ANNOTATION_TAGS as readonly string[]).includes(v);
}

/** Max JSON string length accepted when coercing stringified visual values (defensive). */
const VISUAL_ASSESSMENT_JSON_STRING_MAX = 65_536;

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.length > VISUAL_ASSESSMENT_JSON_STRING_MAX) return null;
  try {
    const p = JSON.parse(s) as unknown;
    if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Normalises free-text pattern keys stored on older instances (string trim only).
 * Unknown legacy codes are preserved as-is for chart fidelity.
 */
export function normalizePatternClassificationString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function parseSelectedZones(value: unknown): ConsultationScalpZoneId[] {
  let list: unknown[] | null = null;
  if (Array.isArray(value)) {
    list = value;
  } else if (typeof value === "string") {
    const s = value.trim();
    if (!s) return [];
    if (s.length > VISUAL_ASSESSMENT_JSON_STRING_MAX) return [];
    try {
      const p = JSON.parse(s) as unknown;
      if (Array.isArray(p)) list = p;
      else return [];
    } catch {
      return [];
    }
  } else {
    return [];
  }

  const out: ConsultationScalpZoneId[] = [];
  for (const x of list) {
    const z = String(x).trim();
    if (isConsultationScalpZoneId(z) && !out.includes(z)) out.push(z);
  }
  return out;
}

export function parseRepairVisualAnnotations(
  value: unknown
): ConsultationRepairVisualAnnotationsV1 {
  let raw: Record<string, unknown> | null = null;
  if (value == null) return {};
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return {};
    const asObj = tryParseJsonObject(s);
    if (asObj) raw = asObj;
    else return {};
  } else if (typeof value === "object" && !Array.isArray(value)) {
    raw = value as Record<string, unknown>;
  } else {
    return {};
  }

  const out: ConsultationRepairVisualAnnotationsV1 = {};
  for (const z of CONSULTATION_SCALP_ZONE_IDS) {
    const cell = raw[z];
    if (!Array.isArray(cell)) continue;
    const tags: ConsultationRepairAnnotationTag[] = [];
    for (const t of cell) {
      const s = String(t).trim();
      if (isConsultationRepairAnnotationTag(s) && !tags.includes(s)) tags.push(s);
    }
    if (tags.length) out[z] = tags;
  }
  return out;
}
