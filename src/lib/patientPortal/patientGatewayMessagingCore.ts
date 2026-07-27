/**
 * FI-PATIENT-APP-1F — patient-safe messaging translation + validation (pure).
 */

export const PATIENT_GATEWAY_MESSAGE_CATEGORIES = [
  "general",
  "appointment",
  "post_op",
  "medication",
  "billing",
] as const;

export type PatientGatewayMessageCategory = (typeof PATIENT_GATEWAY_MESSAGE_CATEGORIES)[number];

export const PATIENT_GATEWAY_MAX_MESSAGE_LENGTH = 4000;
export const PATIENT_GATEWAY_MESSAGE_RATE_WINDOW_MS = 60_000;
export const PATIENT_GATEWAY_MESSAGE_RATE_MAX = 10;
export const PATIENT_GATEWAY_MESSAGE_DUPLICATE_WINDOW_MS = 30_000;

export type PatientGatewayMessageDirection = "patient_to_clinic" | "clinic_to_patient";
export type PatientGatewayMessageStatus = "sent" | "delivered" | "read" | "failed";
export type PatientGatewayThreadStatus = "open" | "closed";

export type PatientGatewayThreadSummary = {
  id: string;
  subject: string;
  category: PatientGatewayMessageCategory;
  status: PatientGatewayThreadStatus;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type PatientGatewayMessageItem = {
  id: string;
  direction: PatientGatewayMessageDirection;
  senderLabel: string;
  body: string;
  sentAt: string;
  status: PatientGatewayMessageStatus;
};

export type PatientGatewayThreadDetail = PatientGatewayThreadSummary & {
  messages: PatientGatewayMessageItem[];
};

const CATEGORY_SUBJECTS: Record<PatientGatewayMessageCategory, string> = {
  general: "General enquiry",
  appointment: "Appointment",
  post_op: "Post-operative care",
  medication: "Medication",
  billing: "Billing",
};

export function subjectForMessageCategory(category: PatientGatewayMessageCategory): string {
  return CATEGORY_SUBJECTS[category];
}

export function isPatientGatewayMessageCategory(
  value: string
): value is PatientGatewayMessageCategory {
  return (PATIENT_GATEWAY_MESSAGE_CATEGORIES as readonly string[]).includes(value);
}

export function validatePatientGatewayMessageBody(
  body: unknown
):
  | { ok: true; body: string }
  | { ok: false; code: "message_empty" | "message_too_long"; message: string } {
  if (typeof body !== "string") {
    return { ok: false, code: "message_empty", message: "Message body is required." };
  }
  const trimmed = body.trim();
  if (!trimmed) {
    return { ok: false, code: "message_empty", message: "Message body cannot be empty." };
  }
  if (trimmed.length > PATIENT_GATEWAY_MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      code: "message_too_long",
      message: `Message body must be at most ${PATIENT_GATEWAY_MAX_MESSAGE_LENGTH} characters.`,
    };
  }
  return { ok: true, body: trimmed };
}

/** Strip client attempts to control identity / delivery / staff fields. */
export function sanitizePatientMessageClientPayload(raw: Record<string, unknown>): {
  body: unknown;
  ignoredKeys: string[];
} {
  const ignored = [
    "direction",
    "senderLabel",
    "status",
    "patientId",
    "tenantId",
    "senderId",
    "staffId",
    "isStaff",
    "delivered",
    "read",
  ].filter((k) => k in raw);
  return { body: raw.body, ignoredKeys: ignored };
}

export function mapThreadRowToSummary(input: {
  id: string;
  subject: string;
  category: string;
  status: string;
  last_message_at: string | null;
  unreadCount: number;
}): PatientGatewayThreadSummary {
  const category = isPatientGatewayMessageCategory(input.category) ? input.category : "general";
  return {
    id: input.id,
    subject: input.subject,
    category,
    status: input.status === "closed" ? "closed" : "open",
    lastMessageAt: input.last_message_at,
    unreadCount: Math.max(0, Math.floor(input.unreadCount)),
  };
}

export function mapMessageRowToItem(input: {
  id: string;
  direction: string;
  sender_label: string;
  body: string;
  sent_at: string;
  status: string;
}): PatientGatewayMessageItem {
  const direction: PatientGatewayMessageDirection =
    input.direction === "clinic_to_patient" ? "clinic_to_patient" : "patient_to_clinic";
  const status: PatientGatewayMessageStatus =
    input.status === "delivered" ||
    input.status === "read" ||
    input.status === "failed" ||
    input.status === "sent"
      ? input.status
      : "sent";
  return {
    id: input.id,
    direction,
    senderLabel:
      direction === "clinic_to_patient"
        ? input.sender_label.trim() || "Clinical Team"
        : "You",
    body: input.body,
    sentAt: input.sent_at,
    status,
  };
}

export function evaluateMessageRateLimit(input: {
  recentSentAtIsos: readonly string[];
  nowMs: number;
}):
  | { ok: true }
  | { ok: false; code: "message_rate_limited"; message: string } {
  const windowStart = input.nowMs - PATIENT_GATEWAY_MESSAGE_RATE_WINDOW_MS;
  const recent = input.recentSentAtIsos.filter((iso) => {
    const ms = Date.parse(iso);
    return Number.isFinite(ms) && ms >= windowStart;
  });
  if (recent.length >= PATIENT_GATEWAY_MESSAGE_RATE_MAX) {
    return {
      ok: false,
      code: "message_rate_limited",
      message: "Too many messages. Please wait a moment before sending again.",
    };
  }
  return { ok: true };
}

export function evaluateMessageDuplicate(input: {
  recentBodies: readonly { body: string; sentAt: string }[];
  candidateBody: string;
  nowMs: number;
}):
  | { ok: true }
  | { ok: false; code: "message_duplicate"; message: string } {
  const windowStart = input.nowMs - PATIENT_GATEWAY_MESSAGE_DUPLICATE_WINDOW_MS;
  const normalized = input.candidateBody.trim();
  for (const row of input.recentBodies) {
    const ms = Date.parse(row.sentAt);
    if (!Number.isFinite(ms) || ms < windowStart) continue;
    if (row.body.trim() === normalized) {
      return {
        ok: false,
        code: "message_duplicate",
        message: "Duplicate message detected. Please wait before resending.",
      };
    }
  }
  return { ok: true };
}

/** Privacy-safe notification preview copy — never include clinical body text. */
export function buildPrivacySafeMessageNotificationPreview(): string {
  return "New message from your clinical team.";
}

export function messagingPayloadExposesStaffFields(payload: unknown): boolean {
  const serialized = JSON.stringify(payload);
  const forbidden = [
    "staff_id",
    "fi_user_id",
    "internal_note",
    "escalation",
    "hubspot",
    "metadata",
    "body_storage_ref",
    "created_by",
  ];
  return forbidden.some((k) => serialized.includes(`"${k}"`));
}
