export type PathologyTemplateId =
  | "hair_loss_investigation"
  | "female_hair_loss_investigation"
  | "hair_transplant_pre_op"
  | "trt_monitoring"
  | "custom_request";

export type PathologyRequestStatus = "saved" | "cancelled";

export type PathologyRequestRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  request_date: string;
  doctor_user_id: string | null;
  template_used: PathologyTemplateId;
  status: PathologyRequestStatus;
  clinical_notes: string | null;
  emailed_to_patient_at: string | null;
  cancelled_at: string | null;
  pdf_storage_bucket: string | null;
  pdf_storage_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PathologyRequestItemRow = {
  id: string;
  tenant_id: string;
  request_id: string;
  sort_order: number;
  test_code: string | null;
  test_label: string;
  created_at: string;
};

export type PathologyPdfTestLine = { code: string | null; label: string };

export type PathologyPdfBranding = {
  clinicName: string;
  accentHex: string;
  /** Optional extra lines (phone, address, web). */
  clinicLines: string[];
};

export type PathologyPdfInput = {
  branding: PathologyPdfBranding;
  patientName: string;
  dateOfBirth: string | null;
  patientEmail: string | null;
  patientPhone: string | null;
  requestDate: string;
  templateLabel: string;
  doctorDisplayName: string | null;
  clinicalNotes: string | null;
  tests: PathologyPdfTestLine[];
  requestRef: string;
};

export type PathologyRequestAuditEvent = {
  id: string;
  occurred_at: string;
  activity_kind: string;
  title: string | null;
  detail: Record<string, unknown>;
};

export type PathologyRequestDetailBundle = {
  request: PathologyRequestRow;
  items: PathologyRequestItemRow[];
  patientName: string;
  dateOfBirth: string | null;
  patientEmail: string | null;
  patientPhone: string | null;
  doctorDisplayName: string | null;
  branding: PathologyPdfBranding;
  tenantDisplayName: string;
  templateLabel: string;
};
