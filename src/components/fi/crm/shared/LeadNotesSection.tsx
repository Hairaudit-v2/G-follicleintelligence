"use client";

import { useMemo } from "react";
import type { FiCrmLeadNoteRow, FiCrmNoteRow } from "@/src/lib/crm/types";
import { buildLeadNotesPreview } from "./leadNotesPreview";
import { crmLeadCardClass } from "./crmSharedStyles";

export type LeadNotesSectionProps = {
  notes: FiCrmNoteRow[];
  leadNotes: FiCrmLeadNoteRow[];
  previewLimit?: number;
  canMutate: boolean;
  noteBody: string;
  leadNoteBody: string;
  noteBusy?: boolean;
  leadNoteBusy?: boolean;
  noteErr?: string | null;
  leadNoteErr?: string | null;
  onNoteBodyChange: (value: string) => void;
  onLeadNoteBodyChange: (value: string) => void;
  onAddGeneralNote: (e: React.FormEvent) => void | Promise<void>;
  onAddLeadNote: (e: React.FormEvent) => void | Promise<void>;
};

export function LeadNotesSection({
  notes,
  leadNotes,
  previewLimit = 6,
  canMutate,
  noteBody,
  leadNoteBody,
  noteBusy = false,
  leadNoteBusy = false,
  noteErr = null,
  leadNoteErr = null,
  onNoteBodyChange,
  onLeadNoteBodyChange,
  onAddGeneralNote,
  onAddLeadNote,
}: LeadNotesSectionProps) {
  const notesPreview = useMemo(
    () => buildLeadNotesPreview(notes, leadNotes, previewLimit),
    [notes, leadNotes, previewLimit]
  );

  return (
    <section className={crmLeadCardClass}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</h3>
      {notesPreview.length === 0 ? (
        <p className="text-xs text-slate-400">No notes yet.</p>
      ) : (
        <ul className="mb-3 max-h-40 space-y-2 overflow-y-auto text-xs">
          {notesPreview.map((n) => (
            <li key={`${n.kind}-${n.id}`} className="rounded bg-white/[0.03] p-2">
              <span className="text-gray-500">{n.at}</span>{" "}
              <span className="text-gray-500">({n.kind})</span>
              <p className="whitespace-pre-wrap text-slate-200">{n.text}</p>
            </li>
          ))}
        </ul>
      )}
      {canMutate ? (
        <div className="space-y-3">
          <form onSubmit={onAddGeneralNote}>
            <p className="mb-1 text-xs font-medium text-slate-300">General CRM note</p>
            <textarea
              value={noteBody}
              onChange={(e) => onNoteBodyChange(e.target.value)}
              rows={2}
              className="w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
              placeholder="Visible on lead (general notes)"
            />
            <button
              type="submit"
              disabled={noteBusy}
              className="mt-1 rounded border border-slate-700 px-3 py-1 text-xs hover:bg-white/[0.03] disabled:opacity-50"
            >
              Add general note
            </button>
          </form>
          <form onSubmit={onAddLeadNote}>
            <p className="mb-1 text-xs font-medium text-slate-300">Lead note</p>
            <textarea
              value={leadNoteBody}
              onChange={(e) => onLeadNoteBodyChange(e.target.value)}
              rows={2}
              className="w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
              placeholder="Internal lead note"
            />
            <button
              type="submit"
              disabled={leadNoteBusy}
              className="mt-1 rounded border border-slate-700 px-3 py-1 text-xs hover:bg-white/[0.03] disabled:opacity-50"
            >
              Add lead note
            </button>
          </form>
        </div>
      ) : null}
      {noteErr || leadNoteErr ? (
        <p className="mt-1 text-xs text-rose-300">{noteErr ?? leadNoteErr}</p>
      ) : null}
    </section>
  );
}
