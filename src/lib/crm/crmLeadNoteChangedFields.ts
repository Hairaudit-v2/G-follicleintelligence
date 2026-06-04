import type { FiCrmLeadNoteRow } from "./types";

/** Comparable fields for activity `changed_keys` (Stage 2J). */
export type LeadNoteDetailComparableSnapshot = {
  note_body: string;
  note_visibility: string;
  is_pinned: boolean;
};

export function noteDetailSnapshotFromRowLike(row: Pick<FiCrmLeadNoteRow, "note_body" | "note_visibility" | "is_pinned">): LeadNoteDetailComparableSnapshot {
  return {
    note_body: String(row.note_body).trim(),
    note_visibility: String(row.note_visibility).trim(),
    is_pinned: Boolean(row.is_pinned),
  };
}

export type LeadNoteDetailTrackedKey = keyof LeadNoteDetailComparableSnapshot;

export function collectChangedLeadNoteDetailKeys(
  before: LeadNoteDetailComparableSnapshot,
  after: LeadNoteDetailComparableSnapshot
): LeadNoteDetailTrackedKey[] {
  const keys: LeadNoteDetailTrackedKey[] = [];
  if (before.note_body !== after.note_body) keys.push("note_body");
  if (before.note_visibility !== after.note_visibility) keys.push("note_visibility");
  if (before.is_pinned !== after.is_pinned) keys.push("is_pinned");
  return keys;
}
