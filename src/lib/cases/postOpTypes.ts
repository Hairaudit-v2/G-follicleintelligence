import { z } from "zod";

/** Post-operative phase for the case (Stage 5D). */
export const POST_OP_STATUS_VALUES = [
  "not_started",
  "immediate_post_op",
  "early_recovery",
  "healing",
  "routine_follow_up",
  "stable",
  "needs_attention",
  "closed",
] as const;

export type PostOpStatusValue = (typeof POST_OP_STATUS_VALUES)[number];

export function isPostOpStatus(s: string | null | undefined): s is PostOpStatusValue {
  return !!s && (POST_OP_STATUS_VALUES as readonly string[]).includes(s.trim());
}

/** Standard outcome / follow-up checkpoints. */
export const FOLLOW_UP_CHECKPOINT_VALUES = [
  "day_1",
  "day_7",
  "day_14",
  "month_1",
  "month_3",
  "month_6",
  "month_12",
] as const;

export type FollowUpCheckpointValue = (typeof FOLLOW_UP_CHECKPOINT_VALUES)[number];

export function isFollowUpCheckpoint(s: string | null | undefined): s is FollowUpCheckpointValue {
  return !!s && (FOLLOW_UP_CHECKPOINT_VALUES as readonly string[]).includes(s.trim());
}

export const FOLLOW_UP_STATUS_VALUES = [
  "pending",
  "scheduled",
  "completed",
  "skipped",
  "cancelled",
] as const;

export type FollowUpStatusValue = (typeof FOLLOW_UP_STATUS_VALUES)[number];

export function isFollowUpStatus(s: string | null | undefined): s is FollowUpStatusValue {
  return !!s && (FOLLOW_UP_STATUS_VALUES as readonly string[]).includes(s.trim());
}

export const POST_OP_NOTES_MAX = 24_000;

const uuidStr = z.string().uuid();

export const postOpTrackingUpsertBodySchema = z.object({
  adminKey: z.string().optional(),
  post_op_status: z.enum(POST_OP_STATUS_VALUES).optional(),
  instructions_given: z.boolean().optional(),
  aftercare_notes: z.string().max(POST_OP_NOTES_MAX).nullable().optional(),
  donor_recovery_notes: z.string().max(POST_OP_NOTES_MAX).nullable().optional(),
  recipient_recovery_notes: z.string().max(POST_OP_NOTES_MAX).nullable().optional(),
  complication_notes: z.string().max(POST_OP_NOTES_MAX).nullable().optional(),
  patient_satisfaction_score: z.number().int().min(1).max(10).nullable().optional(),
  outcome_notes: z.string().max(POST_OP_NOTES_MAX).nullable().optional(),
});

export type PostOpTrackingUpsertBody = z.infer<typeof postOpTrackingUpsertBodySchema>;
export type PostOpTrackingUpsertPatch = Omit<PostOpTrackingUpsertBody, "adminKey">;

export const followUpUpsertBodySchema = z
  .object({
    adminKey: z.string().optional(),
    id: uuidStr.optional(),
    checkpoint: z.enum(FOLLOW_UP_CHECKPOINT_VALUES).optional(),
    scheduled_date: z.string().max(32).nullable().optional(),
    completed_date: z.string().max(32).nullable().optional(),
    follow_up_status: z.enum(FOLLOW_UP_STATUS_VALUES).optional(),
    notes: z.string().max(POST_OP_NOTES_MAX).nullable().optional(),
    linked_image_ids: z.array(uuidStr).optional(),
  })
  .superRefine((b, ctx) => {
    if (!b.id && !b.checkpoint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "checkpoint is required when id is omitted.",
      });
    }
  });

export type FollowUpUpsertBody = z.infer<typeof followUpUpsertBodySchema>;
export type FollowUpUpsertPatch = Omit<FollowUpUpsertBody, "adminKey">;

export const followUpDeleteBodySchema = z.object({
  adminKey: z.string().optional(),
  id: uuidStr,
});

export type FollowUpDeleteBody = z.infer<typeof followUpDeleteBodySchema>;
