import { z } from "zod";

export const pathologyResultItemInputSchema = z.object({
  test_code: z.string().max(64).nullable().optional(),
  test_label: z.string().min(1).max(500),
  result_value: z.string().max(500).default(""),
  result_unit: z.string().max(64).nullable().optional(),
  reference_range: z.string().max(200).nullable().optional(),
  flag: z.enum(["low", "normal", "high", "critical", "unknown"]),
});

export const createPathologyResultFormSchema = z.object({
  result_date: z.string().min(1).max(32),
  provider_name: z.string().max(300).nullable().optional(),
  pathology_request_id: z.string().uuid().nullable().optional(),
  clinical_summary: z.string().max(8000).nullable().optional(),
  /** Initial persistence state from the form. */
  status: z.enum(["draft", "reviewed"]).default("draft"),
  items: z.array(pathologyResultItemInputSchema).default([]),
});

export const patchPathologyResultBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save_draft"),
    result_date: z.string().min(1).max(32),
    provider_name: z.string().max(300).nullable().optional(),
    pathology_request_id: z.union([z.string().uuid(), z.null()]),
    clinical_summary: z.string().max(8000).nullable().optional(),
    items: z.array(pathologyResultItemInputSchema).default([]),
  }),
  z.object({
    action: z.literal("mark_reviewed"),
    clinical_summary: z.string().max(8000).nullable().optional(),
  }),
  z.object({
    action: z.literal("archive"),
  }),
]);
