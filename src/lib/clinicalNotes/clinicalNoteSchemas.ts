import { z } from "zod";

import type { ClinicalNoteSectionKey } from "@/src/lib/clinicalNotes/clinicalNoteConstants";

const s = z.string().max(16000).optional().default("");

export const clinicalNoteSectionsSchema = z.object({
  presenting_concern: s,
  hair_loss_history: s,
  current_medications: s,
  relevant_medical_history: s,
  examination_findings: s,
  assessment: s,
  plan: s,
  prescription_discussion: s,
  follow_up: s,
});

export type ClinicalNoteSections = z.infer<typeof clinicalNoteSectionsSchema>;

export function parseClinicalNoteSections(raw: unknown): ClinicalNoteSections {
  const parsed = clinicalNoteSectionsSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    const empty: Record<ClinicalNoteSectionKey, string> = {
      presenting_concern: "",
      hair_loss_history: "",
      current_medications: "",
      relevant_medical_history: "",
      examination_findings: "",
      assessment: "",
      plan: "",
      prescription_discussion: "",
      follow_up: "",
    };
    return empty;
  }
  return parsed.data;
}
