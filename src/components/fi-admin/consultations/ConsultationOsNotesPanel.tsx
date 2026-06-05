import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledDisabledTextarea } from "./consultationOsPreviewFields";

export type ConsultationOsNotesPanelProps = {
  /** Shown in the textarea `placeholder` to reflect the active consultation type. */
  notesPlaceholder: string;
  /** Short bullets rendered above the field as prompt guidance. */
  promptFocus: string[];
};

export function ConsultationOsNotesPanel({ notesPlaceholder, promptFocus }: ConsultationOsNotesPanelProps) {
  return (
    <FiSection title="Live consultation notes" headingId="consultation-os-notes-heading">
      {promptFocus.length > 0 ? (
        <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Prompt focus</p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-slate-600">
            {promptFocus.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <LabeledDisabledTextarea
        id="cos-live-notes"
        label="Notes"
        placeholder={notesPlaceholder}
        hint="Autosave will be added in a later stage."
      />
    </FiSection>
  );
}
