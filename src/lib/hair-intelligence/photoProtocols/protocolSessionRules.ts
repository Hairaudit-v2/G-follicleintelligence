import type { HliPhotoProtocolSessionSlot, HliPhotoProtocolSlot } from "./types";

/** Minimum slot match score for auto-complete without explicit staff accept (aligns with completion gate). */
export const PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE = 0.48;

/** True when every required slot is accepted or captured with strong AI match score. */
export function canCompleteRequiredSessionSlots(params: {
  sessionSlots: HliPhotoProtocolSessionSlot[];
  slotsById: Map<string, HliPhotoProtocolSlot>;
}): boolean {
  for (const ss of params.sessionSlots) {
    const def = params.slotsById.get(ss.slot_id);
    if (!def?.is_required) continue;
    if (ss.status === "accepted") continue;
    if (ss.status === "captured" && (ss.ai_match_confidence ?? 0) >= PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE) continue;
    return false;
  }
  return true;
}
