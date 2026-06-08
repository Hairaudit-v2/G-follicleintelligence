import { z } from "zod";
import type { PathologyTemplateId } from "./pathologyTypes";

export const pathologyTemplateIdSchema = z.enum([
  "hair_loss_investigation",
  "female_hair_loss_investigation",
  "hair_transplant_pre_op",
  "trt_monitoring",
  "custom_request",
]) satisfies z.ZodType<PathologyTemplateId>;

const testLineSchema = z.object({
  code: z.string().trim().max(64).nullable().optional(),
  label: z.string().trim().min(1).max(500),
});

export const createPathologyRequestBodySchema = z.object({
  request_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  template_used: pathologyTemplateIdSchema,
  tests: z.array(testLineSchema).min(1, "Add at least one test."),
  clinical_notes: z.string().trim().max(8000).optional().nullable(),
  adminKey: z.string().optional(),
});

export const patchPathologyRequestBodySchema = z.object({
  clinical_notes: z.string().trim().max(8000).nullable().optional(),
  adminKey: z.string().optional(),
});

export const sendPathologyRequestToPatientBodySchema = z.object({
  /** Optional extra sentence from the clinician (appended to the template body). */
  personal_note: z.string().trim().max(2000).optional().nullable(),
  adminKey: z.string().optional(),
});

export type CreatePathologyRequestBody = z.infer<typeof createPathologyRequestBodySchema>;
export type PatchPathologyRequestBody = z.infer<typeof patchPathologyRequestBodySchema>;
export type SendPathologyRequestToPatientBody = z.infer<typeof sendPathologyRequestToPatientBodySchema>;
