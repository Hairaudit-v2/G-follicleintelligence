import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledDisabledInput } from "./consultationOsPreviewFields";

export function ConsultationOsBeardDesignPanel() {
  return (
    <FiSection title="Beard design" headingId="consultation-os-beard-design-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LabeledDisabledInput id="cos-beard-area" label="Beard area" />
        <LabeledDisabledInput id="cos-beard-density" label="Density goal" />
        <LabeledDisabledInput id="cos-beard-patchy" label="Patchy regions" />
        <LabeledDisabledInput id="cos-beard-scar" label="Scar correction" />
        <LabeledDisabledInput id="cos-beard-angulation" label="Angulation notes" />
        <LabeledDisabledInput id="cos-beard-style" label="Style preference" />
      </div>
    </FiSection>
  );
}
