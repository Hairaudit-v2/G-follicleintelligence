import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledTextInput, type ConsultationOsSectionBinder } from "./consultationOsPreviewFields";

const FIELDS = [
  { key: "donor_source_area", label: "Donor source area" },
  { key: "recipient_area", label: "Recipient area" },
  { key: "texture_match", label: "Texture match" },
  { key: "extraction_suitability", label: "Extraction suitability" },
  { key: "risks_limitations", label: "Risks / limitations" },
  { key: "expected_yield", label: "Expected yield" },
] as const;

export function ConsultationOsBodyHairPanel({ values, onFieldChange, disabled }: ConsultationOsSectionBinder) {
  return (
    <FiSection title="Body hair" headingId="consultation-os-body-hair-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <LabeledTextInput
            key={f.key}
            id={`cos-body-${f.key}`}
            label={f.label}
            value={values[f.key] ?? ""}
            onChange={(v) => onFieldChange(f.key, v)}
            disabled={disabled}
          />
        ))}
      </div>
    </FiSection>
  );
}
