"use client";

import { cn } from "@/lib/utils";
import { AiGeneratedClinicalNoteField } from "@/src/components/fi-admin/consultation-forms/AiGeneratedClinicalNoteField";
import { BodyAreaMapAnnotationsSummary, BodyAreaMapField } from "@/src/components/fi-admin/consultation-forms/BodyAreaMapField";
import { ClinicalNoteField, ClinicalNoteReadOnlySummary } from "@/src/components/fi-admin/consultation-forms/ClinicalNoteField";
import { VoiceNoteField, VoiceNoteReadOnlySummary } from "@/src/components/fi-admin/consultation-forms/VoiceNoteField";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import { evaluateConsultationFormCondition } from "@/src/lib/consultationForms/consultationFormCondition";
import { optionsForField } from "@/src/lib/consultationForms/consultationFormOptionSets";
import {
  FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG,
  HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG,
  HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG,
} from "@/src/lib/consultationForms/consultationFormConstants";
import type { ConsultationFormField, ConsultationFormPersistenceContext } from "@/src/lib/consultationForms/consultationFormTypes";

function readStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}

function PlaceholderCard({ title, body }: { title: string; body: string }) {
  return (
    <FiCard className="border border-dashed border-slate-300 bg-slate-50/90 p-4">
      <p className={cn("text-sm font-semibold", fiOsLightFormSurfaceClassNames.labelInline)}>{title}</p>
      <p className={cn("mt-1", fiOsLightFormSurfaceClassNames.helper)}>{body}</p>
    </FiCard>
  );
}

