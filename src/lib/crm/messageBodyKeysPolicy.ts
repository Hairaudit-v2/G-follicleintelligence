/**
 * Pure policy: CRM Phase-1 messages are preview-only in Postgres.
 * Reject full-body style keys at HTTP boundaries and in `validateCrmMessagePreviewInput`.
 */

export const FORBIDDEN_MESSAGE_BODY_KEYS_LOWER = new Set([
  "body",
  "html_body",
  "text_body",
  "raw_body",
  "full_body",
  "content",
  "html",
  "text",
  "fullbody",
]);

export function assertMessagePayloadHasNoForbiddenBodyKeys(raw: Record<string, unknown>): void {
  for (const k of Object.keys(raw)) {
    if (FORBIDDEN_MESSAGE_BODY_KEYS_LOWER.has(k.toLowerCase())) {
      throw new Error(`CRM messages cannot include full-body field "${k}"; use body_preview only.`);
    }
  }
}
