import type { ReminderTemplateType } from "./reminderConstants";

export type ResendDeliveryConfig = {
  apiKey: string | null;
  fromEmail: string | null;
  fromName: string | null;
};

export type TwilioDeliveryConfig = {
  accountSid: string | null;
  authToken: string | null;
  fromNumber: string | null;
  defaultCountryCode: string | null;
};

export type ReminderDeliveryConfig = {
  resend: ResendDeliveryConfig;
  twilio: TwilioDeliveryConfig;
};

export function isEmailDeliveryConfigured(cfg: ReminderDeliveryConfig): boolean {
  return Boolean(cfg.resend.apiKey && cfg.resend.fromEmail);
}

export function isSmsDeliveryConfigured(cfg: ReminderDeliveryConfig): boolean {
  return Boolean(cfg.twilio.accountSid && cfg.twilio.authToken && cfg.twilio.fromNumber);
}

export function isDeliveryChannelConfigured(
  cfg: ReminderDeliveryConfig,
  type: ReminderTemplateType
): boolean {
  return type === "email" ? isEmailDeliveryConfigured(cfg) : isSmsDeliveryConfigured(cfg);
}

/** Formats a stored phone value for Twilio `To` (E.164 when possible). */
export function formatPhoneForTwilio(phone: string, defaultCountryCode?: string | null): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 6 ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6) return null;
  const cc = defaultCountryCode?.replace(/\D/g, "") || null;
  if (cc) {
    const national = digits.startsWith("0") ? digits.slice(1) : digits;
    return `+${cc}${national}`;
  }
  return `+${digits}`;
}

export function buildResendFromAddress(cfg: ResendDeliveryConfig): string | null {
  const email = cfg.fromEmail?.trim();
  if (!email) return null;
  const name = cfg.fromName?.trim();
  return name ? `${name} <${email}>` : email;
}

export type PatientReminderContact = {
  email: string | null;
  phone: string | null;
  phoneE164: string | null;
};

export function patientHasContactForTemplateType(
  contact: PatientReminderContact,
  type: ReminderTemplateType
): boolean {
  if (type === "email") return Boolean(contact.email?.trim());
  if (type === "sms") return Boolean(contact.phoneE164?.trim());
  return false;
}
