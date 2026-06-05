import type { PatientClinicalDetailsPatchBody } from "./clinicalDetailsApiSchemas";
import type { EditableClinicalDetailsPayload } from "./clinicalDetailsPolicy";
import { normalizeEditableClinicalDetailsPayload } from "./clinicalDetailsPolicy";

/** Apply PATCH-style fields from parsed body onto a full editable payload (undefined = leave unchanged). */
export function mergeClinicalDetailsPatch(
  base: EditableClinicalDetailsPayload,
  patch: PatientClinicalDetailsPatchBody
): EditableClinicalDetailsPayload {
  const record: Record<string, unknown> = { ...base };
  const keys = [
    "primary_hair_concern",
    "treatment_interest",
    "hair_loss_duration",
    "family_history",
    "relevant_medical_history",
    "current_medications",
    "allergies",
    "contraindications",
    "scalp_conditions",
    "previous_hair_treatments",
    "norwood_scale",
    "ludwig_scale",
    "hairline_pattern",
    "primary_concern",
    "clinical_flags",
    "metadata",
  ] as const;
  for (const k of keys) {
    const v = (patch as Record<string, unknown>)[k];
    if (v !== undefined) {
      record[k] = v;
    }
  }
  return normalizeEditableClinicalDetailsPayload(record);
}
