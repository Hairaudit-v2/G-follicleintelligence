"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import {
  normalizeClinicalNoteValue,
  nowIso,
  type ClinicalNoteFieldValue,
} from "@/src/lib/consultationForms/consultationFormNoteModel";

const QUICK_INSERTS = [
  "Donor suitable",
  "Donor limited",
  "Medical therapy discussed",
  "PRP discussed",
  "Surgery suitable",
  "Blood tests recommended",
  "Review required",
] as const;

export function ClinicalNoteField({
  label,
  description,
  required,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string | null;
  required?: boolean;
  value: unknown;
  onChange: (next: ClinicalNoteFieldValue) => void;
  disabled: boolean;
}) {
  const normalized = useMemo(() => normalizeClinicalNoteValue(value), [value]);
  const [note, setNote] = useState(normalized.note);

  useEffect(() => {
    setNote(normalized.note);
  }, [normalized.note]);

  const commit = useCallback(
    (nextNote: string) => {
      setNote(nextNote);
      onChange({ mode: "clinical_note", note: nextNote, updatedAt: nowIso() });
    },
    [onChange]
  );

  const appendSnippet = useCallback(
    (snippet: string) => {
      const sep = note.trim().length > 0 ? "\n" : "";
      commit(`${note.trimEnd()}${sep}${snippet}`);
    },
    [commit, note]
  );

  return (
    <div className="space-y-2">
      <div>
        <div className={fiOsLightFormSurfaceClassNames.labelInline}>
          {label}
          {required ? <span className={fiOsLightFormSurfaceClassNames.requiredMark}> *</span> : null}
        </div>
        {description?.trim() ? (
          <p className={cn("mt-0.5", fiOsLightFormSurfaceClassNames.helper)}>{description}</p>
        ) : null}
      </div>
      {!disabled ? (
        <div className="flex flex-wrap gap-2">
          {QUICK_INSERTS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => appendSnippet(t)}
              className="min-h-[40px] touch-manipulation rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50/50"
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        className={cn(
          "min-h-[160px] w-full",
          fiOsLightFormSurfaceClassNames.controlInset,
          disabled && "opacity-80"
        )}
        value={note}
        disabled={disabled}
        onChange={(e) => commit(e.target.value)}
        placeholder="Structured clinician notes for this consultation…"
      />
    </div>
  );
}

export function ClinicalNoteReadOnlySummary({ label, value }: { label: string; value: unknown }) {
  const { note } = normalizeClinicalNoteValue(value);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-800">
      <p className="font-semibold text-slate-900">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-slate-700">{note.trim() || "—"}</p>
    </div>
  );
}
