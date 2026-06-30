import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledTextInput, type ConsultationOsSectionBinder } from "./consultationOsPreviewFields";

const FIELDS = [
  { key: "grade_of_loss", label: "Grade of loss" },
  { key: "pattern_classification", label: "Pattern classification" },
  { key: "duration", label: "Duration of hair loss" },
  { key: "family_history", label: "Family history" },
  { key: "previous_treatments", label: "Previous treatments" },
  { key: "initial_observations", label: "Initial observations", wide: true },
] as const;

export function ConsultationOsAssessmentPanel({
  values,
  onFieldChange,
  disabled,
}: ConsultationOsSectionBinder) {
  return (
    <FiSection title="Assessment" headingId="consultation-os-assessment-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <LabeledTextInput
            key={f.key}
            id={`cos-assess-${f.key}`}
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
