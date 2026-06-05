import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledDisabledInput } from "./consultationOsPreviewFields";

export function ConsultationOsAssessmentPanel() {
  return (
    <FiSection title="Assessment" headingId="consultation-os-assessment-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LabeledDisabledInput id="cos-grade-loss" label="Grade of loss" />
        <LabeledDisabledInput id="cos-pattern" label="Pattern classification" />
        <LabeledDisabledInput id="cos-duration" label="Duration of hair loss" />
        <LabeledDisabledInput id="cos-family" label="Family history" />
        <LabeledDisabledInput id="cos-prev-tx" label="Previous treatments" />
        <LabeledDisabledInput id="cos-obs" label="Initial observations" className="sm:col-span-2" />
      </div>
    </FiSection>
  );
}
