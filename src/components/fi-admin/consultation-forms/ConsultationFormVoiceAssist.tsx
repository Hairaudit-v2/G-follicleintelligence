"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { loadLatestVoiceClinicalNoteAction } from "@/lib/actions/fi-clinical-voice-note-actions";
import { VoiceNoteEntryButton } from "@/src/components/fi/clinical-notes/VoiceNoteEntryButton";
import {
  CLINICAL_NOTE_SECTION_LABELS,
  type ClinicalNoteSectionKey,
} from "@/src/lib/clinicalNotes/clinicalNoteConstants";
import {
  applyVoiceNoteFormSuggestions,
  buildVoiceNoteFormSuggestions,
  type VoiceNoteFormSuggestion,
} from "@/src/lib/clinicalNotes/voiceNoteFormSuggestCore";
import type { ClinicalNoteSections } from "@/src/lib/clinicalNotes/clinicalNoteSchemas";
import type { ConsultationFormField } from "@/src/lib/consultationForms/consultationFormTypes";

type LoadedNote = {
  id: string;
  record_status: string;
  created_at: string;
  transcript_raw: string;
  sections: ClinicalNoteSections;
};

export function ConsultationFormVoiceAssist({
  tenantId,
  consultationId,
  patientId,
  caseId,
  fields,
  values,
  canEdit,
  onApplyValues,
}: {
  tenantId: string;
  consultationId: string;
  patientId?: string | null;
  caseId?: string | null;
  fields: readonly ConsultationFormField[];
  values: Record<string, unknown>;
  canEdit: boolean;
  onApplyValues: (next: Record<string, unknown>) => void;
}) {
  const pid = patientId?.trim() || null;
  const [note, setNote] = useState<LoadedNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [lastAppliedCount, setLastAppliedCount] = useState<number | null>(null);

  const refreshNote = useCallback(() => {
    if (!pid) {
      setNote(null);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await loadLatestVoiceClinicalNoteAction({
        tenantId,
        patientId: pid,
        consultationId,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (!res.note) {
        setNote(null);
        return;
      }
      setNote({
        id: res.note.id,
        record_status: res.note.record_status,
        created_at: res.note.created_at,
        transcript_raw: res.note.transcript_raw,
        sections: res.note.sections as ClinicalNoteSections,
      });
    });
  }, [consultationId, pid, tenantId]);

  useEffect(() => {
    refreshNote();
  }, [refreshNote]);

  const suggestions: VoiceNoteFormSuggestion[] = useMemo(() => {
    if (!note) return [];
    return buildVoiceNoteFormSuggestions({
      fields,
      sections: note.sections,
      transcriptRaw: note.transcript_raw,
      currentValues: values,
      fillEmptyOnly: true,
    });
  }, [fields, note, values]);

  const applySuggestions = useCallback(() => {
    if (!note || suggestions.length === 0) return;
    const fieldTypes: Record<string, string> = {};
    for (const f of fields) fieldTypes[f.id] = f.type;
    const next = applyVoiceNoteFormSuggestions(values, suggestions, fieldTypes);
    onApplyValues(next);
    setLastAppliedCount(suggestions.length);
  }, [fields, note, onApplyValues, suggestions, values]);

  if (!canEdit) return null;

  return (
    <section
      className="rounded-xl border border-violet-500/25 bg-violet-950/20 px-4 py-4"
      data-testid="consultation-form-voice-assist"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-300/90">
            Voice assist
          </p>
          <h2 className="mt-1 text-sm font-semibold text-slate-50">
            Record consult → fill matching fields
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Capture audio during the visit, generate a structured draft note, then apply suggestions
            into empty text fields on this form. Select / radio answers are not auto-filled.
          </p>
        </div>
        {pid ? (
          <div className="flex flex-wrap gap-2">
            <VoiceNoteEntryButton
              tenantId={tenantId}
              patientId={pid}
              caseId={caseId}
              consultationId={consultationId}
              label="Record / voice note"
              className="inline-flex min-h-10 items-center rounded-lg border border-violet-400/40 bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
              onDraftCreated={() => refreshNote()}
            />
            <button
              type="button"
              disabled={pending}
              onClick={refreshNote}
              className="rounded-lg border border-white/[0.12] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.04] disabled:opacity-50"
            >
              {pending ? "Loading…" : "Refresh note"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-amber-200">
            Link a patient on the consultation to enable voice.
          </p>
        )}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {note ? (
        <div className="mt-3 space-y-2 rounded-lg border border-white/[0.08] bg-black/20 p-3">
          <p className="text-xs text-slate-400">
            Latest note · {note.record_status.replace(/_/g, " ")} ·{" "}
            {new Date(note.created_at).toLocaleString()}
          </p>
          <ul className="grid gap-1 text-xs text-slate-300 sm:grid-cols-2">
            {(Object.keys(note.sections) as ClinicalNoteSectionKey[]).map((key) => {
              const text = note.sections[key]?.trim();
              if (!text) return null;
              return (
                <li key={key} className="truncate">
                  <span className="text-slate-500">{CLINICAL_NOTE_SECTION_LABELS[key]}:</span>{" "}
                  {text.slice(0, 80)}
                  {text.length > 80 ? "…" : ""}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={suggestions.length === 0}
              onClick={applySuggestions}
              data-testid="apply-voice-note-to-form"
              className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply voice note to form
              {suggestions.length > 0 ? ` (${suggestions.length} fields)` : ""}
            </button>
            {suggestions.length === 0 ? (
              <span className="text-xs text-slate-500">
                No empty matching text fields to fill (or note sections empty).
              </span>
            ) : (
              <span className="text-xs text-slate-400">
                Will fill: {suggestions.map((s) => s.fieldLabel).join(", ")}
              </span>
            )}
            {lastAppliedCount != null ? (
              <span className="text-xs text-emerald-300" role="status">
                Applied {lastAppliedCount} field{lastAppliedCount === 1 ? "" : "s"}.
              </span>
            ) : null}
          </div>
        </div>
      ) : pid && !pending ? (
        <p className="mt-3 text-xs text-slate-500">
          No voice clinical note yet for this patient — use Record / voice note above.
        </p>
      ) : null}
    </section>
  );
}
