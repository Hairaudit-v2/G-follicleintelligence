import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledDisabledInput } from "./consultationOsPreviewFields";

export function ConsultationOsMedicalHairLossPanel() {
  return (
    <FiSection title="Hair loss (medical)" headingId="consultation-os-med-hair-loss-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LabeledDisabledInput id="cos-mhl-pattern" label="Pattern/type of loss" />
        <LabeledDisabledInput id="cos-mhl-duration" label="Duration" />
        <LabeledDisabledInput id="cos-mhl-blood" label="Blood test requirements" />
        <LabeledDisabledInput id="cos-mhl-meds" label="Medication discussion" />
        <LabeledDisabledInput id="cos-mhl-nutrition" label="Nutritional / hormonal factors" />
        <LabeledDisabledInput id="cos-mhl-followup" label="Follow-up plan" />
      </div>
    </FiSection>
  );
}
