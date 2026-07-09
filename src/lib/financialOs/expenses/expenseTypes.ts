/** FinancialOS expenses Phase 1 — shared types (no DB I/O). */

export const FI_EXPENSE_STATUSES = ["draft", "reviewed", "posted", "void"] as const;
export type FiExpenseStatus = (typeof FI_EXPENSE_STATUSES)[number];

export const FI_EXPENSE_PAYMENT_METHODS = [
  "card",
  "bank",
  "cash",
  "direct_debit",
  "other",
] as const;
export type FiExpensePaymentMethod = (typeof FI_EXPENSE_PAYMENT_METHODS)[number];

export const FI_EXPENSE_IMPORT_SOURCE_TYPES = [
  "bank_csv",
  "card_csv",
  "receipt_batch",
  "manual_bulk",
  "api",
] as const;
export type FiExpenseImportSourceType = (typeof FI_EXPENSE_IMPORT_SOURCE_TYPES)[number];

export const FI_EXPENSE_IMPORT_STATUSES = [
  "uploaded",
  "parsing",
  "ready_for_review",
  "committed",
  "failed",
  "cancelled",
] as const;
export type FiExpenseImportStatus = (typeof FI_EXPENSE_IMPORT_STATUSES)[number];

export const FI_EXPENSE_IMPORT_LINE_STATUSES = [
  "draft",
  "accepted",
  "rejected",
  "duplicate",
  "committed",
] as const;
export type FiExpenseImportLineStatus = (typeof FI_EXPENSE_IMPORT_LINE_STATUSES)[number];

export const FI_EXPENSE_DOC_KINDS = ["receipt", "invoice", "bank_csv", "other"] as const;
export type FiExpenseDocKind = (typeof FI_EXPENSE_DOC_KINDS)[number];

export const FI_EXPENSE_OCR_STATUSES = [
  "none",
  "pending",
  "processing",
  "succeeded",
  "failed",
  "skipped",
] as const;
export type FiExpenseOcrStatus = (typeof FI_EXPENSE_OCR_STATUSES)[number];

export const FI_EXPENSE_AUDIT_ACTIONS = [
  "created",
  "updated",
  "categorized",
  "reviewed",
  "posted",
  "voided",
  "import_created",
  "import_parsed",
  "import_line_updated",
  "import_committed",
  "ocr_completed",
] as const;
export type FiExpenseAuditAction = (typeof FI_EXPENSE_AUDIT_ACTIONS)[number];

