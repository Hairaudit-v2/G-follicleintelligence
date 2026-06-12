import type {
  HliPhotoProtocolComplianceSummary,
  HliPhotoProtocolSlot,
  HliPhotoProtocolSuggestedMatch,
  HliPhotoProtocolTemplate,
  ProtocolComplianceImage,
} from "./types";
import { compareMatchQuality, scoreImageForProtocolSlot } from "./protocolSlotMatching";

const STRONG_MATCH = 0.52;

export type CalculatePhotoProtocolComplianceParams = {
  template: HliPhotoProtocolTemplate;
  slots: HliPhotoProtocolSlot[];
  images: ProtocolComplianceImage[];
};

/**
 * Pure compliance engine: compares required template slots to classified patient images (Stage 8A).
 * Optional slots never block `complete`.
 */
export function calculatePhotoProtocolCompliance(
  params: CalculatePhotoProtocolComplianceParams
): HliPhotoProtocolComplianceSummary {
  const slotsSorted = [...params.slots].sort((a, b) => a.sort_order - b.sort_order);
  const required = slotsSorted.filter((s) => s.is_required);
  const optional = slotsSorted.filter((s) => !s.is_required);

  const suggested_matches: Record<string, HliPhotoProtocolSuggestedMatch[]> = {};
  const warnings: string[] = [];
  const missing_slots: HliPhotoProtocolSlot[] = [];
  let needs_review_count = 0;
  let captured_count = 0;

  const imagesRanked = [...params.images].sort(compareMatchQuality);

  for (const slot of required) {
    const ranked: HliPhotoProtocolSuggestedMatch[] = [];
    for (const img of imagesRanked) {
      const { score, reasons } = scoreImageForProtocolSlot(slot, img);
      if (score > 0) {
        ranked.push({ image_id: img.id, score, reasons });
      }
    }
    ranked.sort((a, b) => b.score - a.score);
    suggested_matches[slot.id] = ranked.slice(0, 5);

    const best = ranked[0];
    if (!best || best.score < STRONG_MATCH) {
      missing_slots.push(slot);
      continue;
    }

    captured_count += 1;
    const img = params.images.find((i) => i.id === best.image_id);
    const st = (img?.ai_image_review_status ?? "").toLowerCase();
    if (st === "pending" && (img?.ai_image_category_confidence ?? 0) < 0.55) {
      needs_review_count += 1;
      warnings.push(`${slot.label}: matched image has low confidence — please review.`);
    }
  }

  for (const slot of optional) {
    const ranked: HliPhotoProtocolSuggestedMatch[] = [];
    for (const img of imagesRanked) {
      const { score, reasons } = scoreImageForProtocolSlot(slot, img);
      if (score > 0) ranked.push({ image_id: img.id, score, reasons });
    }
    ranked.sort((a, b) => b.score - a.score);
    suggested_matches[slot.id] = ranked.slice(0, 3);
  }

  const required_count = required.length;
  const missing_count = missing_slots.length;
  const complete = required_count > 0 && missing_count === 0;

  return {
    required_count,
    captured_count,
    missing_count,
    needs_review_count,
    complete,
    missing_slots,
    suggested_matches,
    warnings,
  };
}
