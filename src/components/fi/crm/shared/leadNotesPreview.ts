import type { FiCrmLeadNoteRow, FiCrmNoteRow } from "@/src/lib/crm/types";

export type LeadNotePreviewItem = {
  id: string;
  kind: "note" | "lead_note";
  at: string;
  text: string;
};

export function buildLeadNotesPreview(
  notes: FiCrmNoteRow[],
  leadNotes: FiCrmLeadNoteRow[],
  limit = 6
): LeadNotePreviewItem[] {
  const general = notes.map((n) => ({
    id: n.id,
    kind: "note" as const,
    at: n.created_at,
    text: n.body,
  }));
  const ln = leadNotes
    .filter((x) => x.archived_at == null)
    .map((n) => ({ id: n.id, kind: "lead_note" as const, at: n.created_at, text: n.note_body }));
  return [...general, ...ln]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}