export type FiExpenseCategoryRow = {
  id: string;
  tenant_id: string;
  clinic_id: string | null;
  code: string;
  label: string;
  parent_id: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FiExpenseRow = {
  id: string;
  tenant_id: string;
  clinic_id: string | null;
  status: FiExpenseStatus;
  expense_date: string;
  amount_cents: number;
  currency: string;
  vendor_name: string | null;
  description: string | null;
  category_id: string | null;
  payment_method: FiExpensePaymentMethod | null;
  source_import_line_id: string | null;
  lead_id: string | null;
  case_id: string | null;
  patient_id: string | null;
  consultation_id: string | null;
  campaign_key: string | null;
  procedure_type: string | null;
  created_by_fi_user_id: string | null;
  reviewed_by_fi_user_id: string | null;
  posted_at: string | null;
  voided_at: string | null;
  idempotency_key: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** Joined presentation fields (optional). */
  category_code?: string | null;
  category_label?: string | null;
};

export type FiExpenseImportRow = {
  id: string;
  tenant_id: string;
  clinic_id: string | null;
  source_type: FiExpenseImportSourceType;
  status: FiExpenseImportStatus;
  original_filename: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  row_count: number;
  error_summary: string | null;
  created_by_fi_user_id: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type FiExpenseImportLineRow = {
  id: string;
  tenant_id: string;
  import_id: string;
  line_index: number;
  status: FiExpenseImportLineStatus;
  transaction_date: string | null;
  description_raw: string | null;
  amount_cents: number;
  currency: string;
  external_ref: string | null;
  merchant_hint: string | null;
  category_id: string | null;
  suggested_category_id: string | null;
  confidence: number | null;
  vendor_name: string | null;
  clinic_id: string | null;
  lead_id: string | null;
  case_id: string | null;
  patient_id: string | null;
  receipt_storage_path: string | null;
  parse_warnings: unknown[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function mapExpenseCategoryRow(raw: Record<string, unknown>): FiExpenseCategoryRow {
  const metadata =
    raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    code: String(raw.code ?? ""),
    label: String(raw.label ?? ""),
    parent_id: raw.parent_id != null ? String(raw.parent_id) : null,
    is_system: Boolean(raw.is_system),
    is_active: raw.is_active !== false,
    sort_order: Number(raw.sort_order ?? 0),
    metadata,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export function mapExpenseRow(raw: Record<string, unknown>): FiExpenseRow {
  const metadata =
    raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    status: String(raw.status ?? "draft") as FiExpenseStatus,
    expense_date: String(raw.expense_date ?? "").slice(0, 10),
    amount_cents: Number(raw.amount_cents ?? 0),
    currency: String(raw.currency ?? "AUD").toUpperCase(),
    vendor_name: raw.vendor_name != null ? String(raw.vendor_name) : null,
    description: raw.description != null ? String(raw.description) : null,
    category_id: raw.category_id != null ? String(raw.category_id) : null,
    payment_method:
      raw.payment_method != null
        ? (String(raw.payment_method) as FiExpensePaymentMethod)
        : null,
    source_import_line_id:
      raw.source_import_line_id != null ? String(raw.source_import_line_id) : null,
    lead_id: raw.lead_id != null ? String(raw.lead_id) : null,
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    patient_id: raw.patient_id != null ? String(raw.patient_id) : null,
    consultation_id: raw.consultation_id != null ? String(raw.consultation_id) : null,
    campaign_key: raw.campaign_key != null ? String(raw.campaign_key) : null,
    procedure_type: raw.procedure_type != null ? String(raw.procedure_type) : null,
    created_by_fi_user_id:
      raw.created_by_fi_user_id != null ? String(raw.created_by_fi_user_id) : null,
    reviewed_by_fi_user_id:
      raw.reviewed_by_fi_user_id != null ? String(raw.reviewed_by_fi_user_id) : null,
    posted_at: raw.posted_at != null ? String(raw.posted_at) : null,
    voided_at: raw.voided_at != null ? String(raw.voided_at) : null,
    idempotency_key: raw.idempotency_key != null ? String(raw.idempotency_key) : null,
    metadata,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    category_code: raw.category_code != null ? String(raw.category_code) : null,
    category_label: raw.category_label != null ? String(raw.category_label) : null,
  };
}

export function mapExpenseImportRow(raw: Record<string, unknown>): FiExpenseImportRow {
  const metadata =
    raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    source_type: String(raw.source_type) as FiExpenseImportSourceType,
    status: String(raw.status ?? "uploaded") as FiExpenseImportStatus,
    original_filename: raw.original_filename != null ? String(raw.original_filename) : null,
    storage_bucket: raw.storage_bucket != null ? String(raw.storage_bucket) : null,
    storage_path: raw.storage_path != null ? String(raw.storage_path) : null,
    row_count: Number(raw.row_count ?? 0),
    error_summary: raw.error_summary != null ? String(raw.error_summary) : null,
    created_by_fi_user_id:
      raw.created_by_fi_user_id != null ? String(raw.created_by_fi_user_id) : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    metadata,
  };
}

export function mapExpenseImportLineRow(raw: Record<string, unknown>): FiExpenseImportLineRow {
  const metadata =
    raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};
  const warnings = Array.isArray(raw.parse_warnings) ? raw.parse_warnings : [];
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    import_id: String(raw.import_id),
    line_index: Number(raw.line_index ?? 0),
    status: String(raw.status ?? "draft") as FiExpenseImportLineStatus,
    transaction_date:
      raw.transaction_date != null ? String(raw.transaction_date).slice(0, 10) : null,
    description_raw: raw.description_raw != null ? String(raw.description_raw) : null,
    amount_cents: Number(raw.amount_cents ?? 0),
    currency: String(raw.currency ?? "AUD").toUpperCase(),
    external_ref: raw.external_ref != null ? String(raw.external_ref) : null,
    merchant_hint: raw.merchant_hint != null ? String(raw.merchant_hint) : null,
    category_id: raw.category_id != null ? String(raw.category_id) : null,
    suggested_category_id:
      raw.suggested_category_id != null ? String(raw.suggested_category_id) : null,
    confidence: raw.confidence != null ? Number(raw.confidence) : null,
    vendor_name: raw.vendor_name != null ? String(raw.vendor_name) : null,
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    lead_id: raw.lead_id != null ? String(raw.lead_id) : null,
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    patient_id: raw.patient_id != null ? String(raw.patient_id) : null,
    receipt_storage_path:
      raw.receipt_storage_path != null ? String(raw.receipt_storage_path) : null,
    parse_warnings: warnings,
    metadata,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export function assertExpensesTenantScoped(
  rows: readonly { tenant_id: string }[],
  tenantId: string
): boolean {
  const tid = tenantId.trim();
  return rows.every((r) => r.tenant_id === tid);
}
