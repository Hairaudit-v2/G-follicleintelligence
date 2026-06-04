import { stableMetadataFingerprint } from "./crmLeadDetailsPolicy";
import type { FiCrmLeadCommunicationRow } from "./types";

/** Comparable fields for activity `changed_keys` (Stage 2K). */
export type LeadCommunicationDetailComparableSnapshot = {
  communication_type: string;
  direction: string;
  outcome: string | null;
  subject: string | null;
  preview: string | null;
  contact_at: string;
  next_follow_up_at: string | null;
  metadata: Record<string, unknown>;
};

export function leadCommunicationDetailSnapshotFromRowLike(
  row: Pick<
    FiCrmLeadCommunicationRow,
    | "communication_type"
    | "direction"
    | "outcome"
    | "subject"
    | "preview"
    | "contact_at"
    | "next_follow_up_at"
    | "metadata"
  >
): LeadCommunicationDetailComparableSnapshot {
  return {
    communication_type: String(row.communication_type).trim(),
    direction: String(row.direction).trim(),
    outcome: row.outcome != null && String(row.outcome).trim() !== "" ? String(row.outcome).trim() : null,
    subject: row.subject != null && String(row.subject).trim() !== "" ? String(row.subject).trim() : null,
    preview: row.preview != null && String(row.preview).trim() !== "" ? String(row.preview).trim() : null,
    contact_at: String(row.contact_at).trim(),
    next_follow_up_at:
      row.next_follow_up_at != null && String(row.next_follow_up_at).trim() !== ""
        ? String(row.next_follow_up_at).trim()
        : null,
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {},
  };
}

export type LeadCommunicationDetailTrackedKey = keyof LeadCommunicationDetailComparableSnapshot;

export function collectChangedLeadCommunicationDetailKeys(
  before: LeadCommunicationDetailComparableSnapshot,
  after: LeadCommunicationDetailComparableSnapshot
): LeadCommunicationDetailTrackedKey[] {
  const keys: LeadCommunicationDetailTrackedKey[] = [];
  if (before.communication_type !== after.communication_type) keys.push("communication_type");
  if (before.direction !== after.direction) keys.push("direction");
  if ((before.outcome ?? null) !== (after.outcome ?? null)) keys.push("outcome");
  if ((before.subject ?? null) !== (after.subject ?? null)) keys.push("subject");
  if ((before.preview ?? null) !== (after.preview ?? null)) keys.push("preview");
  if (before.contact_at !== after.contact_at) keys.push("contact_at");
  if ((before.next_follow_up_at ?? null) !== (after.next_follow_up_at ?? null)) keys.push("next_follow_up_at");
  if (stableMetadataFingerprint(before.metadata) !== stableMetadataFingerprint(after.metadata)) keys.push("metadata");
  return keys;
}
