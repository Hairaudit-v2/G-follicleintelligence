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
export type ConsultationRepairVisualAnnotationsV1 = Partial<Record<ConsultationScalpZoneId, ConsultationRepairAnnotationTag[]>>;

export function isConsultationScalpZoneId(v: string): v is ConsultationScalpZoneId {
  return (CONSULTATION_SCALP_ZONE_IDS as readonly string[]).includes(v);
}

export function isConsultationRepairAnnotationTag(v: string): v is ConsultationRepairAnnotationTag {
  return (CONSULTATION_REPAIR_ANNOTATION_TAGS as readonly string[]).includes(v);
}

export function parseSelectedZones(value: unknown): ConsultationScalpZoneId[] {
  if (!Array.isArray(value)) return [];
  const out: ConsultationScalpZoneId[] = [];
  for (const x of value) {
    const s = String(x).trim();
    if (isConsultationScalpZoneId(s) && !out.includes(s)) out.push(s);
  }
  return out;
}

export function parseRepairVisualAnnotations(value: unknown): ConsultationRepairVisualAnnotationsV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
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
