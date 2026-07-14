import { createHash } from "node:crypto";

import { isPlaceholderEmail, normalizeEmail } from "@/src/lib/fi/foundation/normalize";

export const GENERIC_EMAIL_SUBJECT_PREVIEW_MAX = 120;
export const GENERIC_EMAIL_BODY_PREVIEW_MAX = 200;
export const GENERIC_EMAIL_ACTIVITY_KIND_INBOUND = "email.clinic.inbound";
export const GENERIC_EMAIL_ACTIVITY_KIND_OUTBOUND = "email.clinic.outbound";
export const GENERIC_EMAIL_MATCH_CONFIDENCE_HIGH = 1;
export const GENERIC_EMAIL_MATCH_CONFIDENCE_NONE = 0;

export type GenericEmailDirection = "inbound" | "outbound";
export type GenericEmailMatchStatus = "unmatched" | "matched" | "ambiguous";

export type GenericEmailActivityInput = {
  tenantId: string;
  source: string;
  externalMessageId: string;
  externalThreadId?: string | null;
  direction: GenericEmailDirection;
  fromEmail?: string | null;
  toEmails?: string[] | null;
  subject?: string | null;
  bodyText?: string | null;
  receivedAt?: string | null;
  sentAt?: string | null;
};

export type GenericEmailMatchAudit = {
  counterparty_email_hash: string | null;
  person_ids: string[];
  lead_ids: string[];
  patient_ids: string[];
  decision: GenericEmailMatchStatus | "matched_lead" | "matched_patient";
  decided_at: string;
};

export type GenericEmailMatchResolution = {
  matchStatus: GenericEmailMatchStatus;
  matchedLeadId: string | null;
  matchedPatientId: string | null;
  matchConfidence: number;
  matchReason: string | null;
  matchAudit: GenericEmailMatchAudit;
};

export function hashEmailForStorage(email: string | null | undefined): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized || isPlaceholderEmail(normalized)) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

