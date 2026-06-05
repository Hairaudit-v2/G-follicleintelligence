import "server-only";

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

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.cfg.resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.body,
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    const detail = payload.message?.trim() || `Resend HTTP ${res.status}`;
    throw new Error(`Email delivery failed: ${detail}`);
  }

  return { provider: "resend", externalId: payload.id?.trim() || null };
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
