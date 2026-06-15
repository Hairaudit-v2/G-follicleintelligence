"use client";

import { useCallback, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { ClinicalNoteField, ClinicalNoteReadOnlySummary } from "@/src/components/fi-admin/consultation-forms/ClinicalNoteField";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import { buildHairTransplantDeterministicClinicalNoteDraft } from "@/src/lib/consultationForms/hairTransplantClinicalNoteDraft";
import { normalizeClinicalNoteValue, nowIso, type ClinicalNoteFieldValue } from "@/src/lib/consultationForms/consultationFormNoteModel";

export function AiGeneratedClinicalNoteField({
  label,
  description,
  required,
  values,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string | null;
  required?: boolean;
  /** Full form values — draft is regenerated from structured answers only. */
  values: Record<string, unknown>;
  value: unknown;
  onChange: (next: ClinicalNoteFieldValue) => void;
  disabled: boolean;
}) {
  const draft = useMemo(() => buildHairTransplantDeterministicClinicalNoteDraft(values), [values]);
  const normalized = useMemo(() => normalizeClinicalNoteValue(value), [value]);
  const [editing, setEditing] = useState(false);

  const approveDraft = useCallback(() => {
    onChange({ mode: "clinical_note", note: draft, updatedAt: nowIso() });
    setEditing(false);
  }, [draft, onChange]);

  if (disabled) {
    return (
      <div className="space-y-2">
        <div>
          <div className={fiOsLightFormSurfaceClassNames.labelInline}>{label}</div>
          {description?.trim() ? (
            <p className={cn("mt-0.5", fiOsLightFormSurfaceClassNames.helper)}>{description}</p>
          ) : null}
        </div>
        <ClinicalNoteReadOnlySummary label="Canonical clinical note" value={value} />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <div>
        <div className={fiOsLightFormSurfaceClassNames.labelInline}>
          {label}
          {required ? <span className={fiOsLightFormSurfaceClassNames.requiredMark}> *</span> : null}
        </div>
        {description?.trim() ? (
          <p className={cn("mt-0.5", fiOsLightFormSurfaceClassNames.helper)}>{description}</p>
        ) : null}
        <p className={cn("mt-2 rounded-lg border border-violet-200 bg-violet-50/90 px-3 py-2 text-xs text-violet-950")}>
          Draft note is assembled from structured answers in this consultation (deterministic — not a live cloud model).
          Approve to copy into the chart note, or edit freely.
        </p>
      </div>

      {!editing ? (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested chart note</p>
            <div
              className={cn(
                "mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white bg-white px-3 py-2 text-sm text-slate-800 shadow-sm",
                fiOsLightFormSurfaceClassNames.body
              )}
            >
              {draft.trim() ? draft : "— Add intake, pattern, and recommendation fields to populate this draft."}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={approveDraft}
              disabled={!draft.trim()}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve suggestion
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Edit note
            </button>
          </div>
          {normalized.note.trim() ? (
            <p className={cn("text-xs", fiOsLightFormSurfaceClassNames.meta)}>
              Canonical note on file ({normalized.note.trim().length} chars).{" "}
              {normalized.note.trim() === draft.trim() ? "Matches current suggestion." : "Differs from current suggestion — approve again to overwrite."}
            </p>
          ) : required ? (
            <p className={cn("text-xs font-medium text-amber-900", fiOsLightFormSurfaceClassNames.meta)}>
              Approve or edit a canonical note before submitting — this field is required.
            </p>
          ) : null}
        </>
      ) : (
        <div className="space-y-3">
          <ClinicalNoteField
            label="Edit canonical clinical note"
            description="Fine-tune wording before submit. This is the single chart note for this encounter."
            required={required}
            value={value}
            onChange={onChange}
            disabled={false}
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm font-semibold text-sky-700 underline hover:text-sky-900"
          >
            Back to suggestion preview
          </button>
        </div>
      )}
    </div>
  );
}
