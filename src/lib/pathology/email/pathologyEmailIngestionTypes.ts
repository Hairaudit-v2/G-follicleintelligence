export type PathologyEmailProvider =
  | "generic"
  | "mailgun"
  | "sendgrid"
  | "postmark"
  | "cloudflare"
  | "zapier";

export type PathologyEmailInboundMessageStatus =
  | "received"
  | "processed"
  | "duplicate"
  | "rejected"
  | "failed";

export type PathologyEmailRouteStatus = "active" | "disabled";

export type PathologyEmailNormalizedAttachment = {
  filename: string;
  contentType: string;
  sizeBytes: number;
  contentBase64: string;
};

/** Provider-agnostic normalized payload consumed by ingestion orchestration. */
export type PathologyEmailNormalizedPayload = {
  provider: PathologyEmailProvider;
  providerMessageId: string | null;
  fromEmail: string | null;
  toEmails: string[];
  subject: string | null;
  receivedAt: string | null;
  headers: Record<string, unknown>;
  attachments: PathologyEmailNormalizedAttachment[];
};

export type PathologyEmailRouteRow = {
  id: string;
  tenant_id: string;
  inbound_email: string;
  route_status: PathologyEmailRouteStatus;
  source_label: string | null;
  default_source_channel: "manual_upload" | "email" | "api";
  created_at: string;
  updated_at: string;
};

export type PathologyEmailInboundMessageRow = {
  id: string;
  tenant_id: string;
  provider: string;
  provider_message_id: string | null;
  from_email: string | null;
  to_email: string;
  subject: string | null;
  received_at: string | null;
  raw_headers: Record<string, unknown>;
  attachment_count: number;
  accepted_attachment_count: number;
  rejected_attachment_count: number;
  dedup_hash: string;
  status: PathologyEmailInboundMessageStatus;
  failure_reason: string | null;
  created_inbound_document_ids: string[];
  created_at: string;
};

export type PathologyEmailIngestionResult = {
  ok: true;
  status: PathologyEmailInboundMessageStatus;
  messageId: string;
  tenantId: string;
  acceptedCount: number;
  rejectedCount: number;
  duplicate: boolean;
  createdDocumentIds: string[];
};

export type PathologyEmailIngestionError = {
  ok: false;
  httpStatus: number;
  publicMessage: string;
};
