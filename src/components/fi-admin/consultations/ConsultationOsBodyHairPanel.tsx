import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledDisabledInput } from "./consultationOsPreviewFields";

export function ConsultationOsBodyHairPanel() {
  return (
    <FiSection title="Body hair" headingId="consultation-os-body-hair-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LabeledDisabledInput id="cos-body-donor" label="Donor source area" />
        <LabeledDisabledInput id="cos-body-recipient" label="Recipient area" />
        <LabeledDisabledInput id="cos-body-texture" label="Texture match" />
        <LabeledDisabledInput id="cos-body-extraction" label="Extraction suitability" />
        <LabeledDisabledInput id="cos-body-risks" label="Risks / limitations" />
        <LabeledDisabledInput id="cos-body-yield" label="Expected yield" />
      </div>
    </FiSection>
  );
}
