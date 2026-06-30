import { z } from "zod";
import {
  HIE_CLASSIFICATION_SYSTEMS,
  HIE_HAIR_LOSS_PATTERN_TYPES,
  HIE_HAIR_LOSS_REVIEW_STATUSES,
  HIE_SEX_CLASSIFICATIONS,
} from "./types";

const SYS = HIE_CLASSIFICATION_SYSTEMS as unknown as [string, ...string[]];
const PAT = HIE_HAIR_LOSS_PATTERN_TYPES as unknown as [string, ...string[]];
const REV = HIE_HAIR_LOSS_REVIEW_STATUSES as unknown as [string, ...string[]];
const SEX = HIE_SEX_CLASSIFICATIONS as unknown as [string, ...string[]];

export const hairLossClassificationReviewBodySchema = z
  .object({
    adminKey: z.string().optional(),
    review_status: z.enum(REV),
    classification_system: z.enum(SYS).optional(),
    pattern_type: z.enum(PAT).optional(),
    classification_grade: z.string().max(64).optional(),
    confidence_score: z.number().min(0).max(1).optional(),
    frontal_loss_score: z.union([z.number().int().min(0).max(10), z.null()]).optional(),
    temporal_recession_score: z.union([z.number().int().min(0).max(10), z.null()]).optional(),
    mid_scalp_score: z.union([z.number().int().min(0).max(10), z.null()]).optional(),
    crown_loss_score: z.union([z.number().int().min(0).max(10), z.null()]).optional(),
    diffuse_thinning_score: z.union([z.number().int().min(0).max(10), z.null()]).optional(),
    retrograde_pattern_detected: z.boolean().optional(),
    suspected_scarring_pattern: z.boolean().optional(),
    sex_classification: z.enum(SEX).nullable().optional(),
    age_estimate_range: z.string().max(128).nullable().optional(),
    ai_notes: z.string().max(8000).nullable().optional(),
  })
  .strict();

export type HairLossClassificationReviewBody = z.infer<
  typeof hairLossClassificationReviewBodySchema
>;
