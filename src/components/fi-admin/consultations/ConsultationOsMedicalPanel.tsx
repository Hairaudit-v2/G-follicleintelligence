import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledTextInput, type ConsultationOsSectionBinder } from "./consultationOsPreviewFields";

const FIELDS = [
  { key: "current_medications", label: "Current medications" },
  { key: "medical_conditions", label: "Medical conditions" },
  { key: "scalp_condition", label: "Scalp condition" },
  { key: "possible_contraindications", label: "Possible contraindications", wide: true },
] as const;

export function ConsultationOsMedicalPanel({ values, onFieldChange, disabled }: ConsultationOsSectionBinder) {
  return (
    <FiSection title="Medical" headingId="consultation-os-medical-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <LabeledTextInput
            key={f.key}
            id={`cos-med-${f.key}`}
            label={f.label}
            value={values[f.key] ?? ""}
            onChange={(v) => onFieldChange(f.key, v)}
            disabled={disabled}
            className={"wide" in f && f.wide ? "sm:col-span-2" : undefined}
          />
        ))}
      </div>
    </FiSection>
  );
}
