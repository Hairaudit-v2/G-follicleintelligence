import { FiSection } from "@/src/components/fi-design/FiSection";

import { CONSULTATION_QUOTE_DATA_KEYS, type ConsultationQuoteDataKey } from "@/src/lib/consultations/consultationTypes";

import { LabeledTextInput } from "./consultationOsPreviewFields";

const QUOTE_LABELS: Record<ConsultationQuoteDataKey, string> = {
  session_size: "Session size",
  graft_estimate: "Graft estimate",
  price_quoted: "Price quoted",
  other_services: "Other services",
  finance_options: "Finance options",
  quote_status: "Quote status",
};

export type ConsultationOsQuotePanelProps = {
  values: Record<ConsultationQuoteDataKey, string>;
  onFieldChange: (key: ConsultationQuoteDataKey, value: string) => void;
  disabled?: boolean;
};

export function ConsultationOsQuotePanel({ values, onFieldChange, disabled }: ConsultationOsQuotePanelProps) {
  return (
    <FiSection title="Quote" headingId="consultation-os-quote-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CONSULTATION_QUOTE_DATA_KEYS.map((key) => (
          <LabeledTextInput
            key={key}
            id={`cos-quote-${key}`}
            label={QUOTE_LABELS[key]}
            value={values[key] ?? ""}
            onChange={(v) => onFieldChange(key, v)}
            disabled={disabled}
          />
        ))}
      </div>
    </FiSection>
  );
}
