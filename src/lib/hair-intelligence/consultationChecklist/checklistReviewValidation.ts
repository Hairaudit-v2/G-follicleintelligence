import { z } from "zod";
import {
  HIE_CONSULTATION_CHECKLIST_STATUSES,
  HIE_CONSULTATION_CONSENT_COMPLEXITY_LEVELS,
  HIE_CONSULTATION_PRIORITY_LEVELS,
  HIE_CONSULTATION_REVIEW_STATUSES,
} from "./types";

const PRI = HIE_CONSULTATION_PRIORITY_LEVELS as unknown as [string, ...string[]];
const CON = HIE_CONSULTATION_CONSENT_COMPLEXITY_LEVELS as unknown as [string, ...string[]];
const REV = HIE_CONSULTATION_REVIEW_STATUSES as unknown as [string, ...string[]];
const ST = HIE_CONSULTATION_CHECKLIST_STATUSES as unknown as [string, ...string[]];

export const consultationChecklistReviewBodySchema = z
  .object({
    adminKey: z.string().optional(),
    review_status: z.enum(REV),
    priority_level: z.enum(PRI).optional(),
    medication_discussion_required: z.boolean().optional(),
    stabilisation_discussion_required: z.boolean().optional(),
    donor_preservation_discussion_required: z.boolean().optional(),
    expectation_management_required: z.boolean().optional(),
    consent_complexity_level: z.enum(CON).nullable().optional(),
    documentation_required: z.boolean().optional(),
    follow_up_required: z.boolean().optional(),
    delay_recommended: z.boolean().optional(),
    consultation_summary: z.string().max(8000).nullable().optional(),
    checklist_items: z.array(z.string().max(500)).max(60).optional(),
    risk_flags: z.array(z.string().max(240)).max(40).optional(),
    ai_notes: z.string().max(8000).nullable().optional(),
    checklist_status: z.enum(ST).optional(),
    confidence_score: z.number().min(0).max(1).optional(),
  })
  .strict();

export type ConsultationChecklistReviewBody = z.infer<typeof consultationChecklistReviewBodySchema>;
