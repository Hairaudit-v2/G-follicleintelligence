import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledTextarea } from "./consultationOsPreviewFields";

export type ConsultationOsNotesPanelProps = {
  /** Shown in the textarea `placeholder` to reflect the active consultation type. */
  notesPlaceholder: string;
  /** Short bullets rendered above the field as prompt guidance. */
  promptFocus: string[];
  liveNotes: string;
  onLiveNotesChange: (next: string) => void;
  disabled?: boolean;
};

export function ConsultationOsNotesPanel({
  notesPlaceholder,
  promptFocus,
  liveNotes,
  onLiveNotesChange,
  disabled,
}: ConsultationOsNotesPanelProps) {
  return (
    <FiSection title="Live consultation notes" headingId="consultation-os-notes-heading">
      {promptFocus.length > 0 ? (
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Prompt focus
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-slate-400">
            {promptFocus.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <LabeledTextarea
        id="cos-live-notes"
        label="Notes"
        value={liveNotes}
        onChange={onLiveNotesChange}
        placeholder={notesPlaceholder}
        hint="Manual save only — autosave is not enabled in this stage."
        disabled={disabled}
      />
    </FiSection>
  );
}
