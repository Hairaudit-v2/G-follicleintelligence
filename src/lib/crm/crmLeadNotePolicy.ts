import type { FiCrmLeadNoteRow } from "./types";

/** Allowed `note_visibility` values for `fi_crm_lead_notes`. */
export const CRM_LEAD_NOTE_VISIBILITY_VALUES = ["internal", "sales", "clinical", "admin"] as const;

export type CrmLeadNoteVisibility = (typeof CRM_LEAD_NOTE_VISIBILITY_VALUES)[number];

const VIS_SET = new Set<string>(CRM_LEAD_NOTE_VISIBILITY_VALUES);

export function isCrmLeadNoteVisibility(v: string): v is CrmLeadNoteVisibility {
  return VIS_SET.has(v.trim());
}

export function assertCrmLeadNoteVisibilityAllowed(visibility: string): void {
  const v = visibility.trim();
  if (!isCrmLeadNoteVisibility(v)) {
    throw new Error(
      `Invalid note visibility "${visibility}". Allowed: ${CRM_LEAD_NOTE_VISIBILITY_VALUES.join(", ")}.`
    );
  }
}

export function assertCrmLeadNoteBodyNonEmpty(noteBody: string): string {
  const t = noteBody.trim();
  if (!t) throw new Error("Note body is required.");
  return t;
}

export function assertLeadNoteNotArchived(row: Pick<FiCrmLeadNoteRow, "archived_at">): void {
  if (row.archived_at != null && String(row.archived_at).trim() !== "") {
    throw new Error("Archived notes cannot be edited or pinned.");
  }
}

/**
 * UI / list order: pinned first, then newest by `created_at`.
 */
export function sortCrmLeadNotesForDisplay(notes: FiCrmLeadNoteRow[]): FiCrmLeadNoteRow[] {
  return [...notes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const tb = new Date(b.created_at).getTime();
    const ta = new Date(a.created_at).getTime();
    return tb - ta;
  });
}

export function isLeadNoteOwnedByLeadTenant(
  row: Pick<FiCrmLeadNoteRow, "tenant_id" | "lead_id">,
  tenantId: string,
  leadId: string
): boolean {
  return row.tenant_id === tenantId.trim() && row.lead_id === leadId.trim();
}
