import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledDisabledInput } from "./consultationOsPreviewFields";

export function ConsultationOsDonorPanel() {
  return (
    <FiSection title="Donor" headingId="consultation-os-donor-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LabeledDisabledInput id="cos-donor-density" label="Donor density" />
        <LabeledDisabledInput id="cos-hair-type" label="Hair type" />
        <LabeledDisabledInput id="cos-hair-calibre" label="Hair calibre" />
        <LabeledDisabledInput id="cos-donor-quality" label="Donor quality notes" className="sm:col-span-2" />
      </div>
    </FiSection>
  );
}
