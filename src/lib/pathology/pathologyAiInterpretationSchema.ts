import { z } from "zod";

export const pathologyAiMarkerSchema = z
  .object({
    marker: z.string().min(1).max(200),
    value: z.string().max(200).nullable().optional(),
    unit: z.string().max(80).nullable().optional(),
    reference_range: z.string().max(200).nullable().optional(),
    flag: z.string().max(80).nullable().optional(),
    hair_relevance: z.string().max(1200),
    suggested_next_step: z.string().max(1200).nullable().optional(),
  })
  .strict();

export const pathologyAiContributorSchema = z
  .object({
    name: z.string().min(1).max(200),
    rationale: z.string().max(1600),
  })
  .strict();

export const pathologyAiRiskFlagSchema = z
  .object({
    label: z.string().min(1).max(200),
    rationale: z.string().max(1600),
    urgency: z.enum(["routine", "review_soon", "urgent"]).default("routine"),
  })
  .strict();

export const pathologyAiConsiderationSchema = z
  .object({
    label: z.string().min(1).max(240),
    rationale: z.string().max(1600).optional(),
  })
  .strict();

export const pathologyAiRepeatTestingSchema = z
  .object({
    marker_or_panel: z.string().min(1).max(240),
    rationale: z.string().max(1600),
    suggested_timing: z.string().max(240).nullable().optional(),
  })
  .strict();

export const pathologyAiSurgeryReadinessSchema = z
  .object({
    narrative: z.string().max(2000),
    score: z.number().min(0).max(100).nullable().optional(),
    iron_status_score: z.number().min(0).max(100).nullable().optional(),
    thyroid_status_score: z.number().min(0).max(100).nullable().optional(),
    vitamin_status_score: z.number().min(0).max(100).nullable().optional(),
    inflammation_status_score: z.number().min(0).max(100).nullable().optional(),
    hormone_status_score: z.number().min(0).max(100).nullable().optional(),
  })
  .strict();

export const pathologyAiInterpretationJsonSchema = z
  .object({
    overview: z.string().max(3000),
    likely_contributors: z.array(pathologyAiContributorSchema),
    abnormal_markers: z.array(pathologyAiMarkerSchema),
    suboptimal_markers_for_hair: z.array(pathologyAiMarkerSchema),
    missing_markers: z.array(pathologyAiMarkerSchema),
    risk_flags: z.array(pathologyAiRiskFlagSchema),
    treatment_considerations: z.array(pathologyAiConsiderationSchema),
    supplement_considerations: z.array(pathologyAiConsiderationSchema),
    medication_considerations: z.array(pathologyAiConsiderationSchema),
    surgery_readiness: pathologyAiSurgeryReadinessSchema,
    repeat_testing_recommendations: z.array(pathologyAiRepeatTestingSchema),
    patient_friendly_summary: z.string().max(4000),
    clinician_summary: z.string().max(4000),
    hair_loss_relevance_score: z.number().min(0).max(100).nullable().optional(),
  })
  .strict();

export type PathologyAiInterpretationJson = z.infer<typeof pathologyAiInterpretationJsonSchema>;
