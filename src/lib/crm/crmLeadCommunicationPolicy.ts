import type { FiCrmLeadCommunicationRow } from "./types";

/** Allowed `communication_type` values for `fi_crm_lead_communications`. */
export const CRM_LEAD_COMMUNICATION_TYPE_VALUES = [
  "phone",
  "email",
  "sms",
  "whatsapp",
  "in_person",
  "video_call",
  "other",
] as const;

export type CrmLeadCommunicationType = (typeof CRM_LEAD_COMMUNICATION_TYPE_VALUES)[number];

const TYPE_SET = new Set<string>(CRM_LEAD_COMMUNICATION_TYPE_VALUES);

export function isCrmLeadCommunicationType(v: string): v is CrmLeadCommunicationType {
  return TYPE_SET.has(v.trim());
}

export const CRM_LEAD_COMMUNICATION_DIRECTION_VALUES = ["inbound", "outbound", "internal"] as const;

export type CrmLeadCommunicationDirection =
  (typeof CRM_LEAD_COMMUNICATION_DIRECTION_VALUES)[number];

const DIR_SET = new Set<string>(CRM_LEAD_COMMUNICATION_DIRECTION_VALUES);

export function isCrmLeadCommunicationDirection(v: string): v is CrmLeadCommunicationDirection {
  return DIR_SET.has(v.trim());
}

export const CRM_LEAD_COMMUNICATION_OUTCOME_VALUES = [
  "connected",
  "voicemail",
  "no_answer",
  "replied",
  "booked",
  "not_interested",
  "follow_up_required",
  "other",
] as const;

export type CrmLeadCommunicationOutcome = (typeof CRM_LEAD_COMMUNICATION_OUTCOME_VALUES)[number];

const OUTCOME_SET = new Set<string>(CRM_LEAD_COMMUNICATION_OUTCOME_VALUES);

export function isCrmLeadCommunicationOutcome(v: string): v is CrmLeadCommunicationOutcome {
  return OUTCOME_SET.has(v.trim());
}

/** Max length for `subject` (bounded metadata). */
export const CRM_LEAD_COMMUNICATION_MAX_SUBJECT = 512;

/** Max length for `preview` (bounded metadata). */
export const CRM_LEAD_COMMUNICATION_MAX_PREVIEW = 512;

export function assertCrmLeadCommunicationTypeAllowed(communicationType: string): string {
  const t = communicationType.trim();
  if (!isCrmLeadCommunicationType(t)) {
    throw new Error(
      `Invalid communication type "${communicationType}". Allowed: ${CRM_LEAD_COMMUNICATION_TYPE_VALUES.join(", ")}.`
    );
  }
  return t;
}

export function assertCrmLeadCommunicationDirectionAllowed(direction: string): string {
  const d = direction.trim();
  if (!isCrmLeadCommunicationDirection(d)) {
    throw new Error(
      `Invalid direction "${direction}". Allowed: ${CRM_LEAD_COMMUNICATION_DIRECTION_VALUES.join(", ")}.`
    );
  }
  return d;
}

/** When `outcome` is non-null after trim, it must be allow-listed. */
export function normaliseCrmLeadCommunicationOutcome(
  outcome: string | null | undefined
): string | null {
  if (outcome === undefined || outcome === null) return null;
  const t = String(outcome).trim();
  return t.length === 0 ? null : t;
}

export function assertCrmLeadCommunicationOutcomeAllowed(
  outcome: string | null | undefined
): string | null {
  const o = normaliseCrmLeadCommunicationOutcome(outcome);
  if (o === null) return null;
  if (!isCrmLeadCommunicationOutcome(o)) {
    throw new Error(
      `Invalid outcome "${outcome}". Allowed: ${CRM_LEAD_COMMUNICATION_OUTCOME_VALUES.join(", ")}, or omit.`
    );
  }
  return o;
}

export function assertCrmLeadCommunicationSubjectBounded(
  subject: string | null | undefined
): string | null {
  if (subject === undefined || subject === null) return null;
  const t = String(subject).trim();
  if (t.length > CRM_LEAD_COMMUNICATION_MAX_SUBJECT) {
    throw new Error(`subject must be at most ${CRM_LEAD_COMMUNICATION_MAX_SUBJECT} characters.`);
  }
  return t.length === 0 ? null : t;
}

export function assertCrmLeadCommunicationPreviewBounded(
  preview: string | null | undefined
): string | null {
  if (preview === undefined || preview === null) return null;
  const t = String(preview).trim();
  if (t.length > CRM_LEAD_COMMUNICATION_MAX_PREVIEW) {
    throw new Error(`preview must be at most ${CRM_LEAD_COMMUNICATION_MAX_PREVIEW} characters.`);
  }
  return t.length === 0 ? null : t;
}

export function assertCrmLeadCommunicationMetadataObject(
  metadata: unknown
): Record<string, unknown> {
  if (metadata === undefined || metadata === null) return {};
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("metadata must be a JSON object.");
  }
  return metadata as Record<string, unknown>;
}

export function assertLeadCommunicationNotArchived(
  row: Pick<FiCrmLeadCommunicationRow, "archived_at">
): void {
  if (row.archived_at != null && String(row.archived_at).trim() !== "") {
    throw new Error("Archived contact log entries cannot be edited.");
  }
}

/** Newest `contact_at` first (contact log default). */
export function sortCrmLeadCommunicationsForDisplay(
  rows: FiCrmLeadCommunicationRow[]
): FiCrmLeadCommunicationRow[] {
  return [...rows].sort((a, b) => {
    const tb = new Date(b.contact_at).getTime();
    const ta = new Date(a.contact_at).getTime();
    return tb - ta;
  });
}

export function isLeadCommunicationOwnedByLeadTenant(
  row: Pick<FiCrmLeadCommunicationRow, "tenant_id" | "lead_id">,
  tenantId: string,
  leadId: string
): boolean {
  return row.tenant_id === tenantId.trim() && row.lead_id === leadId.trim();
}