/** Mask email for admin diagnostics — never used for patient-facing surfaces. */
export function maskEmailForPreview(email: string | null | undefined): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return null;
  const visible = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${visible}@${domain}`;
}

export function truncateSubjectPreview(subject: string | null | undefined): string | null {
  if (subject == null || typeof subject !== "string") return null;
  const t = subject.trim().replace(/\s+/g, " ");
  if (!t.length) return null;
  if (t.length <= GENERIC_EMAIL_SUBJECT_PREVIEW_MAX) return t;
  return `${t.slice(0, GENERIC_EMAIL_SUBJECT_PREVIEW_MAX - 1)}…`;
}

/** Strip control chars and collapse whitespace; truncate for safe preview storage. */
export function truncateBodyPreview(body: string | null | undefined): string | null {
  if (body == null || typeof body !== "string") return null;
  const t = body
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t.length) return null;
  if (t.length <= GENERIC_EMAIL_BODY_PREVIEW_MAX) return t;
  return `${t.slice(0, GENERIC_EMAIL_BODY_PREVIEW_MAX - 1)}…`;
}

export function genericEmailActivityKind(direction: GenericEmailDirection): string {
  return direction === "inbound"
    ? GENERIC_EMAIL_ACTIVITY_KIND_INBOUND
    : GENERIC_EMAIL_ACTIVITY_KIND_OUTBOUND;
}

export function buildGenericEmailActivityTitle(direction: GenericEmailDirection): string {
  return direction === "inbound" ? "Inbound clinic email" : "Outbound clinic email";
}

export function counterpartyEmailForMatch(
  direction: GenericEmailDirection,
  fromEmail: string | null | undefined,
  toEmails: string[] | null | undefined
): string | null {
  if (direction === "inbound") {
    return normalizeEmail(fromEmail);
  }
  const first = toEmails?.map((e) => normalizeEmail(e)).find(Boolean);
  return first ?? null;
}

export function normalizeGenericEmailToHashes(emails: string[] | null | undefined): string[] {
  if (!emails?.length) return [];
  const out = new Set<string>();
  for (const raw of emails) {
    const hash = hashEmailForStorage(raw);
    if (hash) out.add(hash);
  }
  return Array.from(out);
}

export function buildGenericEmailToPreview(emails: string[] | null | undefined): string | null {
  if (!emails?.length) return null;
  const masked = emails.map((e) => maskEmailForPreview(e)).filter(Boolean);
  if (!masked.length) return null;
  return masked.slice(0, 3).join(", ");
}

export function resolveGenericEmailMatch(input: {
  counterpartyEmail: string | null;
  personIds: string[];
  leadIds: string[];
  patientIds: string[];
  decidedAt: string;
}): GenericEmailMatchResolution {
  const counterpartyHash = hashEmailForStorage(input.counterpartyEmail);
  const baseAudit: Omit<GenericEmailMatchAudit, "decision"> = {
    counterparty_email_hash: counterpartyHash,
    person_ids: [...input.personIds],
    lead_ids: [...input.leadIds],
    patient_ids: [...input.patientIds],
    decided_at: input.decidedAt,
  };

  if (!input.counterpartyEmail || isPlaceholderEmail(input.counterpartyEmail)) {
    return {
      matchStatus: "unmatched",
      matchedLeadId: null,
      matchedPatientId: null,
      matchConfidence: GENERIC_EMAIL_MATCH_CONFIDENCE_NONE,
      matchReason: "no_counterparty_email",
      matchAudit: { ...baseAudit, decision: "unmatched" },
    };
  }

  if (input.personIds.length > 1) {
    return {
      matchStatus: "ambiguous",
      matchedLeadId: null,
      matchedPatientId: null,
      matchConfidence: GENERIC_EMAIL_MATCH_CONFIDENCE_NONE,
      matchReason: "multiple_persons_match_email",
      matchAudit: { ...baseAudit, decision: "ambiguous" },
    };
  }

  if (input.personIds.length === 0) {
    return {
      matchStatus: "unmatched",
      matchedLeadId: null,
      matchedPatientId: null,
      matchConfidence: GENERIC_EMAIL_MATCH_CONFIDENCE_NONE,
      matchReason: "no_person_match",
      matchAudit: { ...baseAudit, decision: "unmatched" },
    };
  }

  if (input.leadIds.length > 1 || input.patientIds.length > 1) {
    return {
      matchStatus: "ambiguous",
      matchedLeadId: null,
      matchedPatientId: null,
      matchConfidence: GENERIC_EMAIL_MATCH_CONFIDENCE_NONE,
      matchReason:
        input.leadIds.length > 1 ? "multiple_leads_match_email" : "multiple_patients_match_email",
      matchAudit: { ...baseAudit, decision: "ambiguous" },
    };
  }

  const matchedLeadId = input.leadIds[0] ?? null;
  const matchedPatientId = input.patientIds[0] ?? null;

  if (!matchedLeadId && !matchedPatientId) {
    return {
      matchStatus: "unmatched",
      matchedLeadId: null,
      matchedPatientId: null,
      matchConfidence: GENERIC_EMAIL_MATCH_CONFIDENCE_NONE,
      matchReason: "person_found_no_lead_or_patient",
      matchAudit: { ...baseAudit, decision: "unmatched" },
    };
  }

  return {
    matchStatus: "matched",
    matchedLeadId,
    matchedPatientId,
    matchConfidence: GENERIC_EMAIL_MATCH_CONFIDENCE_HIGH,
    matchReason: matchedLeadId ? "single_lead_email_match" : "single_patient_email_match",
    matchAudit: {
      ...baseAudit,
      decision: matchedLeadId ? "matched_lead" : "matched_patient",
    },
  };
}

export function buildGenericEmailCrmActivityDetail(input: {
  genericEmailActivityId: string;
  direction: GenericEmailDirection;
  subjectPreview: string | null;
  matchConfidence: number;
  matchReason: string | null;
  externalMessageId: string;
}): Record<string, unknown> {
  return {
    generic_email_activity_id: input.genericEmailActivityId,
    direction: input.direction,
    subject_preview: input.subjectPreview,
    match_confidence: input.matchConfidence,
    match_reason: input.matchReason,
    external_message_id: input.externalMessageId,
  };
}

export function isGenericEmailActivityKind(kind: string): boolean {
  const k = kind.trim();
  return k === GENERIC_EMAIL_ACTIVITY_KIND_INBOUND || k === GENERIC_EMAIL_ACTIVITY_KIND_OUTBOUND;
}
