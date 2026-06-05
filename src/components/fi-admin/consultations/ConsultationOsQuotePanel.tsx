import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledDisabledInput } from "./consultationOsPreviewFields";

export function ConsultationOsQuotePanel() {
  return (
    <FiSection title="Quote" headingId="consultation-os-quote-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LabeledDisabledInput id="cos-session-size" label="Session size" />
        <LabeledDisabledInput id="cos-graft-est" label="Graft estimate" />
        <LabeledDisabledInput id="cos-price" label="Price quoted" />
        <LabeledDisabledInput id="cos-other-svc" label="Other services" />
        <LabeledDisabledInput id="cos-finance" label="Finance options" />
        <LabeledDisabledInput id="cos-quote-status" label="Quote status" defaultValue="Draft" />
      </div>
    </FiSection>
  );
}
