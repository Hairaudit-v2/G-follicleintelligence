import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledDisabledInput } from "./consultationOsPreviewFields";

export function ConsultationOsMedicalPanel() {
  return (
    <FiSection title="Medical" headingId="consultation-os-medical-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LabeledDisabledInput id="cos-meds" label="Current medications" />
        <LabeledDisabledInput id="cos-conditions" label="Medical conditions" />
        <LabeledDisabledInput id="cos-scalp" label="Scalp condition" />
        <LabeledDisabledInput id="cos-contra" label="Possible contraindications" className="sm:col-span-2" />
      </div>
    </FiSection>
  );
}
