/**
 * FI-PATIENT-APP-2F.3 — Front Desk patient-message queue (pure).
 * Reuses canonical gateway categories; does not duplicate message bodies into a second store.
 */

import {
  PATIENT_GATEWAY_MESSAGE_CATEGORIES,
  isPatientGatewayMessageCategory,
  subjectForMessageCategory,
  type PatientGatewayMessageCategory,
  type PatientGatewayThreadStatus,
} from "@/src/lib/patientPortal/patientGatewayMessagingCore";

export const FRONT_DESK_PATIENT_MESSAGE_PREVIEW_MAX = 120;
export const FRONT_DESK_PATIENT_MESSAGE_POLL_MS = 30_000;

/** Categories where toast/queue must not expose clinical body text. */
export const FRONT_DESK_SENSITIVE_MESSAGE_CATEGORIES = [
  "post_op",
  "medication",
] as const satisfies readonly PatientGatewayMessageCategory[];

export type FrontDeskStaffWorkState = "unread" | "open" | "handled";

export type FrontDeskPatientMessageQueueFilter = "unread" | "all";

export type FrontDeskPatientMessageQueueItem = {
  threadId: string;
  patientId: string;
  patientDisplayName: string;
  category: PatientGatewayMessageCategory;
  categoryLabel: string;
  subject: string;
  status: PatientGatewayThreadStatus;
  lastMessageAt: string | null;
  unreadCount: number;
  workState: FrontDeskStaffWorkState;
  /** Null when preview policy withholds body text. */
  preview: string | null;
  previewPolicy: "bounded_text" | "generic_sensitive";
  patientHref: string;
};

export type FrontDeskPatientMessageQueuePayload = {
  tenantId: string;
  unreadCount: number;
  filter: FrontDeskPatientMessageQueueFilter;
  items: FrontDeskPatientMessageQueueItem[];
  loadedAt: string;
  /** Documented refresh strategy for Front Desk while open. */
  refreshStrategy: "bounded_polling";
  refreshIntervalMs: number;
};

export type FrontDeskPatientMessageThreadMessage = {
  id: string;
  direction: "patient_to_clinic" | "clinic_to_patient";
  senderLabel: string;
  body: string;
  sentAt: string;
  staffReadAt: string | null;
};

export type FrontDeskPatientMessageThreadDetail = {
  tenantId: string;
  threadId: string;
  patientId: string;
  patientDisplayName: string;
  category: PatientGatewayMessageCategory;
  categoryLabel: string;
  subject: string;
  status: PatientGatewayThreadStatus;
  lastMessageAt: string | null;
  unreadCount: number;
  workState: FrontDeskStaffWorkState;
  staffHandledAt: string | null;
  messages: FrontDeskPatientMessageThreadMessage[];
  patientHref: string;
  canReply: boolean;
};

export function isSensitiveFrontDeskMessageCategory(
  category: string
): boolean {
  return (FRONT_DESK_SENSITIVE_MESSAGE_CATEGORIES as readonly string[]).includes(category);
}

export function categoryLabelForFrontDesk(category: string): string {
  if (!isPatientGatewayMessageCategory(category)) return "Message";
  return subjectForMessageCategory(category);
}

/**
 * PART F — safe preview policy for shared Front Desk surfaces / toasts.
 * Sensitive clinical categories never expose body text in queue/toast.
 */
export function buildFrontDeskSafeMessagePreview(input: {
  category: string;
  body: string | null | undefined;
}): {
  preview: string | null;
  previewPolicy: "bounded_text" | "generic_sensitive";
  toastTitle: string;
  toastBody: string;
} {
  const category = isPatientGatewayMessageCategory(input.category)
    ? input.category
    : "general";

  if (isSensitiveFrontDeskMessageCategory(category)) {
    return {
      preview: null,
      previewPolicy: "generic_sensitive",
      toastTitle: "New patient message",
      toastBody: "New patient message — open to view",
    };
  }

  const raw = (input.body ?? "").trim().replace(/\s+/g, " ");
  const bounded =
    raw.length > FRONT_DESK_PATIENT_MESSAGE_PREVIEW_MAX
      ? `${raw.slice(0, FRONT_DESK_PATIENT_MESSAGE_PREVIEW_MAX - 1)}…`
      : raw || null;

  return {
    preview: bounded,
    previewPolicy: "bounded_text",
    toastTitle: "New patient message",
    toastBody: bounded ?? "New patient message — open to view",
  };
}

/**
 * Staff work state — independent of patient_read_at.
 * Handled is explicit; a newer patient message after handled reopens work.
 */
export function deriveFrontDeskStaffWorkState(input: {
  unreadCount: number;
  staffHandledAt: string | null;
  lastPatientMessageAt: string | null;
}): FrontDeskStaffWorkState {
  if (input.unreadCount > 0) return "unread";
  if (input.staffHandledAt && input.lastPatientMessageAt) {
    const handledMs = Date.parse(input.staffHandledAt);
    const lastMs = Date.parse(input.lastPatientMessageAt);
    if (Number.isFinite(handledMs) && Number.isFinite(lastMs) && handledMs >= lastMs) {
      return "handled";
    }
  } else if (input.staffHandledAt && !input.lastPatientMessageAt) {
    return "handled";
  }
  return "open";
}

/** Unread first, then newest activity. */
export function compareFrontDeskPatientMessageQueueItems(
  a: Pick<FrontDeskPatientMessageQueueItem, "unreadCount" | "lastMessageAt">,
  b: Pick<FrontDeskPatientMessageQueueItem, "unreadCount" | "lastMessageAt">
): number {
  const aUnread = a.unreadCount > 0 ? 1 : 0;
  const bUnread = b.unreadCount > 0 ? 1 : 0;
  if (aUnread !== bUnread) return bUnread - aUnread;
  const aMs = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
  const bMs = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
  return (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
}

export function buildFrontDeskPatientHref(tenantId: string, patientId: string, threadId?: string): string {
  const base = `/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}`;
  if (!threadId?.trim()) return base;
  const params = new URLSearchParams({
    focus: "messages",
    thread: threadId.trim(),
  });
  return `${base}?${params.toString()}`;
}

export function filterFrontDeskPatientMessageQueueItems(
  items: readonly FrontDeskPatientMessageQueueItem[],
  filter: FrontDeskPatientMessageQueueFilter
): FrontDeskPatientMessageQueueItem[] {
  const sorted = [...items].sort(compareFrontDeskPatientMessageQueueItems);
  if (filter === "unread") return sorted.filter((i) => i.unreadCount > 0);
  return sorted;
}

export function resolveFrontDeskMessageCategory(
  value: string
): PatientGatewayMessageCategory {
  return isPatientGatewayMessageCategory(value) ? value : "general";
}

export function assertKnownGatewayCategoriesForTests(): readonly string[] {
  return PATIENT_GATEWAY_MESSAGE_CATEGORIES;
}

export function formatFrontDeskRelativeTime(
  iso: string | null,
  nowMs: number
): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const delta = Math.max(0, nowMs - ms);
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
