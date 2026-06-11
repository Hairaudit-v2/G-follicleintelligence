"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
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
        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {label}
          {required ? <span className="text-red-600"> *</span> : null}
        </div>
        {description?.trim() ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {!disabled ? (
        <div className="flex flex-wrap gap-2">
          {QUICK_INSERTS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => appendSnippet(t)}
              className="min-h-[40px] touch-manipulation rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:border-sky-300 hover:bg-sky-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sky-500/50"
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        className={cn(
          "min-h-[160px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100",
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
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/50">
      <p className="font-semibold text-slate-900 dark:text-slate-50">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{note.trim() || "—"}</p>
    </div>
  );
}
