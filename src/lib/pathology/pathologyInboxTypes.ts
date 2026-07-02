export type PathologyInboundSourceChannel = "manual_upload" | "email" | "api";

export type PathologyInboundMatchStatus = "pending" | "matched" | "rejected" | "promoted";

export type PathologyInboundExtractionStatus =
  | "not_started"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "needs_review";

export type PathologyExtractionReviewStatus = "pending_review" | "reviewed" | "dismissed";

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
  extraction_status: PathologyInboundExtractionStatus;
  extraction_job_id: string | null;
  draft_result_id: string | null;
  ready_for_review_at: string | null;
  inbound_email_message_id: string | null;
  email_from: string | null;
  email_subject: string | null;
  email_source_label: string | null;
  email_attachment_dedup_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type PathologyInboundDocumentEventType =
  | "created"
  | "match_suggested"
  | "match_confirmed"
  | "match_rejected"
  | "promoted"
  | "extraction_queued"
  | "extraction_started"
  | "extraction_succeeded"
  | "extraction_failed"
  | "draft_result_created"
  | "ready_for_review"
  | "email_received"
  | "email_attachment_accepted"
  | "email_attachment_rejected"
  | "email_duplicate_detected";

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
  started_at: string | null;
  completed_at: string | null;
  extracted_marker_count: number;
  skipped_marker_count: number;
  review_status: PathologyExtractionReviewStatus;
  raw_text_preview: string | null;
  medical_intelligence_preview_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PathologyExtractionPreviewMarker = {
  test_code: string | null;
  test_label: string;
  result_value: string;
  result_unit: string | null;
  reference_range: string | null;
  flag: string;
  confidence: number | null;
};

export type PathologyInboundDocumentListItem = PathologyInboundDocumentRow & {
  suggested_patient_name: string | null;
  confirmed_patient_name: string | null;
  extraction_job: PathologyExtractionJobRow | null;
};
