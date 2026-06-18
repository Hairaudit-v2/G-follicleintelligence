/**
 * ReceptionOS Phase 5 — pre-send safety rules (pure, testable).
 */

import { isReceptionCommunicationTemplateKey } from "@/src/lib/receptionOs/receptionCommunicationTemplates";

export const RECEPTION_SMS_SAFE_LENGTH = 160;

export type ReceptionCommunicationSafetyInput = {
  channel: "sms" | "email";
  templateKey: string | null;
  body: string;
  toAddress: string | null;
  leadId: string | null;
  patientId: string | null;
  allowLongSms?: boolean;
};

export type ReceptionCommunicationSafetyResult = { ok: true } | { ok: false; reason: string };

export function validateReceptionCommunicationSafety(
  input: ReceptionCommunicationSafetyInput,
): ReceptionCommunicationSafetyResult {
  const templateKey = input.templateKey?.trim() ?? "";
  if (!templateKey) return { ok: false, reason: "Template key is required." };
  if (!isReceptionCommunicationTemplateKey(templateKey)) {
    return { ok: false, reason: "Template is not available for this tenant." };
  }

  const body = input.body.trim();
  if (!body) return { ok: false, reason: "Message body is required." };

  if (!input.leadId?.trim() && !input.patientId?.trim()) {
    return { ok: false, reason: "A linked patient or lead is required before sending." };
  }

  const to = input.toAddress?.trim() ?? "";
  if (input.channel === "email" && !to) {
    return { ok: false, reason: "Email recipient is required." };
  }
  if (input.channel === "sms" && !to) {
    return { ok: false, reason: "SMS recipient is required." };
  }
  if (input.channel === "sms" && !input.allowLongSms && body.length > RECEPTION_SMS_SAFE_LENGTH) {
    return {
      ok: false,
      reason: `SMS exceeds safe length (${RECEPTION_SMS_SAFE_LENGTH} characters). Long SMS must be explicitly allowed.`,
    };
  }

  return { ok: true };
}
