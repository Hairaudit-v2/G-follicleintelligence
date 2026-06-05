import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledTextInput, type ConsultationOsSectionBinder } from "./consultationOsPreviewFields";

const FIELDS = [
  { key: "surgery_suitability", label: "Surgery suitability" },
  { key: "recommended_pathway", label: "Recommended treatment pathway" },
  { key: "prp_prf", label: "PRP / PRF" },
  { key: "exosomes", label: "Exosomes" },
  { key: "medication_plan", label: "Medication plan" },
  { key: "possible_complications", label: "Possible complications" },
] as const;

export function ConsultationOsRecommendationsPanel({ values, onFieldChange, disabled }: ConsultationOsSectionBinder) {
  return (
    <FiSection title="Recommendations" headingId="consultation-os-recs-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <LabeledTextInput
            key={f.key}
            id={`cos-rec-${f.key}`}
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
