import { z } from "zod";

/** Matches legacy `fi_cases.status` check constraint. */
export const FI_CASE_STATUS_VALUES = ["draft", "submitted", "processing", "complete", "failed"] as const;

export type FiCaseStatusValue = (typeof FI_CASE_STATUS_VALUES)[number];

export function isFiCaseStatus(s: string | null | undefined): s is FiCaseStatusValue {
  return !!s && (FI_CASE_STATUS_VALUES as readonly string[]).includes(s.trim());
}

export const CASE_PLANNING_NOTES_MAX = 16_000;

export const caseProfilePatchBodySchema = z
  .object({
    adminKey: z.string().optional(),
    status: z.enum(FI_CASE_STATUS_VALUES).optional(),
    treatment_type: z.string().max(512).nullable().optional(),
    case_type: z.string().max(256).nullable().optional(),
    planning_notes: z.string().max(CASE_PLANNING_NOTES_MAX).nullable().optional(),
  })
  .refine((b) => b.status !== undefined || b.treatment_type !== undefined || b.case_type !== undefined || b.planning_notes !== undefined, {
    message: "Provide at least one of: status, treatment_type, case_type, planning_notes.",
  });

export type CaseProfilePatchBody = z.infer<typeof caseProfilePatchBodySchema>;
