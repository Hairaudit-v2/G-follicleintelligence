/** FinancialOS Phase 1 — master ledger transaction kinds and row shapes. */

export const FI_FINANCIAL_TRANSACTION_KINDS = [
  "invoice_created",
  "payment_received",
  "refund_processed",
  "deposit_paid",
  "balance_paid",
  "cancellation_fee",
] as const;
export type FiFinancialTransactionKind = (typeof FI_FINANCIAL_TRANSACTION_KINDS)[number];

export const FI_FINANCIAL_TRANSACTION_DIRECTIONS = ["credit", "debit"] as const;
export type FiFinancialTransactionDirection = (typeof FI_FINANCIAL_TRANSACTION_DIRECTIONS)[number];

export const FI_FINANCIAL_SOURCE_MODULES = [
  "consultation_os",
  "surgery_os",
  "leadflow",
  "revenue_os",
  "financial_os",
  "system",
] as const;
export type FiFinancialSourceModule = (typeof FI_FINANCIAL_SOURCE_MODULES)[number];

export type FiFinancialTransactionRow = {
  id: string;
  tenant_id: string;
  clinic_id: string | null;
  transaction_kind: FiFinancialTransactionKind;
  amount_cents: number;
  currency: string;
  direction: FiFinancialTransactionDirection;
  invoice_id: string | null;
  payment_id: string | null;
  payment_reconciliation_id: string | null;
  patient_id: string | null;
  lead_id: string | null;
  case_id: string | null;
  consultation_id: string | null;
  source_module: FiFinancialSourceModule;
  description: string | null;
  idempotency_key: string | null;
  metadata: Record<string, unknown>;
  created_by_fi_user_id: string | null;
  created_at: string;
};

export function mapFinancialTransactionRow(raw: Record<string, unknown>): FiFinancialTransactionRow {
  const metadata =
    raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    transaction_kind: String(raw.transaction_kind) as FiFinancialTransactionKind,
    amount_cents: Number(raw.amount_cents ?? 0),
    currency: String(raw.currency ?? "AUD").toUpperCase(),
    direction: String(raw.direction ?? "credit") as FiFinancialTransactionDirection,
    invoice_id: raw.invoice_id != null ? String(raw.invoice_id) : null,
    payment_id: raw.payment_id != null ? String(raw.payment_id) : null,
    payment_reconciliation_id:
      raw.payment_reconciliation_id != null ? String(raw.payment_reconciliation_id) : null,
    patient_id: raw.patient_id != null ? String(raw.patient_id) : null,
    lead_id: raw.lead_id != null ? String(raw.lead_id) : null,
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    consultation_id: raw.consultation_id != null ? String(raw.consultation_id) : null,
    source_module: String(raw.source_module ?? "financial_os") as FiFinancialSourceModule,
    description: raw.description != null ? String(raw.description) : null,
    idempotency_key: raw.idempotency_key != null ? String(raw.idempotency_key) : null,
    metadata,
    created_by_fi_user_id: raw.created_by_fi_user_id != null ? String(raw.created_by_fi_user_id) : null,
    created_at: String(raw.created_at ?? ""),
  };
}

export function ledgerKindForInvoice(invoiceKind: string): FiFinancialTransactionKind {
  if (invoiceKind === "surgery_deposit") return "deposit_paid";
  if (invoiceKind === "surgery_balance") return "balance_paid";
  return "payment_received";
}

export function sourceModuleForInvoice(invoice: {
  consultation_id: string | null;
  case_id: string | null;
  lead_id: string | null;
}): FiFinancialSourceModule {
  if (invoice.consultation_id) return "consultation_os";
  if (invoice.case_id) return "surgery_os";
  if (invoice.lead_id) return "leadflow";
  return "revenue_os";
}
