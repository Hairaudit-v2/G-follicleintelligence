import type { EditableClinicalDetailKey } from "./clinicalDetailsPolicy";

export const CLINICAL_DETAIL_FIELD_LABELS: Record<EditableClinicalDetailKey, string> = {
  primary_hair_concern: "Primary hair concern",
  treatment_interest: "Treatment interest",
  hair_loss_duration: "Hair loss duration",
  family_history: "Family history",
  relevant_medical_history: "Relevant medical history",
  current_medications: "Current medications",
  allergies: "Allergies",
  contraindications: "Contraindications",
  scalp_conditions: "Scalp conditions",
  previous_hair_treatments: "Previous hair treatments",
  norwood_scale: "Norwood scale",
  ludwig_scale: "Ludwig scale",
  hairline_pattern: "Hairline pattern",
  primary_concern: "Primary concern",
  clinical_flags: "Clinical flags (JSON)",
  metadata: "Metadata (JSON)",
};
