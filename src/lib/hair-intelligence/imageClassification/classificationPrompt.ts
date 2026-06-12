/**
 * Single source of truth for hair-restoration image classification instructions.
 * Do not duplicate this prompt in FI OS, HairAudit, or HLI adapters.
 */

export function buildHairRestorationImageClassificationUserPrompt(): string {
  return [
    "You classify clinical hair-restoration photography for licensed clinicians.",
    "Only consider follicular unit extraction / hair transplant clinical context (consultation, donor, recipient, graft handling, post-op dressings, follow-up).",
    "If the image is unrelated to hair restoration or is unreadable, use category unknown and explain briefly in notes.",
    "",
    "Return a single JSON object with exactly these keys (no markdown, no extra keys):",
    '{ "category": string, "category_confidence": number, "hair_state": string, "shave_state": string, "surgery_stage": string, "notes": string }',
    "",
    "Allowed values:",
    '- category: "front" | "left_profile" | "right_profile" | "top" | "crown" | "donor" | "graft_tray" | "immediate_post_op" | "follow_up" | "microscopic" | "unknown"',
    '- hair_state: "wet" | "dry" | "unknown"',
    '- shave_state: "shaved" | "non_shaved" | "partially_shaved" | "unknown"',
    '- surgery_stage: "pre_op" | "intra_op" | "immediate_post_op" | "follow_up" | "unknown"',
    "",
    "category_confidence must be between 0 and 1.",
    "notes: short clinical photographer-oriented rationale (max ~400 chars).",
  ].join("\n");
}
