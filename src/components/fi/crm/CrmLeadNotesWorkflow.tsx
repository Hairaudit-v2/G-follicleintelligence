"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { archiveCrmLeadNoteAction, createCrmLeadNoteAction, updateCrmLeadNoteAction } from "@/lib/actions/fi-crm-actions";
import type { FiCrmLeadNoteRow } from "@/src/lib/crm";
import { CRM_LEAD_NOTE_VISIBILITY_VALUES, sortCrmLeadNotesForDisplay } from "@/src/lib/crm";

const card = "rounded border border-gray-200 bg-white p-4 shadow-sm";

function visibilitiesWithFallback(current: string): string[] {
  const u = new Set<string>([...CRM_LEAD_NOTE_VISIBILITY_VALUES]);
  if (current?.trim()) u.add(current.trim());
  return Array.from(u);
}

export function CrmLeadNotesWorkflow({
  tenantId,
  leadId,
  leadNotes,
}: {
  tenantId: string;
  leadId: string;
  leadNotes: FiCrmLeadNoteRow[];
}) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const [createBody, setCreateBody] = useState("");
  const [createVis, setCreateVis] = useState<string>("internal");
  const [createPinned, setCreatePinned] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editVis, setEditVis] = useState("");
  const [editPinned, setEditPinned] = useState(false);

  const activeNotes = useMemo(() => leadNotes.filter((n) => !n.archived_at), [leadNotes]);
  const archivedNotes = useMemo(() => leadNotes.filter((n) => !!n.archived_at), [leadNotes]);

  const sortedActive = useMemo(() => sortCrmLeadNotesForDisplay(activeNotes), [activeNotes]);
  const sortedArchived = useMemo(() => sortCrmLeadNotesForDisplay(archivedNotes), [archivedNotes]);

  function withAdmin<T extends Record<string, unknown>>(body: T): T & { adminKey?: string } {
    if (adminKey.trim()) return { ...body, adminKey: adminKey.trim() };
    return body;
  }

  function startEdit(n: FiCrmLeadNoteRow) {
    setEditingId(n.id);
    setEditBody(n.note_body);
    setEditVis(n.note_visibility);
    setEditPinned(n.is_pinned);
    setFeedback(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      const r = await createCrmLeadNoteAction(
        tenantId,
        leadId,
        withAdmin({
          noteBody: createBody,
          noteVisibility: createVis as (typeof CRM_LEAD_NOTE_VISIBILITY_VALUES)[number],
          isPinned: createPinned,
        })
      );
      setFeedback(r.ok ? "Note saved." : r.error);
      if (r.ok) {
        setCreateBody("");
        setCreateVis("internal");
        setCreatePinned(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(noteId: string) {
    setFeedback(null);
    setBusy(true);
    try {
      const r = await updateCrmLeadNoteAction(tenantId, leadId, noteId, withAdmin({ noteBody: editBody, noteVisibility: editVis, isPinned: editPinned }));
      setFeedback(r.ok ? "Note updated." : r.error);
      if (r.ok) {
        setEditingId(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onArchive(noteId: string) {
    setFeedback(null);
    setBusy(true);
    try {
      const r = await archiveCrmLeadNoteAction(tenantId, leadId, noteId, withAdmin({}));
      setFeedback(r.ok ? "Note archived." : r.error);
      if (r.ok) {
        setEditingId(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card}>
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Internal lead notes</h2>
      <p className="mb-3 text-xs text-gray-600">Internal lead notes are not patient-facing.</p>

      <label className="mb-3 block max-w-md text-xs">
        <span className="text-gray-600">FI admin key (optional)</span>
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1"
        />
      </label>

      <form onSubmit={onCreate} className="mb-6 space-y-2 rounded border border-gray-100 bg-gray-50/80 p-3 text-sm">
        <h3 className="font-medium text-gray-900">New note</h3>
        <textarea
          value={createBody}
          onChange={(e) => setCreateBody(e.target.value)}
          rows={3}
          className="w-full rounded border border-gray-300 px-2 py-1"
          placeholder="Note text"
          required
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-gray-600">
            Visibility
            <select value={createVis} onChange={(e) => setCreateVis(e.target.value)} className="ml-1 rounded border border-gray-300 px-2 py-1 text-xs">
              {CRM_LEAD_NOTE_VISIBILITY_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input type="checkbox" checked={createPinned} onChange={(e) => setCreatePinned(e.target.checked)} />
            Pinned
          </label>
        </div>
        <button type="submit" disabled={busy} className="rounded bg-gray-800 px-2 py-1 text-xs text-white disabled:opacity-50">
          Add note
        </button>
      </form>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Active notes</h3>
      {sortedActive.length === 0 ? (
        <p className="mb-4 text-sm text-gray-600">No active internal notes yet.</p>
      ) : (
        <ul className="mb-4 space-y-3 text-sm">
          {sortedActive.map((n) => (
            <li key={n.id} className="rounded border border-gray-100 p-3">
              {editingId === n.id ? (
                <div className="space-y-2">
                  <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} className="w-full rounded border border-gray-300 px-2 py-1" />
                  <div className="flex flex-wrap items-center gap-3">
                    <select value={editVis} onChange={(e) => setEditVis(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs">
                      {visibilitiesWithFallback(editVis).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-gray-600">
                      <input type="checkbox" checked={editPinned} onChange={(e) => setEditPinned(e.target.checked)} />
                      Pinned
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => onSaveEdit(n.id)} className="rounded bg-gray-800 px-2 py-1 text-xs text-white disabled:opacity-50">
                      Save
                    </button>
                    <button type="button" disabled={busy} onClick={cancelEdit} className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {n.is_pinned ? <span className="mr-2 text-xs font-medium text-amber-700">Pinned</span> : null}
                      <span className="text-xs text-gray-500">{n.note_visibility}</span>
                      <p className="mt-1 whitespace-pre-wrap text-gray-800">{n.note_body}</p>
                      <p className="mt-1 text-xs text-gray-400">{n.created_at}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button type="button" disabled={busy} onClick={() => startEdit(n)} className="rounded border border-gray-300 px-2 py-0.5 text-xs disabled:opacity-50">
                        Edit
                      </button>
                      <button type="button" disabled={busy} onClick={() => onArchive(n.id)} className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-800 disabled:opacity-50">
                        Archive
                      </button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          className="text-xs font-medium text-blue-700 hover:underline"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? "Hide" : "Show"} archived notes{archivedNotes.length ? ` (${archivedNotes.length})` : ""}
        </button>
        {showArchived && sortedArchived.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm text-gray-600">
            {sortedArchived.map((n) => (
              <li key={n.id} className="rounded border border-dashed border-gray-200 bg-gray-50/50 p-2">
                <p className="text-xs text-gray-500">Archived {n.archived_at}</p>
                <p className="mt-1 whitespace-pre-wrap line-through decoration-gray-400">{n.note_body}</p>
              </li>
            ))}
          </ul>
        ) : null}
        {showArchived && sortedArchived.length === 0 ? <p className="mt-2 text-xs text-gray-500">No archived notes.</p> : null}
      </div>

      {feedback ? <p className="mt-3 text-sm text-gray-800">{feedback}</p> : null}
    </section>
  );
}
