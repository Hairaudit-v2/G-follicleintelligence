import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledTextInput, type ConsultationOsSectionBinder } from "./consultationOsPreviewFields";

const FIELDS = [
  { key: "beard_area", label: "Beard area" },
  { key: "density_goal", label: "Density goal" },
  { key: "patchy_regions", label: "Patchy regions" },
  { key: "scar_correction", label: "Scar correction" },
  { key: "angulation_notes", label: "Angulation notes" },
  { key: "style_preference", label: "Style preference" },
] as const;

export function ConsultationOsBeardDesignPanel({
  values,
  onFieldChange,
  disabled,
}: ConsultationOsSectionBinder) {
  return (
    <FiSection title="Beard design" headingId="consultation-os-beard-design-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <LabeledTextInput
            key={f.key}
            id={`cos-beard-${f.key}`}
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
