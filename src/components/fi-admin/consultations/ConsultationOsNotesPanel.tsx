import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledDisabledTextarea } from "./consultationOsPreviewFields";

export function ConsultationOsNotesPanel() {
  return (
    <FiSection
      title="Live consultation notes"
      description="Preview workspace — fields are disabled until a later release."
      headingId="consultation-os-notes-heading"
    >
      <LabeledDisabledTextarea
        id="cos-live-notes"
        label="Notes"
        placeholder="Type live consultation notes here…"
        hint="Autosave will be added in a later stage."
      />
    </FiSection>
  );
}
