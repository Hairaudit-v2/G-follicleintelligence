import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledDisabledInput } from "./consultationOsPreviewFields";

export function ConsultationOsRecommendationsPanel() {
  return (
    <FiSection title="Recommendations" headingId="consultation-os-recs-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LabeledDisabledInput id="cos-suitability" label="Surgery suitability" />
        <LabeledDisabledInput id="cos-pathway" label="Recommended treatment pathway" />
        <LabeledDisabledInput id="cos-prp" label="PRP / PRF" />
        <LabeledDisabledInput id="cos-exosomes" label="Exosomes" />
        <LabeledDisabledInput id="cos-med-plan" label="Medication plan" />
        <LabeledDisabledInput id="cos-complications" label="Possible complications" />
      </div>
    </FiSection>
  );
}
