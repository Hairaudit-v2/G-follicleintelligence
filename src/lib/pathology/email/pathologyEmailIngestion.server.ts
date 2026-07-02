import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  decodeBase64Attachment,
  parsePathologyEmailAttachment,
} from "@/src/lib/pathology/email/pathologyEmailAttachmentParser.server";
import {
  buildPathologyEmailAttachmentDedupHash,
  buildPathologyEmailMessageDedupHash,
} from "@/src/lib/pathology/email/pathologyEmailDedup.server";
import {
  readPathologyEmailMaxAttachmentBytesFromEnv,
  type PathologyEmailIngestionEnvSlice,
} from "@/src/lib/pathology/email/pathologyEmailIngestionEnv";
import type {
  PathologyEmailInboundMessageRow,
  PathologyEmailIngestionError,
  PathologyEmailIngestionResult,
  PathologyEmailNormalizedPayload,
} from "@/src/lib/pathology/email/pathologyEmailIngestionTypes";
import {
  assertPathologyEmailSenderAllowed,
  PathologyEmailSenderNotAllowedError,
} from "@/src/lib/pathology/email/pathologyEmailIngestionSecurity.server";
import {
  PathologyEmailRouteNotFoundError,
  resolvePathologyEmailRouteFromPayload,
} from "@/src/lib/pathology/email/pathologyEmailTenantRouting.server";
import {
  appendInboundDocumentEvent,
  createInboundDocumentFromBuffer,
} from "@/src/lib/pathology/pathologyInboxMutations.server";

function mapMessageRow(row: Record<string, unknown>): PathologyEmailInboundMessageRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    provider: String(row.provider),
    provider_message_id: row.provider_message_id != null ? String(row.provider_message_id) : null,
    from_email: row.from_email != null ? String(row.from_email) : null,
    to_email: String(row.to_email),
    subject: row.subject != null ? String(row.subject) : null,
    received_at: row.received_at != null ? String(row.received_at) : null,
    raw_headers:
      row.raw_headers && typeof row.raw_headers === "object" && !Array.isArray(row.raw_headers)
        ? (row.raw_headers as Record<string, unknown>)
        : {},
    attachment_count: row.attachment_count != null ? Number(row.attachment_count) : 0,
    accepted_attachment_count:
      row.accepted_attachment_count != null ? Number(row.accepted_attachment_count) : 0,
    rejected_attachment_count:
      row.rejected_attachment_count != null ? Number(row.rejected_attachment_count) : 0,
    dedup_hash: String(row.dedup_hash),
    status: String(row.status) as PathologyEmailInboundMessageRow["status"],
    failure_reason: row.failure_reason != null ? String(row.failure_reason) : null,
    created_inbound_document_ids: Array.isArray(row.created_inbound_document_ids)
      ? row.created_inbound_document_ids.map((id) => String(id))
      : [],
    created_at: String(row.created_at),
  };
}

