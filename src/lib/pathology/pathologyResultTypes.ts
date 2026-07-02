export type PathologyResultSourceType = "uploaded_pdf" | "manual_entry" | "imported";

export type PathologyResultStatus = "draft" | "reviewed" | "archived";

export type PathologyResultItemFlag = "low" | "normal" | "high" | "critical" | "unknown";

export type PathologyResultRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  pathology_request_id: string | null;
  result_date: string;
  provider_name: string | null;
  source_type: PathologyResultSourceType;
  uploaded_file_bucket: string | null;
  uploaded_file_path: string | null;
  status: PathologyResultStatus;
  clinical_summary: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PathologyResultItemRow = {
  id: string;
  tenant_id: string;
  result_id: string;
  test_code: string | null;
  test_label: string;
  result_value: string;
  result_unit: string | null;
  reference_range: string | null;
  flag: PathologyResultItemFlag;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type PathologyResultDetailBundle = {
  result: PathologyResultRow;
  items: PathologyResultItemRow[];
  linkedRequest: { id: string; request_date: string; template_used: string; status: string } | null;
  reviewerDisplayName: string | null;
  /** Short-lived signed URL for the uploaded PDF, if any. */
  pdfSignedUrl: string | null;
  /** Shared HLI medical intelligence (draft/reviewed results only). */
  medicalIntelligence: import("@/src/lib/clinical-intelligence/fiPathologyMedicalIntelligenceTypes").FiMedicalIntelligenceDisplay | null;
};

export type PathologyRequestOptionRow = {
  id: string;
  request_date: string;
  template_used: string;
};
