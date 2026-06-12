import { z } from "zod";
import {
  FI_AI_HAIR_STATES,
  FI_AI_IMAGE_CATEGORIES,
  FI_AI_IMAGE_REVIEW_STATUSES,
  FI_AI_SHAVE_STATES,
  FI_AI_SURGERY_STAGES,
} from "@/src/lib/imaging/aiImageClassificationTypes";

const CAT = FI_AI_IMAGE_CATEGORIES as unknown as [string, ...string[]];
const HAIR = FI_AI_HAIR_STATES as unknown as [string, ...string[]];
const SHAVE = FI_AI_SHAVE_STATES as unknown as [string, ...string[]];
const SURG = FI_AI_SURGERY_STAGES as unknown as [string, ...string[]];
const REV = FI_AI_IMAGE_REVIEW_STATUSES as unknown as [string, ...string[]];

export const fiImageAiReviewBodySchema = z
  .object({
    adminKey: z.string().optional(),
    ai_image_category: z.enum(CAT).optional(),
    ai_hair_state: z.enum(HAIR).optional(),
    ai_shave_state: z.enum(SHAVE).optional(),
    ai_surgery_stage: z.enum(SURG).optional(),
    ai_image_ai_notes: z.string().max(8000).nullable().optional(),
    ai_image_review_status: z.enum(REV),
  })
  .strict();

export type FiImageAiReviewBody = z.infer<typeof fiImageAiReviewBodySchema>;
