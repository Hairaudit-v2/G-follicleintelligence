/** ImagingOS — shared vocabulary (mirrors DB checks on fi_patient_images / region links). */

export const IMAGING_LIBRARY_AXES = [
  "consultation",
  "surgery",
  "follow_up",
  "trichoscopy",
  "pathology",
  "general_clinical",
] as const;

export type ImagingLibraryAxis = (typeof IMAGING_LIBRARY_AXES)[number];

export const IMAGING_ANATOMICAL_REGIONS = [
  "hairline",
  "frontal_third",
  "midscalp",
  "crown",
  "donor",
  "temple_left",
  "temple_right",
  "scar",
  "beard",
  "eyebrow",
  "body_hair",
  "global",
  "other",
] as const;

export type ImagingAnatomicalRegion = (typeof IMAGING_ANATOMICAL_REGIONS)[number];

export const IMAGING_AI_ANALYSIS_KINDS = [
  "density_estimate",
  "norwood_grade",
  "donor_assessment",
  "outcome_score",
] as const;

export type ImagingAiAnalysisKind = (typeof IMAGING_AI_ANALYSIS_KINDS)[number];

/** Map seeded protocol template slug → fi_patient_images.imaging_library_axis */
export function mapTemplateSlugToImagingLibraryAxis(templateSlug: string): ImagingLibraryAxis {
  const s = templateSlug.trim();
  if (s === "surgery_day") return "surgery";
  if (s === "follow_up_review") return "follow_up";
  if (s === "trichoscopy_review") return "trichoscopy";
  if (s === "hair_loss_consultation" || s === "hair_transplant_planning") return "consultation";
  return "general_clinical";
}

export function buildGuidedVisitType(templateSlug: string): string {
  return `guided:${templateSlug.trim()}`;
}

/** Best-effort device label for ImagingOS metadata (max 160 chars). */
export function inferCaptureDeviceType(userAgent: string | null | undefined): string {
  const u = (userAgent ?? "").toLowerCase();
  if (!u) return "unknown";
  if (u.includes("ipad")) return "ipad";
  if (u.includes("iphone")) return "iphone";
  if (u.includes("android")) return u.includes("mobile") ? "android_phone" : "android_tablet";
  if (u.includes("tablet")) return "tablet";
  return "desktop_or_other";
}

/** Preset compare pairs for UI (image selection is manual / heuristics). */
export const IMAGING_COMPARE_PRESETS = [
  { id: "baseline_vs_current", label: "Baseline vs current" },
  { id: "pre_op_vs_post_op", label: "Pre-op vs post-op" },
  { id: "m6_vs_m12", label: "6 month vs 12 month" },
] as const;

export const IMAGING_ANNOTATION_SCHEMA_VERSION = "imaging-annotation.v1" as const;
