import { FI_RESEND_PUBLIC_SEND_FAILED_MESSAGE } from "@/src/lib/email/emailDeliveryPublicMessages";
import { logStructured } from "@/src/lib/server/structuredLog";

export type ResendHttpAttachment = { filename: string; content: string };

export type ResendHttpSendInput = {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  attachments?: ResendHttpAttachment[];
};

export type ResendHttpSendLogFields = {
  tenant_id?: string | null;
  prescription_id?: string | null;
  pathology_request_id?: string | null;
  recipient_email_domain?: string | null;
  /** Short routing hint for log queries (e.g. fi_reminder_jobs, pathology_patient_pdf). */
  delivery_path?: string | null;
};

function recipientDomainFromToList(to: string[]): string | null {
  const first = to[0]?.trim();
  if (!first || !first.includes("@")) return null;
  return first.split("@")[1]?.toLowerCase() ?? null;
}

function mergeLogFields(base: ResendHttpSendLogFields): Record<string, string | number | boolean | null | undefined> {
  const out: Record<string, string | number | boolean | null | undefined> = {};
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * POST /emails on Resend. On non-2xx, emits a structured log (no API key / body secrets) and throws {@link FI_RESEND_PUBLIC_SEND_FAILED_MESSAGE}.
 * Optional `RESEND_REPLY_TO` (single address or comma-separated list) is forwarded when set.
 */
export async function sendResendEmailHttp(
  input: ResendHttpSendInput,
  logFields: ResendHttpSendLogFields = {}
): Promise<{ resendId: string | null }> {
  const replyRaw = process.env.RESEND_REPLY_TO?.trim();
  let replyTo: string | string[] | undefined;
  if (replyRaw) {
    replyTo = replyRaw.includes(",")
      ? replyRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : replyRaw;
  }

  const body: Record<string, unknown> = {
    from: input.from.trim(),
    to: input.to.map((t) => t.trim()).filter(Boolean),
    subject: input.subject.trim(),
    text: input.text,
  };
  if (input.attachments?.length) body.attachments = input.attachments;
  if (replyTo) body.reply_to = replyTo;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    name?: string;
  };

  if (!res.ok) {
    const apiMessage = payload.message?.trim() || null;
    const apiName = payload.name?.trim() || null;
    logStructured("error", "fi_resend_email_send_failed", {
      ...mergeLogFields({
        ...logFields,
        recipient_email_domain: logFields.recipient_email_domain ?? recipientDomainFromToList(input.to),
      }),
      http_status: res.status,
      resend_error_name: apiName,
      resend_error_message: apiMessage,
    });
    throw new Error(FI_RESEND_PUBLIC_SEND_FAILED_MESSAGE);
  }

  return { resendId: payload.id?.trim() || null };
}
