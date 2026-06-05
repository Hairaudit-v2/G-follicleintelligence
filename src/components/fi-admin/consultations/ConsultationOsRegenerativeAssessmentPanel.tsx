import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledTextInput, type ConsultationOsSectionBinder } from "./consultationOsPreviewFields";

const FIELDS = [
  { key: "treatment_area", label: "Treatment area" },
  { key: "hair_loss_type", label: "Hair loss type" },
  { key: "previous_treatments", label: "Previous treatments" },
  { key: "session_plan", label: "Session plan" },
  { key: "maintenance_plan", label: "Maintenance plan" },
  { key: "contraindications", label: "Contraindications" },
] as const;

export function ConsultationOsRegenerativeAssessmentPanel({
  values,
  onFieldChange,
  disabled,
}: ConsultationOsSectionBinder) {
  return (
    <FiSection title="Regenerative assessment" headingId="consultation-os-regen-assessment-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <LabeledTextInput
            key={f.key}
            id={`cos-regen-${f.key}`}
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
