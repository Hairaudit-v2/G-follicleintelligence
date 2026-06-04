import { z } from "zod";
import {
  assertPatientImageMetadataObject,
  isPatientImageCategory,
  PATIENT_IMAGE_ARCHIVE_REASON_MAX,
  PATIENT_IMAGE_CAPTION_MAX,
} from "./patientImagePolicy";

const jsonObjectSchema = z
  .unknown()
  .transform((v, ctx) => {
    if (v === undefined) return undefined;
    try {
      return assertPatientImageMetadataObject("metadata", v);
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: e instanceof Error ? e.message : "Invalid metadata.",
      });
      return z.NEVER;
    }
  })
  .optional();

function boundedOptString(max: number, label: string) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .superRefine((v, ctx) => {
      if (v === undefined || v === null) return;
      if (String(v).length > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: max,
          inclusive: true,
          type: "string",
          message: `${label} exceeds ${max} characters.`,
        });
      }
    });
}

export const patientImagePatchBodySchema = z
  .object({
    adminKey: z.string().optional(),
    image_category: z.string().optional(),
    caption: boundedOptString(PATIENT_IMAGE_CAPTION_MAX, "caption").nullable().optional(),
    taken_at: z.union([z.string(), z.null()]).optional(),
    metadata: jsonObjectSchema,
  })
  .strict()
  .superRefine((b, ctx) => {
    if (b.image_category !== undefined && !isPatientImageCategory(b.image_category)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid image_category.", path: ["image_category"] });
    }
    const keys = Object.keys(b).filter((k) => k !== "adminKey");
    if (keys.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one of image_category, caption, taken_at, or metadata.",
      });
    }
  });

export type PatientImagePatchBody = z.infer<typeof patientImagePatchBodySchema>;

export const patientImageArchiveBodySchema = z
  .object({
    adminKey: z.string().optional(),
    archive_reason: boundedOptString(PATIENT_IMAGE_ARCHIVE_REASON_MAX, "archive_reason").nullable().optional(),
  })
  .strict();

export type PatientImageArchiveBody = z.infer<typeof patientImageArchiveBodySchema>;
