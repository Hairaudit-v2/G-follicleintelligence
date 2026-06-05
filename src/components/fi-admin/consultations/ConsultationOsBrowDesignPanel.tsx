import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledDisabledInput } from "./consultationOsPreviewFields";

export function ConsultationOsBrowDesignPanel() {
  return (
    <FiSection title="Brow design" headingId="consultation-os-brow-design-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LabeledDisabledInput id="cos-brow-shape" label="Desired brow shape" />
        <LabeledDisabledInput id="cos-brow-symmetry" label="Symmetry notes" />
        <LabeledDisabledInput id="cos-brow-density" label="Density requirement" />
        <LabeledDisabledInput id="cos-brow-scar" label="Scar tissue" />
        <LabeledDisabledInput id="cos-brow-existing" label="Existing brow hair quality" />
        <LabeledDisabledInput id="cos-brow-donor" label="Donor suitability" className="sm:col-span-2" />
      </div>
    </FiSection>
  );
}
