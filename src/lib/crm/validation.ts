/**
 * Pure validation for CRM mutation inputs (Stage 2C).
 */

import { assertMessagePayloadHasNoForbiddenBodyKeys } from "./messageBodyKeysPolicy";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isNonEmptyUuid(value: string | null | undefined): boolean {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function assertNonEmptyUuid(value: string, fieldName: string): string {
  const t = value.trim();
  if (!UUID_RE.test(t)) {
    throw new Error(`${fieldName} must be a non-empty UUID.`);
  }
  return t;
}

export type ValidatedCrmMessagePreviewInput = {
  channel: string;
  direction: "inbound" | "outbound";
  subject: string | null;
  body_preview: string | null;
  body_storage_ref: string | null;
  external_thread_id: string | null;
  external_message_id: string | null;
  sent_at: string | null;
  received_at: string | null;
  metadata: Record<string, unknown>;
};

const MAX_BODY_PREVIEW_CHARS = 512;

/**
 * Phase 1: preview/metadata only — reject obvious full-body keys and cap preview length.
 */
export function validateCrmMessagePreviewInput(
  raw: Record<string, unknown>
): ValidatedCrmMessagePreviewInput {
  assertMessagePayloadHasNoForbiddenBodyKeys(raw);

  const channel = typeof raw.channel === "string" ? raw.channel.trim() : "";
  if (!channel) throw new Error("CRM message channel is required.");

  const directionRaw = typeof raw.direction === "string" ? raw.direction.trim().toLowerCase() : "";
  if (directionRaw !== "inbound" && directionRaw !== "outbound") {
    throw new Error('CRM message direction must be "inbound" or "outbound".');
  }
  const direction = directionRaw as "inbound" | "outbound";

  const subject = typeof raw.subject === "string" ? raw.subject.trim() || null : null;

  let body_preview: string | null = null;
  if (raw.body_preview != null) {
    if (typeof raw.body_preview !== "string")
      throw new Error("body_preview must be a string when provided.");
    const t = raw.body_preview.trim();
    if (t.length > MAX_BODY_PREVIEW_CHARS) {
      throw new Error(`body_preview must be at most ${MAX_BODY_PREVIEW_CHARS} characters.`);
    }
    body_preview = t || null;
  }

  const body_storage_ref =
    typeof raw.body_storage_ref === "string" && raw.body_storage_ref.trim()
      ? raw.body_storage_ref.trim()
      : null;
  const external_thread_id =
    typeof raw.external_thread_id === "string" && raw.external_thread_id.trim()
      ? raw.external_thread_id.trim()
      : null;
  const external_message_id =
    typeof raw.external_message_id === "string" && raw.external_message_id.trim()
      ? raw.external_message_id.trim()
      : null;
  const sent_at = typeof raw.sent_at === "string" && raw.sent_at.trim() ? raw.sent_at.trim() : null;
  const received_at =
    typeof raw.received_at === "string" && raw.received_at.trim() ? raw.received_at.trim() : null;

  const metadata =
    raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};

  return {
    channel,
    direction,
    subject,
    body_preview,
    body_storage_ref,
    external_thread_id,
    external_message_id,
    sent_at,
    received_at,
    metadata,
  };
}

export function truncateCrmBodyPreview(
  text: string,
  maxChars: number = MAX_BODY_PREVIEW_CHARS
): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars);
}
