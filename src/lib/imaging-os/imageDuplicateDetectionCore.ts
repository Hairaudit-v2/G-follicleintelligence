/**
 * ImagingOS Phase 2 — duplicate detection helpers (pure).
 */

export type SessionImageFingerprint = {
  image_id: string;
  content_hash?: string | null;
  perceptual_hash?: string | null;
  protocol_slot_slug?: string | null;
  storage_path?: string | null;
};

export type DuplicateDetectionResult = {
  duplicate_status: "unique" | "possible_duplicate" | "unknown";
  matched_image_id?: string | null;
};

function hammingDistance(a: string, b: string): number | null {
  if (a.length !== b.length || a.length === 0) return null;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist += 1;
  }
  return dist;
}

export function detectDuplicateInSessionFingerprints(input: {
  candidate: {
    content_hash?: string | null;
    perceptual_hash?: string | null;
    protocol_slot_slug?: string | null;
    storage_path?: string | null;
  };
  session_images: SessionImageFingerprint[];
}): DuplicateDetectionResult {
  const contentHash = input.candidate.content_hash?.trim();
  const perceptualHash = input.candidate.perceptual_hash?.trim();
  const storagePath = input.candidate.storage_path?.trim();
  const slot = input.candidate.protocol_slot_slug?.trim();

  if (!contentHash && !perceptualHash && !storagePath) {
    return { duplicate_status: "unknown" };
  }

  for (const existing of input.session_images) {
    if (storagePath && existing.storage_path?.trim() === storagePath) {
      return { duplicate_status: "possible_duplicate", matched_image_id: existing.image_id };
    }
    if (contentHash && existing.content_hash?.trim() === contentHash) {
      return { duplicate_status: "possible_duplicate", matched_image_id: existing.image_id };
    }
    if (perceptualHash && existing.perceptual_hash?.trim()) {
      const dist = hammingDistance(perceptualHash, existing.perceptual_hash.trim());
      if (dist != null && dist <= 6) {
        return { duplicate_status: "possible_duplicate", matched_image_id: existing.image_id };
      }
    }
    if (slot && existing.protocol_slot_slug?.trim() === slot && contentHash && existing.content_hash) {
      return { duplicate_status: "possible_duplicate", matched_image_id: existing.image_id };
    }
  }

  return { duplicate_status: "unique" };
}