/**
 * ReceptionOS Phase 4 — communication action permissions.
 */

import type { ReceptionOsViewerRole } from "@/src/lib/receptionOs/receptionOsBoardModel";
import type { ReceptionCommunicationTemplateKey } from "@/src/lib/receptionOs/receptionCommunicationTemplates";

export const RECEPTION_COMMUNICATION_ACTIONS = [
  "send_sms",
  "send_email",
  "log_call",
  "add_note",
  "copy_payment_link",
  "preview",
] as const;

export type ReceptionCommunicationAction = (typeof RECEPTION_COMMUNICATION_ACTIONS)[number];

/** Templates consultants may send outbound. */
export const CONSULTANT_SENDABLE_TEMPLATE_KEYS: readonly ReceptionCommunicationTemplateKey[] = [
  "quote_follow_up",
  "consultation_no_show",
  "appointment_reminder",
];

/** All roles with ReceptionOS access may preview/draft. */
export function receptionCommunicationPreviewAllowed(_role: ReceptionOsViewerRole): boolean {
  return true;
}

export function receptionCommunicationManualLogAllowed(role: ReceptionOsViewerRole): boolean {
  return (
    role === "receptionist" ||
    role === "consultant" ||
    role === "clinic_manager" ||
    role === "admin"
  );
}

export function receptionCommunicationCopyPaymentLinkAllowed(role: ReceptionOsViewerRole): boolean {
  return receptionCommunicationManualLogAllowed(role);
}

export function receptionCommunicationSendAllowed(
  role: ReceptionOsViewerRole,
  templateKey: ReceptionCommunicationTemplateKey
): boolean {
  if (role === "admin" || role === "clinic_manager") return true;
  if (role === "consultant") return CONSULTANT_SENDABLE_TEMPLATE_KEYS.includes(templateKey);
  return false;
}

export function receptionCommunicationActionAllowed(
  role: ReceptionOsViewerRole,
  action: ReceptionCommunicationAction,
  templateKey?: ReceptionCommunicationTemplateKey | null
): boolean {
  switch (action) {
    case "preview":
      return receptionCommunicationPreviewAllowed(role);
    case "log_call":
    case "add_note":
      return receptionCommunicationManualLogAllowed(role);
    case "copy_payment_link":
      return receptionCommunicationCopyPaymentLinkAllowed(role);
    case "send_sms":
    case "send_email":
      if (!templateKey) return false;
      return receptionCommunicationSendAllowed(role, templateKey);
    default:
      return false;
  }
}
