import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledDisabledInput } from "./consultationOsPreviewFields";

export function ConsultationOsRegenerativeAssessmentPanel() {
  return (
    <FiSection title="Regenerative assessment" headingId="consultation-os-regen-assessment-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LabeledDisabledInput id="cos-regen-area" label="Treatment area" />
        <LabeledDisabledInput id="cos-regen-loss-type" label="Hair loss type" />
        <LabeledDisabledInput id="cos-regen-prev" label="Previous treatments" />
        <LabeledDisabledInput id="cos-regen-session" label="Session plan" />
        <LabeledDisabledInput id="cos-regen-maint" label="Maintenance plan" />
        <LabeledDisabledInput id="cos-regen-contra" label="Contraindications" />
      </div>
    </FiSection>
  );
}
