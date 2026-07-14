/**
 * Pure helpers: map structured voice clinical-note sections → consultation form field values.
 * Only suggests free-text style fields; never invents select/boolean codes.
 */

import {
  CLINICAL_NOTE_SECTION_KEYS,
  CLINICAL_NOTE_SECTION_LABELS,
  type ClinicalNoteSectionKey,
} from "@/src/lib/clinicalNotes/clinicalNoteConstants";
import type { ClinicalNoteSections } from "@/src/lib/clinicalNotes/clinicalNoteSchemas";
import type { ConsultationFormField } from "@/src/lib/consultationForms/consultationFormTypes";

export type VoiceNoteFormSuggestion = {
  fieldId: string;
  fieldLabel: string;
  sectionKey: ClinicalNoteSectionKey | "combined" | "transcript";
  value: string;
  /** True when current form value is empty / blank. */
  fieldWasEmpty: boolean;
};

const SECTION_FIELD_HINTS: Record<ClinicalNoteSectionKey, string[]> = {
  presenting_concern: [
    "presenting",
    "chief_complaint",
    "chief_concern",
    "complaint",
    "priority_focus",
    "primary_concern",
    "reason_for_visit",
  ],
  hair_loss_history: [
    "hair_loss_history",
    "history",
    "onset",
    "duration",
    "progression",
    "pattern_history",
  ],
  current_medications: ["medication", "medications", "current_meds", "drug", "rx_current"],
  relevant_medical_history: [
    "medical_history",
    "pmh",
    "comorbid",
    "health_history",
    "relevant_history",
  ],
  examination_findings: [
    "examination",
    "exam_findings",
    "findings",
    "scalp_exam",
    "clinical_findings",
  ],
  assessment: ["assessment", "impression", "diagnosis", "formulation"],
  plan: ["plan", "recommendation", "treatment_plan", "management_plan", "next_steps"],
  prescription_discussion: ["prescription", "rx_discussion", "medication_discussion", "pharma"],
  follow_up: ["follow_up", "followup", "review", "recall", "next_review"],
};

function isBlankFormValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if (typeof o.note === "string") return o.note.trim() === "";
    if (typeof o.transcript === "string") return o.transcript.trim() === "";
  }
  return false;
}

function fieldHaystack(field: ConsultationFormField): string {
  return `${field.id} ${field.label}`.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function matchSectionForField(field: ConsultationFormField): ClinicalNoteSectionKey | null {
  const hay = fieldHaystack(field);
  for (const key of CLINICAL_NOTE_SECTION_KEYS) {
    const hints = SECTION_FIELD_HINTS[key];
    if (hints.some((h) => hay.includes(h))) return key;
  }
  // Label-only fuzzy: section label words
  for (const key of CLINICAL_NOTE_SECTION_KEYS) {
    const labelBits = CLINICAL_NOTE_SECTION_LABELS[key].toLowerCase().split(/\s+/);
    if (labelBits.every((b) => b.length > 3 && hay.includes(b.replace(/[^a-z]/g, "")))) {
      return key;
    }
  }
  return null;
}

function formatSectionsAsNote(sections: ClinicalNoteSections): string {
  const parts: string[] = [];
  for (const key of CLINICAL_NOTE_SECTION_KEYS) {
    const text = sections[key]?.trim();
    if (!text) continue;
    parts.push(`${CLINICAL_NOTE_SECTION_LABELS[key]}\n${text}`);
  }
  return parts.join("\n\n");
}

/**
 * Build suggestions for fillable form fields from a voice clinical note.
 * Prefer filling empty fields only (caller can pass fillEmptyOnly=false to overwrite).
 */
export function buildVoiceNoteFormSuggestions(input: {
  fields: readonly ConsultationFormField[];
  sections: ClinicalNoteSections;
  transcriptRaw?: string | null;
  currentValues: Record<string, unknown>;
  fillEmptyOnly?: boolean;
}): VoiceNoteFormSuggestion[] {
  const fillEmptyOnly = input.fillEmptyOnly !== false;
  const combined = formatSectionsAsNote(input.sections);
  const transcript = input.transcriptRaw?.trim() ?? "";
  const out: VoiceNoteFormSuggestion[] = [];

  for (const field of input.fields) {
    const empty = isBlankFormValue(input.currentValues[field.id]);
    if (fillEmptyOnly && !empty) continue;

    if (field.type === "clinical_note") {
      if (!combined) continue;
      out.push({
        fieldId: field.id,
        fieldLabel: field.label,
        sectionKey: "combined",
        value: combined,
        fieldWasEmpty: empty,
      });
      continue;
    }

    if (field.type === "voice_note") {
      const t = transcript || combined;
      if (!t) continue;
      out.push({
        fieldId: field.id,
        fieldLabel: field.label,
        sectionKey: transcript ? "transcript" : "combined",
        value: t,
        fieldWasEmpty: empty,
      });
      continue;
    }

    if (field.type !== "text" && field.type !== "textarea") continue;

    const sectionKey = matchSectionForField(field);
    if (!sectionKey) {
      // Generic notes / free-text catch-all
      const hay = fieldHaystack(field);
      if (
        (hay.includes("note") || hay.includes("comment") || hay.includes("additional")) &&
        combined
      ) {
        out.push({
          fieldId: field.id,
          fieldLabel: field.label,
          sectionKey: "combined",
          value: combined,
          fieldWasEmpty: empty,
        });
      }
      continue;
    }

    const text = input.sections[sectionKey]?.trim();
    if (!text) continue;
    out.push({
      fieldId: field.id,
      fieldLabel: field.label,
      sectionKey,
      value: text,
      fieldWasEmpty: empty,
    });
  }

  return out;
}

/** Apply suggestions into a values map (returns new object). */
export function applyVoiceNoteFormSuggestions(
  currentValues: Record<string, unknown>,
  suggestions: readonly VoiceNoteFormSuggestion[],
  fieldTypes: Record<string, string>
): Record<string, unknown> {
  const next = { ...currentValues };
  const now = new Date().toISOString();
  for (const s of suggestions) {
    const t = fieldTypes[s.fieldId];
    if (t === "clinical_note") {
      next[s.fieldId] = { mode: "clinical_note", note: s.value, updatedAt: now };
    } else if (t === "voice_note") {
      next[s.fieldId] = {
        mode: "voice_note",
        transcript: s.value,
        updatedAt: now,
      };
    } else {
      next[s.fieldId] = s.value;
    }
  }
  return next;
}
