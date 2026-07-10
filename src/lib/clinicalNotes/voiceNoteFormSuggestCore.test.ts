import assert from "node:assert/strict";
import { test } from "node:test";

import { emptyClinicalNoteSections } from "@/src/lib/clinicalNotes/clinicalNoteConstants";
import {
  applyVoiceNoteFormSuggestions,
  buildVoiceNoteFormSuggestions,
} from "@/src/lib/clinicalNotes/voiceNoteFormSuggestCore";
import type { ConsultationFormField } from "@/src/lib/consultationForms/consultationFormTypes";

function field(
  partial: Pick<ConsultationFormField, "id" | "label" | "type">
): ConsultationFormField {
  return { ...partial };
}

test("buildVoiceNoteFormSuggestions maps sections to matching text fields and skips filled", () => {
  const sections = emptyClinicalNoteSections();
  sections.presenting_concern = "Thinning at temples";
  sections.plan = "Start topical minoxidil";

  const fields: ConsultationFormField[] = [
    field({ id: "presenting_concern_notes", label: "Presenting concern", type: "textarea" }),
    field({ id: "treatment_plan", label: "Plan / recommendations", type: "textarea" }),
    field({ id: "priority_focus", label: "Primary focus", type: "select" }),
    field({ id: "already_filled", label: "Assessment", type: "text" }),
  ];

  const suggestions = buildVoiceNoteFormSuggestions({
    fields,
    sections,
    currentValues: {
      already_filled: "existing text",
    },
    fillEmptyOnly: true,
  });

  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0]?.fieldId, "presenting_concern_notes");
  assert.equal(suggestions[0]?.value, "Thinning at temples");
  assert.equal(suggestions[1]?.fieldId, "treatment_plan");
  assert.equal(suggestions[1]?.value, "Start topical minoxidil");
});

test("applyVoiceNoteFormSuggestions writes clinical_note and voice_note shapes", () => {
  const applied = applyVoiceNoteFormSuggestions(
    {},
    [
      {
        fieldId: "structured_clinical_note",
        fieldLabel: "Note",
        sectionKey: "combined",
        value: "Assessment\nStable",
        fieldWasEmpty: true,
      },
      {
        fieldId: "dictation",
        fieldLabel: "Voice",
        sectionKey: "transcript",
        value: "raw transcript",
        fieldWasEmpty: true,
      },
    ],
    {
      structured_clinical_note: "clinical_note",
      dictation: "voice_note",
    }
  );

  assert.equal(
    (applied.structured_clinical_note as { note: string }).note,
    "Assessment\nStable"
  );
  assert.equal((applied.dictation as { transcript: string }).transcript, "raw transcript");
});
