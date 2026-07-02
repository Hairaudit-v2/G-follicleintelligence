import { createHash } from "node:crypto";

import type { PathologyEmailNormalizedAttachment } from "@/src/lib/pathology/email/pathologyEmailIngestionTypes";
import { sha256HexBytes } from "@/src/lib/pathology/email/pathologyEmailAttachmentParser.server";

export function buildPathologyEmailAttachmentDedupHash(params: {
  tenantId: string;
  providerMessageId: string | null;
  filename: string;
  attachmentBytes: Uint8Array;
}): string {
  const messagePart = params.providerMessageId?.trim() || "no-provider-message-id";
  const filename = params.filename.trim().toLowerCase() || "attachment.pdf";
  const bytesHash = sha256HexBytes(params.attachmentBytes);
  const material = `${params.tenantId.trim()}|${messagePart}|${filename}|${bytesHash}`;
  return createHash("sha256").update(material, "utf8").digest("hex");
}

export function buildPathologyEmailMessageDedupHash(params: {
  tenantId: string;
  provider: string;
  providerMessageId: string | null;
  toEmail: string;
  subject: string | null;
  attachmentHashes: string[];
}): string {
  const messagePart = params.providerMessageId?.trim() || "no-provider-message-id";
  const attachmentPart = [...params.attachmentHashes].sort().join(",");
  const material = [
    params.tenantId.trim(),
    params.provider.trim(),
    messagePart,
    params.toEmail.trim().toLowerCase(),
    (params.subject ?? "").trim().toLowerCase(),
    attachmentPart,
  ].join("|");
  return createHash("sha256").update(material, "utf8").digest("hex");
}

export function buildAttachmentHashesFromNormalized(
  tenantId: string,
  providerMessageId: string | null,
  attachments: PathologyEmailNormalizedAttachment[],
  decode: (contentBase64: string) => Uint8Array | null
): string[] {
  const hashes: string[] = [];
  for (const attachment of attachments) {
    const bytes = decode(attachment.contentBase64);
    if (!bytes?.length) continue;
    hashes.push(
      buildPathologyEmailAttachmentDedupHash({
        tenantId,
        providerMessageId,
        filename: attachment.filename,
        attachmentBytes: bytes,
      })
    );
  }
  return hashes;
}
