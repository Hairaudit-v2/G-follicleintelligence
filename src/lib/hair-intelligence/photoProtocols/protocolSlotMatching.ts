import { normalizeFiAiHairState, normalizeFiAiImageCategory, normalizeFiAiShaveState, normalizeFiAiSurgeryStage } from "@/src/lib/hair-intelligence/imageClassification/enumValidation";
import type { FiAiImageCategory } from "@/src/lib/imaging/aiImageClassificationTypes";
import type { HliPhotoProtocolSlot, ProtocolComplianceImage } from "./types";

function reviewBoost(status: string | null | undefined): number {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "accepted" || s === "corrected") return 0.18;
  if (s === "pending") return 0;
  if (s === "rejected") return -0.5;
  return 0;
}

function allowedCategories(slot: HliPhotoProtocolSlot): FiAiImageCategory[] {
  const acc = slot.acceptable_image_categories;
  if (acc && acc.length > 0) return acc;
  if (slot.required_image_category) return [slot.required_image_category];
  return [];
}

/**
 * Scores how well a patient image satisfies a protocol slot using Stage 8A AI metadata.
 * Returns 0 when category is unknown / missing — required slots must not auto-complete on unknown.
 */
export function scoreImageForProtocolSlot(
  slot: HliPhotoProtocolSlot,
  image: ProtocolComplianceImage
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const cat = normalizeFiAiImageCategory(image.ai_image_category);
  if (cat === "unknown" || image.ai_image_category == null || !String(image.ai_image_category).trim()) {
    return { score: 0, reasons: ["AI category unknown or missing"] };
  }

  const allowed = allowedCategories(slot);
  if (!allowed.includes(cat)) {
    return { score: 0, reasons: [`Category ${cat} not in allowed set`] };
  }
  reasons.push("Category match");

  let score = 0.35;
  if (slot.required_surgery_stage) {
    const imgSurg = normalizeFiAiSurgeryStage(image.ai_surgery_stage);
    const req = normalizeFiAiSurgeryStage(slot.required_surgery_stage);
    if (imgSurg === req) {
      score += 0.28;
      reasons.push("Surgery stage match");
    } else if (req !== "unknown" && imgSurg !== "unknown") {
      score += 0.05;
      reasons.push("Surgery stage partial (mismatch)");
    }
  } else {
    score += 0.08;
  }

  if (slot.required_hair_state) {
    const h = normalizeFiAiHairState(image.ai_hair_state);
    if (h === normalizeFiAiHairState(slot.required_hair_state)) {
      score += 0.08;
      reasons.push("Hair state match");
    }
  }

  if (slot.required_shave_state) {
    const sh = normalizeFiAiShaveState(image.ai_shave_state);
    if (sh === normalizeFiAiShaveState(slot.required_shave_state)) {
      score += 0.08;
      reasons.push("Shave state match");
    }
  }

  const conf =
    typeof image.ai_image_category_confidence === "number" && Number.isFinite(image.ai_image_category_confidence)
      ? Math.max(0, Math.min(1, image.ai_image_category_confidence))
      : 0;
  score *= 0.45 + conf * 0.55;
  reasons.push(`Confidence weight ${conf.toFixed(2)}`);

  score += reviewBoost(image.ai_image_review_status);

  const st = (image.ai_image_review_status ?? "").toLowerCase();
  if ((st === "pending" || st === "") && conf < 0.4) {
    score = Math.min(score, 0.52);
    reasons.push("Low AI confidence — manual review suggested");
  }

  score = Math.max(0, Math.min(1, score));
  return { score, reasons };
}

/** Sort matches: higher score first; tie-break by review status then confidence. */
export function compareMatchQuality(a: ProtocolComplianceImage, b: ProtocolComplianceImage): number {
  const rank = (img: ProtocolComplianceImage) => {
    const rs = (img.ai_image_review_status ?? "").toLowerCase();
    const rev = rs === "accepted" || rs === "corrected" ? 2 : rs === "pending" ? 1 : 0;
    const conf =
      typeof img.ai_image_category_confidence === "number" && Number.isFinite(img.ai_image_category_confidence)
        ? img.ai_image_category_confidence
        : 0;
    return rev * 10 + conf;
  };
  return rank(b) - rank(a);
}
