import type {
  FiAiImageCategory,
  FiAiSurgeryStage,
} from "@/src/lib/imaging/aiImageClassificationTypes";
import {
  normalizeFiAiImageCategory,
  normalizeFiAiImageReviewStatus,
  normalizeFiAiSurgeryStage,
} from "@/src/lib/hair-intelligence/imageClassification/enumValidation";

/**
 * Minimal image projection for gallery bucketing (Twin / reports).
 * `procedure_date_ymd` is optional `YYYY-MM-DD` for the linked case's procedure day when known.
 */
export type PatientJourneyGalleryImageInput = {
  id: string;
  taken_at: string | null;
  created_at: string;
  case_id: string | null;
  procedure_date_ymd: string | null;
  ai_image_category: string | null;
  ai_image_category_confidence: number | null;
  ai_surgery_stage: string | null;
  ai_image_review_status: string | null;
  ai_image_classified_at: string | null;
};

export type PatientJourneyGalleryBuckets<
  T extends { id: string } = PatientJourneyGalleryImageInput,
> = {
  /** Newest captures first (small hero list; may overlap other buckets). */
  mostRecent: T[];
  preOp: T[];
  immediatePostOp: T[];
  /** Approximate mid-term follow-up window when procedure date exists (~4–8 months). */
  sixMonth: T[];
  /** Approximate long-term window (~8–15 months). */
  twelveMonth: T[];
  /** `follow_up` surgery stage / category not placed in timed windows. */
  followUpGeneral: T[];
  crown: T[];
  donor: T[];
  hairline: T[];
  microscope: T[];
  unknownNeedsReview: T[];
};

function effectiveDateIso(img: PatientJourneyGalleryImageInput): string {
  const t = img.taken_at?.trim();
  if (t) return t;
  return img.created_at.trim();
}

function parseYmdToUtcNoon(ymd: string | null): number | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd.trim())) return null;
  const ms = Date.parse(`${ymd.trim()}T12:00:00.000Z`);
  return Number.isFinite(ms) ? ms : null;
}

function daysBetweenCaptureAndProcedure(img: PatientJourneyGalleryImageInput): number | null {
  const p = parseYmdToUtcNoon(img.procedure_date_ymd);
  if (p == null) return null;
  const c = Date.parse(effectiveDateIso(img));
  if (!Number.isFinite(c)) return null;
  return Math.floor((c - p) / 86400000);
}

function needsUnknownReviewBucket(img: PatientJourneyGalleryImageInput): boolean {
  const cat = normalizeFiAiImageCategory(img.ai_image_category);
  const st = normalizeFiAiImageReviewStatus(img.ai_image_review_status);
  const conf = img.ai_image_category_confidence;
  if (st === "rejected") return true;
  if (cat === "unknown") return true;
  if (typeof conf === "number" && Number.isFinite(conf) && conf < 0.3) return true;
  return false;
}

function primaryBucketForImage(
  img: PatientJourneyGalleryImageInput
): keyof Omit<PatientJourneyGalleryBuckets, "mostRecent"> {
  if (needsUnknownReviewBucket(img)) return "unknownNeedsReview";

  const cat = normalizeFiAiImageCategory(img.ai_image_category) as FiAiImageCategory;
  const surg = normalizeFiAiSurgeryStage(img.ai_surgery_stage) as FiAiSurgeryStage;

  if (cat === "microscopic") return "microscope";
  if (cat === "donor" || cat === "graft_tray") return "donor";
  if (cat === "crown") return "crown";
  if (cat === "front" || cat === "left_profile" || cat === "right_profile" || cat === "top")
    return "hairline";

  const d = daysBetweenCaptureAndProcedure(img);
  if (d != null) {
    if (d >= 0 && d <= 21) return "immediatePostOp";
    if (d >= 120 && d < 240) return "sixMonth";
    if (d >= 240 && d < 450) return "twelveMonth";
    if (d < 0) return "preOp";
  }

  if (surg === "immediate_post_op" || cat === "immediate_post_op") return "immediatePostOp";
  if (surg === "pre_op") return "preOp";
  if (surg === "follow_up" || cat === "follow_up") return "followUpGeneral";

  return "unknownNeedsReview";
}

/**
 * Groups patient images for longitudinal gallery / Twin without requiring exact 6/12 month labels.
 */
export function buildPatientJourneyGallery<T extends PatientJourneyGalleryImageInput>(
  images: readonly T[]
): PatientJourneyGalleryBuckets<T> {
  const empty = (): PatientJourneyGalleryBuckets<T> => ({
    mostRecent: [],
    preOp: [],
    immediatePostOp: [],
    sixMonth: [],
    twelveMonth: [],
    followUpGeneral: [],
    crown: [],
    donor: [],
    hairline: [],
    microscope: [],
    unknownNeedsReview: [],
  });

  if (!images.length) return empty();

  const sorted = [...images].sort((a, b) => {
    const ta = Date.parse(effectiveDateIso(a));
    const tb = Date.parse(effectiveDateIso(b));
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });

  const buckets = empty();
  buckets.mostRecent = sorted.slice(0, 12);

  for (const img of sorted) {
    const key = primaryBucketForImage(img);
    buckets[key].push(img);
  }

  return buckets;
}

/** UI-facing merge for Twin "Follow-up" rail (timed windows + general follow-up). */
export function flattenFollowUpGroup<T extends { id: string }>(
  b: PatientJourneyGalleryBuckets<T>
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of [...b.sixMonth, ...b.twelveMonth, ...b.followUpGeneral]) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  return out;
}

export type TwinImagingUiSectionKey =
  | "pre_op"
  | "immediate_post_op"
  | "follow_up"
  | "donor"
  | "crown"
  | "hairline_front"
  | "microscope"
  | "unknown_needs_review";

export type TwinImagingUiSection<T extends { id: string }> = {
  key: TwinImagingUiSectionKey;
  title: string;
  items: T[];
};

/**
 * Maps journey buckets to the Patient Twin gallery sections.
 */
export function buildTwinImagingUiSections<T extends { id: string }>(
  b: PatientJourneyGalleryBuckets<T>
): TwinImagingUiSection<T>[] {
  const follow = flattenFollowUpGroup(b);
  return [
    { key: "unknown_needs_review", title: "Unknown / needs review", items: b.unknownNeedsReview },
    { key: "pre_op", title: "Pre-op", items: b.preOp },
    { key: "immediate_post_op", title: "Immediate post-op", items: b.immediatePostOp },
    { key: "follow_up", title: "Follow-up", items: follow },
    { key: "donor", title: "Donor", items: b.donor },
    { key: "crown", title: "Crown", items: b.crown },
    { key: "hairline_front", title: "Hairline / front", items: b.hairline },
    { key: "microscope", title: "Microscope", items: b.microscope },
  ];
}
