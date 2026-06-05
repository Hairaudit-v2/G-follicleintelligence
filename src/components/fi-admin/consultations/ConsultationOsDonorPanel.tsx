import { FiSection } from "@/src/components/fi-design/FiSection";

import { LabeledTextInput, type ConsultationOsSectionBinder } from "./consultationOsPreviewFields";

const FIELDS = [
  { key: "donor_density", label: "Donor density" },
  { key: "hair_type", label: "Hair type" },
  { key: "hair_calibre", label: "Hair calibre" },
  { key: "donor_quality_notes", label: "Donor quality notes", wide: true },
] as const;

export function ConsultationOsDonorPanel({ values, onFieldChange, disabled }: ConsultationOsSectionBinder) {
  return (
    <FiSection title="Donor" headingId="consultation-os-donor-heading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <LabeledTextInput
            key={f.key}
            id={`cos-donor-${f.key}`}
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
