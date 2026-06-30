import { z } from "zod";
import { CLINICAL_DETAILS_TEXT_MAX, isJsonObjectRecord } from "./clinicalDetailsPolicy";
import {
  HAIRLINE_PATTERN_VALUES,
  LUDWIG_SCALE_VALUES,
  NORWOOD_SCALE_VALUES,
} from "./hairLossScales";

const jsonObjectSchema = z
  .unknown()
  .transform((v, ctx) => {
    if (v === undefined) return undefined;
    if (!isJsonObjectRecord(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be a JSON object." });
      return z.NEVER;
    }
    return v;
  })
  .optional();

function boundedText(max: number, field: string) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .superRefine((v, ctx) => {
      if (v === undefined) return;
      if (v === null) return;
      const s = String(v);
      if (s.length > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: max,
          inclusive: true,
          type: "string",
          message: `${field} exceeds ${max} characters.`,
        });
      }
    });
}

function preprocessEmptyStringToNull(v: unknown): unknown {
  if (v === "") return null;
  return v;
}

function optionalNorwoodScale() {
  return z.preprocess(
    preprocessEmptyStringToNull,
    z.union([z.null(), z.enum(NORWOOD_SCALE_VALUES as unknown as [string, ...string[]])]).optional()
  );
}

function optionalLudwigScale() {
  return z.preprocess(
    preprocessEmptyStringToNull,
    z.union([z.null(), z.enum(LUDWIG_SCALE_VALUES as unknown as [string, ...string[]])]).optional()
  );
}

function optionalHairlinePattern() {
  return z.preprocess(
    preprocessEmptyStringToNull,
    z
      .union([z.null(), z.enum(HAIRLINE_PATTERN_VALUES as unknown as [string, ...string[]])])
      .optional()
  );
}

export const patientClinicalDetailsPatchBodySchema = z
  .object({
    adminKey: z.string().optional(),
    primary_hair_concern: boundedText(
      CLINICAL_DETAILS_TEXT_MAX.primary_hair_concern,
      "primary_hair_concern"
    ),
    treatment_interest: boundedText(
      CLINICAL_DETAILS_TEXT_MAX.treatment_interest,
      "treatment_interest"
    ),
    hair_loss_duration: boundedText(
      CLINICAL_DETAILS_TEXT_MAX.hair_loss_duration,
      "hair_loss_duration"
    ),
    family_history: boundedText(CLINICAL_DETAILS_TEXT_MAX.family_history, "family_history"),
    relevant_medical_history: boundedText(
      CLINICAL_DETAILS_TEXT_MAX.relevant_medical_history,
      "relevant_medical_history"
    ),
    current_medications: boundedText(
      CLINICAL_DETAILS_TEXT_MAX.current_medications,
      "current_medications"
    ),
    allergies: boundedText(CLINICAL_DETAILS_TEXT_MAX.allergies, "allergies"),
    contraindications: boundedText(
      CLINICAL_DETAILS_TEXT_MAX.contraindications,
      "contraindications"
    ),
    scalp_conditions: boundedText(CLINICAL_DETAILS_TEXT_MAX.scalp_conditions, "scalp_conditions"),
    previous_hair_treatments: boundedText(
      CLINICAL_DETAILS_TEXT_MAX.previous_hair_treatments,
      "previous_hair_treatments"
    ),
    norwood_scale: optionalNorwoodScale(),
    ludwig_scale: optionalLudwigScale(),
    hairline_pattern: optionalHairlinePattern(),
    primary_concern: boundedText(CLINICAL_DETAILS_TEXT_MAX.primary_concern, "primary_concern"),
    clinical_flags: jsonObjectSchema,
    metadata: jsonObjectSchema,
  })
  .strict()
  .superRefine((b, ctx) => {
    const keys = Object.keys(b).filter((k) => k !== "adminKey");
    if (keys.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one clinical field, clinical_flags, or metadata.",
      });
    }
  });

export type PatientClinicalDetailsPatchBody = z.infer<typeof patientClinicalDetailsPatchBodySchema>;