export function ConsultationFormFieldRenderer({
  field,
  values,
  value,
  onChange,
  disabled,
  persistence = null,
  sectionId,
  templateSlug,
}: {
  field: ConsultationFormField;
  values: Record<string, unknown>;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled: boolean;
  persistence?: ConsultationFormPersistenceContext | null;
  /** Active section id — used for Hair Transplant v2 handoff UX. */
  sectionId?: string;
  templateSlug?: string;
}) {
  if (!evaluateConsultationFormCondition(field.showWhen, values)) {
    return null;
  }

  const slug = templateSlug?.trim() ?? "";
  const sec = sectionId?.trim() ?? "";
  const hairTransplantHandoffUx =
    (slug === HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG || slug === HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG) &&
    sec === "clinical_summary_handoff";

  const followUpAiNoteUx =
    slug === FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG && sec === "clinical_summary_next_action";

  const aiGeneratedClinicalNoteUx = hairTransplantHandoffUx || followUpAiNoteUx;

  if (hairTransplantHandoffUx && field.id === "clinician_voice_note") {
    return null;
  }

  if (aiGeneratedClinicalNoteUx && field.type === "clinical_note" && field.id === "structured_clinical_note") {
    return (
      <AiGeneratedClinicalNoteField
        label={field.label}
        description={field.description}
        required={field.required}
        values={values}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  const opts = optionsForField(field);
  const commonLabel = (
    <label className={fiOsLightFormSurfaceClassNames.label}>
      {field.label}
      {field.required ? <span className={fiOsLightFormSurfaceClassNames.requiredMark}> *</span> : null}
    </label>
  );

  const description =
    field.description?.trim() ? (
      <p className={cn("mt-0.5", fiOsLightFormSurfaceClassNames.helper)}>{field.description}</p>
    ) : null;

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-1">
          {commonLabel}
          {description}
          <input
            type="text"
            className={fiOsLightFormSurfaceClassNames.controlInset}
            value={typeof value === "string" ? value : value == null ? "" : String(value)}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "textarea":
      return (
        <div className="space-y-1">
          {commonLabel}
          {description}
          <textarea
            className={cn(fiOsLightFormSurfaceClassNames.controlInset, "min-h-[88px]")}
            value={typeof value === "string" ? value : value == null ? "" : String(value)}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "number":
      return (
        <div className="space-y-1">
          {commonLabel}
          {description}
          <input
            type="number"
            className={cn(fiOsLightFormSurfaceClassNames.controlInset, "max-w-xs")}
            value={
              typeof value === "number" && !Number.isNaN(value)
                ? String(value)
                : typeof value === "string" && value.trim() !== ""
                  ? value
                  : ""
            }
            min={field.min}
            max={field.max}
            step={field.step ?? "any"}
            disabled={disabled}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onChange(null);
                return;
              }
              const n = Number.parseFloat(raw);
              onChange(Number.isNaN(n) ? null : n);
            }}
          />
        </div>
      );
    case "date":
      return (
        <div className="space-y-1">
          {commonLabel}
          {description}
          <input
            type="date"
            className={fiOsLightFormSurfaceClassNames.controlInsetDate}
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "boolean":
      return (
        <div className="flex items-start gap-2">
          <input
            id={`cf-${field.id}`}
            type="checkbox"
            className={cn("mt-1", fiOsLightFormSurfaceClassNames.choiceCheckbox)}
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <div>
            <label htmlFor={`cf-${field.id}`} className={fiOsLightFormSurfaceClassNames.labelInline}>
              {field.label}
              {field.required ? <span className={fiOsLightFormSurfaceClassNames.requiredMark}> *</span> : null}
            </label>
            {description}
          </div>
        </div>
      );
    case "select":
      return (
        <div className="space-y-1">
          {commonLabel}
          {description}
          <select
            className={cn(fiOsLightFormSurfaceClassNames.controlInset, "max-w-lg")}
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">— Select —</option>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "multi_select":
    case "checkbox_group": {
      const selected = new Set(readStringArray(value));
      return (
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className={fiOsLightFormSurfaceClassNames.legend}>
            {field.label}
            {field.required ? <span className={fiOsLightFormSurfaceClassNames.requiredMark}> *</span> : null}
          </legend>
          {description}
          <div className="grid gap-2 sm:grid-cols-2">
            {opts.map((o) => {
              const checked = selected.has(o.value);
              return (
                <label key={o.value} className={fiOsLightFormSurfaceClassNames.choiceRow}>
                  <input
                    type="checkbox"
                    className={fiOsLightFormSurfaceClassNames.choiceCheckbox}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => {
                      const next = new Set(selected);
                      if (checked) next.delete(o.value);
                      else next.add(o.value);
                      onChange(Array.from(next));
                    }}
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    }
    case "radio":
      return (
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className={fiOsLightFormSurfaceClassNames.legend}>
            {field.label}
            {field.required ? <span className={fiOsLightFormSurfaceClassNames.requiredMark}> *</span> : null}
          </legend>
          {description}
          <div className="flex flex-col gap-2">
            {opts.map((o) => (
              <label key={o.value} className={fiOsLightFormSurfaceClassNames.choiceRow}>
                <input
                  type="radio"
                  name={`cf-radio-${field.id}`}
                  className="h-4 w-4 border-slate-500 text-cyan-600 focus:ring-2 focus:ring-cyan-400/35"
                  value={o.value}
                  checked={value === o.value}
                  disabled={disabled}
                  onChange={() => onChange(o.value)}
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      );
    case "body_area_map":
      if (disabled) {
        return (
          <div className="space-y-2">
            {commonLabel}
            {description}
            <BodyAreaMapAnnotationsSummary
              fieldLabel=""
              value={value}
              allowedViews={field.bodyAreaMapViews}
            />
          </div>
        );
      }
      return (
        <BodyAreaMapField
          label={field.label}
          description={field.description}
          required={field.required}
          value={value}
          disabled={disabled}
          allowedViews={field.bodyAreaMapViews}
          onChange={(next) => onChange(next)}
        />
      );
    case "voice_note":
      if (disabled) {
        return (
          <div className="space-y-2">
            {description}
            <VoiceNoteReadOnlySummary label={field.label} value={value} />
          </div>
        );
      }
      return (
        <VoiceNoteField
          fieldId={field.id}
          label={field.label}
          description={field.description}
          required={field.required}
          value={value}
          disabled={disabled}
          persistence={persistence}
          onChange={(next) => onChange(next)}
        />
      );
    case "image_upload":
      return (
        <div className="space-y-2">
          {commonLabel}
          {description}
          <PlaceholderCard
            title="Image upload (Stage 2+)"
            body="Uploads will create fi_patient_images rows linked to this consultation / form instance."
          />
        </div>
      );
    case "clinical_note":
      if (disabled) {
        return (
          <div className="space-y-2">
            {description}
            <ClinicalNoteReadOnlySummary label={field.label} value={value} />
          </div>
        );
      }
      return (
        <ClinicalNoteField
          label={field.label}
          description={field.description}
          required={field.required}
          value={value}
          disabled={disabled}
          onChange={(next) => onChange(next)}
        />
      );
    case "diagnosis_picker":
      return (
        <div className="space-y-2">
          {commonLabel}
          {description}
          <PlaceholderCard
            title="Diagnosis picker (Stage 2+)"
            body="Searchable diagnosis codes / impressions will be wired here."
          />
        </div>
      );
    case "treatment_recommendation":
      return (
        <div className="space-y-2">
          {commonLabel}
          {description}
          <PlaceholderCard
            title="Treatment recommendation (Stage 2+)"
            body="Procedure bundles and medical therapy suggestions will render here."
          />
        </div>
      );
    case "quote_builder":
      return (
        <div className="space-y-2">
          {commonLabel}
          {description}
          <PlaceholderCard
            title="Quote builder (Stage 2+)"
            body="Line items, templates, and fi_crm_quotes linkage will replace this placeholder."
          />
        </div>
      );
    default:
      return (
        <p className="text-xs text-amber-900">
          Unsupported field type:{" "}
          <code className="rounded bg-amber-100 px-1 font-mono text-[0.8rem] text-amber-950">{field.type}</code>
        </p>
      );
  }
}