async function findExistingMessageByDedupHash(
  supabase: SupabaseClient,
  tenantId: string,
  dedupHash: string
): Promise<PathologyEmailInboundMessageRow | null> {
  const { data, error } = await supabase
    .from("fi_pathology_inbound_email_messages")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("dedup_hash", dedupHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapMessageRow(data as Record<string, unknown>);
}

async function findExistingDocumentIdByAttachmentDedup(
  supabase: SupabaseClient,
  tenantId: string,
  attachmentDedupHash: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_pathology_inbound_documents")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email_attachment_dedup_hash", attachmentDedupHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return String((data as { id: string }).id);
}

export async function ingestPathologyEmailWebhook(
  payload: PathologyEmailNormalizedPayload,
  env: PathologyEmailIngestionEnvSlice = process.env as PathologyEmailIngestionEnvSlice,
  client?: SupabaseClient
): Promise<PathologyEmailIngestionResult | PathologyEmailIngestionError> {
  const supabase = client ?? supabaseAdmin();
  const maxBytes = readPathologyEmailMaxAttachmentBytesFromEnv(env);

  if (!payload.toEmails.length) {
    return { ok: false, httpStatus: 400, publicMessage: "Invalid webhook payload." };
  }

  try {
    assertPathologyEmailSenderAllowed(payload.fromEmail, env);
  } catch (e) {
    if (e instanceof PathologyEmailSenderNotAllowedError) {
      return { ok: false, httpStatus: 403, publicMessage: "Forbidden." };
    }
    throw e;
  }

  let routeResult;
  try {
    routeResult = await resolvePathologyEmailRouteFromPayload(payload.toEmails, supabase);
  } catch (e) {
    if (e instanceof PathologyEmailRouteNotFoundError) {
      return { ok: false, httpStatus: 404, publicMessage: "Unknown inbound address." };
    }
    throw e;
  }

  const { route, matchedToEmail } = routeResult;
  const tenantId = route.tenant_id;

  const attachmentDedupHashes = payload.attachments.map((attachment) => {
    const bytes = decodeBase64Attachment(attachment.contentBase64) ?? new Uint8Array();
    return buildPathologyEmailAttachmentDedupHash({
      tenantId,
      providerMessageId: payload.providerMessageId,
      filename: attachment.filename,
      attachmentBytes: bytes,
    });
  });

  const messageDedupHash = buildPathologyEmailMessageDedupHash({
    tenantId,
    provider: payload.provider,
    providerMessageId: payload.providerMessageId,
    toEmail: matchedToEmail,
    subject: payload.subject,
    attachmentHashes: attachmentDedupHashes,
  });

  const existingMessage = await findExistingMessageByDedupHash(supabase, tenantId, messageDedupHash);
  if (existingMessage) {
    return {
      ok: true,
      status: "duplicate",
      messageId: existingMessage.id,
      tenantId,
      acceptedCount: existingMessage.accepted_attachment_count,
      rejectedCount: existingMessage.rejected_attachment_count,
      duplicate: true,
      createdDocumentIds: existingMessage.created_inbound_document_ids,
    };
  }

  const { data: messageInsert, error: messageInsertErr } = await supabase
    .from("fi_pathology_inbound_email_messages")
    .insert({
      tenant_id: tenantId,
      provider: payload.provider,
      provider_message_id: payload.providerMessageId,
      from_email: payload.fromEmail,
      to_email: matchedToEmail,
      subject: payload.subject,
      received_at: payload.receivedAt,
      raw_headers: payload.headers,
      attachment_count: payload.attachments.length,
      dedup_hash: messageDedupHash,
      status: "received",
    })
    .select("*")
    .single();
  if (messageInsertErr) throw new Error(messageInsertErr.message);

  const message = mapMessageRow(messageInsert as Record<string, unknown>);
  const createdDocumentIds: string[] = [];
  let acceptedCount = 0;
  let rejectedCount = 0;
  let duplicateAttachment = false;
  let emailReceivedLogged = false;

  for (const attachment of payload.attachments) {
    const parsed = parsePathologyEmailAttachment(attachment, maxBytes);
    if (!parsed.ok) {
      rejectedCount += 1;
      continue;
    }

    const attachmentDedupHash = buildPathologyEmailAttachmentDedupHash({
      tenantId,
      providerMessageId: payload.providerMessageId,
      filename: parsed.attachment.filename,
      attachmentBytes: parsed.attachment.bytes,
    });

    const existingDocId = await findExistingDocumentIdByAttachmentDedup(
      supabase,
      tenantId,
      attachmentDedupHash
    );
    if (existingDocId) {
      duplicateAttachment = true;
      await appendInboundDocumentEvent(supabase, {
        tenantId,
        inboundDocumentId: existingDocId,
        eventType: "email_duplicate_detected",
        actorUserId: null,
        detail: {
          inbound_email_message_id: message.id,
          filename: parsed.attachment.filename,
        },
      });
      continue;
    }

    const document = await createInboundDocumentFromBuffer(
      {
        tenantId,
        pdfBytes: parsed.attachment.bytes,
        originalFilename: parsed.attachment.filename,
        contentType: parsed.attachment.contentType,
        sourceChannel: route.default_source_channel,
        actingUserId: null,
        inboundEmailMessageId: message.id,
        emailFrom: payload.fromEmail,
        emailSubject: payload.subject,
        emailSourceLabel: route.source_label,
        emailAttachmentDedupHash: attachmentDedupHash,
      },
      supabase
    );

    createdDocumentIds.push(document.id);
    acceptedCount += 1;

    if (!emailReceivedLogged) {
      await appendInboundDocumentEvent(supabase, {
        tenantId,
        inboundDocumentId: document.id,
        eventType: "email_received",
        actorUserId: null,
        detail: {
          inbound_email_message_id: message.id,
          provider: payload.provider,
          from_email: payload.fromEmail,
          to_email: matchedToEmail,
          subject: payload.subject,
        },
      });
      emailReceivedLogged = true;
    }

    await appendInboundDocumentEvent(supabase, {
      tenantId,
      inboundDocumentId: document.id,
      eventType: "email_attachment_accepted",
      actorUserId: null,
      detail: {
        inbound_email_message_id: message.id,
        filename: parsed.attachment.filename,
        size_bytes: parsed.attachment.sizeBytes,
      },
    });
  }

  let finalStatus: PathologyEmailInboundMessageRow["status"] = "processed";
  let failureReason: string | null = null;

  if (acceptedCount === 0 && rejectedCount > 0) {
    finalStatus = "rejected";
    failureReason = "All attachments rejected.";
  } else if (acceptedCount === 0 && duplicateAttachment) {
    finalStatus = "duplicate";
  } else if (acceptedCount === 0) {
    finalStatus = "rejected";
    failureReason = "No attachments to process.";
  } else if (duplicateAttachment && acceptedCount === 0) {
    finalStatus = "duplicate";
  }

  const { error: updateErr } = await supabase
    .from("fi_pathology_inbound_email_messages")
    .update({
      accepted_attachment_count: acceptedCount,
      rejected_attachment_count: rejectedCount,
      created_inbound_document_ids: createdDocumentIds,
      status: finalStatus,
      failure_reason: failureReason,
    })
    .eq("tenant_id", tenantId)
    .eq("id", message.id);
  if (updateErr) throw new Error(updateErr.message);

  return {
    ok: true,
    status: finalStatus,
    messageId: message.id,
    tenantId,
    acceptedCount,
    rejectedCount,
    duplicate: finalStatus === "duplicate",
    createdDocumentIds,
  };
}
