/** Canonical section keys for voice → structured consultation notes (DoctorOS 1C). */
export const CLINICAL_NOTE_SECTION_KEYS = [
  "presenting_concern",
  "hair_loss_history",
  "current_medications",
  "relevant_medical_history",
  "examination_findings",
  "assessment",
  "plan",
  "prescription_discussion",
  "follow_up",
] as const;

export type ClinicalNoteSectionKey = (typeof CLINICAL_NOTE_SECTION_KEYS)[number];

export const CLINICAL_NOTE_SECTION_LABELS: Record<ClinicalNoteSectionKey, string> = {
  presenting_concern: "Presenting concern",
  hair_loss_history: "Hair loss history",
  current_medications: "Current medications",
  relevant_medical_history: "Relevant medical history",
  examination_findings: "Examination findings",
  assessment: "Assessment",
  plan: "Plan",
  prescription_discussion: "Prescription discussion",
  follow_up: "Follow-up",
};

export function emptyClinicalNoteSections(): Record<ClinicalNoteSectionKey, string> {
  const o = {} as Record<ClinicalNoteSectionKey, string>;
  for (const k of CLINICAL_NOTE_SECTION_KEYS) {
    o[k] = "";
  }
  return o;
}
