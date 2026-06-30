import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledTextInput, type ConsultationOsSectionBinder } from "./consultationOsPreviewFields";

const FIELDS = [
  { key: "desired_brow_shape", label: "Desired brow shape" },
  { key: "symmetry_notes", label: "Symmetry notes" },
  { key: "density_requirement", label: "Density requirement" },
  { key: "scar_tissue", label: "Scar tissue" },
  { key: "existing_brow_hair_quality", label: "Existing brow hair quality" },
  { key: "donor_suitability", label: "Donor suitability", wide: true },
] as const;

export function ConsultationOsBrowDesignPanel({
  values,
  onFieldChange,
  disabled,
}: ConsultationOsSectionBinder) {
  return (
    <FiSection title="Brow design" headingId="consultation-os-brow-design-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <LabeledTextInput
            key={f.key}
            id={`cos-brow-${f.key}`}
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
