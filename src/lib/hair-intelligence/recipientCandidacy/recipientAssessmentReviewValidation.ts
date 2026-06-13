import { z } from "zod";
import {
  HIE_RECIPIENT_QUALITY_RATINGS,
  HIE_RECIPIENT_REVIEW_STATUSES,
  HIE_RECIPIENT_RISK_LEVELS,
  HIE_RECIPIENT_SURGICAL_TIMING_RISKS,
} from "./types";

const QLT = HIE_RECIPIENT_QUALITY_RATINGS as unknown as [string, ...string[]];
const RSK = HIE_RECIPIENT_RISK_LEVELS as unknown as [string, ...string[]];
const STG = HIE_RECIPIENT_SURGICAL_TIMING_RISKS as unknown as [string, ...string[]];
const REV = HIE_RECIPIENT_REVIEW_STATUSES as unknown as [string, ...string[]];

export const recipientAssessmentReviewBodySchema = z
  .object({
    adminKey: z.string().optional(),
    review_status: z.enum(REV),
    recipient_quality_rating: z.enum(QLT).optional(),
    confidence_score: z.number().min(0).max(1).optional(),
    diffuse_thinning_risk: z.enum(RSK).nullable().optional(),
    shock_loss_risk: z.enum(RSK).nullable().optional(),
    density_expectation_risk: z.enum(RSK).nullable().optional(),
    surgical_timing_risk: z.enum(STG).nullable().optional(),
    patient_expectation_risk: z.enum(RSK).nullable().optional(),
    medication_stabilisation_needed: z.boolean().optional(),
    pathology_review_recommended: z.boolean().optional(),
    documentation_gap_detected: z.boolean().optional(),
    candidacy_summary: z.string().max(8000).nullable().optional(),
    ai_notes: z.string().max(8000).nullable().optional(),
    review_topics: z.array(z.string().max(500)).max(40).optional(),
  })
  .strict();

export type RecipientAssessmentReviewBody = z.infer<typeof recipientAssessmentReviewBodySchema>;
