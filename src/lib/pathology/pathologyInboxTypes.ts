export type PathologyInboundSourceChannel = "manual_upload" | "email" | "api";

export type PathologyInboundMatchStatus = "pending" | "matched" | "rejected" | "promoted";

export type PathologyInboundDocumentRow = {
  id: string;
  tenant_id: string;
  source_channel: PathologyInboundSourceChannel;
  storage_bucket: string | null;
  storage_path: string | null;
  original_filename: string | null;
  content_type: string | null;
  match_status: PathologyInboundMatchStatus;
  suggested_patient_id: string | null;
  confirmed_patient_id: string | null;
  match_confidence: number | null;
  match_evidence: Record<string, unknown>;
  extracted_patient_name: string | null;
  extracted_dob: string | null;
  extracted_mrn: string | null;
  promoted_result_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PathologyInboundDocumentEventType =
  | "created"
  | "match_suggested"
  | "match_confirmed"
  | "match_rejected"
  | "promoted"
  | "extraction_queued";

export type PathologyInboundDocumentListItem = PathologyInboundDocumentRow & {
  suggested_patient_name: string | null;
  confirmed_patient_name: string | null;
};

export type PathologyExtractionJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "needs_review";

export type PathologyExtractionJobRow = {
  id: string;
  tenant_id: string;
  inbound_document_id: string | null;
  result_id: string | null;
  status: PathologyExtractionJobStatus;
  provider: string | null;
  raw_extraction_json: Record<string, unknown>;
  normalized_items_json: unknown[];
  error_message: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
};
