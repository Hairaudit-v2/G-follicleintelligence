import { FiSection } from "@/src/components/fi-design/FiSection";

import { ClinicalHairLossScaleFields } from "@/src/components/fi/patients/ClinicalHairLossScaleFields";
import { LabeledTextInput, type ConsultationOsSectionBinder } from "./consultationOsPreviewFields";

const FIELDS = [
  { key: "pattern_type_of_loss", label: "Pattern/type of loss" },
  { key: "duration", label: "Duration" },
  { key: "blood_test_requirements", label: "Blood test requirements" },
  { key: "medication_discussion", label: "Medication discussion" },
  { key: "nutritional_hormonal_factors", label: "Nutritional / hormonal factors" },
  { key: "follow_up_plan", label: "Follow-up plan" },
] as const;

export function ConsultationOsMedicalHairLossPanel({
  values,
  onFieldChange,
  disabled,
}: ConsultationOsSectionBinder) {
  return (
    <FiSection title="Hair loss (medical)" headingId="consultation-os-med-hair-loss-heading">
      <div className="space-y-4">
        <ClinicalHairLossScaleFields
          values={{
            norwood_scale: values.norwood_scale ?? "",
            ludwig_scale: values.ludwig_scale ?? "",
            hairline_pattern: values.hairline_pattern ?? "",
            primary_concern: values.primary_concern ?? "",
          }}
          onFieldChange={onFieldChange}
          disabled={disabled}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <LabeledTextInput
              key={f.key}
              id={`cos-mhl-${f.key}`}
              label={f.label}
              value={values[f.key] ?? ""}
              onChange={(v) => onFieldChange(f.key, v)}
              disabled={disabled}
            />
          ))}
        </div>
      </div>
    </FiSection>
  );
}
