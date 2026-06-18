import "server-only";

import { sendResendEmailHttp } from "@/src/lib/email/resendHttpSend.server";
import type { ReminderTemplateType } from "./reminderConstants";
import {
  buildResendFromAddress,
  isDeliveryChannelConfigured,
  type ReminderDeliveryConfig,
} from "./reminderDeliveryConfig";
import { loadReminderDeliveryConfig } from "./reminderDeliveryConfig.server";
import type { PatientReminderContact } from "./reminderPatientContact.server";

export type ReminderSendParams = {
  type: ReminderTemplateType;
  contact: PatientReminderContact;
  subject: string | null;
  body: string;
  cfg?: ReminderDeliveryConfig;
};

export type ReminderSendResult = {
  provider: "resend" | "twilio";
  externalId: string | null;
};

function requireContactForType(type: ReminderTemplateType, contact: PatientReminderContact): string {
  if (type === "email") {
    const email = contact.email?.trim();
    if (!email) throw new Error("Patient has no email on file for this reminder.");
    return email;
  }
  const phone = contact.phoneE164?.trim();
  if (!phone) throw new Error("Patient has no valid phone on file for this reminder.");
  return phone;
}

async function sendReminderEmail(params: {
  cfg: ReminderDeliveryConfig;
  to: string;
  subject: string;
  body: string;
}): Promise<ReminderSendResult> {
  const from = buildResendFromAddress(params.cfg.resend);
  if (!from) throw new Error("RESEND_FROM_EMAIL is not configured.");

  const { resendId } = await sendResendEmailHttp(
    {
      apiKey: params.cfg.resend.apiKey!,
      from,
      to: [params.to],
      subject: params.subject,
      text: params.body,
    },
    { delivery_path: "fi_reminder_jobs" }
  );

  return { provider: "resend", externalId: resendId };
}

/** Sends a one-off test email to `FI_REMINDER_TEST_EMAIL` (never the patient). Requires `FI_REMINDERS_TEST_SEND=true`. */
export async function sendTestReminderEmailToOverride(params: {
  cfg: ReminderDeliveryConfig;
  to: string;
  subject: string;
  body: string;
}): Promise<ReminderSendResult> {
  const to = params.to.trim();
  if (!to) throw new Error("Test recipient email is empty.");
  return sendReminderEmail({
    cfg: params.cfg,
    to,
    subject: params.subject.trim() || "Appointment reminder (test)",
    body: params.body,
  });
}

async function sendReminderSms(params: {
  cfg: ReminderDeliveryConfig;
  to: string;
  body: string;
}): Promise<ReminderSendResult> {
  const sid = params.cfg.twilio.accountSid!;
  const token = params.cfg.twilio.authToken!;
  const from = params.cfg.twilio.fromNumber!;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams({ To: params.to, From: from, Body: params.body });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const payload = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok) {
    const detail = payload.message?.trim() || `Twilio HTTP ${res.status}`;
    throw new Error(`SMS delivery failed: ${detail}`);
  }

  return { provider: "twilio", externalId: payload.sid?.trim() || null };
}

/** Shared Twilio SMS send used by reminders and ReceptionOS live delivery. */
export async function sendTwilioSmsViaReminderConfig(params: {
  cfg?: ReminderDeliveryConfig;
  to: string;
  body: string;
}): Promise<ReminderSendResult> {
  const cfg = params.cfg ?? loadReminderDeliveryConfig();
  if (!isDeliveryChannelConfigured(cfg, "sms")) {
    throw new Error("SMS delivery is not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).");
  }
  return sendReminderSms({ cfg, to: params.to.trim(), body: params.body.trim() });
}

/** Sends a rendered reminder via Resend (email) or Twilio (SMS). */
export async function sendReminderDelivery(params: ReminderSendParams): Promise<ReminderSendResult> {
  const cfg = params.cfg ?? loadReminderDeliveryConfig();
  if (!isDeliveryChannelConfigured(cfg, params.type)) {
    const missing =
      params.type === "email"
        ? "RESEND_API_KEY and RESEND_FROM_EMAIL"
        : "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER";
    throw new Error(`${params.type.toUpperCase()} delivery is not configured (${missing}).`);
  }

  const destination = requireContactForType(params.type, params.contact);
  const body = params.body.trim();
  if (!body) throw new Error("Reminder body is empty.");

  if (params.type === "email") {
    const subject = params.subject?.trim() || "Appointment reminder";
    return sendReminderEmail({ cfg, to: destination, subject, body });
  }

  return sendReminderSms({ cfg, to: destination, body });
}
