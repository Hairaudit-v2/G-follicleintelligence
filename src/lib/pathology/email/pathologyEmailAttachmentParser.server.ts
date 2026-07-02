import { createHash } from "node:crypto";

import type {
  PathologyEmailNormalizedAttachment,
  PathologyEmailNormalizedPayload,
  PathologyEmailProvider,
} from "@/src/lib/pathology/email/pathologyEmailIngestionTypes";

export type ParsedPathologyEmailAttachment = {
  filename: string;
  contentType: string;
  sizeBytes: number;
  bytes: Uint8Array;
};

export type PathologyEmailAttachmentRejectReason =
  | "not_pdf"
  | "oversized"
  | "invalid_base64"
  | "empty";

export type PathologyEmailAttachmentParseResult =
  | { ok: true; attachment: ParsedPathologyEmailAttachment }
  | { ok: false; reason: PathologyEmailAttachmentRejectReason; filename: string };

const PDF_MAGIC = "%PDF";

export function isPdfBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  return head === PDF_MAGIC;
}

export function isPdfContentType(contentType: string): boolean {
  const ct = contentType.trim().toLowerCase();
  return ct === "application/pdf" || ct.endsWith("/pdf");
}

export function decodeBase64Attachment(contentBase64: string): Uint8Array | null {
  const raw = contentBase64.trim();
  if (!raw) return null;
  try {
    return new Uint8Array(Buffer.from(raw, "base64"));
  } catch {
    return null;
  }
}

