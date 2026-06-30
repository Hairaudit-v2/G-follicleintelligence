import { z } from "zod";
import {
  clampHairLossConfidence,
  clampHairLossSeverityScore,
  normalizeClassificationGradeForSystem,
  normalizeHieHairLossClassificationSystem,
  normalizeHieHairLossPatternType,
  normalizeHieSexClassification,
} from "./enumValidation";
import type { HairLossClassificationModelResult } from "./types";

const rawSchema = z.object({
  sex_classification: z.string(),
  classification_system: z.string(),
  classification_grade: z.string(),
  pattern_type: z.string(),
  confidence_score: z.number(),
  frontal_loss_score: z.union([z.number(), z.null()]).optional(),
  temporal_recession_score: z.union([z.number(), z.null()]).optional(),
  mid_scalp_score: z.union([z.number(), z.null()]).optional(),
  crown_loss_score: z.union([z.number(), z.null()]).optional(),
  diffuse_thinning_score: z.union([z.number(), z.null()]).optional(),
  retrograde_pattern_detected: z.boolean(),
  suspected_scarring_pattern: z.boolean(),
  notes: z.string(),
});

export type HairLossModelJsonParseSuccess = { ok: true; data: HairLossClassificationModelResult };
export type HairLossModelJsonParseFailure = { ok: false; error: string };

/**
 * Parse and normalise OpenAI (or test) JSON object for hair loss classification.
 */
export function parseHairLossClassificationModelJson(
  parsed: unknown
): HairLossModelJsonParseSuccess | HairLossModelJsonParseFailure {
  const zod = rawSchema.safeParse(parsed);
  if (!zod.success) {
    return { ok: false, error: zod.error.issues[0]?.message ?? "invalid json" };
  }
  const d = zod.data;
  const classification_system = normalizeHieHairLossClassificationSystem(d.classification_system);
  const classification_grade = normalizeClassificationGradeForSystem(
    classification_system,
    d.classification_grade
  );
  const out: HairLossClassificationModelResult = {
    sex_classification: normalizeHieSexClassification(d.sex_classification),
    classification_system,
    classification_grade,
    pattern_type: normalizeHieHairLossPatternType(d.pattern_type),
    confidence_score: clampHairLossConfidence(d.confidence_score),
    frontal_loss_score: clampHairLossSeverityScore(d.frontal_loss_score ?? null),
    temporal_recession_score: clampHairLossSeverityScore(d.temporal_recession_score ?? null),
    mid_scalp_score: clampHairLossSeverityScore(d.mid_scalp_score ?? null),
    crown_loss_score: clampHairLossSeverityScore(d.crown_loss_score ?? null),
    diffuse_thinning_score: clampHairLossSeverityScore(d.diffuse_thinning_score ?? null),
    retrograde_pattern_detected: Boolean(d.retrograde_pattern_detected),
    suspected_scarring_pattern: Boolean(d.suspected_scarring_pattern),
    notes: typeof d.notes === "string" ? d.notes.trim().slice(0, 400) : "",
  };
  return { ok: true, data: out };
}