export function parsePathologyEmailAttachment(
  attachment: PathologyEmailNormalizedAttachment,
  maxBytes: number
): PathologyEmailAttachmentParseResult {
  const filename = attachment.filename?.trim() || "attachment.bin";
  const contentType = attachment.contentType?.trim() || "application/octet-stream";
  const bytes = decodeBase64Attachment(attachment.contentBase64);
  if (!bytes || bytes.length === 0) {
    return { ok: false, reason: "empty", filename };
  }

  const sizeBytes = attachment.sizeBytes > 0 ? attachment.sizeBytes : bytes.length;
  if (sizeBytes > maxBytes || bytes.length > maxBytes) {
    return { ok: false, reason: "oversized", filename };
  }

  if (!isPdfContentType(contentType) && !filename.toLowerCase().endsWith(".pdf")) {
    return { ok: false, reason: "not_pdf", filename };
  }

  if (!isPdfBytes(bytes)) {
    return { ok: false, reason: "not_pdf", filename };
  }

  return {
    ok: true,
    attachment: {
      filename: filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`,
      contentType: "application/pdf",
      sizeBytes: bytes.length,
      bytes,
    },
  };
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function asAttachments(value: unknown): PathologyEmailNormalizedAttachment[] {
  if (!Array.isArray(value)) return [];
  const out: PathologyEmailNormalizedAttachment[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const contentBase64 = asString(r.contentBase64);
    if (!contentBase64) continue;
    out.push({
      filename: asString(r.filename) ?? "attachment.pdf",
      contentType: asString(r.contentType) ?? "application/pdf",
      sizeBytes: typeof r.sizeBytes === "number" && Number.isFinite(r.sizeBytes) ? r.sizeBytes : 0,
      contentBase64,
    });
  }
  return out;
}

function asHeaders(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeProvider(value: unknown): PathologyEmailProvider {
  const p = asString(value)?.toLowerCase();
  switch (p) {
    case "mailgun":
      return "mailgun";
    case "sendgrid":
      return "sendgrid";
    case "postmark":
      return "postmark";
    case "cloudflare":
      return "cloudflare";
    case "zapier":
      return "zapier";
    default:
      return "generic";
  }
}

/** Generic JSON webhook shape (also used as Zapier fallback). */
export function normalizeGenericPathologyEmailPayload(
  body: Record<string, unknown>
): PathologyEmailNormalizedPayload {
  return {
    provider: normalizeProvider(body.provider),
    providerMessageId: asString(body.providerMessageId) ?? asString(body.provider_message_id),
    fromEmail: asString(body.fromEmail) ?? asString(body.from_email) ?? asString(body.from),
    toEmails: asStringArray(body.toEmails ?? body.to_emails ?? body.to),
    subject: asString(body.subject),
    receivedAt: asString(body.receivedAt) ?? asString(body.received_at),
    headers: asHeaders(body.headers),
    attachments: asAttachments(body.attachments),
  };
}

/** Mailgun inbound webhook (simplified JSON adapter). */
export function normalizeMailgunPathologyEmailPayload(
  body: Record<string, unknown>
): PathologyEmailNormalizedPayload {
  const message = (body["message-headers"] ?? body.messageHeaders) as unknown;
  const headers = asHeaders(message);
  const attachments: PathologyEmailNormalizedAttachment[] = [];
  const count = Number(body.attachments ?? 0);
  if (Number.isFinite(count) && count > 0) {
    const files = body.files;
    if (Array.isArray(files)) {
      for (const file of files) {
        if (!file || typeof file !== "object" || Array.isArray(file)) continue;
        const f = file as Record<string, unknown>;
        const contentBase64 = asString(f.content) ?? asString(f.contentBase64);
        if (!contentBase64) continue;
        attachments.push({
          filename: asString(f.filename) ?? asString(f.name) ?? "attachment.pdf",
          contentType: asString(f.contentType) ?? asString(f["content-type"]) ?? "application/pdf",
          sizeBytes: typeof f.size === "number" ? f.size : 0,
          contentBase64,
        });
      }
    }
  }

  return {
    provider: "mailgun",
    providerMessageId: asString(body["Message-Id"]) ?? asString(body.messageId),
    fromEmail: asString(body.sender) ?? asString(body.from),
    toEmails: asStringArray(body.recipient ?? body.to),
    subject: asString(body.subject),
    receivedAt: asString(body.timestamp),
    headers,
    attachments: attachments.length ? attachments : asAttachments(body.attachments),
  };
}

/** SendGrid Inbound Parse adapter. */
export function normalizeSendGridPathologyEmailPayload(
  body: Record<string, unknown>
): PathologyEmailNormalizedPayload {
  const attachments: PathologyEmailNormalizedAttachment[] = [];
  const count = Number(body.attachments ?? 0);
  if (Number.isFinite(count) && count > 0) {
    for (let i = 1; i <= count; i++) {
      const infoKey = `attachment-info`;
      const infoRaw = body[infoKey];
      let meta: Record<string, unknown> = {};
      if (typeof infoRaw === "string") {
        try {
          const parsed = JSON.parse(infoRaw) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            meta = parsed as Record<string, unknown>;
          }
        } catch {
          meta = {};
        }
      }
      const fileKey = `attachment${i}`;
      const contentBase64 = asString(body[fileKey]);
      if (!contentBase64) continue;
      const entry = meta[fileKey] as Record<string, unknown> | undefined;
      attachments.push({
        filename: asString(entry?.filename) ?? `attachment-${i}.pdf`,
        contentType: asString(entry?.type) ?? "application/pdf",
        sizeBytes: typeof entry?.length === "number" ? Number(entry.length) : 0,
        contentBase64,
      });
    }
  }

  return {
    provider: "sendgrid",
    providerMessageId: asString(body["message-id"]) ?? asString(body.message_id),
    fromEmail: asString(body.from) ?? asString(body.envelope),
    toEmails: asStringArray(body.to),
    subject: asString(body.subject),
    receivedAt: asString(body.date),
    headers: asHeaders(body.headers),
    attachments: attachments.length ? attachments : asAttachments(body.attachments),
  };
}

/** Postmark inbound adapter. */
export function normalizePostmarkPathologyEmailPayload(
  body: Record<string, unknown>
): PathologyEmailNormalizedPayload {
  const attachments: PathologyEmailNormalizedAttachment[] = [];
  const rawAttachments = body.Attachments ?? body.attachments;
  if (Array.isArray(rawAttachments)) {
    for (const row of rawAttachments) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as Record<string, unknown>;
      const contentBase64 = asString(r.Content) ?? asString(r.contentBase64);
      if (!contentBase64) continue;
      attachments.push({
        filename: asString(r.Name) ?? asString(r.filename) ?? "attachment.pdf",
        contentType: asString(r.ContentType) ?? asString(r.contentType) ?? "application/pdf",
        sizeBytes: typeof r.ContentLength === "number" ? r.ContentLength : 0,
        contentBase64,
      });
    }
  }

  return {
    provider: "postmark",
    providerMessageId: asString(body.MessageID) ?? asString(body.messageId),
    fromEmail: asString(body.From) ?? asString(body.from),
    toEmails: asStringArray(body.To ?? body.to),
    subject: asString(body.Subject) ?? asString(body.subject),
    receivedAt: asString(body.Date) ?? asString(body.receivedAt),
    headers: asHeaders(body.Headers ?? body.headers),
    attachments,
  };
}

/** Cloudflare Email Workers JSON adapter. */
export function normalizeCloudflarePathologyEmailPayload(
  body: Record<string, unknown>
): PathologyEmailNormalizedPayload {
  return {
    provider: "cloudflare",
    providerMessageId: asString(body.messageId) ?? asString(body.id),
    fromEmail: asString(body.from),
    toEmails: asStringArray(body.to),
    subject: asString(body.subject),
    receivedAt: asString(body.receivedAt),
    headers: asHeaders(body.headers),
    attachments: asAttachments(body.attachments),
  };
}

export function normalizePathologyEmailWebhookPayload(
  body: Record<string, unknown>
): PathologyEmailNormalizedPayload {
  const hinted = normalizeProvider(body.provider);
  switch (hinted) {
    case "mailgun":
      return normalizeMailgunPathologyEmailPayload(body);
    case "sendgrid":
      return normalizeSendGridPathologyEmailPayload(body);
    case "postmark":
      return normalizePostmarkPathologyEmailPayload(body);
    case "cloudflare":
      return normalizeCloudflarePathologyEmailPayload(body);
    case "zapier":
    case "generic":
    default:
      return normalizeGenericPathologyEmailPayload(body);
  }
}

export function sha256HexBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256HexString(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
